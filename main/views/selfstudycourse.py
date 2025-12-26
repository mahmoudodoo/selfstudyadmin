from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import requests
import random
import logging
import os
from django.conf import settings
import json
import uuid

logger = logging.getLogger(__name__)

# Dynamic Domain Discovery
class DomainDiscovery:
    @staticmethod
    def _get_domains_registry_instances():
        return [
            "https://sfsdomains1.pythonanywhere.com",
            "https://sfsdomains2.pythonanywhere.com"
        ]

    @staticmethod
    def _get_auth_token():
        return os.getenv('AUTH_TOKEN')

    @staticmethod
    def _fetch_app_replicas_from_registry(registry_url, app_id):
        try:
            url = f"{registry_url.rstrip('/')}/apps/{app_id}/"
            auth_token = DomainDiscovery._get_auth_token()

            headers = {'Content-Type': 'application/json'}
            if auth_token:
                headers['Authorization'] = f'Token {auth_token}'

            logger.info(f"Fetching app replicas from: {url}")
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code == 200:
                app_data = response.json()
                replica_urls = [replica['replica_url'].rstrip('/') for replica in app_data.get('replicas', [])]
                logger.info(f"Successfully fetched {len(replica_urls)} replicas from {registry_url}")
                return replica_urls
            else:
                logger.warning(f"Failed to fetch from {registry_url}: {response.status_code}")
                return None

        except requests.RequestException as e:
            logger.error(f"Request failed for {registry_url}: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching from {registry_url}: {str(e)}")
            return None

    @staticmethod
    def get_dynamic_domains(app_id):
        registry_instances = DomainDiscovery._get_domains_registry_instances()

        for registry_url in registry_instances:
            replica_urls = DomainDiscovery._fetch_app_replicas_from_registry(registry_url, app_id)
            if replica_urls is not None:
                logger.info(f"Successfully obtained {len(replica_urls)} domains from {registry_url}")
                return replica_urls

        # Fallback domains
        fallback_domains = {
            13: ["https://selfstudyuserprofile1.pythonanywhere.com", "https://selfstudyuserprofile2.pythonanywhere.com"],
            18: ["https://selfstudymedia1.pythonanywhere.com", "https://selfstudymedia2.pythonanywhere.com"],
            19: ["https://selfstudycourse1.pythonanywhere.com", "https://selfstudycourse2.pythonanywhere.com"]
        }
        return fallback_domains.get(app_id, [])

# API Client
class CourseAPIClient:
    def __init__(self):
        self.auth_token = os.getenv('AUTH_TOKEN')
        self.course_domains = DomainDiscovery.get_dynamic_domains(19)
        self.media_domains = DomainDiscovery.get_dynamic_domains(18)
        self.user_profile_domains = DomainDiscovery.get_dynamic_domains(13)

    def _get_headers(self):
        return {
            'Content-Type': 'application/json',
            'Authorization': f'Token {self.auth_token}'
        }

    def _get_random_domain(self, domains):
        return random.choice(domains) if domains else None

    def _make_request(self, method, endpoint, data=None, domain_type='course', files=None, expected_statuses=None):
        if expected_statuses is None:
            expected_statuses = [200, 201]
            
        domains = getattr(self, f'{domain_type}_domains')
        domain = self._get_random_domain(domains)
        
        if not domain:
            return {'error': 'No available domains'}

        url = f"{domain}{endpoint}"
        headers = self._get_headers() if not files else {'Authorization': f'Token {self.auth_token}'}

        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method.upper() == 'POST':
                if files:
                    response = requests.post(url, files=files, data=data, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return {'error': f'Unsupported method: {method}'}

            # Handle 204 No Content for DELETE operations
            if response.status_code == 204:
                return {'success': True, 'message': 'Deleted successfully'}
                
            if response.status_code in expected_statuses:
                try:
                    return response.json()
                except ValueError:
                    return {'success': True, 'message': 'Operation completed successfully'}
            else:
                logger.error(f"API Error: {response.status_code} - {response.text}")
                try:
                    error_data = response.json()
                    return {'error': f'API returned {response.status_code}', 'details': error_data}
                except ValueError:
                    return {'error': f'API returned {response.status_code}: {response.text}'}

        except requests.RequestException as e:
            logger.error(f"Request failed: {str(e)}")
            return {'error': str(e)}

    # Helper method to resolve external_id to primary key
    def _resolve_external_id_to_pk(self, external_id, entity_type):
        """Resolve external UUID to primary key integer"""
        if not external_id:
            return None
            
        domains = self.course_domains
        domain = self._get_random_domain(domains)
        
        if not domain:
            return None

        try:
            # Map entity types to endpoints
            endpoint_map = {
                'course': f'/courses/{external_id}/',
                'lesson': f'/lessons/{external_id}/',
                'homework': f'/homeworks/{external_id}/'
            }
            
            endpoint = endpoint_map.get(entity_type)
            if not endpoint:
                return None
                
            url = f"{domain}{endpoint}"
            response = requests.get(url, headers=self._get_headers(), timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                return data.get('id')  # Return the primary key
            else:
                logger.error(f"Failed to resolve {entity_type} {external_id}: {response.status_code}")
                return None
                
        except requests.RequestException as e:
            logger.error(f"Error resolving {entity_type} {external_id}: {str(e)}")
            return None

    # User operations
    def get_users(self):
        return self._make_request('GET', '/profiles/', domain_type='user_profile')

    # Course operations
    def get_courses(self):
        return self._make_request('GET', '/courses/')

    def get_course(self, course_id):
        return self._make_request('GET', f'/courses/{course_id}/')

    def create_course(self, data, image_file):
        # Step 1: Generate course ID first
        course_id = str(uuid.uuid4())
        if 'external_course_id' not in data:
            data['external_course_id'] = course_id
        
        # Step 2: Upload image to media app with course name
        image_url = None
        if image_file:
            course_name = data.get('title', '')
            media_response = self.upload_course_image(image_file, course_id, course_name)
            if media_response and 'image' in media_response:
                image_url = media_response['image']
                logger.info(f"Successfully uploaded image to media app: {image_url}")
            elif media_response and 'error' in media_response:
                logger.error(f"Failed to upload course image: {media_response['error']}")
                return {'error': f"Media upload failed: {media_response['error']}"}
            else:
                logger.error("Media upload failed with unknown error")
                return {'error': "Media upload failed with unknown error"}
        
        # Step 3: Add the image URL to course data
        if image_url:
            data['image_url'] = image_url
            logger.info(f"Added image_url to course data: {image_url}")
        
        # Step 4: Create course with the image_url
        logger.info(f"Creating course with data: {data}")
        return self._make_request('POST', '/courses/', data)

    def update_course(self, course_id, data, image_file=None):
        # Step 1: Get current course to get the title for media app
        course_name = data.get('title', '')
        if not course_name:
            # Try to get current course title
            course_response = self.get_course(course_id)
            if not isinstance(course_response, dict) or 'error' in course_response:
                logger.error(f"Failed to get course details for {course_id}")
            else:
                course_name = course_response.get('title', '')

        # Step 2: Upload image to media app FIRST if provided
        image_url = None
        if image_file:
            media_response = self.upload_course_image(image_file, course_id, course_name)
            if media_response and 'image' in media_response:
                image_url = media_response['image']
                logger.info(f"Successfully uploaded image to media app: {image_url}")
            elif media_response and 'error' in media_response:
                logger.error(f"Failed to upload course image: {media_response['error']}")
                return {'error': f"Media upload failed: {media_response['error']}"}
        
        # Step 3: Add the image URL to course data if we have one
        if image_url:
            data['image_url'] = image_url
            logger.info(f"Added image_url to course data: {image_url}")
        
        # Step 4: Update course with the new data
        logger.info(f"Updating course with data: {data}")
        return self._make_request('PUT', f'/courses/{course_id}/', data)

    def delete_course(self, course_id):
        return self._make_request('DELETE', f'/courses/{course_id}/', expected_statuses=[200, 204])

    # Lesson operations
    def get_lessons(self, course_id=None):
        endpoint = '/lessons/'
        if course_id:
            endpoint += f'?course_id={course_id}'
        return self._make_request('GET', endpoint)

    def create_lesson(self, data):
        # Resolve course external_id to primary key
        if 'course_external_id' in data:
            course_pk = self._resolve_external_id_to_pk(data['course_external_id'], 'course')
            if course_pk:
                data['course'] = course_pk
                del data['course_external_id']
            else:
                return {'error': f"Could not resolve course with external_id: {data['course_external_id']}"}
        
        return self._make_request('POST', '/lessons/', data)

    def update_lesson(self, lesson_id, data):
        # Resolve course external_id to primary key
        if 'course_external_id' in data:
            course_pk = self._resolve_external_id_to_pk(data['course_external_id'], 'course')
            if course_pk:
                data['course'] = course_pk
                del data['course_external_id']
            else:
                return {'error': f"Could not resolve course with external_id: {data['course_external_id']}"}
        
        return self._make_request('PUT', f'/lessons/{lesson_id}/', data)

    def delete_lesson(self, lesson_id):
        return self._make_request('DELETE', f'/lessons/{lesson_id}/', expected_statuses=[200, 204])

    # Comment operations
    def get_comments(self, course_id=None):
        endpoint = '/comments/'
        if course_id:
            endpoint += f'?course_id={course_id}'
        return self._make_request('GET', endpoint)

    def create_comment(self, data):
        # Resolve course external_id to primary key
        if 'course_external_id' in data:
            course_pk = self._resolve_external_id_to_pk(data['course_external_id'], 'course')
            if course_pk:
                data['course'] = course_pk
                del data['course_external_id']
            else:
                return {'error': f"Could not resolve course with external_id: {data['course_external_id']}"}
        
        return self._make_request('POST', '/comments/', data)

    def update_comment(self, comment_id, data):
        # Resolve course external_id to primary key
        if 'course_external_id' in data:
            course_pk = self._resolve_external_id_to_pk(data['course_external_id'], 'course')
            if course_pk:
                data['course'] = course_pk
                del data['course_external_id']
            else:
                return {'error': f"Could not resolve course with external_id: {data['course_external_id']}"}
        
        return self._make_request('PUT', f'/comments/{comment_id}/', data)

    def delete_comment(self, comment_id):
        return self._make_request('DELETE', f'/comments/{comment_id}/', expected_statuses=[200, 204])

    # Homework operations
    def get_homeworks(self, course_id=None):
        endpoint = '/homeworks/'
        if course_id:
            endpoint += f'?course_id={course_id}'
        return self._make_request('GET', endpoint)

    def create_homework(self, data):
        # Resolve course external_id to primary key
        if 'course_external_id' in data:
            course_pk = self._resolve_external_id_to_pk(data['course_external_id'], 'course')
            if course_pk:
                data['course'] = course_pk
                del data['course_external_id']
            else:
                return {'error': f"Could not resolve course with external_id: {data['course_external_id']}"}
        
        # Resolve lesson external_id to primary key if provided
        if 'lesson_external_id' in data and data['lesson_external_id']:
            lesson_pk = self._resolve_external_id_to_pk(data['lesson_external_id'], 'lesson')
            if lesson_pk:
                data['lesson'] = lesson_pk
            del data['lesson_external_id']
        
        return self._make_request('POST', '/homeworks/', data)

    def update_homework(self, homework_id, data):
        # Resolve course external_id to primary key
        if 'course_external_id' in data:
            course_pk = self._resolve_external_id_to_pk(data['course_external_id'], 'course')
            if course_pk:
                data['course'] = course_pk
                del data['course_external_id']
            else:
                return {'error': f"Could not resolve course with external_id: {data['course_external_id']}"}
        
        # Resolve lesson external_id to primary key if provided
        if 'lesson_external_id' in data and data['lesson_external_id']:
            lesson_pk = self._resolve_external_id_to_pk(data['lesson_external_id'], 'lesson')
            if lesson_pk:
                data['lesson'] = lesson_pk
            del data['lesson_external_id']
        
        return self._make_request('PUT', f'/homeworks/{homework_id}/', data)

    def delete_homework(self, homework_id):
        return self._make_request('DELETE', f'/homeworks/{homework_id}/', expected_statuses=[200, 204])

    # Submitted homework operations
    def get_submitted_homeworks(self, user_id=None, homework_id=None):
        endpoint = '/submitted-homeworks/'
        params = []
        if user_id:
            params.append(f'user_id={user_id}')
        if homework_id:
            params.append(f'homework_id={homework_id}')
        if params:
            endpoint += '?' + '&'.join(params)
        return self._make_request('GET', endpoint)

    def create_submitted_homework(self, data):
        # Resolve homework external_id to primary key
        if 'homework_external_id' in data:
            homework_pk = self._resolve_external_id_to_pk(data['homework_external_id'], 'homework')
            if homework_pk:
                data['homework'] = homework_pk
                del data['homework_external_id']
            else:
                return {'error': f"Could not resolve homework with external_id: {data['homework_external_id']}"}
        
        return self._make_request('POST', '/submitted-homeworks/', data)

    def update_submitted_homework(self, submission_id, data):
        # Resolve homework external_id to primary key
        if 'homework_external_id' in data:
            homework_pk = self._resolve_external_id_to_pk(data['homework_external_id'], 'homework')
            if homework_pk:
                data['homework'] = homework_pk
                del data['homework_external_id']
            else:
                return {'error': f"Could not resolve homework with external_id: {data['homework_external_id']}"}
        
        return self._make_request('PUT', f'/submitted-homeworks/{submission_id}/', data)

    def delete_submitted_homework(self, submission_id):
        return self._make_request('DELETE', f'/submitted-homeworks/{submission_id}/', expected_statuses=[200, 204])

    # Registration operations
    def get_registrations(self, user_id=None, course_id=None):
        endpoint = '/registrations/'
        params = []
        if user_id:
            params.append(f'user_id={user_id}')
        if course_id:
            params.append(f'course_id={course_id}')
        if params:
            endpoint += '?' + '&'.join(params)
        return self._make_request('GET', endpoint)

    def create_registration(self, data):
        # Resolve course external_id to primary key
        if 'course_external_id' in data:
            course_pk = self._resolve_external_id_to_pk(data['course_external_id'], 'course')
            if course_pk:
                data['course'] = course_pk
                del data['course_external_id']
            else:
                return {'error': f"Could not resolve course with external_id: {data['course_external_id']}"}
        
        return self._make_request('POST', '/registrations/', data)

    def delete_registration(self, registration_id):
        return self._make_request('DELETE', f'/registrations/{registration_id}/', expected_statuses=[200, 204])

    # Media operations - UPDATED to accept course_name parameter
    def upload_course_image(self, image_file, course_id=None, course_name=None):
        domain = self._get_random_domain(self.media_domains)
        if not domain:
            return {'error': 'No media domains available'}

        url = f"{domain}/course-images/"
        
        # Prepare the data for media app - include course name
        files = {'image': image_file}
        data = {
            'course_id': course_id,
            'course_name': course_name if course_name else f'Course {course_id[:8]}'  # Provide fallback name
        }
        
        # Debug logging
        logger.info(f"Uploading course image to: {url}")
        logger.info(f"Course ID for media: {data['course_id']}")
        logger.info(f"Course Name for media: {data['course_name']}")

        try:
            response = requests.post(
                url,
                files=files,
                data=data,
                headers={'Authorization': f'Token {self.auth_token}'},
                timeout=30
            )
            
            logger.info(f"Media upload response status: {response.status_code}")
            logger.info(f"Media upload response: {response.text}")
            
            if response.status_code in [200, 201]:
                result = response.json()
                # Ensure we return the image URL in the expected format
                if 'image' in result:
                    return result
                elif 'image_url' in result:
                    # If the media app returns 'image_url' instead of 'image'
                    return {'image': result['image_url']}
                else:
                    logger.error(f"Media upload response missing image URL: {result}")
                    return {'error': 'Media upload response missing image URL'}
            else:
                logger.error(f"Media upload failed: {response.status_code} - {response.text}")
                return {'error': f'Media upload failed: {response.status_code}'}
        except requests.RequestException as e:
            logger.error(f"Media upload request failed: {str(e)}")
            return {'error': str(e)}
        
@method_decorator(login_required, name='dispatch')
class SelfStudyCourseView(View):
    def get(self, request):
        auth_token = os.getenv('AUTH_TOKEN', 'default-token')
        return render(request, 'selfstudycourse.html', {'auth_token': auth_token})

@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(login_required, name='dispatch')
class CourseAPIView(View):
    def __init__(self):
        super().__init__()
        self.api_client = CourseAPIClient()

    def get(self, request, *args, **kwargs):
        action = request.GET.get('action')
        
        try:
            if action == 'get_users':
                result = self.api_client.get_users()
            elif action == 'get_courses':
                result = self.api_client.get_courses()
            elif action == 'get_course':
                course_id = request.GET.get('course_id')
                result = self.api_client.get_course(course_id)
            elif action == 'get_lessons':
                course_id = request.GET.get('course_id')
                result = self.api_client.get_lessons(course_id)
            elif action == 'get_comments':
                course_id = request.GET.get('course_id')
                result = self.api_client.get_comments(course_id)
            elif action == 'get_homeworks':
                course_id = request.GET.get('course_id')
                result = self.api_client.get_homeworks(course_id)
            elif action == 'get_submitted_homeworks':
                user_id = request.GET.get('user_id')
                homework_id = request.GET.get('homework_id')
                result = self.api_client.get_submitted_homeworks(user_id, homework_id)
            elif action == 'get_registrations':
                user_id = request.GET.get('user_id')
                course_id = request.GET.get('course_id')
                result = self.api_client.get_registrations(user_id, course_id)
            else:
                result = {'error': 'Invalid action'}

            return JsonResponse(result, safe=False)

        except Exception as e:
            logger.error(f"Error in CourseAPIView GET: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def post(self, request, *args, **kwargs):
        action = request.POST.get('action')
        
        try:
            if action == 'create_course':
                data = {
                    'title': request.POST.get('title'),
                    'description': request.POST.get('description')
                }
                image_file = request.FILES.get('image')
                result = self.api_client.create_course(data, image_file)
            elif action == 'update_course':
                data = {
                    'title': request.POST.get('title'),
                    'description': request.POST.get('description')
                }
                image_file = request.FILES.get('image')
                course_id = request.POST.get('course_id')
                result = self.api_client.update_course(course_id, data, image_file)
            elif action == 'create_lesson':
                data = {
                    'external_lesson_id': str(uuid.uuid4()),
                    'title': request.POST.get('title'),
                    'course_external_id': request.POST.get('course_external_id'),
                    'source_code_url': request.POST.get('source_code_url'),
                    'reading_url': request.POST.get('reading_url')
                }
                result = self.api_client.create_lesson(data)
            elif action == 'update_lesson':
                data = {
                    'title': request.POST.get('title'),
                    'course_external_id': request.POST.get('course_external_id'),
                    'source_code_url': request.POST.get('source_code_url'),
                    'reading_url': request.POST.get('reading_url')
                }
                lesson_id = request.POST.get('lesson_id')
                result = self.api_client.update_lesson(lesson_id, data)
            elif action == 'create_comment':
                data = {
                    'external_comment_id': str(uuid.uuid4()),
                    'content': request.POST.get('content'),
                    'user_id': request.POST.get('user_id'),
                    'course_external_id': request.POST.get('course_external_id')
                }
                result = self.api_client.create_comment(data)
            elif action == 'update_comment':
                data = {
                    'content': request.POST.get('content'),
                    'user_id': request.POST.get('user_id'),
                    'course_external_id': request.POST.get('course_external_id')
                }
                comment_id = request.POST.get('comment_id')
                result = self.api_client.update_comment(comment_id, data)
            elif action == 'create_homework':
                data = {
                    'external_homework_id': str(uuid.uuid4()),
                    'title': request.POST.get('title'),
                    'homework_url': request.POST.get('homework_url'),
                    'course_external_id': request.POST.get('course_external_id'),
                    'lesson_external_id': request.POST.get('lesson_external_id') if request.POST.get('lesson_external_id') else None,
                    'description': request.POST.get('description')
                }
                result = self.api_client.create_homework(data)
            elif action == 'update_homework':
                data = {
                    'title': request.POST.get('title'),
                    'homework_url': request.POST.get('homework_url'),
                    'course_external_id': request.POST.get('course_external_id'),
                    'lesson_external_id': request.POST.get('lesson_external_id') if request.POST.get('lesson_external_id') else None,
                    'description': request.POST.get('description')
                }
                homework_id = request.POST.get('homework_id')
                result = self.api_client.update_homework(homework_id, data)
            elif action == 'create_submitted_homework':
                data = {
                    'external_submitted_homework_id': str(uuid.uuid4()),
                    'user_id': request.POST.get('user_id'),
                    'homework_external_id': request.POST.get('homework_external_id'),
                    'submitted_homework_url': request.POST.get('submitted_homework_url'),
                    'description': request.POST.get('description')
                }
                result = self.api_client.create_submitted_homework(data)
            elif action == 'update_submitted_homework':
                data = {
                    'user_id': request.POST.get('user_id'),
                    'homework_external_id': request.POST.get('homework_external_id'),
                    'submitted_homework_url': request.POST.get('submitted_homework_url'),
                    'description': request.POST.get('description')
                }
                submission_id = request.POST.get('submission_id')
                result = self.api_client.update_submitted_homework(submission_id, data)
            elif action == 'create_registration':
                data = {
                    'external_id': str(uuid.uuid4()),
                    'user_id': request.POST.get('user_id'),
                    'course_external_id': request.POST.get('course_external_id')
                }
                result = self.api_client.create_registration(data)
            else:
                result = {'error': 'Invalid action'}

            return JsonResponse(result, safe=False)

        except Exception as e:
            logger.error(f"Error in CourseAPIView POST: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete(self, request, *args, **kwargs):
        import json
        data = json.loads(request.body)
        action = data.get('action')
        
        try:
            if action == 'delete_course':
                course_id = data.get('course_id')
                result = self.api_client.delete_course(course_id)
            elif action == 'delete_lesson':
                lesson_id = data.get('lesson_id')
                result = self.api_client.delete_lesson(lesson_id)
            elif action == 'delete_comment':
                comment_id = data.get('comment_id')
                result = self.api_client.delete_comment(comment_id)
            elif action == 'delete_homework':
                homework_id = data.get('homework_id')
                result = self.api_client.delete_homework(homework_id)
            elif action == 'delete_submitted_homework':
                submission_id = data.get('submission_id')
                result = self.api_client.delete_submitted_homework(submission_id)
            elif action == 'delete_registration':
                registration_id = data.get('registration_id')
                result = self.api_client.delete_registration(registration_id)
            else:
                result = {'error': 'Invalid action'}

            return JsonResponse(result, safe=False)

        except Exception as e:
            logger.error(f"Error in CourseAPIView DELETE: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)