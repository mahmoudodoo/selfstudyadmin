import os
import logging
import requests
import random
import uuid
from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json

logger = logging.getLogger(__name__)

# Authentication token
AUTH_TOKEN = os.getenv('AUTH_TOKEN', 'default-token-change-in-production')

# SelfStudy Domains registry instances
SFS_DOMAINS_INSTANCES = [
    "https://sfsdomains1.pythonanywhere.com",
    "https://sfsdomains2.pythonanywhere.com"
]

# App IDs
SELFSTUDY_LIVECOURSE_APP_ID = 12
USERPROFILE_APP_ID = 13
SELFSTUDY_COURSE_APP_ID = 19

class DomainDiscovery:
    """Handles dynamic domain discovery for all apps"""
    
    @staticmethod
    def get_working_domain_instance():
        """Get the first working SelfStudy Domains instance"""
        for domain in SFS_DOMAINS_INSTANCES:
            try:
                health_url = f"{domain}/apps/"
                headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                response = requests.get(health_url, headers=headers, timeout=5)
                if response.status_code == 200:
                    logger.info(f"Found working domain instance: {domain}")
                    return domain
            except requests.RequestException as e:
                logger.warning(f"Domain instance {domain} is not reachable: {e}")
                continue
        logger.error("No working SelfStudy Domains instances found")
        return None

    @staticmethod
    def fetch_replica_urls_from_registry(app_id: int):
        """Fetch replica URLs for a specific app from SelfStudy Domains registry"""
        base_domain = DomainDiscovery.get_working_domain_instance()
        if not base_domain:
            logger.error("Cannot fetch replica URLs: no working domain instance")
            return []

        try:
            url = f"{base_domain}/apps/{app_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }

            logger.info(f"Fetching replica URLs from: {url}")
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code == 200:
                app_data = response.json()
                replica_urls = [replica['replica_url'].rstrip('/') for replica in app_data.get('replicas', [])]
                logger.info(f"Found {len(replica_urls)} replica URLs for app {app_id}")
                return replica_urls
            else:
                logger.error(f"Failed to fetch app data: {response.status_code} - {response.text}")
                return []

        except requests.RequestException as e:
            logger.error(f"Request failed for app {app_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching replica URLs for app {app_id}: {e}")
            return []

    @staticmethod
    def get_random_replica_url(app_id: int):
        """Get a random working replica URL for an app"""
        replica_urls = DomainDiscovery.fetch_replica_urls_from_registry(app_id)
        if not replica_urls:
            # Fallback to hardcoded domains
            if app_id == USERPROFILE_APP_ID:
                replica_urls = [
                    "https://selfstudyuserprofile1.pythonanywhere.com",
                    "https://selfstudyuserprofile2.pythonanywhere.com"
                ]
            elif app_id == SELFSTUDY_COURSE_APP_ID:
                replica_urls = [
                    "https://selfstudycourse1.pythonanywhere.com",
                    "https://selfstudycourse2.pythonanywhere.com"
                ]
            elif app_id == SELFSTUDY_LIVECOURSE_APP_ID:
                replica_urls = [
                    "https://selfstudylivecourse1.pythonanywhere.com",
                    "https://selfstudylivecourse2.pythonanywhere.com"
                ]
        
        if replica_urls:
            return random.choice(replica_urls)
        return None

class ExternalDataService:
    """Service to fetch data from external apps"""
    
    @staticmethod
    def make_authenticated_request(url, method='GET', data=None):
        """Make authenticated request with AUTH_TOKEN"""
        try:
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Making {method} request to {url} with data: {data}")
            
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return None
                
            logger.info(f"Response status: {response.status_code}, content: {response.text}")
                
            if response.status_code in [200, 201]:
                return response.json()
            else:
                logger.error(f"Request failed: {response.status_code} - {response.text}")
                return None
                
        except requests.RequestException as e:
            logger.error(f"Request failed for {url}: {e}")
            return None

    @staticmethod
    def get_userprofiles():
        """Get all userprofiles from userprofile app"""
        base_url = DomainDiscovery.get_random_replica_url(USERPROFILE_APP_ID)
        if not base_url:
            return []
            
        url = f"{base_url}/profiles/"
        return ExternalDataService.make_authenticated_request(url)

    @staticmethod
    def get_courses():
        """Get all courses from selfstudycourse app"""
        base_url = DomainDiscovery.get_random_replica_url(SELFSTUDY_COURSE_APP_ID)
        if not base_url:
            return []
            
        url = f"{base_url}/courses/"
        return ExternalDataService.make_authenticated_request(url)

    @staticmethod
    def get_teachers():
        """Get all teachers from selfstudylivecourse app"""
        base_url = DomainDiscovery.get_random_replica_url(SELFSTUDY_LIVECOURSE_APP_ID)
        if not base_url:
            return []
            
        url = f"{base_url}/api/teachers/"
        return ExternalDataService.make_authenticated_request(url)

    @staticmethod
    def get_live_course_rooms():
        """Get all live course rooms from selfstudylivecourse app"""
        base_url = DomainDiscovery.get_random_replica_url(SELFSTUDY_LIVECOURSE_APP_ID)
        if not base_url:
            return []
            
        url = f"{base_url}/api/live-course-rooms/"
        return ExternalDataService.make_authenticated_request(url)

    @staticmethod
    def create_teacher(teacher_data):
        """Create a new teacher"""
        base_url = DomainDiscovery.get_random_replica_url(SELFSTUDY_LIVECOURSE_APP_ID)
        if not base_url:
            return None
            
        # Generate teacher_id if not provided
        if 'teacher_id' not in teacher_data:
            teacher_data['teacher_id'] = str(uuid.uuid4())
            
        url = f"{base_url}/api/teachers/"
        return ExternalDataService.make_authenticated_request(url, 'POST', teacher_data)

    @staticmethod
    def create_live_course_room(room_data):
        """Create a new live course room"""
        base_url = DomainDiscovery.get_random_replica_url(SELFSTUDY_LIVECOURSE_APP_ID)
        if not base_url:
            return None
            
        # Generate room_id if not provided
        if 'room_id' not in room_data:
            room_data['room_id'] = str(uuid.uuid4())
            
        # Generate student_id if not provided but student_name is
        if 'student_id' not in room_data and 'student_name' in room_data:
            # Try to find student_id from userprofiles
            userprofiles = ExternalDataService.get_userprofiles() or []
            for user in userprofiles:
                if user.get('username') == room_data['student_name']:
                    room_data['student_id'] = user.get('user_id')
                    break
            
            # If still no student_id, generate one
            if 'student_id' not in room_data:
                room_data['student_id'] = str(uuid.uuid4())
            
        url = f"{base_url}/api/live-course-rooms/"
        return ExternalDataService.make_authenticated_request(url, 'POST', room_data)

    @staticmethod
    def update_teacher(teacher_id, teacher_data):
        """Update a teacher"""
        base_url = DomainDiscovery.get_random_replica_url(SELFSTUDY_LIVECOURSE_APP_ID)
        if not base_url:
            return None
            
        # Ensure teacher_id is in the data
        teacher_data['teacher_id'] = teacher_id
            
        url = f"{base_url}/api/teachers/{teacher_id}/"
        return ExternalDataService.make_authenticated_request(url, 'PUT', teacher_data)

    @staticmethod
    def update_live_course_room(room_id, room_data):
        """Update a live course room"""
        base_url = DomainDiscovery.get_random_replica_url(SELFSTUDY_LIVECOURSE_APP_ID)
        if not base_url:
            return None
            
        # Ensure room_id is in the data
        room_data['room_id'] = room_id
            
        url = f"{base_url}/api/live-course-rooms/{room_id}/"
        return ExternalDataService.make_authenticated_request(url, 'PUT', room_data)

    @staticmethod
    def delete_teacher(teacher_id):
        """Delete a teacher"""
        base_url = DomainDiscovery.get_random_replica_url(SELFSTUDY_LIVECOURSE_APP_ID)
        if not base_url:
            return False
            
        try:
            url = f"{base_url}/api/teachers/{teacher_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            response = requests.delete(url, headers=headers, timeout=10)
            logger.info(f"Delete teacher response: {response.status_code}")
            return response.status_code == 204
        except requests.RequestException as e:
            logger.error(f"Delete teacher failed: {e}")
            return False

    @staticmethod
    def delete_live_course_room(room_id):
        """Delete a live course room"""
        base_url = DomainDiscovery.get_random_replica_url(SELFSTUDY_LIVECOURSE_APP_ID)
        if not base_url:
            return False
            
        try:
            url = f"{base_url}/api/live-course-rooms/{room_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            response = requests.delete(url, headers=headers, timeout=10)
            logger.info(f"Delete room response: {response.status_code}")
            return response.status_code == 204
        except requests.RequestException as e:
            logger.error(f"Delete room failed: {e}")
            return False

@method_decorator(login_required, name='dispatch')
class SelfStudyLiveCourseView(View):
    """Main view for Live Courses Management"""
    
    def get(self, request):
        context = {
            'page_title': 'Live Courses Management',
            'app_name': 'selfstudylivecourse'
        }
        return render(request, 'selfstudylivecourse.html', context)

@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(login_required, name='dispatch')
class LiveCourseDataView(View):
    """API endpoint for live course data operations"""
    
    def get(self, request):
        """Get all data for the management interface"""
        try:
            userprofiles = ExternalDataService.get_userprofiles() or []
            courses = ExternalDataService.get_courses() or []
            teachers = ExternalDataService.get_teachers() or []
            live_course_rooms = ExternalDataService.get_live_course_rooms() or []
            
            return JsonResponse({
                'success': True,
                'userprofiles': userprofiles,
                'courses': courses,
                'teachers': teachers,
                'live_course_rooms': live_course_rooms
            })
        except Exception as e:
            logger.error(f"Error fetching data: {e}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)

    def post(self, request):
        """Handle create operations"""
        try:
            data = json.loads(request.body)
            action = data.get('action')
            
            if action == 'create_teacher':
                teacher_data = {
                    'teachername': data.get('teachername')
                }
                result = ExternalDataService.create_teacher(teacher_data)
                if result:
                    return JsonResponse({'success': True, 'data': result})
                else:
                    return JsonResponse({'success': False, 'error': 'Failed to create teacher'}, status=400)
                    
            elif action == 'create_live_course_room':
                room_data = {
                    'course_name': data.get('course_name'),
                    'student_name': data.get('student_name'),
                    'student_id': data.get('student_id'),
                    'room_url': data.get('room_url'),
                    'teacher': data.get('teacher_id')
                }
                result = ExternalDataService.create_live_course_room(room_data)
                if result:
                    return JsonResponse({'success': True, 'data': result})
                else:
                    return JsonResponse({'success': False, 'error': 'Failed to create live course room'}, status=400)
                    
            else:
                return JsonResponse({'success': False, 'error': 'Invalid action'}, status=400)
                
        except Exception as e:
            logger.error(f"Error in POST operation: {e}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    def put(self, request):
        """Handle update operations"""
        try:
            data = json.loads(request.body)
            action = data.get('action')
            
            if action == 'update_teacher':
                teacher_data = {
                    'teachername': data.get('teachername')
                }
                result = ExternalDataService.update_teacher(data.get('teacher_id'), teacher_data)
                if result:
                    return JsonResponse({'success': True, 'data': result})
                else:
                    return JsonResponse({'success': False, 'error': 'Failed to update teacher'}, status=400)
                    
            elif action == 'update_live_course_room':
                room_data = {
                    'course_name': data.get('course_name'),
                    'student_name': data.get('student_name'),
                    'student_id': data.get('student_id'),
                    'room_url': data.get('room_url'),
                    'teacher': data.get('teacher_id')
                }
                result = ExternalDataService.update_live_course_room(data.get('room_id'), room_data)
                if result:
                    return JsonResponse({'success': True, 'data': result})
                else:
                    return JsonResponse({'success': False, 'error': 'Failed to update live course room'}, status=400)
                    
            else:
                return JsonResponse({'success': False, 'error': 'Invalid action'}, status=400)
                
        except Exception as e:
            logger.error(f"Error in PUT operation: {e}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    def delete(self, request):
        """Handle delete operations"""
        try:
            data = json.loads(request.body)
            action = data.get('action')
            
            if action == 'delete_teacher':
                success = ExternalDataService.delete_teacher(data.get('teacher_id'))
                return JsonResponse({'success': success})
                
            elif action == 'delete_live_course_room':
                success = ExternalDataService.delete_live_course_room(data.get('room_id'))
                return JsonResponse({'success': success})
                
            else:
                return JsonResponse({'success': False, 'error': 'Invalid action'}, status=400)
                
        except Exception as e:
            logger.error(f"Error in DELETE operation: {e}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)