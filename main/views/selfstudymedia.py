import os
import json
import random
import logging
import requests
from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

logger = logging.getLogger(__name__)

# Authentication token from environment
AUTH_TOKEN = os.getenv('AUTH_TOKEN', '')
SFS_DOMAINS = [
    'https://sfsdomains1.pythonanywhere.com',
    'https://sfsdomains2.pythonanywhere.com'
]
APP_IDS = {
    'selfstudymedia': 18,
    'selfstudyexam': 20,
    'selfstudyuserprofile': 13,
    'selfstudycourse': 19
}

class MediaServiceClient:
    """Client for interacting with selfstudymedia service"""
    
    def __init__(self):
        self.auth_token = AUTH_TOKEN
        self.replicas = []
        self.current_replica = None
        self.headers = {
            'Authorization': f'Token {self.auth_token}',
            'Content-Type': 'application/json'
        }
    
    def fetch_replicas(self, app_name='selfstudymedia'):
        """Fetch replicas from SelfStudy Domains service"""
        app_id = APP_IDS.get(app_name)
        if not app_id:
            return []
        
        # Try domains in order
        for domain in SFS_DOMAINS:
            try:
                url = f"{domain}/apps/{app_id}/"
                response = requests.get(
                    url,
                    headers={'Authorization': f'Token {self.auth_token}'},
                    timeout=10
                )
                
                if response.status_code == 200:
                    app_data = response.json()
                    replicas = [
                        replica['replica_url'].rstrip('/')
                        for replica in app_data.get('replicas', [])
                        if replica.get('replica_url')
                    ]
                    return replicas
                    
            except Exception as e:
                logger.error(f"Failed to fetch replicas from {domain}: {str(e)}")
                continue
        
        # Fallback: test direct domains if registry fails
        return self.test_fallback_domains()
    
    def test_fallback_domains(self):
        """Test direct domains if registry service fails"""
        test_domains = [
            'https://selfstudymedia1.pythonanywhere.com',
            'https://selfstudymedia2.pythonanywhere.com',
            'https://selfstudymedia3.pythonanywhere.com'
        ]
        
        working_domains = []
        for domain in test_domains:
            try:
                response = requests.get(
                    f"{domain}/metrics/",
                    headers={'Authorization': f'Token {self.auth_token}'},
                    timeout=5
                )
                if response.status_code in [200, 401]:  # 401 means service is up but auth required
                    working_domains.append(domain)
            except:
                continue
        
        return working_domains
    
    def health_check(self, replica_url):
        """Check if a replica is healthy"""
        try:
            response = requests.get(
                f"{replica_url}/metrics/",
                headers=self.headers,
                timeout=5
            )
            return response.status_code in [200, 401]
        except:
            return False
    
    def select_random_replica(self):
        """Select a random healthy replica"""
        if not self.replicas:
            self.replicas = self.fetch_replicas()
        
        if not self.replicas:
            return None
        
        # Filter healthy replicas
        healthy_replicas = []
        for replica in self.replicas:
            if self.health_check(replica):
                healthy_replicas.append(replica)
        
        if not healthy_replicas:
            return None
        
        # Select random healthy replica
        self.current_replica = random.choice(healthy_replicas)
        return self.current_replica
    
    def make_request(self, method, endpoint, data=None, files=None):
        """Make HTTP request to selected replica"""
        if not self.current_replica:
            self.select_random_replica()
            if not self.current_replica:
                raise Exception("No healthy replicas available")
        
        url = f"{self.current_replica}/{endpoint.lstrip('/')}"
        
        try:
            headers = self.headers.copy()
            if files:
                # Remove Content-Type for multipart requests
                headers.pop('Content-Type', None)
            
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == 'POST':
                if files:
                    response = requests.post(url, files=files, data=data, headers=headers, timeout=60)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'PUT':
                if files:
                    response = requests.put(url, files=files, data=data, headers=headers, timeout=60)
                else:
                    response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            elif method.upper() == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
            
        except requests.exceptions.Timeout:
            # Try another replica on timeout
            logger.warning(f"Timeout on {self.current_replica}, trying another replica")
            old_replica = self.current_replica
            self.current_replica = None
            if self.select_random_replica() and self.current_replica != old_replica:
                return self.make_request(method, endpoint, data, files)
            raise Exception("All replicas timed out")
        
        except Exception as e:
            logger.error(f"Request failed: {str(e)}")
            raise

@method_decorator(login_required, name='dispatch')
class SelfStudyMediaView(View):
    """Main view for selfstudymedia management"""
    
    def __init__(self):
        super().__init__()
        self.client = MediaServiceClient()
    
    def get_context_data(self):
        """Get context data for template"""
        replicas = self.client.fetch_replicas()
        
        # Select random replica for initial load
        random_replica = None
        if replicas:
            healthy_replicas = [r for r in replicas if self.client.health_check(r)]
            if healthy_replicas:
                random_replica = random.choice(healthy_replicas)
        
        context = {
            'replicas': replicas,
            'random_replica': random_replica,
            'auth_token': AUTH_TOKEN,
            'media_types': [
                {'value': 'profile_images', 'label': 'Profile Images'},
                {'value': 'course_images', 'label': 'Course Images'},
                {'value': 'lesson_images', 'label': 'Lesson Images'},
                {'value': 'lesson_videos', 'label': 'Lesson Videos'},
                {'value': 'instruction_videos', 'label': 'Instruction Videos'}
            ]
        }
        
        # Add app IDs for reference
        context['app_ids'] = APP_IDS
        
        return context
    
    def get(self, request):
        context = self.get_context_data()
        return render(request, 'selfstudymedia.html', context)

@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(login_required, name='dispatch')
class SelfStudyMediaAPIView(View):
    """API view for selfstudymedia operations"""
    
    def __init__(self):
        super().__init__()
        self.client = MediaServiceClient()
    
    def get(self, request, *args, **kwargs):
        """Handle GET requests - fetch media items"""
        try:
            media_type = request.GET.get('media_type')
            item_id = request.GET.get('id')  # This is the reference ID (user_id, course_id, etc.)
            replica_url = request.GET.get('replica_url')
            
            if not replica_url:
                return JsonResponse({
                    'status': 'error',
                    'message': 'No replica URL provided'
                }, status=400)
            
            # Set client replica
            self.client.current_replica = replica_url
            
            # Determine endpoint based on media type
            if media_type == 'profile_images':
                endpoint = 'profile-images/'
                if item_id:
                    endpoint = f'profile-images/{item_id}/'
            elif media_type == 'course_images':
                endpoint = 'course-images/'
                if item_id:
                    endpoint = f'course-images/{item_id}/'
            elif media_type == 'lesson_images':
                endpoint = 'lesson-images/'
                if item_id:
                    endpoint = f'lesson-images/{item_id}/'
            elif media_type == 'lesson_videos':
                endpoint = 'lesson-videos/'
                if item_id:
                    endpoint = f'lesson-videos/{item_id}/'
            elif media_type == 'instruction_videos':
                endpoint = 'instruction-videos/'
                if item_id:
                    endpoint = f'instruction-videos/{item_id}/'
            else:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Invalid media type'
                }, status=400)
            
            # Make request
            response = self.client.make_request('GET', endpoint)
            
            if response.status_code == 200:
                data = response.json()
                # Ensure data is always a list for consistency
                if not isinstance(data, list):
                    data = [data] if data else []
                
                return JsonResponse({
                    'status': 'success',
                    'data': data
                })
            else:
                return JsonResponse({
                    'status': 'error',
                    'message': f'API Error: {response.status_code}',
                    'details': response.text if response.text else 'No details'
                }, status=response.status_code)
                
        except Exception as e:
            logger.error(f"GET request failed: {str(e)}")
            return JsonResponse({
                'status': 'error',
                'message': str(e)
            }, status=500)
    
    def post(self, request, *args, **kwargs):
        """Handle POST requests - create/update media items"""
        try:
            data = request.POST.dict()
            files = request.FILES
            replica_url = data.get('replica_url')
            media_type = data.get('media_type')
            
            if not replica_url:
                return JsonResponse({
                    'status': 'error',
                    'message': 'No replica URL provided'
                }, status=400)
            
            # Set client replica
            self.client.current_replica = replica_url
            
            # Determine endpoint and field names based on media type
            if media_type == 'profile_images':
                endpoint = 'profile-images/'
                id_field = 'user_id'
                file_field = 'image'
            elif media_type == 'course_images':
                endpoint = 'course-images/'
                id_field = 'course_id'
                file_field = 'image'
            elif media_type == 'lesson_images':
                endpoint = 'lesson-images/'
                id_field = 'lesson_id'
                file_field = 'image'
            elif media_type == 'lesson_videos':
                endpoint = 'lesson-videos/'
                id_field = 'lesson_id'
                file_field = 'video'
            elif media_type == 'instruction_videos':
                endpoint = 'instruction-videos/'
                id_field = 'exam_id'
                file_field = 'video'
            else:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Invalid media type'
                }, status=400)
            
            # Get reference ID from form data
            reference_id = data.get('reference_id')
            if not reference_id:
                return JsonResponse({
                    'status': 'error',
                    'message': f'{id_field.replace("_", " ").title()} is required'
                }, status=400)
            
            # Check if file is provided
            if not files:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Media file is required'
                }, status=400)
            
            # Prepare form data
            form_data = {id_field: reference_id}
            
            # Prepare files with correct field name
            file_data = {file_field: list(files.values())[0]}
            
            # Make request
            response = self.client.make_request('POST', endpoint, form_data, file_data)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'status': 'success',
                    'data': response.json(),
                    'message': 'Media item created/updated successfully'
                })
            else:
                return JsonResponse({
                    'status': 'error',
                    'message': f'API Error: {response.status_code}',
                    'details': response.text if response.text else 'No details'
                }, status=response.status_code)
                
        except Exception as e:
            logger.error(f"POST request failed: {str(e)}")
            return JsonResponse({
                'status': 'error',
                'message': str(e)
            }, status=500)
    
    def delete(self, request, *args, **kwargs):
        """Handle DELETE requests"""
        try:
            data = json.loads(request.body)
            media_type = data.get('media_type')
            reference_id = data.get('reference_id')  # This is user_id, course_id, etc.
            replica_url = data.get('replica_url')
            
            if not all([media_type, reference_id, replica_url]):
                return JsonResponse({
                    'status': 'error',
                    'message': 'Missing required parameters'
                }, status=400)
            
            # Set client replica
            self.client.current_replica = replica_url
            
            # Determine endpoint
            if media_type == 'profile_images':
                endpoint = f'profile-images/{reference_id}/'
            elif media_type == 'course_images':
                endpoint = f'course-images/{reference_id}/'
            elif media_type == 'lesson_images':
                endpoint = f'lesson-images/{reference_id}/'
            elif media_type == 'lesson_videos':
                endpoint = f'lesson-videos/{reference_id}/'
            elif media_type == 'instruction_videos':
                endpoint = f'instruction-videos/{reference_id}/'
            else:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Invalid media type'
                }, status=400)
            
            response = self.client.make_request('DELETE', endpoint)
            
            if response.status_code in [200, 204]:
                return JsonResponse({
                    'status': 'success',
                    'message': 'Media item deleted successfully'
                })
            else:
                return JsonResponse({
                    'status': 'error',
                    'message': f'API Error: {response.status_code}',
                    'details': response.text if response.text else 'No details'
                }, status=response.status_code)
                
        except Exception as e:
            logger.error(f"DELETE request failed: {str(e)}")
            return JsonResponse({
                'status': 'error',
                'message': str(e)
            }, status=500)

@method_decorator(login_required, name='dispatch')
class ExternalDataAPIView(View):
    """API view for fetching external data (users, courses, exams)"""
    
    def get(self, request, *args, **kwargs):
        """Fetch data from other services"""
        try:
            data_type = request.GET.get('type')
            
            client = MediaServiceClient()
            
            # Determine which service to query
            if data_type == 'users':
                # Query selfstudyuserprofile app (app_id=13)
                user_replicas = client.fetch_replicas('selfstudyuserprofile')
                if not user_replicas:
                    return JsonResponse({
                        'status': 'error',
                        'message': 'No user service replicas found'
                    }, status=404)
                
                # Use first healthy replica
                for replica in user_replicas:
                    if client.health_check(replica):
                        client.current_replica = replica
                        response = client.make_request('GET', 'profiles/')
                        if response.status_code == 200:
                            users = response.json()
                            return JsonResponse({
                                'status': 'success',
                                'data': [{
                                    'id': user.get('user_id'),
                                    'username': user.get('username'),
                                    'email': user.get('email'),
                                    'first_name': user.get('first_name', ''),
                                    'last_name': user.get('last_name', ''),
                                    'full_name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get('username')
                                } for user in users]
                            })
                
                return JsonResponse({
                    'status': 'error',
                    'message': 'Failed to fetch users from any replica'
                }, status=500)
                
            elif data_type == 'courses':
                # Query selfstudycourse app (app_id=19)
                course_replicas = client.fetch_replicas('selfstudycourse')
                if not course_replicas:
                    return JsonResponse({
                        'status': 'error',
                        'message': 'No course service replicas found'
                    }, status=404)
                
                # Use first healthy replica
                for replica in course_replicas:
                    if client.health_check(replica):
                        client.current_replica = replica
                        response = client.make_request('GET', 'courses/')
                        if response.status_code == 200:
                            courses = response.json()
                            return JsonResponse({
                                'status': 'success',
                                'data': [{
                                    'id': course.get('external_course_id'),
                                    'title': course.get('title'),
                                    'description': course.get('description')
                                } for course in courses]
                            })
                
                return JsonResponse({
                    'status': 'error',
                    'message': 'Failed to fetch courses from any replica'
                }, status=500)
                
            elif data_type == 'lessons':
                # Query selfstudycourse app for lessons (app_id=19)
                course_replicas = client.fetch_replicas('selfstudycourse')
                if not course_replicas:
                    return JsonResponse({
                        'status': 'error',
                        'message': 'No course service replicas found'
                    }, status=404)
                
                # Use first healthy replica
                for replica in course_replicas:
                    if client.health_check(replica):
                        client.current_replica = replica
                        response = client.make_request('GET', 'lessons/')
                        if response.status_code == 200:
                            lessons = response.json()
                            return JsonResponse({
                                'status': 'success',
                                'data': [{
                                    'id': lesson.get('external_lesson_id'),
                                    'title': lesson.get('title'),
                                    'course_id': lesson.get('course')  # This might need adjustment
                                } for lesson in lessons]
                            })
                
                return JsonResponse({
                    'status': 'error',
                    'message': 'Failed to fetch lessons from any replica'
                }, status=500)
                
            elif data_type == 'exams':
                # Query selfstudyexam app (app_id=20)
                exam_replicas = client.fetch_replicas('selfstudyexam')
                if not exam_replicas:
                    return JsonResponse({
                        'status': 'error',
                        'message': 'No exam service replicas found'
                    }, status=404)
                
                # Use first healthy replica
                for replica in exam_replicas:
                    if client.health_check(replica):
                        client.current_replica = replica
                        response = client.make_request('GET', 'exams/')
                        if response.status_code == 200:
                            exams = response.json()
                            return JsonResponse({
                                'status': 'success',
                                'data': [{
                                    'id': exam.get('external_id'),
                                    'title': exam.get('title'),
                                    'course_id': exam.get('course_id'),
                                    'exam_duration': exam.get('exam_duration')
                                } for exam in exams]
                            })
                
                return JsonResponse({
                    'status': 'error',
                    'message': 'Failed to fetch exams from any replica'
                }, status=500)
                
            else:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Invalid data type'
                }, status=400)
                
        except Exception as e:
            logger.error(f"External data fetch failed: {str(e)}")
            return JsonResponse({
                'status': 'error',
                'message': str(e)
            }, status=500)

@method_decorator(login_required, name='dispatch')
class ReplicaAPIView(View):
    """API view for replica management"""
    
    def get(self, request, *args, **kwargs):
        """Get list of replicas"""
        try:
            app_name = request.GET.get('app', 'selfstudymedia')
            client = MediaServiceClient()
            replicas = client.fetch_replicas(app_name)
            
            # Health check each replica
            replica_status = []
            for replica in replicas:
                is_healthy = client.health_check(replica)
                replica_status.append({
                    'url': replica,
                    'healthy': is_healthy
                })
            
            return JsonResponse({
                'status': 'success',
                'data': replica_status
            })
            
        except Exception as e:
            logger.error(f"Failed to get replicas: {str(e)}")
            return JsonResponse({
                'status': 'error',
                'message': str(e)
            }, status=500)