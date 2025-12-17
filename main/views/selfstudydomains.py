import os
import random
import requests
import logging
from django.shortcuts import render, redirect
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.contrib import messages
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.conf import settings
import json

logger = logging.getLogger(__name__)

@method_decorator(login_required, name='dispatch')
class SelfStudyDomainsView(View):
    """
    Main view for SelfStudy Domains management
    """
    
    def __init__(self):
        super().__init__()
        self.AUTH_TOKEN = os.getenv('AUTH_TOKEN')
        if not self.AUTH_TOKEN:
            logger.error("AUTH_TOKEN not found in environment variables")
    
    def get(self, request):
        """Render the main domains management page"""
        context = {
            'page_title': 'Domains Management',
            'auth_token': self.AUTH_TOKEN,
        }
        return render(request, 'selfstudydomains.html', context)

    def _get_headers(self):
        """Get authentication headers"""
        return {
            'Authorization': f'Token {self.AUTH_TOKEN}',
            'Content-Type': 'application/json'
        }

    def _get_registry_domains(self):
        """Get registry domains list"""
        return [
            'https://sfsdomains1.pythonanywhere.com',
            'https://sfsdomains2.pythonanywhere.com'
        ]

    def _get_working_registry(self):
        """Get a working registry domain with fallback"""
        domains = self._get_registry_domains()
        random.shuffle(domains)  # Randomize for load balancing
        
        for domain in domains:
            try:
                # Try to get app_id=8 (selfstudydomains service)
                url = f"{domain}/apps/8/"
                response = requests.get(url, headers=self._get_headers(), timeout=5)
                if response.status_code == 200:
                    return domain, response.json()
            except requests.exceptions.RequestException as e:
                logger.warning(f"Registry domain {domain} failed: {str(e)}")
                continue
        
        # If all registries fail, try direct domain testing
        logger.warning("All registry domains failed, trying direct domains...")
        return None, None

    def _get_all_replicas(self, app_id=None):
        """Get all replicas for a specific app or all apps"""
        registry_domain, registry_data = self._get_working_registry()
        
        if not registry_domain:
            return {'error': 'No working registry found'}, None
        
        try:
            if app_id:
                # Get specific app with replicas
                url = f"{registry_domain}/apps/{app_id}/"
                response = requests.get(url, headers=self._get_headers(), timeout=10)
                if response.status_code == 200:
                    app_data = response.json()
                    return app_data, registry_domain
                else:
                    return {'error': f'Failed to fetch app {app_id}'}, registry_domain
            else:
                # Get all apps
                url = f"{registry_domain}/apps/"
                response = requests.get(url, headers=self._get_headers(), timeout=10)
                if response.status_code == 200:
                    apps_data = response.json()
                    return apps_data, registry_domain
                else:
                    return {'error': 'Failed to fetch apps'}, registry_domain
                    
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching data: {str(e)}")
            return {'error': str(e)}, registry_domain

    def post(self, request):
        """Handle AJAX requests for CRUD operations"""
        action = request.POST.get('action')
        
        if not action:
            return JsonResponse({'error': 'No action specified'}, status=400)
        
        try:
            if action == 'get_apps':
                return self._handle_get_apps(request)
            elif action == 'get_app':
                return self._handle_get_app(request)
            elif action == 'create_app':
                return self._handle_create_app(request)
            elif action == 'update_app':
                return self._handle_update_app(request)
            elif action == 'delete_app':
                return self._handle_delete_app(request)
            elif action == 'get_replicas':
                return self._handle_get_replicas(request)
            elif action == 'create_replica':
                return self._handle_create_replica(request)
            elif action == 'update_replica':
                return self._handle_update_replica(request)
            elif action == 'delete_replica':
                return self._handle_delete_replica(request)
            elif action == 'get_registry_status':
                return self._handle_registry_status(request)
            elif action == 'select_replica':
                return self._handle_select_replica(request)
            else:
                return JsonResponse({'error': 'Invalid action'}, status=400)
                
        except Exception as e:
            logger.error(f"Error in post action {action}: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def _handle_get_apps(self, request):
        """Get all apps"""
        apps_data, registry_domain = self._get_all_replicas()
        
        if 'error' in apps_data:
            return JsonResponse({'error': apps_data['error']}, status=500)
        
        # If it's a list of apps, return as is
        if isinstance(apps_data, list):
            return JsonResponse({
                'success': True,
                'apps': apps_data,
                'registry': registry_domain
            })
        
        # If it's a single app dict, wrap in list
        return JsonResponse({
            'success': True,
            'apps': [apps_data] if apps_data else [],
            'registry': registry_domain
        })

    def _handle_get_app(self, request):
        """Get specific app by ID"""
        app_id = request.POST.get('app_id')
        if not app_id:
            return JsonResponse({'error': 'App ID required'}, status=400)
        
        try:
            app_id = int(app_id)
        except ValueError:
            return JsonResponse({'error': 'Invalid App ID'}, status=400)
        
        app_data, registry_domain = self._get_all_replicas(app_id)
        
        if 'error' in app_data:
            return JsonResponse({'error': app_data['error']}, status=500)
        
        return JsonResponse({
            'success': True,
            'app': app_data,
            'registry': registry_domain
        })

    def _handle_create_app(self, request):
        """Create new app"""
        app_name = request.POST.get('app_name')
        description = request.POST.get('description')
        github_link = request.POST.get('github_link')
        
        if not app_name:
            return JsonResponse({'error': 'App name is required'}, status=400)
        
        registry_domain, _ = self._get_working_registry()
        if not registry_domain:
            return JsonResponse({'error': 'No working registry found'}, status=500)
        
        data = {
            'app_name': app_name,
            'description': description or '',
            'github_link': github_link or ''
        }
        
        try:
            url = f"{registry_domain}/apps/"
            response = requests.post(
                url,
                json=data,
                headers=self._get_headers(),
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'App created successfully',
                    'app': response.json()
                })
            else:
                return JsonResponse({
                    'error': f'Failed to create app: {response.text}'
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({'error': str(e)}, status=500)

    def _handle_update_app(self, request):
        """Update existing app"""
        app_id = request.POST.get('app_id')
        app_name = request.POST.get('app_name')
        description = request.POST.get('description')
        github_link = request.POST.get('github_link')
        
        if not app_id or not app_name:
            return JsonResponse({'error': 'App ID and name are required'}, status=400)
        
        registry_domain, _ = self._get_working_registry()
        if not registry_domain:
            return JsonResponse({'error': 'No working registry found'}, status=500)
        
        data = {
            'app_name': app_name,
            'description': description or '',
            'github_link': github_link or ''
        }
        
        try:
            url = f"{registry_domain}/apps/{app_id}/"
            response = requests.put(
                url,
                json=data,
                headers=self._get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                return JsonResponse({
                    'success': True,
                    'message': 'App updated successfully',
                    'app': response.json()
                })
            else:
                return JsonResponse({
                    'error': f'Failed to update app: {response.text}'
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({'error': str(e)}, status=500)

    def _handle_delete_app(self, request):
        """Delete app"""
        app_id = request.POST.get('app_id')
        if not app_id:
            return JsonResponse({'error': 'App ID required'}, status=400)
        
        registry_domain, _ = self._get_working_registry()
        if not registry_domain:
            return JsonResponse({'error': 'No working registry found'}, status=500)
        
        try:
            url = f"{registry_domain}/apps/{app_id}/"
            response = requests.delete(
                url,
                headers=self._get_headers(),
                timeout=10
            )
            
            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'App deleted successfully'
                })
            else:
                return JsonResponse({
                    'error': f'Failed to delete app: {response.text}'
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({'error': str(e)}, status=500)

    def _handle_get_replicas(self, request):
        """Get replicas with optional filtering"""
        app_id = request.POST.get('app_id')
        registry_domain, _ = self._get_working_registry()
        
        if not registry_domain:
            return JsonResponse({'error': 'No working registry found'}, status=500)
        
        try:
            if app_id:
                # Get replicas for specific app
                url = f"{registry_domain}/replicas/?app={app_id}"
            else:
                # Get all replicas
                url = f"{registry_domain}/replicas/"
            
            response = requests.get(url, headers=self._get_headers(), timeout=10)
            
            if response.status_code == 200:
                return JsonResponse({
                    'success': True,
                    'replicas': response.json(),
                    'registry': registry_domain
                })
            else:
                return JsonResponse({
                    'error': f'Failed to fetch replicas: {response.text}'
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({'error': str(e)}, status=500)

    def _handle_create_replica(self, request):
        """Create new replica"""
        app_id = request.POST.get('app_id')
        replica_url = request.POST.get('replica_url')
        replica_username = request.POST.get('replica_username')
        replica_password = request.POST.get('replica_password')
        admin_username = request.POST.get('admin_username')
        admin_password = request.POST.get('admin_password')
        db_host = request.POST.get('db_host')
        db_name = request.POST.get('db_name')
        db_username = request.POST.get('db_username')
        db_password = request.POST.get('db_password')
        
        # Validate required fields
        required_fields = ['app_id', 'replica_url', 'replica_username', 'replica_password',
                          'admin_username', 'admin_password', 'db_host', 'db_name',
                          'db_username', 'db_password']
        
        missing_fields = [field for field in required_fields if not request.POST.get(field)]
        if missing_fields:
            return JsonResponse({
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }, status=400)
        
        registry_domain, _ = self._get_working_registry()
        if not registry_domain:
            return JsonResponse({'error': 'No working registry found'}, status=500)
        
        data = {
            'app': int(app_id),
            'replica_url': replica_url,
            'replica_username': replica_username,
            'replica_password': replica_password,
            'admin_username': admin_username,
            'admin_password': admin_password,
            'db_host': db_host,
            'db_name': db_name,
            'db_username': db_username,
            'db_password': db_password
        }
        
        try:
            url = f"{registry_domain}/replicas/"
            response = requests.post(
                url,
                json=data,
                headers=self._get_headers(),
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Replica created successfully',
                    'replica': response.json()
                })
            else:
                return JsonResponse({
                    'error': f'Failed to create replica: {response.text}'
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({'error': str(e)}, status=500)

    def _handle_update_replica(self, request):
        """Update existing replica"""
        replica_id = request.POST.get('replica_id')
        if not replica_id:
            return JsonResponse({'error': 'Replica ID required'}, status=400)
        
        # Build data from POST, only include provided fields
        data = {}
        fields = ['replica_url', 'replica_username', 'replica_password',
                 'admin_username', 'admin_password', 'db_host', 'db_name',
                 'db_username', 'db_password', 'app']
        
        for field in fields:
            value = request.POST.get(field)
            if value is not None:
                if field == 'app' and value:
                    data[field] = int(value)
                else:
                    data[field] = value
        
        if not data:
            return JsonResponse({'error': 'No fields to update'}, status=400)
        
        registry_domain, _ = self._get_working_registry()
        if not registry_domain:
            return JsonResponse({'error': 'No working registry found'}, status=500)
        
        try:
            url = f"{registry_domain}/replicas/{replica_id}/"
            response = requests.put(
                url,
                json=data,
                headers=self._get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                return JsonResponse({
                    'success': True,
                    'message': 'Replica updated successfully',
                    'replica': response.json()
                })
            else:
                return JsonResponse({
                    'error': f'Failed to update replica: {response.text}'
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({'error': str(e)}, status=500)

    def _handle_delete_replica(self, request):
        """Delete replica"""
        replica_id = request.POST.get('replica_id')
        if not replica_id:
            return JsonResponse({'error': 'Replica ID required'}, status=400)
        
        registry_domain, _ = self._get_working_registry()
        if not registry_domain:
            return JsonResponse({'error': 'No working registry found'}, status=500)
        
        try:
            url = f"{registry_domain}/replicas/{replica_id}/"
            response = requests.delete(
                url,
                headers=self._get_headers(),
                timeout=10
            )
            
            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'Replica deleted successfully'
                })
            else:
                return JsonResponse({
                    'error': f'Failed to delete replica: {response.text}'
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({'error': str(e)}, status=500)

    def _handle_registry_status(self, request):
        """Get registry health status"""
        domains = self._get_registry_domains()
        status_data = []
        
        for domain in domains:
            try:
                url = f"{domain}/apps/8/"
                response = requests.get(url, headers=self._get_headers(), timeout=5)
                status_data.append({
                    'domain': domain,
                    'status': 'online' if response.status_code == 200 else 'error',
                    'status_code': response.status_code
                })
            except requests.exceptions.RequestException as e:
                status_data.append({
                    'domain': domain,
                    'status': 'offline',
                    'error': str(e)
                })
        
        working_domain, _ = self._get_working_registry()
        
        return JsonResponse({
            'success': True,
            'registries': status_data,
            'working_registry': working_domain
        })

    def _handle_select_replica(self, request):
        """Select a random replica for load balancing"""
        app_id = request.POST.get('app_id')
        if not app_id:
            return JsonResponse({'error': 'App ID required'}, status=400)
        
        app_data, registry_domain = self._get_all_replicas(int(app_id))
        
        if 'error' in app_data:
            return JsonResponse({'error': app_data['error']}, status=500)
        
        replicas = app_data.get('replicas', [])
        if not replicas:
            return JsonResponse({'error': 'No replicas available for this app'}, status=404)
        
        # Select random replica
        selected_replica = random.choice(replicas)
        
        return JsonResponse({
            'success': True,
            'selected_replica': selected_replica,
            'replica_count': len(replicas),
            'registry': registry_domain
        })


@method_decorator(csrf_exempt, name='dispatch')
class SelfStudyDomainsAPIView(View):
    """
    API endpoint for SelfStudy Domains
    """
    
    def __init__(self):
        super().__init__()
        self.AUTH_TOKEN = os.getenv('AUTH_TOKEN')
    
    def get(self, request):
        """API endpoint to get domains and replicas"""
        action = request.GET.get('action', 'get_apps')
        app_id = request.GET.get('app_id')
        
        view = SelfStudyDomainsView()
        
        # Simulate POST data for the view methods
        if action == 'get_apps':
            return view._handle_get_apps(request)
        elif action == 'get_app' and app_id:
            request.POST = {'app_id': app_id}
            return view._handle_get_app(request)
        elif action == 'get_replicas':
            request.POST = {'app_id': app_id} if app_id else {}
            return view._handle_get_replicas(request)
        elif action == 'registry_status':
            return view._handle_registry_status(request)
        else:
            return JsonResponse({'error': 'Invalid action'}, status=400)