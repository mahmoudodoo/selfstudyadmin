import os
import logging
import requests
import random
from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json
import uuid

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
    """Handles dynamic domain discovery and management"""
    
    def __init__(self):
        self.domains_cache = {}
        self.health_status = {}
    
    def get_working_domain_instance(self):
        """Get the first working SelfStudy Domains instance"""
        for domain in SFS_DOMAINS_INSTANCES:
            try:
                health_url = f"{domain}/health/"
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
    
    def fetch_replica_urls_from_registry(self, app_id: int):
        """Fetch replica URLs for a specific app from SelfStudy Domains registry"""
        base_domain = self.get_working_domain_instance()
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
    
    def get_domains_for_app(self, app_id: int):
        """Get domains for a specific app with caching"""
        if app_id not in self.domains_cache:
            self.domains_cache[app_id] = self.fetch_replica_urls_from_registry(app_id)
            if not self.domains_cache[app_id]:
                # Fallback domains
                if app_id == SELFSTUDY_LIVECOURSE_APP_ID:
                    self.domains_cache[app_id] = [
                        "https://selfstudylivecourse.pythonanywhere.com",
                        "https://selfstudylivecourse2.pythonanywhere.com"
                    ]
                elif app_id == USERPROFILE_APP_ID:
                    self.domains_cache[app_id] = [
                        "https://selfstudyuserprofile.pythonanywhere.com",
                        "https://selfstudyuserprofile2.pythonanywhere.com"
                    ]
                elif app_id == SELFSTUDY_COURSE_APP_ID:
                    self.domains_cache[app_id] = [
                        "https://selfstudycourse.pythonanywhere.com",
                        "https://selfstudycourse2.pythonanywhere.com"
                    ]
        
        return self.domains_cache[app_id]
    
    def get_random_domain(self, app_id: int):
        """Get a random working domain for an app"""
        domains = self.get_domains_for_app(app_id)
        if not domains:
            return None
        
        # Try to find a healthy domain
        healthy_domains = []
        for domain in domains:
            if self.is_domain_healthy(domain):
                healthy_domains.append(domain)
        
        if healthy_domains:
            return random.choice(healthy_domains)
        
        # If no healthy domains, return a random one
        return random.choice(domains)
    
    def is_domain_healthy(self, domain: str):
        """Check if a domain is healthy"""
        if domain in self.health_status:
            return self.health_status[domain]
        
        try:
            health_url = f"{domain}/health/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            response = requests.get(health_url, headers=headers, timeout=5)
            is_healthy = response.status_code == 200
            self.health_status[domain] = is_healthy
            return is_healthy
        except:
            self.health_status[domain] = False
            return False

# Global domain discovery instance
domain_discovery = DomainDiscovery()

class APIHelper:
    """Helper class for API operations"""
    
    @staticmethod
    def make_request(method, url, data=None, timeout=10):
        """Make authenticated HTTP request"""
        try:
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Token {AUTH_TOKEN}'
            }
            
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=timeout)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            return response
            
        except requests.RequestException as e:
            logger.error(f"Request failed for {url}: {e}")
            return None
    
    @staticmethod
    def get_teachers():
        """Get all teachers from livecourse app"""
        domain = domain_discovery.get_random_domain(SELFSTUDY_LIVECOURSE_APP_ID)
        if not domain:
            return []
        
        url = f"{domain}/api/teachers/"
        response = APIHelper.make_request('GET', url)
        
        if response and response.status_code == 200:
            return response.json()
        return []
    
    @staticmethod
    def get_live_course_rooms():
        """Get all live course rooms from livecourse app"""
        domain = domain_discovery.get_random_domain(SELFSTUDY_LIVECOURSE_APP_ID)
        if not domain:
            return []
        
        url = f"{domain}/api/live-course-rooms/"
        response = APIHelper.make_request('GET', url)
        
        if response and response.status_code == 200:
            return response.json()
        return []
    
    @staticmethod
    def get_user_profiles():
        """Get all user profiles from userprofile app"""
        domain = domain_discovery.get_random_domain(USERPROFILE_APP_ID)
        if not domain:
            return []
        
        url = f"{domain}/api/profiles/"
        response = APIHelper.make_request('GET', url)
        
        if response and response.status_code == 200:
            return response.json()
        return []
    
    @staticmethod
    def get_courses():
        """Get all courses from course app"""
        domain = domain_discovery.get_random_domain(SELFSTUDY_COURSE_APP_ID)
        if not domain:
            return []
        
        url = f"{domain}/api/courses/"
        response = APIHelper.make_request('GET', url)
        
        if response and response.status_code == 200:
            return response.json()
        return []
    
    @staticmethod
    def create_teacher(teacher_data):
        """Create a new teacher"""
        domain = domain_discovery.get_random_domain(SELFSTUDY_LIVECOURSE_APP_ID)
        if not domain:
            return None
        
        url = f"{domain}/api/teachers/"
        response = APIHelper.make_request('POST', url, teacher_data)
        
        if response and response.status_code == 201:
            return response.json()
        return None
    
    @staticmethod
    def create_live_course_room(room_data):
        """Create a new live course room"""
        domain = domain_discovery.get_random_domain(SELFSTUDY_LIVECOURSE_APP_ID)
        if not domain:
            return None
        
        url = f"{domain}/api/live-course-rooms/"
        response = APIHelper.make_request('POST', url, room_data)
        
        if response and response.status_code == 201:
            return response.json()
        return None
    
    @staticmethod
    def update_teacher(teacher_id, teacher_data):
        """Update a teacher"""
        domain = domain_discovery.get_random_domain(SELFSTUDY_LIVECOURSE_APP_ID)
        if not domain:
            return None
        
        url = f"{domain}/api/teachers/{teacher_id}/"
        response = APIHelper.make_request('PUT', url, teacher_data)
        
        if response and response.status_code == 200:
            return response.json()
        return None
    
    @staticmethod
    def update_live_course_room(room_id, room_data):
        """Update a live course room"""
        domain = domain_discovery.get_random_domain(SELFSTUDY_LIVECOURSE_APP_ID)
        if not domain:
            return None
        
        url = f"{domain}/api/live-course-rooms/{room_id}/"
        response = APIHelper.make_request('PUT', url, room_data)
        
        if response and response.status_code == 200:
            return response.json()
        return None
    
    @staticmethod
    def delete_teacher(teacher_id):
        """Delete a teacher"""
        domain = domain_discovery.get_random_domain(SELFSTUDY_LIVECOURSE_APP_ID)
        if not domain:
            return False
        
        url = f"{domain}/api/teachers/{teacher_id}/"
        response = APIHelper.make_request('DELETE', url)
        
        return response and response.status_code == 204
    
    @staticmethod
    def delete_live_course_room(room_id):
        """Delete a live course room"""
        domain = domain_discovery.get_random_domain(SELFSTUDY_LIVECOURSE_APP_ID)
        if not domain:
            return False
        
        url = f"{domain}/api/live-course-rooms/{room_id}/"
        response = APIHelper.make_request('DELETE', url)
        
        return response and response.status_code == 204

@method_decorator(login_required, name='dispatch')
class SelfStudyLiveCourseView(View):
    """Main view for Live Courses Management"""
    
    def get(self, request):
        context = {
            'app_name': 'SelfStudy Live Course',
            'page_title': 'Live Courses Management',
            'teachers': APIHelper.get_teachers(),
            'live_course_rooms': APIHelper.get_live_course_rooms(),
            'user_profiles': APIHelper.get_user_profiles(),
            'courses': APIHelper.get_courses(),
        }
        return render(request, 'selfstudylivecourse.html', context)

@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(login_required, name='dispatch')
class LiveCourseAPIView(View):
    """API endpoints for AJAX operations"""
    
    def get(self, request, *args, **kwargs):
        action = request.GET.get('action')
        
        if action == 'get_teachers':
            teachers = APIHelper.get_teachers()
            return JsonResponse({'teachers': teachers})
        
        elif action == 'get_rooms':
            rooms = APIHelper.get_live_course_rooms()
            return JsonResponse({'rooms': rooms})
        
        elif action == 'get_user_profiles':
            user_profiles = APIHelper.get_user_profiles()
            return JsonResponse({'user_profiles': user_profiles})
        
        elif action == 'get_courses':
            courses = APIHelper.get_courses()
            return JsonResponse({'courses': courses})
        
        return JsonResponse({'error': 'Invalid action'}, status=400)
    
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            action = data.get('action')
            
            if action == 'create_teacher':
                teacher_data = {
                    'teachername': data.get('teachername'),
                }
                result = APIHelper.create_teacher(teacher_data)
                if result:
                    return JsonResponse({'success': True, 'teacher': result})
                return JsonResponse({'success': False, 'error': 'Failed to create teacher'})
            
            elif action == 'create_live_course_room':
                room_data = {
                    'course_name': data.get('course_name'),
                    'student_name': data.get('student_name'),
                    'student_id': data.get('student_id'),
                    'room_url': data.get('room_url'),
                    'teacher': data.get('teacher_id'),
                }
                result = APIHelper.create_live_course_room(room_data)
                if result:
                    return JsonResponse({'success': True, 'room': result})
                return JsonResponse({'success': False, 'error': 'Failed to create live course room'})
            
            elif action == 'update_teacher':
                teacher_id = data.get('teacher_id')
                teacher_data = {
                    'teachername': data.get('teachername'),
                }
                result = APIHelper.update_teacher(teacher_id, teacher_data)
                if result:
                    return JsonResponse({'success': True, 'teacher': result})
                return JsonResponse({'success': False, 'error': 'Failed to update teacher'})
            
            elif action == 'update_live_course_room':
                room_id = data.get('room_id')
                room_data = {
                    'course_name': data.get('course_name'),
                    'student_name': data.get('student_name'),
                    'student_id': data.get('student_id'),
                    'room_url': data.get('room_url'),
                    'teacher': data.get('teacher_id'),
                }
                result = APIHelper.update_live_course_room(room_id, room_data)
                if result:
                    return JsonResponse({'success': True, 'room': result})
                return JsonResponse({'success': False, 'error': 'Failed to update live course room'})
            
            return JsonResponse({'error': 'Invalid action'}, status=400)
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    def delete(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            action = data.get('action')
            
            if action == 'delete_teacher':
                teacher_id = data.get('teacher_id')
                success = APIHelper.delete_teacher(teacher_id)
                return JsonResponse({'success': success})
            
            elif action == 'delete_live_course_room':
                room_id = data.get('room_id')
                success = APIHelper.delete_live_course_room(room_id)
                return JsonResponse({'success': success})
            
            return JsonResponse({'error': 'Invalid action'}, status=400)
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)