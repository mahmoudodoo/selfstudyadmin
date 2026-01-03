import os
import json
import logging
import random
import requests
from django.shortcuts import render
from django.views import View
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator

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
                health_url = f"{replica}/health-check/"
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
    
    def get_user_by_username(self, username):
        """Get user details by username"""
        replica = self.domain_discovery.get_random_healthy_replica(13)  # App ID 13
        if not replica:
            return {'error': 'No healthy replica found', 'status_code': 503}
        
        try:
            # First, search for the user profile
            url = f"{replica}/profiles/"
            params = {'username': username}
            response = requests.get(url, headers=self.get_headers(), params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('count', 0) > 0:
                    return {
                        'status_code': 200,
                        'data': data['results'][0],
                        'replica': replica
                    }
            
            # Try alternative endpoints
            alt_url = f"{replica}/check-username/{username}/"
            response = requests.get(alt_url, headers=self.get_headers(), timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if not data.get('available', True):  # User exists
                    return {
                        'status_code': 200,
                        'data': data.get('user', {}),
                        'replica': replica
                    }
            
            return {'error': 'User not found', 'status_code': 404}
            
        except requests.RequestException as e:
            logger.error(f"User profile request failed: {e}")
            return {'error': str(e), 'status_code': 503}
    
    def search_users(self, query):
        """Search users by username or email"""
        replica = self.domain_discovery.get_random_healthy_replica(13)
        if not replica:
            return {'error': 'No healthy replica found', 'status_code': 503}
        
        try:
            url = f"{replica}/profiles/"
            params = {'search': query}
            response = requests.get(url, headers=self.get_headers(), params=params, timeout=10)
            
            return {
                'status_code': response.status_code,
                'data': response.json() if response.content else {},
                'replica': replica
            }
        except requests.RequestException as e:
            logger.error(f"User search failed: {e}")
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
        
        context = {
            'tokens': tokens_response.get('data', {}).get('tokens', []) if tokens_response.get('status_code') == 200 else [],
            'stats': stats_response.get('data', {}) if stats_response.get('status_code') == 200 else {},
            'health': health_response.get('data', {}) if health_response.get('status_code') == 200 else {},
            'total_tokens': tokens_response.get('data', {}).get('count', 0),
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
                response = auth_manager.get_token(token)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'get_stats':
                params = request.GET.dict()
                response = auth_manager.get_stats(params)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'get_health':
                response = auth_manager.get_health()
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'search_user':
                username = request.GET.get('username')
                response = user_manager.get_user_by_username(username)
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
            logger.error(f"API error: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    def post(self, request):
        action = request.POST.get('action')
        auth_manager = SelfStudyAllAuthManager()
        
        try:
            data = json.loads(request.body) if request.body else {}
            
            if action == 'create_token':
                response = auth_manager.create_token(data)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'update_token':
                token = data.get('token')
                if not token:
                    return JsonResponse({'error': 'Token required'}, status=400)
                response = auth_manager.update_token(token, data)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'search_tokens':
                response = auth_manager.search_tokens(data)
                return JsonResponse(response, status=response.get('status_code', 200))
            
            elif action == 'validate_token':
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
            logger.error(f"API error: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    def delete(self, request):
        try:
            data = json.loads(request.body) if request.body else {}
            token = data.get('token')
            
            if not token:
                return JsonResponse({'error': 'Token required'}, status=400)
            
            auth_manager = SelfStudyAllAuthManager()
            response = auth_manager.delete_token(token)
            
            return JsonResponse(response, status=response.get('status_code', 200))
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.error(f"Delete error: {e}")
            return JsonResponse({'error': str(e)}, status=500)