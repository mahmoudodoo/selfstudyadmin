import os
import json
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse
from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
import requests
from functools import lru_cache

logger = logging.getLogger(__name__)


class ChatBaseMixin:
    """Base mixin with shared methods for chat operations"""
    
    @property
    def headers(self):
        """Get headers with auth token"""
        token = os.getenv('AUTH_TOKEN', '')
        return {'Authorization': f'Token {token}'} if token else {}
    
    def get_registry_instances(self):
        """Return primary and fallback registry instances"""
        return [
            "https://sfsdomains1.pythonanywhere.com",
            "https://sfsdomains2.pythonanywhere.com"
        ]
    
    @lru_cache(maxsize=128)
    def fetch_app_details(self, registry_url):
        """Cache registry details"""
        try:
            app_id = 9  # selfstudychat app ID
            url = f"{registry_url}/apps/{app_id}/"
            response = requests.get(url, headers=self.headers, timeout=5)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.error(f"Error fetching from {registry_url}: {str(e)}")
        return None
    
    def get_replica_urls(self):
        """Get replica URLs from registry instances with cache"""
        cache_key = 'chat_replica_urls'
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        registry_instances = self.get_registry_instances()
        
        for registry_url in registry_instances:
            try:
                app_data = self.fetch_app_details(registry_url)
                if app_data and 'replicas' in app_data:
                    replica_urls = [
                        replica['replica_url'].rstrip('/')
                        for replica in app_data['replicas']
                        if replica.get('replica_url')
                    ]
                    if replica_urls:
                        # Cache for 5 minutes
                        cache.set(cache_key, replica_urls, 300)
                        return replica_urls
            except Exception as e:
                logger.error(f"Registry {registry_url} failed: {str(e)}")
                continue
        
        # Fallback to default replicas if registry fails
        logger.warning("All registry instances failed, using default replicas")
        default_replicas = getattr(settings, 'DEFAULT_REPLICA_URLS', [])
        cache.set(cache_key, default_replicas, 300)
        return default_replicas
    
    def make_request(self, method, url, data=None, timeout=10):
        """Make HTTP request with better error handling"""
        try:
            if method == 'GET':
                return requests.get(url, headers=self.headers, timeout=timeout)
            elif method == 'POST':
                return requests.post(url, json=data, headers=self.headers, timeout=timeout)
            elif method == 'DELETE':
                return requests.delete(url, headers=self.headers, timeout=timeout)
        except Exception as e:
            logger.error(f"Request failed to {url}: {str(e)}")
            return None
    
    def get_rooms_from_replica(self, replica_url):
        """Get rooms from a single replica"""
        cache_key = f'chat_rooms_{replica_url}'
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        url = f"{replica_url}/api/all-chat-rooms/"
        response = self.make_request('GET', url, timeout=10)
        
        if response and response.status_code == 200:
            rooms = response.json()
            # Add replica source to each room
            for room in rooms:
                room['replica_url'] = replica_url
            # Cache for 30 seconds
            cache.set(cache_key, rooms, 30)
            return rooms
        
        return []
    
    def get_all_rooms_parallel(self, replica_urls):
        """Get rooms from all replicas in parallel"""
        all_rooms = []
        
        def fetch_replica_rooms(replica_url):
            try:
                url = f"{replica_url}/api/all-chat-rooms/"
                response = requests.get(url, headers=self.headers, timeout=10)
                if response.status_code == 200:
                    rooms = response.json()
                    for room in rooms:
                        room['replica_url'] = replica_url
                    return rooms
            except Exception as e:
                logger.error(f"Failed to get rooms from {replica_url}: {str(e)}")
            return []
        
        # Use ThreadPoolExecutor for parallel requests
        with ThreadPoolExecutor(max_workers=min(len(replica_urls), 5)) as executor:
            future_to_url = {executor.submit(fetch_replica_rooms, url): url for url in replica_urls}
            
            for future in as_completed(future_to_url):
                try:
                    rooms = future.result(timeout=15)
                    all_rooms.extend(rooms)
                except Exception as e:
                    replica_url = future_to_url[future]
                    logger.error(f"Error fetching from {replica_url}: {str(e)}")
        
        return all_rooms
    
    def apply_filters(self, rooms, filters):
        """Apply filters to rooms efficiently"""
        if not filters or not rooms:
            return rooms
        
        filtered = rooms
        
        # Room ID filter
        if filters.get('room_id'):
            room_id_filter = filters['room_id']
            filtered = [r for r in filtered if str(r.get('id', '')).startswith(room_id_filter)]
        
        # IP filter
        if filters.get('ip'):
            ip_filter = filters['ip'].lower()
            filtered = [r for r in filtered if ip_filter in r.get('anonymous_user_ip', '').lower()]
        
        # Country filter
        if filters.get('country'):
            country_filter = filters['country'].lower()
            filtered = [r for r in filtered if country_filter in r.get('country_name', '').lower()]
        
        return filtered


class SelfStudyChatView(ChatBaseMixin, View):
    template_name = 'selfstudychat.html'
    
    @method_decorator(login_required)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)
    
    def get(self, request):
        """Render the main chat management page - Optimized version"""
        start_time = time.time()
        
        try:
            # Get replica URLs
            replica_urls = self.get_replica_urls()
            
            if not replica_urls:
                logger.error("No replica URLs found")
                return render(request, self.template_name, {
                    'chat_rooms': [],
                    'replica_urls': [],
                    'blocked_ips': [],
                    'unique_countries': [],
                    'total_rooms': 0,
                    'selected_replica': 'all',
                    'filters': {},
                })
            
            # Get filter parameters
            filters = {
                'room_id': request.GET.get('room_id', ''),
                'ip': request.GET.get('ip', ''),
                'country': request.GET.get('country', ''),
                'message': request.GET.get('message', ''),
            }
            
            selected_replica = request.GET.get('replica', 'all')
            
            # Get rooms in parallel
            if selected_replica != 'all' and selected_replica in replica_urls:
                # Get from single replica
                rooms = self.get_rooms_from_replica(selected_replica)
                rooms = self.apply_filters(rooms, filters)
                unique_countries = self._get_unique_countries(rooms)
            else:
                # Get from all replicas in parallel
                rooms = self.get_all_rooms_parallel(replica_urls)
                rooms = self.apply_filters(rooms, filters)
                unique_countries = self._get_unique_countries(rooms)
            
            # Apply message filter if specified
            if filters.get('message') and rooms:
                rooms = self._apply_message_filter(rooms, filters['message'].lower())
            
            # Get blocked IPs
            blocked_ips = self._get_blocked_ips_from_rooms(rooms, replica_urls)
            
            # Sort by last active (newest first)
            rooms.sort(key=lambda x: x.get('last_active') or '', reverse=True)
            
            logger.info(f"Page loaded in {time.time() - start_time:.2f} seconds with {len(rooms)} rooms")
            
            context = {
                'chat_rooms': rooms[:100],  # Limit to 100 rooms for performance
                'replica_urls': replica_urls,
                'blocked_ips': blocked_ips,
                'unique_countries': unique_countries,
                'total_rooms': len(rooms),
                'selected_replica': selected_replica,
                'filters': filters,
            }
            
            return render(request, self.template_name, context)
            
        except Exception as e:
            logger.error(f"Error loading chat page: {str(e)}", exc_info=True)
            return render(request, self.template_name, {
                'chat_rooms': [],
                'replica_urls': [],
                'blocked_ips': [],
                'unique_countries': [],
                'total_rooms': 0,
                'selected_replica': 'all',
                'filters': {},
                'error': str(e),
            })
    
    def _get_unique_countries(self, rooms):
        """Get unique countries from rooms"""
        countries = set()
        for room in rooms:
            country = room.get('country_name')
            if country and country != 'Unknown':
                countries.add(country)
        return sorted(list(countries))
    
    def _apply_message_filter(self, rooms, message_filter):
        """Apply message filter using parallel requests"""
        if not message_filter or not rooms:
            return rooms
        
        filtered_rooms = []
        
        def check_room_messages(room):
            try:
                replica_url = room.get('replica_url')
                room_id = room.get('id')
                if not replica_url or not room_id:
                    return False
                
                url = f"{replica_url}/api/all-chat-messages/{room_id}/"
                response = requests.get(url, headers=self.headers, timeout=5)
                
                if response.status_code == 200:
                    messages = response.json()
                    return any(message_filter in str(msg.get('message', '')).lower() 
                              for msg in messages)
            except:
                pass
            return False
        
        # Check rooms in parallel
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_room = {executor.submit(check_room_messages, room): room for room in rooms[:50]}  # Limit to 50 rooms
            
            for future in as_completed(future_to_room):
                room = future_to_room[future]
                try:
                    if future.result(timeout=10):
                        filtered_rooms.append(room)
                except:
                    pass
        
        return filtered_rooms
    
    def _get_blocked_ips_from_rooms(self, rooms, replica_urls):
        """Get blocked IPs from rooms"""
        blocked_ips = set()
        
        # Extract unique IPs from rooms
        unique_ips = {room.get('anonymous_user_ip') for room in rooms if room.get('anonymous_user_ip')}
        
        # Check each IP in parallel
        def check_ip_blocked(ip):
            for replica_url in replica_urls[:2]:  # Check first 2 replicas only
                try:
                    url = f"{replica_url}/api/check-blocked-ip/{ip}/"
                    response = requests.get(url, headers=self.headers, timeout=5)
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('status') == 'blocked':
                            return ip
                except:
                    continue
            return None
        
        # Check IPs in parallel
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_ip = {executor.submit(check_ip_blocked, ip): ip for ip in list(unique_ips)[:50]}  # Limit to 50 IPs
            
            for future in as_completed(future_to_ip):
                try:
                    blocked_ip = future.result(timeout=10)
                    if blocked_ip:
                        blocked_ips.add(blocked_ip)
                except:
                    pass
        
        return list(blocked_ips)


class ChatRoomAPIView(ChatBaseMixin, View):
    """API endpoints for chat room operations"""
    
    @method_decorator(csrf_exempt)
    @method_decorator(login_required)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)
    
    def post(self, request, action=None):
        """Handle POST requests for chat operations"""
        try:
            data = json.loads(request.body)
            replica_url = data.get('replica_url')
            room_id = data.get('room_id')
            
            if not replica_url or not room_id:
                return JsonResponse({
                    'success': False,
                    'error': 'Missing required parameters'
                }, status=400)
            
            # Clear cache for this replica
            cache_key = f'chat_rooms_{replica_url}'
            cache.delete(cache_key)
            
            # Get domain from replica URL
            parsed_url = urlparse(replica_url)
            domain = parsed_url.netloc
            
            # Map actions to endpoints
            endpoints = {
                'block-ip': f'/api/external/block-ip/{domain}/{room_id}/',
                'unblock-ip': f'/api/external/unblock-ip/{domain}/{room_id}/',
                'delete-room': f'/api/external/delete-room/{domain}/{room_id}/',
                'mark-seen': f'/api/all-chat-messages/{room_id}/mark-seen/',
                'send-message': f'/api/all-chat-messages/{room_id}/',
            }
            
            if action not in endpoints:
                return JsonResponse({
                    'success': False,
                    'error': 'Invalid action'
                }, status=400)
            
            url = f"{replica_url}{endpoints[action]}"
            
            # Prepare request
            method = 'DELETE' if action == 'delete-room' else 'POST'
            request_data = None
            if action == 'send-message':
                message = data.get('message')
                if not message:
                    return JsonResponse({
                        'success': False,
                        'error': 'Message is required'
                    }, status=400)
                request_data = {'message': message}
            
            # Make request
            response = self.make_request(method, url, request_data)
            
            if response and response.status_code in [200, 201]:
                response_data = response.json()
                return JsonResponse({
                    'success': True,
                    'message': response_data.get('success') or 
                               response_data.get('message') or 
                               'Operation completed'
                })
            else:
                error_msg = 'Operation failed'
                if response:
                    try:
                        error_data = response.json()
                        error_msg = error_data.get('error', error_msg)
                    except:
                        error_msg = f'HTTP {response.status_code}'
                return JsonResponse({
                    'success': False,
                    'error': error_msg
                }, status=500)
                
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON data'
            }, status=400)
        except Exception as e:
            logger.error(f"Error in ChatRoomAPIView: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)
    
    def get(self, request, room_id=None, action=None):
        """Handle GET requests"""
        try:
            if room_id and action == 'messages':
                # Get messages for specific room
                replica_url = request.GET.get('replica_url')
                if not replica_url:
                    return JsonResponse({
                        'success': False,
                        'error': 'replica_url parameter is required'
                    }, status=400)
                
                url = f"{replica_url}/api/all-chat-messages/{room_id}/"
                response = self.make_request('GET', url)
                
                if response and response.status_code == 200:
                    messages = response.json()
                    return JsonResponse({
                        'success': True,
                        'messages': messages
                    })
                else:
                    error_msg = 'Failed to fetch messages'
                    if response:
                        error_msg = f'HTTP {response.status_code}'
                    return JsonResponse({
                        'success': False,
                        'error': error_msg
                    }, status=500)
            
            else:
                # Get all rooms
                start_time = time.time()
                replica_urls = self.get_replica_urls()
                selected_replica = request.GET.get('replica', 'all')
                
                if selected_replica != 'all' and selected_replica in replica_urls:
                    rooms = self.get_rooms_from_replica(selected_replica)
                else:
                    rooms = self.get_all_rooms_parallel(replica_urls)
                
                # Apply filters
                filters = request.GET.dict()
                if filters:
                    rooms = self.apply_filters(rooms, filters)
                
                # Apply message filter if specified
                if filters.get('message') and rooms:
                    message_filter = filters['message'].lower()
                    filtered_rooms = []
                    
                    # Simple sequential check for messages (faster for small sets)
                    for room in rooms[:50]:  # Limit to 50 rooms
                        try:
                            replica_url = room.get('replica_url')
                            room_id = room.get('id')
                            if replica_url and room_id:
                                url = f"{replica_url}/api/all-chat-messages/{room_id}/"
                                response = requests.get(url, headers=self.headers, timeout=5)
                                if response.status_code == 200:
                                    messages = response.json()
                                    if any(message_filter in str(msg.get('message', '')).lower() 
                                           for msg in messages):
                                        filtered_rooms.append(room)
                        except:
                            continue
                    
                    rooms = filtered_rooms
                
                # Sort by last active
                rooms.sort(key=lambda x: x.get('last_active') or '', reverse=True)
                
                logger.info(f"API loaded {len(rooms)} rooms in {time.time() - start_time:.2f}s")
                
                return JsonResponse({
                    'success': True,
                    'chat_rooms': rooms[:100],  # Limit to 100 rooms
                    'total_count': len(rooms)
                })
                
        except Exception as e:
            logger.error(f"Error in GET ChatRoomAPIView: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)