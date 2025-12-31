from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import requests
import json
import random
import time
import os
from datetime import datetime
from urllib.parse import urljoin

class SelfStudyProctorView(View):
    """Main view for proctor management"""
    
    @method_decorator(login_required)
    def get(self, request):
        return render(request, 'selfstudyproctor.html')

class SelfStudyProctorAPIView(View):
    """API view for handling proctor operations"""
    
    # SelfStudy Domains registry instances
    SELFSTUDY_DOMAINS_REGISTRIES = [
        "https://sfsdomains1.pythonanywhere.com",
        "https://sfsdomains2.pythonanywhere.com"
    ]
    
    # Cache for domains
    DOMAINS_CACHE = {}
    CACHE_TIMESTAMP = {}
    CACHE_TTL = 300  # 5 minutes
    
    def __init__(self):
        super().__init__()
        self.auth_token = os.getenv('AUTH_TOKEN')
    
    def get_selfstudy_domains_registry(self):
        """Get a working SelfStudy Domains registry instance"""
        registries = self.SELFSTUDY_DOMAINS_REGISTRIES.copy()
        random.shuffle(registries)
        
        for registry in registries:
            try:
                response = requests.get(f"{registry}/health/", timeout=5)
                if response.status_code == 200:
                    return registry
            except requests.exceptions.RequestException:
                continue
        
        return self.SELFSTUDY_DOMAINS_REGISTRIES[0] if self.SELFSTUDY_DOMAINS_REGISTRIES else None
    
    def fetch_app_replicas(self, app_id):
        """Fetch replicas for a specific app ID"""
        registry_url = self.get_selfstudy_domains_registry()
        if not registry_url or not self.auth_token:
            print(f"Registry unavailable or AUTH_TOKEN not configured for app_id={app_id}")
            return []
        
        try:
            headers = {
                'Authorization': f'Token {self.auth_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(
                f"{registry_url}/apps/{app_id}/",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                app_data = response.json()
                replica_urls = [replica['replica_url'].rstrip('/') 
                              for replica in app_data.get('replicas', [])]
                return replica_urls
            else:
                print(f"Failed to fetch app {app_id}: {response.status_code}")
                return []
                
        except requests.exceptions.RequestException as e:
            print(f"Error fetching app {app_id}: {str(e)}")
            return []
    
    def get_replicas(self, app_id):
        """Get cached replicas or fetch fresh ones"""
        current_time = time.time()
        
        if (app_id in self.DOMAINS_CACHE and 
            app_id in self.CACHE_TIMESTAMP and
            (current_time - self.CACHE_TIMESTAMP[app_id]) < self.CACHE_TTL):
            return self.DOMAINS_CACHE[app_id]
        
        replicas = self.fetch_app_replicas(app_id)
        self.DOMAINS_CACHE[app_id] = replicas
        self.CACHE_TIMESTAMP[app_id] = current_time
        
        return replicas
    
    def select_replica(self, replicas):
        """Select a random replica for load balancing"""
        if not replicas:
            return None
        return random.choice(replicas)
    
    def make_request_to_replica(self, method, replica_url, endpoint, data=None, timeout=10):
        """Make authenticated request to a replica"""
        if not self.auth_token:
            return None
        
        headers = {
            'Authorization': f'Token {self.auth_token}',
            'Content-Type': 'application/json'
        }
        
        # Construct the full URL
        if endpoint:
            url = urljoin(f"{replica_url}/", endpoint.lstrip('/'))
        else:
            url = replica_url
        
        print(f"🔍 Making {method} request to: {url}")
        if data:
            print(f"🔍 Request data: {data}")
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=timeout)
            elif method.upper() == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=timeout)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)
            else:
                return None
            
            print(f"🔍 Response status: {response.status_code}")
            if response.status_code not in [200, 201, 204]:
                print(f"🔍 Response error: {response.text}")
            
            return response
            
        except requests.exceptions.RequestException as e:
            print(f"Request error to {url}: {str(e)}")
            return None
    
    def try_all_replicas(self, method, replicas, endpoint, data=None, timeout=10):
        """Try request on multiple replicas until success"""
        shuffled_replicas = replicas.copy()
        random.shuffle(shuffled_replicas)
        
        for replica in shuffled_replicas:
            print(f"🔍 Trying replica: {replica}")
            response = self.make_request_to_replica(method, replica, endpoint, data, timeout)
            if response and response.status_code in [200, 201, 204]:
                print(f"✅ Success from replica: {replica}")
                return response
        
        # If all fail, try the first one again for error message
        if replicas:
            response = self.make_request_to_replica(method, replicas[0], endpoint, data, timeout)
            return response
        
        return None
    
    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)
    
    @method_decorator(login_required)
    def get(self, request, *args, **kwargs):
        """Handle GET requests"""
        action = request.GET.get('action', 'list')
        
        if action == 'list':
            return self.list_proctors(request)
        elif action == 'get':
            proctor_id = request.GET.get('id')
            if proctor_id:
                return self.get_proctor(request, proctor_id)
        elif action == 'availability':
            proctor_id = request.GET.get('proctor_id')
            start_date = request.GET.get('start_date')
            end_date = request.GET.get('end_date')
            return self.get_proctor_availability(request, proctor_id, start_date, end_date)
        elif action == 'find':
            date = request.GET.get('date')
            time_param = request.GET.get('time')
            return self.find_available_proctors(request, date, time_param)
        elif action == 'get_user_profiles':
            return self.get_user_profiles(request)
        elif action == 'get_replicas':
            app_id = request.GET.get('app_id', '21')
            return self.get_app_replicas(request, app_id)
        
        return JsonResponse({'error': 'Invalid action'}, status=400)
    
    @method_decorator(login_required)
    def post(self, request, *args, **kwargs):
        """Handle POST requests"""
        action = request.GET.get('action', 'create')
        
        if action == 'create':
            try:
                data = json.loads(request.body)
                return self.create_proctor(request, data)
            except json.JSONDecodeError:
                return JsonResponse({'error': 'Invalid JSON'}, status=400)
        
        return JsonResponse({'error': 'Invalid action'}, status=400)
    
    @method_decorator(login_required)
    def put(self, request, *args, **kwargs):
        """Handle PUT requests"""
        action = request.GET.get('action', 'update')
        
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        
        if action == 'update':
            proctor_id = kwargs.get('proctor_id')
            if proctor_id:
                return self.update_proctor(request, proctor_id, data)
            return JsonResponse({'error': 'Proctor ID required'}, status=400)
        elif action == 'update_availability':
            return self.update_availability(request, data)
        elif action == 'update_day':
            return self.update_day_availability(request, data)
        elif action == 'update_hour':
            return self.update_hour_availability(request, data)
        
        return JsonResponse({'error': 'Invalid action'}, status=400)
    
    @method_decorator(login_required)
    def delete(self, request, *args, **kwargs):
        """Handle DELETE requests"""
        proctor_id = kwargs.get('proctor_id')
        if proctor_id:
            return self.delete_proctor(request, proctor_id)
        return JsonResponse({'error': 'Proctor ID required'}, status=400)
    
    def list_proctors(self, request):
        """List all proctors"""
        replicas = self.get_replicas(21)  # app_id=21 for selfstudyproctor
        if not replicas:
            return JsonResponse({'error': 'No replicas available'}, status=503)
        
        response = self.try_all_replicas('GET', replicas, 'proctors/')
        if response:
            try:
                data = response.json()
                return JsonResponse(data, safe=False)
            except:
                return JsonResponse({'error': 'Invalid response from replica'}, status=502)
        
        return JsonResponse({'error': 'Failed to connect to replicas'}, status=502)
    
    def get_proctor(self, request, proctor_id):
        """Get specific proctor"""
        replicas = self.get_replicas(21)
        if not replicas:
            return JsonResponse({'error': 'No replicas available'}, status=503)
        
        response = self.try_all_replicas('GET', replicas, f'proctors/{proctor_id}/')
        if response:
            if response.status_code == 404:
                return JsonResponse({'error': 'Proctor not found'}, status=404)
            try:
                data = response.json()
                return JsonResponse(data, safe=False)
            except:
                return JsonResponse({'error': 'Invalid response from replica'}, status=502)
        
        return JsonResponse({'error': 'Failed to connect to replicas'}, status=502)
    
    def create_proctor(self, request, data):
        """Create new proctor"""
        replicas = self.get_replicas(21)
        if not replicas:
            return JsonResponse({'error': 'No replicas available'}, status=503)
        
        response = self.try_all_replicas('POST', replicas, 'proctors/', data)
        if response:
            if response.status_code in [201, 200]:
                try:
                    data = response.json()
                    return JsonResponse(data, status=201)
                except:
                    return JsonResponse({'success': True, 'message': 'Proctor created'}, status=201)
            else:
                try:
                    error_data = response.json()
                    return JsonResponse({'error': error_data.get('error', 'Unknown error')}, 
                                      status=response.status_code)
                except:
                    return JsonResponse({'error': f'Error: {response.status_code}'}, 
                                      status=response.status_code)
        
        return JsonResponse({'error': 'Failed to connect to replicas'}, status=502)
    
    def update_proctor(self, request, proctor_id, data):
        """Update existing proctor"""
        replicas = self.get_replicas(21)
        if not replicas:
            return JsonResponse({'error': 'No replicas available'}, status=503)
        
        response = self.try_all_replicas('PUT', replicas, f'proctors/{proctor_id}/', data)
        if response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    return JsonResponse(data)
                except:
                    return JsonResponse({'success': True, 'message': 'Proctor updated'})
            elif response.status_code == 404:
                return JsonResponse({'error': 'Proctor not found'}, status=404)
            else:
                try:
                    error_data = response.json()
                    return JsonResponse({'error': error_data.get('error', 'Unknown error')}, 
                                      status=response.status_code)
                except:
                    return JsonResponse({'error': f'Error: {response.status_code}'}, 
                                      status=response.status_code)
        
        return JsonResponse({'error': 'Failed to connect to replicas'}, status=502)
    
    def delete_proctor(self, request, proctor_id):
        """Delete proctor"""
        replicas = self.get_replicas(21)
        if not replicas:
            return JsonResponse({'error': 'No replicas available'}, status=503)
        
        response = self.try_all_replicas('DELETE', replicas, f'proctors/{proctor_id}/')
        if response:
            if response.status_code in [200, 204]:
                return JsonResponse({'success': True, 'message': 'Proctor deleted'})
            elif response.status_code == 404:
                return JsonResponse({'error': 'Proctor not found'}, status=404)
            else:
                return JsonResponse({'error': f'Error: {response.status_code}'}, 
                                  status=response.status_code)
        
        return JsonResponse({'error': 'Failed to connect to replicas'}, status=502)
    
    def get_proctor_availability(self, request, proctor_id, start_date, end_date):
        """Get proctor availability"""
        replicas = self.get_replicas(21)
        if not replicas:
            return JsonResponse({'error': 'No replicas available'}, status=503)
        
        # Build query parameters
        params = []
        if proctor_id:
            params.append(f'proctor_id={proctor_id}')
        if start_date:
            params.append(f'start_date={start_date}')
        if end_date:
            params.append(f'end_date={end_date}')
        
        endpoint = f'proctors/{proctor_id}/availability/'
        if params:
            endpoint += '?' + '&'.join(params)
        
        response = self.try_all_replicas('GET', replicas, endpoint)
        if response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    return JsonResponse(data, safe=False)
                except:
                    return JsonResponse({'error': 'Invalid response from replica'}, status=502)
            else:
                return JsonResponse({'error': f'Error: {response.status_code}'}, 
                                  status=response.status_code)
        
        return JsonResponse({'error': 'Failed to connect to replicas'}, status=502)
    
    def find_available_proctors(self, request, date, time_param):
        """Find available proctors for date/time"""
        replicas = self.get_replicas(21)
        if not replicas:
            return JsonResponse({'error': 'No replicas available'}, status=503)
        
        endpoint = f'find-available-proctors/?date={date}&time={time_param}'
        response = self.try_all_replicas('GET', replicas, endpoint)
        if response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    return JsonResponse(data, safe=False)
                except:
                    return JsonResponse({'error': 'Invalid response from replica'}, status=502)
            else:
                return JsonResponse({'error': f'Error: {response.status_code}'}, 
                                  status=response.status_code)
        
        return JsonResponse({'error': 'Failed to connect to replicas'}, status=502)
    
    def update_availability(self, request, data):
        """Update availability (day or hour)"""
        replicas = self.get_replicas(21)
        if not replicas:
            return JsonResponse({'error': 'No replicas available'}, status=503)
        
        response = self.try_all_replicas('PUT', replicas, 'update-availability/', data)
        if response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    return JsonResponse(data)
                except:
                    return JsonResponse({'success': True, 'message': 'Availability updated'})
            else:
                try:
                    error_data = response.json()
                    return JsonResponse({'error': error_data.get('error', 'Unknown error')}, 
                                      status=response.status_code)
                except:
                    return JsonResponse({'error': f'Error: {response.status_code}'}, 
                                      status=response.status_code)
        
        return JsonResponse({'error': 'Failed to connect to replicas'}, status=502)
    
    def get_user_profiles(self, request):
        """Get user profiles from selfstudyuserprofile app (app_id=13)"""
        replicas = self.get_replicas(13)  # app_id=13 for selfstudyuserprofile
        if not replicas:
            return JsonResponse({'error': 'No user profile replicas available'}, status=503)
        
        response = self.try_all_replicas('GET', replicas, 'profiles/')
        if response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    return JsonResponse(data, safe=False)
                except:
                    return JsonResponse({'error': 'Invalid response from user profile service'}, status=502)
            else:
                return JsonResponse({'error': f'Error from user profile service: {response.status_code}'}, 
                                  status=response.status_code)
        
        return JsonResponse({'error': 'Failed to connect to user profile service'}, status=502)
    
    def get_app_replicas(self, request, app_id):
        """Get replicas for a specific app"""
        try:
            app_id_int = int(app_id)
            replicas = self.get_replicas(app_id_int)
            return JsonResponse({'replicas': replicas, 'count': len(replicas)})
        except ValueError:
            return JsonResponse({'error': 'Invalid app_id'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    def update_day_availability(self, request, data):
        """Update day availability directly"""
        replicas = self.get_replicas(21)
        if not replicas:
            return JsonResponse({'error': 'No replicas available'}, status=503)
        
        day_id = data.get('day_id')
        if not day_id:
            return JsonResponse({'error': 'Day ID is required'}, status=400)
        
        # Try to update using PATCH on available-days endpoint
        endpoint = f'available-days/{day_id}/'
        patch_data = {'is_available': data['is_available']}
        
        print(f"🔍 Updating day availability: day_id={day_id}, is_available={data['is_available']}")
        
        response = self.try_all_replicas('PATCH', replicas, endpoint, patch_data)
        if response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    return JsonResponse(data)
                except:
                    return JsonResponse({'success': True, 'message': 'Day availability updated'})
            else:
                try:
                    error_data = response.json()
                    return JsonResponse({'error': error_data.get('error', 'Unknown error')}, 
                                      status=response.status_code)
                except:
                    return JsonResponse({'error': f'Error: {response.status_code}'}, 
                                      status=response.status_code)
        
        return JsonResponse({'error': 'Failed to connect to replicas'}, status=502)
    
    def update_hour_availability(self, request, data):
        """Update hour availability directly"""
        replicas = self.get_replicas(21)
        if not replicas:
            return JsonResponse({'error': 'No replicas available'}, status=503)
        
        hour_id = data.get('hour_id')
        if not hour_id:
            return JsonResponse({'error': 'Hour ID is required'}, status=400)
        
        # Try to update using PATCH on available-hours endpoint
        endpoint = f'available-hours/{hour_id}/'
        patch_data = {'is_available': data['is_available']}
        
        print(f"🔍 Updating hour availability: hour_id={hour_id}, is_available={data['is_available']}")
        
        response = self.try_all_replicas('PATCH', replicas, endpoint, patch_data)
        if response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    return JsonResponse(data)
                except:
                    return JsonResponse({'success': True, 'message': 'Hour availability updated'})
            else:
                try:
                    error_data = response.json()
                    return JsonResponse({'error': error_data.get('error', 'Unknown error')}, 
                                      status=response.status_code)
                except:
                    return JsonResponse({'error': f'Error: {response.status_code}'}, 
                                      status=response.status_code)
        
        return JsonResponse({'error': 'Failed to connect to replicas'}, status=502)