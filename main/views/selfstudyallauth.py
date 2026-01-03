import os
import json
import logging
import random
import requests
import uuid
from django.shortcuts import render
from django.views import View
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.contrib.auth.decorators import login_required

logger = logging.getLogger(__name__)

# Get authentication token
AUTH_TOKEN = os.getenv('AUTH_TOKEN', 'Token Not Found!')
SELF_STUDY_DOMAINS = [
    'https://sfsdomains1.pythonanywhere.com',
    'https://sfsdomains2.pythonanywhere.com'
]

class DomainDiscovery:
    """Handles dynamic domain discovery for SelfStudy apps"""
    
    def __init__(self):
        self.auth_token = AUTH_TOKEN
        self.cache = {}
        
    def get_healthy_self_study_domain(self):
        """Get a working SelfStudy domain instance"""
        random.shuffle(SELF_STUDY_DOMAINS)
        
        for domain in SELF_STUDY_DOMAINS:
            try:
                url = f"{domain.rstrip('/')}/apps/"
                headers = {
                    'Authorization': f'Token {self.auth_token}',
                    'Content-Type': 'application/json'
                }
                response = requests.get(url, headers=headers, timeout=5)
                if response.status_code == 200:
                    return domain.rstrip('/')
            except requests.RequestException as e:
                logger.warning(f"Domain {domain} is unhealthy: {e}")
                continue
        return None
    
    def get_app_replicas(self, app_id):
        """Fetch replica URLs for a specific app"""
        if app_id in self.cache:
            return self.cache[app_id]
        
        healthy_domain = self.get_healthy_self_study_domain()
        if not healthy_domain:
            return []
        
        try:
            url = f"{healthy_domain}/apps/{app_id}/"
            headers = {
                'Authorization': f'Token {self.auth_token}',
                'Content-Type': 'application/json'
            }
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                app_data = response.json()
                replicas = app_data.get('replicas', [])
                replica_urls = [replica['replica_url'].rstrip('/') for replica in replicas]
                
                # Cache for 5 minutes
                self.cache[app_id] = replica_urls
                return replica_urls
        except requests.RequestException as e:
            logger.error(f"Error fetching app {app_id}: {e}")
        
        return []
    
    def get_random_healthy_replica(self, app_id):
        """Get a random healthy replica for an app"""
        replicas = self.get_app_replicas(app_id)
        if not replicas:
            return None
        
        # Try each replica to find a healthy one
        random.shuffle(replicas)
        for replica in replicas:
            try:
                # Check health endpoint
                health_url = f"{replica}/health-check/" if app_id == 15 else f"{replica}/metrics/"
                headers = {
                    'Authorization': f'Token {self.auth_token}',
                    'Content-Type': 'application/json'
                }
                response = requests.get(health_url, headers=headers, timeout=3)
                if response.status_code == 200:
                    return replica
            except requests.RequestException:
                continue
        
        # If none are healthy, just return the first one
        return replicas[0] if replicas else None


class SelfStudyAllAuthManager:
    """Manages API calls to selfstudyallauth service"""
    
    def __init__(self):
        self.domain_discovery = DomainDiscovery()
        self.auth_token = AUTH_TOKEN
        
    def get_headers(self):
        return {
            'Authorization': f'Token {self.auth_token}',
            'Content-Type': 'application/json'
        }
    
    def make_request(self, method, endpoint, data=None, params=None):
        """Make API request to selfstudyallauth service"""
        replica = self.domain_discovery.get_random_healthy_replica(15)  # App ID 15
        if not replica:
            return {'error': 'No healthy replica found', 'status_code': 503}
        
        try:
            url = f"{replica}{endpoint}"
            if method == 'GET':
                response = requests.get(url, headers=self.get_headers(), params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, headers=self.get_headers(), json=data, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, headers=self.get_headers(), json=data, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=self.get_headers(), timeout=10)
            else:
                return {'error': 'Invalid method', 'status_code': 400}
            
            return {
                'status_code': response.status_code,
                'data': response.json() if response.content else {},
                'replica': replica
            }
        except requests.RequestException as e:
            logger.error(f"API request failed: {e}")
            return {'error': str(e), 'status_code': 503}
    
    def list_tokens(self, params=None):
        """Get list of tokens"""
        return self.make_request('GET', '/api/external/tokens/', params=params)
    
    def get_token(self, token):
        """Get specific token details"""
        return self.make_request('GET', f'/api/external/tokens/{token}/')
    
    def create_token(self, data):
        """Create new token"""
        return self.make_request('POST', '/api/external/tokens/create/', data=data)
    
    def update_token(self, token, data):
        """Update existing token"""
        return self.make_request('PUT', f'/api/external/tokens/{token}/', data=data)
    
    def delete_token(self, token):
        """Delete token"""
        return self.make_request('DELETE', f'/api/external/tokens/{token}/')
    
    def search_tokens(self, data):
        """Search tokens"""
        return self.make_request('POST', '/api/external/tokens/search/', data=data)
    
    def get_stats(self, params=None):
        """Get token statistics"""
        return self.make_request('GET', '/api/external/tokens/stats/', params=params)
    
    def validate_token(self, data):
        """Validate token"""
        return self.make_request('POST', '/api/external/tokens/validate/', data=data)
    
    def bulk_operations(self, data):
        """Perform bulk operations"""
        return self.make_request('POST', '/api/external/tokens/bulk-operations/', data=data)
    
    def get_health(self):
        """Get health status"""
        return self.make_request('GET', '/api/external/health-check/')


class SelfStudyUserProfileManager:
    """Manages API calls to selfstudyuserprofile service"""
    
    def __init__(self):
        self.domain_discovery = DomainDiscovery()
        self.auth_token = AUTH_TOKEN
        
    def get_headers(self):
        return {
            'Authorization': f'Token {self.auth_token}',
            'Content-Type': 'application/json'
        }
    
    def search_users(self, query=None, username=None, email=None, limit=100):
        """Search users by various criteria"""
        replica = self.domain_discovery.get_random_healthy_replica(13)  # App ID 13
        if not replica:
            return {'error': 'No healthy replica found', 'status_code': 503, 'data': []}
        
        try:
            url = f"{replica}/profiles/"
            params = {}
            
            if query:
                params['search'] = query
            if username:
                params['username'] = username
            if email:
                params['email'] = email
            
            # Try to get all profiles first
            response = requests.get(url, headers=self.get_headers(), params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Handle different response formats
                users = []
                
                # Format 1: Django REST Framework paginated response
                if isinstance(data, dict) and 'results' in data:
                    users = data.get('results', [])
                # Format 2: Direct list response
                elif isinstance(data, list):
                    users = data
                # Format 3: Single object (might be from lookup endpoint)
                elif isinstance(data, dict) and 'user_id' in data:
                    users = [data]
                else:
                    logger.warning(f"Unexpected response format from userprofile API: {type(data)}")
                    users = []
                
                # Process users to ensure they have required fields
                processed_users = []
                for user in users:
                    # Extract user_id - handle different field names
                    user_id = user.get('user_id') or user.get('id') or user.get('uuid')
                    if not user_id:
                        continue
                    
                    processed_user = {
                        'user_id': str(user_id),
                        'username': user.get('username', ''),
                        'email': user.get('email', ''),
                        'first_name': user.get('first_name', ''),
                        'last_name': user.get('last_name', ''),
                        'image_url': user.get('image_url', ''),
                        'lab_url': user.get('lab_url', ''),
                        'is_email_verified': user.get('is_email_verified', False),
                        'gender': user.get('gender', ''),
                        'date_joined': user.get('date_joined', ''),
                        'last_updated': user.get('last_updated', ''),
                    }
                    processed_users.append(processed_user)
                
                # Apply limit after processing
                processed_users = processed_users[:limit]
                
                return {
                    'status_code': 200,
                    'data': processed_users,
                    'count': len(processed_users),
                    'replica': replica
                }
            else:
                logger.warning(f"User profile API returned {response.status_code}: {response.text[:200]}")
                return {
                    'status_code': response.status_code,
                    'error': f'HTTP {response.status_code}',
                    'data': []
                }
                
        except requests.RequestException as e:
            logger.error(f"User profile request failed: {e}")
            return {'error': str(e), 'status_code': 503, 'data': []}
    
    def get_user_by_username(self, username):
        """Get user details by username"""
        result = self.search_users(username=username, limit=1)
        if result.get('status_code') == 200 and result.get('data'):
            users = result['data']
            if users:
                return {
                    'status_code': 200,
                    'data': users[0],
                    'replica': result['replica']
                }
        
        return {'error': 'User not found', 'status_code': 404}
    
    def get_user_by_id(self, user_id):
        """Get user details by user_id"""
        replica = self.domain_discovery.get_random_healthy_replica(13)
        if not replica:
            return {'error': 'No healthy replica found', 'status_code': 503}
        
        try:
            # Try multiple endpoint formats
            endpoints = [
                f"{replica}/profiles/{user_id}/",
                f"{replica}/profiles/{user_id}/lookup/",
                f"{replica}/api/profiles/{user_id}/"
            ]
            
            for endpoint in endpoints:
                try:
                    response = requests.get(endpoint, headers=self.get_headers(), timeout=5)
                    if response.status_code == 200:
                        user_data = response.json()
                        # Process the user data to ensure consistent format
                        return {
                            'status_code': 200,
                            'data': {
                                'user_id': str(user_data.get('user_id') or user_data.get('id') or user_id),
                                'username': user_data.get('username', ''),
                                'email': user_data.get('email', ''),
                                'first_name': user_data.get('first_name', ''),
                                'last_name': user_data.get('last_name', ''),
                                'image_url': user_data.get('image_url', ''),
                                'lab_url': user_data.get('lab_url', ''),
                                'is_email_verified': user_data.get('is_email_verified', False),
                                'gender': user_data.get('gender', ''),
                                'date_joined': user_data.get('date_joined', ''),
                                'last_updated': user_data.get('last_updated', ''),
                            },
                            'replica': replica
                        }
                except requests.RequestException:
                    continue
            
            # If no endpoint worked, try searching by user_id
            result = self.search_users(query=user_id, limit=1)
            if result.get('status_code') == 200 and result.get('data'):
                users = result['data']
                if users and str(users[0].get('user_id')) == str(user_id):
                    return {
                        'status_code': 200,
                        'data': users[0],
                        'replica': result['replica']
                    }
            
            return {'error': 'User not found', 'status_code': 404}
                
        except requests.RequestException as e:
            logger.error(f"User profile request failed: {e}")
            return {'error': str(e), 'status_code': 503}


@method_decorator(login_required, name='dispatch')
class SelfStudyAllAuthView(View):
    """Main view for All Auth management"""
    
    def get(self, request):
        auth_manager = SelfStudyAllAuthManager()
        user_manager = SelfStudyUserProfileManager()
        
        # Get initial data
        tokens_response = auth_manager.list_tokens({'limit': 50})
        stats_response = auth_manager.get_stats()
        health_response = auth_manager.get_health()
        
        # Get initial users for dropdown
        users_response = user_manager.search_users(limit=50)
        
        # Process users data to ensure it has all required fields
        users = []
        if users_response.get('status_code') == 200:
            users_data = users_response.get('data', [])
            for user in users_data:
                # Ensure user has all required fields
                processed_user = {
                    'user_id': str(user.get('user_id', '')),
                    'username': user.get('username', ''),
                    'email': user.get('email', ''),
                    'first_name': user.get('first_name', ''),
                    'last_name': user.get('last_name', ''),
                    'is_email_verified': user.get('is_email_verified', False),
                    'image_url': user.get('image_url', ''),
                    'gender': user.get('gender', ''),
                }
                users.append(processed_user)
        
        context = {
            'tokens': tokens_response.get('data', {}).get('tokens', []) if tokens_response.get('status_code') == 200 else [],
            'stats': stats_response.get('data', {}) if stats_response.get('status_code') == 200 else {},
            'health': health_response.get('data', {}) if health_response.get('status_code') == 200 else {},
            'users': users,
            'total_tokens': tokens_response.get('data', {}).get('count', 0),
            'total_users': len(users),
            'replica_info': {
                'current': tokens_response.get('replica', 'Unknown'),
                'status': health_response.get('data', {}).get('status', 'unknown')
            }
        }
        
        return render(request, 'selfstudyallauth.html', context)


@method_decorator(login_required, name='dispatch')
class SelfStudyAllAuthAPIView(View):
    """API endpoints for AJAX requests"""
    
    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)
    
    def get(self, request):
        action = request.GET.get('action')
        auth_manager = SelfStudyAllAuthManager()
        user_manager = SelfStudyUserProfileManager()
        
        try:
            if action == 'list_tokens':
                params = request.GET.dict()
                response = auth_manager.list_tokens(params)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'get_token':
                token = request.GET.get('token')
                if not token:
                    return JsonResponse({'error': 'Token is required'}, status=400)
                response = auth_manager.get_token(token)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'get_stats':
                params = request.GET.dict()
                response = auth_manager.get_stats(params)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'get_health':
                response = auth_manager.get_health()
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'search_users':
                query = request.GET.get('query', '')
                username = request.GET.get('username')
                email = request.GET.get('email')
                limit = int(request.GET.get('limit', 20))
                
                response = user_manager.search_users(
                    query=query if query else None,
                    username=username if username else None,
                    email=email if email else None,
                    limit=limit
                )
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'get_user_by_username':
                username = request.GET.get('username')
                if not username:
                    return JsonResponse({'error': 'Username is required'}, status=400)
                
                response = user_manager.get_user_by_username(username)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'get_user_by_id':
                user_id = request.GET.get('user_id')
                if not user_id:
                    return JsonResponse({'error': 'User ID is required'}, status=400)
                
                # Validate UUID format
                try:
                    uuid.UUID(str(user_id))
                except ValueError:
                    return JsonResponse({'error': 'Invalid User ID format'}, status=400)
                
                response = user_manager.get_user_by_id(user_id)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'get_replicas':
                domain_discovery = DomainDiscovery()
                auth_replicas = domain_discovery.get_app_replicas(15)
                user_replicas = domain_discovery.get_app_replicas(13)
                
                return JsonResponse({
                    'auth_replicas': auth_replicas,
                    'user_replicas': user_replicas,
                    'auth_healthy': domain_discovery.get_random_healthy_replica(15),
                    'user_healthy': domain_discovery.get_random_healthy_replica(13)
                })
            
            else:
                return JsonResponse({'error': 'Invalid action'}, status=400)
                
        except Exception as e:
            logger.error(f"API error: {e}", exc_info=True)
            return JsonResponse({'error': str(e), 'details': 'Internal server error'}, status=500)
    
    def post(self, request):
        try:
            data = json.loads(request.body) if request.body else {}
            action = data.get('action')
            
            if not action:
                return JsonResponse({'error': 'Action is required'}, status=400)
            
            auth_manager = SelfStudyAllAuthManager()
            user_manager = SelfStudyUserProfileManager()
            
            if action == 'create_token':
                # Validate required fields
                if not data.get('user_id'):
                    return JsonResponse({'error': 'User ID is required'}, status=400)
                
                response = auth_manager.create_token(data)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'update_token':
                token = data.get('token')
                if not token:
                    return JsonResponse({'error': 'Token is required'}, status=400)
                
                response = auth_manager.update_token(token, data)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'search_tokens':
                response = auth_manager.search_tokens(data)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'validate_token':
                if not data.get('token'):
                    return JsonResponse({'error': 'Token is required'}, status=400)
                
                response = auth_manager.validate_token(data)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'bulk_operations':
                response = auth_manager.bulk_operations(data)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            else:
                return JsonResponse({'error': 'Invalid action'}, status=400)
                
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.error(f"API error: {e}", exc_info=True)
            return JsonResponse({'error': str(e)}, status=500)
    
    def delete(self, request):
        try:
            data = json.loads(request.body) if request.body else {}
            token = data.get('token')
            
            if not token:
                return JsonResponse({'error': 'Token is required'}, status=400)
            
            auth_manager = SelfStudyAllAuthManager()
            response = auth_manager.delete_token(token)
            
            return JsonResponse(response, status=response.get('status_code', 200))
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.error(f"Delete error: {e}", exc_info=True)
            return JsonResponse({'error': str(e)}, status=500)