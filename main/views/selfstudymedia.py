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
import re
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict

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
    
    def fetch_all_pages(self, endpoint, params=None):
        """Fetch all pages of data from a paginated endpoint"""
        all_data = []
        next_url = endpoint
        page_count = 0
        max_pages = 10  # Safety limit to prevent infinite loops
        
        while next_url and page_count < max_pages:
            try:
                # Handle both relative and absolute URLs
                if next_url.startswith('http'):
                    url = next_url
                else:
                    url = f"{self.current_replica}/{next_url.lstrip('/')}"
                
                response = requests.get(
                    url,
                    headers=self.headers,
                    params=params if page_count == 0 else None,  # Only include params on first call
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Handle different response formats
                    if isinstance(data, dict):
                        if 'results' in data:
                            # Django REST Framework pagination
                            all_data.extend(data['results'])
                            next_url = data.get('next')
                        elif 'data' in data:
                            # Custom pagination
                            all_data.extend(data['data'])
                            next_url = data.get('next')
                        else:
                            # Non-paginated dict response
                            all_data.append(data)
                            next_url = None
                    elif isinstance(data, list):
                        # Non-paginated list response
                        all_data.extend(data)
                        next_url = None
                    else:
                        # Single item response
                        all_data.append(data)
                        next_url = None
                    
                    page_count += 1
                    
                    # If no next URL or empty results, break
                    if not next_url or not data.get('results'):
                        break
                else:
                    logger.error(f"Failed to fetch page: {response.status_code}")
                    break
                    
            except Exception as e:
                logger.error(f"Error fetching page {page_count}: {str(e)}")
                break
        
        logger.info(f"Fetched {len(all_data)} items in {page_count} pages from {endpoint}")
        return all_data

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
            ],
            'display_fields': {
                'profile_images': ['id', 'user_id', 'username', 'image', 'created_at'],
                'course_images': ['id', 'course_id', 'course_name', 'image', 'created_at'],
                'lesson_images': ['id', 'lesson_id', 'lesson_name', 'course_name', 'image', 'created_at'],
                'lesson_videos': ['id', 'lesson_id', 'lesson_name', 'course_name', 'video', 'created_at'],
                'instruction_videos': ['id', 'exam_id', 'exam_name', 'video', 'created_at']
            }
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
                name_field = 'username'
                file_field = 'image'
            elif media_type == 'course_images':
                endpoint = 'course-images/'
                id_field = 'course_id'
                name_field = 'course_name'
                file_field = 'image'
            elif media_type == 'lesson_images':
                endpoint = 'lesson-images/'
                id_field = 'lesson_id'
                name_field = 'lesson_name'
                file_field = 'image'
            elif media_type == 'lesson_videos':
                endpoint = 'lesson-videos/'
                id_field = 'lesson_id'
                name_field = 'lesson_name'
                file_field = 'video'
            elif media_type == 'instruction_videos':
                endpoint = 'instruction-videos/'
                id_field = 'exam_id'
                name_field = 'exam_name'
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
            
            # Get reference name if provided (for courses, lessons, exams)
            reference_name = data.get('reference_name', '')
            
            # For profile images, try to get username from lookup
            if media_type == 'profile_images' and not reference_name:
                reference_name = data.get('username', '')
            
            # Check if file is provided
            if not files:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Media file is required'
                }, status=400)
            
            # Prepare form data
            form_data = {id_field: reference_id}
            
            # Add name field if we have it
            if reference_name and name_field:
                form_data[name_field] = reference_name
            
            # For lesson media, also include course_name if provided
            if media_type in ['lesson_images', 'lesson_videos']:
                course_name = data.get('course_name', '')
                if course_name:
                    form_data['course_name'] = course_name
            
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
    
    def __init__(self):
        super().__init__()
        self.course_cache = {'data': [], 'timestamp': 0, 'ttl': 300000}  # 5 minutes cache
    
    def get(self, request, *args, **kwargs):
        """Fetch data from other services"""
        try:
            data_type = request.GET.get('type')
            
            client = MediaServiceClient()
            
            # Determine which service to query
            if data_type == 'users':
                return self._fetch_users(client)
            elif data_type == 'courses':
                return self._fetch_courses(client)
            elif data_type == 'lessons':
                return self._fetch_lessons(client)
            elif data_type == 'exams':
                return self._fetch_exams(client)
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
    
    def _fetch_users(self, client):
        """Fetch users from selfstudyuserprofile app"""
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
                try:
                    users = client.fetch_all_pages('profiles/')
                    
                    user_data = []
                    for user in users:
                        user_data.append({
                            'id': user.get('user_id'),
                            'username': user.get('username'),
                            'email': user.get('email'),
                            'first_name': user.get('first_name', ''),
                            'last_name': user.get('last_name', ''),
                            'full_name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get('username')
                        })
                    
                    return JsonResponse({
                        'status': 'success',
                        'data': user_data
                    })
                except Exception as e:
                    logger.error(f"Failed to fetch users from {replica}: {str(e)}")
                    continue
        
        return JsonResponse({
            'status': 'error',
            'message': 'Failed to fetch users from any replica'
        }, status=500)
    
    def _fetch_courses(self, client):
        """Fetch courses from selfstudycourse app"""
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
                try:
                    courses = client.fetch_all_pages('courses/')
                    
                    course_data = self._process_courses(courses)
                    
                    # Update cache
                    self.course_cache = {
                        'data': course_data,
                        'timestamp': self._current_timestamp(),
                        'ttl': 300000
                    }
                    
                    return JsonResponse({
                        'status': 'success',
                        'data': course_data
                    })
                except Exception as e:
                    logger.error(f"Failed to fetch courses from {replica}: {str(e)}")
                    continue
        
        return JsonResponse({
            'status': 'error',
            'message': 'Failed to fetch courses from any replica'
        }, status=500)
    
    def _fetch_lessons(self, client):
        """Fetch lessons from selfstudycourse app - OPTIMIZED VERSION"""
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
                try:
                    # Fetch all courses first (use cache if available)
                    courses = self._get_courses_with_cache(client, replica)
                    
                    # Create course mapping for quick lookup
                    course_map = {}
                    for course in courses:
                        course_id = self._extract_course_id(course)
                        if course_id:
                            course_title = self._extract_course_title(course, course_id)
                            course_map[course_id] = course_title
                    
                    # Fetch all lessons
                    lessons = client.fetch_all_pages('lessons/')
                    
                    lesson_data = []
                    for lesson in lessons:
                        lesson_item = self._process_lesson(lesson, course_map)
                        if lesson_item:
                            lesson_data.append(lesson_item)
                    
                    return JsonResponse({
                        'status': 'success',
                        'data': lesson_data
                    })
                except Exception as e:
                    logger.error(f"Failed to fetch lessons from {replica}: {str(e)}")
                    continue
        
        return JsonResponse({
            'status': 'error',
            'message': 'Failed to fetch lessons from any replica'
        }, status=500)
    
    def _fetch_exams(self, client):
        """Fetch exams from selfstudyexam app"""
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
                try:
                    exams = client.fetch_all_pages('exams/')
                    
                    exam_data = []
                    for exam in exams:
                        exam_item = self._process_exam(exam)
                        if exam_item:
                            exam_data.append(exam_item)
                    
                    return JsonResponse({
                        'status': 'success',
                        'data': exam_data
                    })
                except Exception as e:
                    logger.error(f"Failed to fetch exams from {replica}: {str(e)}")
                    continue
        
        return JsonResponse({
            'status': 'error',
            'message': 'Failed to fetch exams from any replica'
        }, status=500)
    
    def _get_courses_with_cache(self, client, replica):
        """Get courses from cache or fetch fresh"""
        now = self._current_timestamp()
        
        # Check cache validity
        if (self.course_cache['data'] and 
            (now - self.course_cache['timestamp']) < self.course_cache['ttl']):
            return self.course_cache['data']
        
        # Fetch fresh courses
        client.current_replica = replica
        courses = client.fetch_all_pages('courses/')
        processed_courses = self._process_courses(courses)
        
        # Update cache
        self.course_cache = {
            'data': processed_courses,
            'timestamp': now,
            'ttl': 300000
        }
        
        return processed_courses
    
    def _process_courses(self, courses):
        """Process courses data"""
        course_data = []
        for course in courses:
            course_item = self._process_course(course)
            if course_item:
                course_data.append(course_item)
        return course_data
    
    def _process_course(self, course):
        """Process individual course"""
        # Extract course ID
        course_id = self._extract_course_id(course)
        if not course_id:
            return None
        
        # Extract course title
        course_title = self._extract_course_title(course, course_id)
        
        return {
            'id': str(course_id).strip(),
            'title': course_title,
            'description': course.get('description', '')
        }
    
    def _extract_course_id(self, course):
        """Extract course ID from course data"""
        course_id = None
        
        # Try different fields in order of priority
        if 'external_course_id' in course:
            course_id = course.get('external_course_id')
        elif 'id' in course:
            course_id = str(course.get('id'))
        elif 'course_id' in course:
            course_id = course.get('course_id')
        elif 'uuid' in course:
            course_id = str(course.get('uuid'))
        elif 'pk' in course:
            course_id = str(course.get('pk'))
        
        return course_id
    
    def _extract_course_title(self, course, course_id):
        """Extract course title from course data"""
        course_title = None
        
        # Try different possible title fields in order of priority
        if course.get('title') and str(course.get('title')).strip():
            course_title = str(course.get('title')).strip()
        elif course.get('name') and str(course.get('name')).strip():
            course_title = str(course.get('name')).strip()
        elif course.get('course_title') and str(course.get('course_title')).strip():
            course_title = str(course.get('course_title')).strip()
        elif course.get('display_name') and str(course.get('display_name')).strip():
            course_title = str(course.get('display_name')).strip()
        elif course.get('description') and str(course.get('description')).strip():
            description = str(course.get('description')).strip()
            if len(description) > 60:
                course_title = description[:60] + '...'
            else:
                course_title = description
        else:
            course_title = f"Course {str(course_id)[:8]}"
        
        # Clean the course title
        course_title = self._clean_title(course_title, course_id, "Course")
        
        return course_title
    
    def _process_lesson(self, lesson, course_map):
        """Process individual lesson"""
        # Extract lesson details
        lesson_id = self._extract_lesson_id(lesson)
        if not lesson_id:
            return None
        
        # Extract lesson title
        lesson_title = self._extract_lesson_title(lesson, lesson_id)
        
        # Extract course ID and name
        course_id = self._extract_lesson_course_id(lesson)
        course_name = course_map.get(course_id) if course_id else None
        
        return {
            'id': str(lesson_id),
            'title': lesson_title,
            'course_id': str(course_id).strip() if course_id else None,
            'course_name': course_name
        }
    
    def _extract_lesson_id(self, lesson):
        """Extract lesson ID from lesson data"""
        lesson_id = None
        
        if 'external_lesson_id' in lesson:
            lesson_id = lesson.get('external_lesson_id')
        elif 'id' in lesson:
            lesson_id = str(lesson.get('id'))
        elif 'lesson_id' in lesson:
            lesson_id = lesson.get('lesson_id')
        elif 'uuid' in lesson:
            lesson_id = str(lesson.get('uuid'))
        elif 'pk' in lesson:
            lesson_id = str(lesson.get('pk'))
        
        return lesson_id
    
    def _extract_lesson_title(self, lesson, lesson_id):
        """Extract lesson title from lesson data"""
        lesson_title = None
        
        if lesson.get('title') and str(lesson.get('title')).strip():
            lesson_title = str(lesson.get('title')).strip()
        elif lesson.get('name') and str(lesson.get('name')).strip():
            lesson_title = str(lesson.get('name')).strip()
        elif lesson.get('lesson_title') and str(lesson.get('lesson_title')).strip():
            lesson_title = str(lesson.get('lesson_title')).strip()
        elif lesson.get('description') and str(lesson.get('description')).strip():
            description = str(lesson.get('description')).strip()
            if len(description) > 60:
                lesson_title = description[:60] + '...'
            else:
                lesson_title = description
        else:
            lesson_title = f"Lesson {str(lesson_id)[:8]}"
        
        # Clean the lesson title
        lesson_title = self._clean_title(lesson_title, lesson_id, "Lesson")
        
        return lesson_title
    
    def _extract_lesson_course_id(self, lesson):
        """Extract course ID from lesson data"""
        course_id = None
        
        if 'course_external_id' in lesson:
            course_id = lesson.get('course_external_id')
        elif 'course' in lesson:
            course_info = lesson.get('course')
            if isinstance(course_info, dict):
                if 'external_course_id' in course_info:
                    course_id = course_info.get('external_course_id')
                elif 'id' in course_info:
                    course_id = str(course_info.get('id'))
                elif 'course_id' in course_info:
                    course_id = course_info.get('course_id')
                elif 'uuid' in course_info:
                    course_id = str(course_info.get('uuid'))
                elif 'pk' in course_info:
                    course_id = str(course_info.get('pk'))
            elif course_info:
                course_id = str(course_info)
        elif 'course_id' in lesson:
            course_id = lesson.get('course_id')
        
        return course_id
    
    def _process_exam(self, exam):
        """Process individual exam"""
        exam_id = None
        
        if 'external_id' in exam:
            exam_id = exam.get('external_id')
        elif 'id' in exam:
            exam_id = str(exam.get('id'))
        elif 'exam_id' in exam:
            exam_id = exam.get('exam_id')
        elif 'uuid' in exam:
            exam_id = str(exam.get('uuid'))
        elif 'pk' in exam:
            exam_id = str(exam.get('pk'))
        
        if not exam_id:
            return None
        
        exam_title = None
        
        if exam.get('title') and str(exam.get('title')).strip():
            exam_title = str(exam.get('title')).strip()
        elif exam.get('name') and str(exam.get('name')).strip():
            exam_title = str(exam.get('name')).strip()
        elif exam.get('exam_title') and str(exam.get('exam_title')).strip():
            exam_title = str(exam.get('exam_title')).strip()
        elif exam.get('description') and str(exam.get('description')).strip():
            description = str(exam.get('description')).strip()
            if len(description) > 60:
                exam_title = description[:60] + '...'
            else:
                exam_title = description
        else:
            exam_title = f"Exam {str(exam_id)[:8]}"
        
        # Clean exam title
        exam_title = self._clean_title(exam_title, exam_id, "Exam")
        
        return {
            'id': str(exam_id),
            'title': exam_title,
            'course_id': exam.get('course_id'),
            'exam_duration': exam.get('exam_duration')
        }
    
    def _clean_title(self, title, item_id, default_prefix):
        """Clean title by removing UUIDs and improving readability"""
        if not title:
            return f"{default_prefix} {str(item_id)[:8]}"
        
        # Check if title looks like a UUID
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        
        if re.match(uuid_pattern, title, re.I) or title == str(item_id):
            return f"{default_prefix} {str(item_id)[:8]}"
        
        # Remove any "ID:" prefix if present
        if title.startswith('ID:'):
            title = title[3:].strip()
        
        # Ensure title is not empty
        if not title or title.lower() in ['none', 'null', '']:
            return f"{default_prefix} {str(item_id)[:8]}"
        
        return title
    
    def _current_timestamp(self):
        """Get current timestamp in milliseconds"""
        import time
        return int(time.time() * 1000)

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