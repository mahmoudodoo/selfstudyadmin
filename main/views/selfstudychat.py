import os
import json
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse
from functools import lru_cache
from typing import List, Dict, Any, Optional
from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
import requests
from collections import defaultdict

logger = logging.getLogger(__name__)

class ChatManager:
    """Centralized chat management with persistent IP blocking"""
    
    def __init__(self):
        self.auth_token = os.getenv('AUTH_TOKEN', '')
        self.headers = {'Authorization': f'Token {self.auth_token}'} if self.auth_token else {}
        self.blocked_ips_cache_key = 'global_blocked_ips'
        self.replicas_cache_key = 'chat_replicas'
        
    def get_blocked_ips(self):
        """Get all blocked IPs from cache"""
        return cache.get(self.blocked_ips_cache_key, set())
    
    def set_blocked_ip(self, ip, blocked=True):
        """Set IP blocked status in cache"""
        blocked_ips = self.get_blocked_ips()
        if blocked:
            blocked_ips.add(ip)
        else:
            blocked_ips.discard(ip)
        cache.set(self.blocked_ips_cache_key, blocked_ips, 86400)  # 24 hours
    
    def get_replicas(self):
        """Get replica URLs with fallback"""
        cached = cache.get(self.replicas_cache_key)
        if cached:
            return cached
        
        # Try to get from registry
        registries = [
            "https://sfsdomains1.pythonanywhere.com",
            "https://sfsdomains2.pythonanywhere.com"
        ]
        
        for registry in registries:
            try:
                response = requests.get(f"{registry}/apps/9/", headers=self.headers, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    replicas = [
                        r['replica_url'].rstrip('/') 
                        for r in data.get('replicas', []) 
                        if r.get('replica_url')
                    ]
                    if replicas:
                        cache.set(self.replicas_cache_key, replicas, 300)
                        return replicas
            except:
                continue
        
        # Fallback
        default_replicas = [
            "https://sfsdomains1.pythonanywhere.com",
            "https://sfsdomains2.pythonanywhere.com"
        ]
        cache.set(self.replicas_cache_key, default_replicas, 300)
        return default_replicas
    
    def fetch_rooms_from_replica(self, replica_url):
        """Fetch rooms from a single replica"""
        try:
            url = f"{replica_url}/api/all-chat-rooms/"
            response = requests.get(url, headers=self.headers, timeout=10)
            if response.status_code == 200:
                rooms = response.json()
                for room in rooms:
                    room['replica_url'] = replica_url
                    room['last_active'] = room.get('last_active', '')
                    room['country_name'] = room.get('country_name', 'Unknown')
                return rooms
        except Exception as e:
            logger.error(f"Error fetching from {replica_url}: {str(e)}")
        return []
    
    def fetch_all_rooms(self, selected_replica=None):
        """Fetch rooms from all replicas or specific one"""
        replicas = self.get_replicas()
        
        if selected_replica and selected_replica != 'all':
            if selected_replica in replicas:
                return self.fetch_rooms_from_replica(selected_replica)
            return []
        
        # Parallel fetch from all replicas
        all_rooms = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_replica = {executor.submit(self.fetch_rooms_from_replica, replica): replica 
                               for replica in replicas}
            
            for future in as_completed(future_to_replica):
                try:
                    rooms = future.result(timeout=15)
                    if rooms:
                        all_rooms.extend(rooms)
                except Exception as e:
                    replica = future_to_replica[future]
                    logger.error(f"Failed to fetch from {replica}: {str(e)}")
        
        return all_rooms
    
    def check_ip_blocked(self, ip, replica_url):
        """Check if IP is blocked on a specific replica"""
        try:
            url = f"{replica_url}/api/check-blocked-ip/{ip}/"
            response = requests.get(url, headers=self.headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                return data.get('status') == 'blocked'
        except:
            pass
        return False
    
    def sync_block_status(self, ip, replica_url, block=True):
        """Sync block status to a replica"""
        try:
            # First get room ID for this IP
            rooms_url = f"{replica_url}/api/all-chat-rooms/"
            response = requests.get(rooms_url, headers=self.headers, timeout=5)
            if response.status_code == 200:
                rooms = response.json()
                for room in rooms:
                    if room.get('anonymous_user_ip') == ip:
                        domain = urlparse(replica_url).hostname
                        endpoint = 'block-ip' if block else 'unblock-ip'
                        sync_url = f"{replica_url}/api/external/{endpoint}/{domain}/{room['id']}/"
                        
                        sync_response = requests.post(sync_url, headers=self.headers, timeout=5)
                        if sync_response.status_code == 200:
                            return True
                        break
        except Exception as e:
            logger.error(f"Error syncing to {replica_url}: {str(e)}")
        return False

chat_manager = ChatManager()

class SelfStudyChatView(View):
    template_name = 'selfstudychat.html'
    
    @method_decorator(login_required)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)
    
    def get(self, request):
        """Main chat management page"""
        start_time = time.time()
        
        try:
            # Get parameters
            filters = {
                'room_id': request.GET.get('room_id', ''),
                'ip': request.GET.get('ip', ''),
                'country': request.GET.get('country', ''),
                'message': request.GET.get('message', ''),
            }
            
            selected_replica = request.GET.get('replica', 'all')
            
            # Fetch rooms
            rooms = chat_manager.fetch_all_rooms(selected_replica)
            
            # Apply simple filters
            if filters['room_id']:
                rooms = [r for r in rooms if filters['room_id'] in str(r.get('id', ''))]
            
            if filters['ip']:
                ip_filter = filters['ip'].lower()
                rooms = [r for r in rooms if ip_filter in r.get('anonymous_user_ip', '').lower()]
            
            if filters['country']:
                rooms = [r for r in rooms if r.get('country_name', '') == filters['country']]
            
            # Get unique countries
            countries = sorted({r.get('country_name', 'Unknown') for r in rooms if r.get('country_name')})
            
            # Sort by last active
            rooms.sort(key=lambda x: x.get('last_active') or '', reverse=True)
            
            # Get replica URLs for dropdown
            replicas = chat_manager.get_replicas()
            
            # Get blocked IPs from cache
            blocked_ips = list(chat_manager.get_blocked_ips())
            
            # Mark blocked rooms
            blocked_set = set(blocked_ips)
            for room in rooms:
                room['is_blocked'] = room.get('anonymous_user_ip') in blocked_set
            
            context = {
                'chat_rooms': rooms,  # REMOVED [:100] LIMIT
                'replica_urls': replicas,
                'blocked_ips': blocked_ips,
                'unique_countries': countries,
                'total_rooms': len(rooms),
                'selected_replica': selected_replica,
                'filters': filters,
                'load_time': round(time.time() - start_time, 2),
            }
            
            return render(request, self.template_name, context)
            
        except Exception as e:
            logger.error(f"Error loading chat page: {str(e)}")
            context = {
                'chat_rooms': [],
                'replica_urls': [],
                'blocked_ips': [],
                'unique_countries': [],
                'total_rooms': 0,
                'selected_replica': 'all',
                'filters': {},
                'error': str(e),
            }
            return render(request, self.template_name, context)


class ChatRoomAPIView(View):
    """API for chat operations"""
    
    @method_decorator(csrf_exempt)
    @method_decorator(login_required)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)
    
    def post(self, request):
        """Handle POST operations"""
        try:
            data = json.loads(request.body)
            action = data.get('action')
            replica_url = data.get('replica_url')
            room_id = data.get('room_id')
            ip_address = data.get('ip_address')
            message = data.get('message')
            
            if not action or not replica_url:
                return JsonResponse({'success': False, 'error': 'Missing parameters'})
            
            # Get domain for external API calls
            domain = urlparse(replica_url).hostname
            
            if action == 'block-ip':
                if not ip_address or not room_id:
                    return JsonResponse({'success': False, 'error': 'Missing IP or room ID'})
                
                # Update cache
                chat_manager.set_blocked_ip(ip_address, True)
                
                # Sync to replica
                endpoint = f"/api/external/block-ip/{domain}/{room_id}/"
                url = replica_url + endpoint
                response = requests.post(url, headers=chat_manager.headers, timeout=10)
                
                if response.status_code == 200:
                    # Sync to other replicas in background
                    self._sync_to_all_replicas(ip_address, True)
                    return JsonResponse({'success': True, 'message': f'IP {ip_address} blocked'})
                else:
                    return JsonResponse({'success': False, 'error': 'Failed to block IP'})
            
            elif action == 'unblock-ip':
                if not ip_address or not room_id:
                    return JsonResponse({'success': False, 'error': 'Missing IP or room ID'})
                
                # Update cache
                chat_manager.set_blocked_ip(ip_address, False)
                
                # Sync to replica
                endpoint = f"/api/external/unblock-ip/{domain}/{room_id}/"
                url = replica_url + endpoint
                response = requests.post(url, headers=chat_manager.headers, timeout=10)
                
                if response.status_code == 200:
                    # Sync to other replicas in background
                    self._sync_to_all_replicas(ip_address, False)
                    return JsonResponse({'success': True, 'message': f'IP {ip_address} unblocked'})
                else:
                    return JsonResponse({'success': False, 'error': 'Failed to unblock IP'})
            
            elif action == 'delete-room':
                if not room_id:
                    return JsonResponse({'success': False, 'error': 'Missing room ID'})
                
                endpoint = f"/api/external/delete-room/{domain}/{room_id}/"
                url = replica_url + endpoint
                response = requests.delete(url, headers=chat_manager.headers, timeout=10)
                
                if response.status_code == 200:
                    return JsonResponse({'success': True, 'message': f'Room {room_id} deleted'})
                else:
                    return JsonResponse({'success': False, 'error': 'Failed to delete room'})
            
            elif action == 'send-message':
                if not room_id or not message:
                    return JsonResponse({'success': False, 'error': 'Missing room ID or message'})
                
                url = f"{replica_url}/api/all-chat-messages/{room_id}/"
                response = requests.post(url, headers=chat_manager.headers, 
                                       json={'message': message}, timeout=10)
                
                if response.status_code == 201:
                    return JsonResponse({'success': True, 'message': 'Message sent'})
                else:
                    return JsonResponse({'success': False, 'error': 'Failed to send message'})
            
            elif action == 'mark-seen':
                if not room_id:
                    return JsonResponse({'success': False, 'error': 'Missing room ID'})
                
                url = f"{replica_url}/api/all-chat-messages/{room_id}/mark-seen/"
                response = requests.post(url, headers=chat_manager.headers, timeout=10)
                
                if response.status_code == 200:
                    return JsonResponse({'success': True, 'message': 'Messages marked as seen'})
                else:
                    return JsonResponse({'success': False, 'error': 'Failed to mark messages'})
            
            elif action == 'get-messages':
                if not room_id:
                    return JsonResponse({'success': False, 'error': 'Missing room ID'})
                
                url = f"{replica_url}/api/all-chat-messages/{room_id}/"
                response = requests.get(url, headers=chat_manager.headers, timeout=10)
                
                if response.status_code == 200:
                    messages = response.json()
                    return JsonResponse({'success': True, 'messages': messages})
                else:
                    return JsonResponse({'success': False, 'error': 'Failed to get messages'})
            
            else:
                return JsonResponse({'success': False, 'error': 'Invalid action'})
                
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Invalid JSON'})
        except Exception as e:
            logger.error(f"API error: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)})
    
    def get(self, request):
        """Handle GET requests for rooms"""
        try:
            selected_replica = request.GET.get('replica', 'all')
            rooms = chat_manager.fetch_all_rooms(selected_replica)
            
            # Apply filters
            room_id_filter = request.GET.get('room_id', '')
            ip_filter = request.GET.get('ip', '')
            country_filter = request.GET.get('country', '')
            
            if room_id_filter:
                rooms = [r for r in rooms if room_id_filter in str(r.get('id', ''))]
            
            if ip_filter:
                ip_filter_lower = ip_filter.lower()
                rooms = [r for r in rooms if ip_filter_lower in r.get('anonymous_user_ip', '').lower()]
            
            if country_filter:
                rooms = [r for r in rooms if r.get('country_name', '') == country_filter]
            
            # Get blocked IPs
            blocked_ips = list(chat_manager.get_blocked_ips())
            blocked_set = set(blocked_ips)
            
            for room in rooms:
                room['is_blocked'] = room.get('anonymous_user_ip') in blocked_set
            
            # Sort
            rooms.sort(key=lambda x: x.get('last_active') or '', reverse=True)
            
            return JsonResponse({
                'success': True,
                'rooms': rooms,  # REMOVED [:100] LIMIT
                'blocked_ips': blocked_ips,
                'total': len(rooms)
            })
            
        except Exception as e:
            logger.error(f"GET error: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)})
    
    def _sync_to_all_replicas(self, ip, block):
        """Sync block status to all replicas in background"""
        def sync_task():
            replicas = chat_manager.get_replicas()
            for replica in replicas:
                chat_manager.sync_block_status(ip, replica, block)
        
        # Run in background thread
        import threading
        thread = threading.Thread(target=sync_task)
        thread.daemon = True
        thread.start()