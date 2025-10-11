from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
import requests
import random
import os
import logging
from django.http import JsonResponse
from django.conf import settings

logger = logging.getLogger(__name__)

class DomainDiscovery:
    """Dynamic domain discovery system for SelfStudy domains"""
    
    def __init__(self):
        self.app_id = 11
        self.registry_domains = [
            'https://sfsdomains1.pythonanywhere.com',
            'https://sfsdomains2.pythonanywhere.com'
        ]
        self.auth_token = os.getenv('AUTH_TOKEN')
        if not self.auth_token:
            logger.warning("AUTH_TOKEN environment variable not set")
        self.replica_urls = []
        self.available_replicas = []
        
    def get_working_registry(self):
        """Get first working registry domain - simplified health check"""
        for domain in self.registry_domains:
            try:
                # Try to access the apps endpoint directly instead of health check
                url = f"{domain}/apps/{self.app_id}/"
                headers = {}
                if self.auth_token:
                    headers['Authorization'] = f'Token {self.auth_token}'
                
                response = requests.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    logger.info(f"Using registry domain: {domain}")
                    return domain
            except requests.RequestException as e:
                logger.warning(f"Registry domain {domain} failed: {str(e)}")
                continue
        logger.error("All registry domains are unavailable")
        return None
    
    def fetch_replica_urls(self):
        """Fetch replica URLs from registry"""
        registry_domain = self.get_working_registry()
        
        if not registry_domain:
            # If registry fails, use hardcoded replicas as fallback
            logger.info("Using fallback replica URLs")
            self.replica_urls = [
                'https://selfstudyjouserlab1.pythonanywhere.com',
                'https://selfstudyuserlab2.pythonanywhere.com', 
                'https://selfstudylabuser.pythonanywhere.com'
            ]
            # Initialize available replicas with status
            self.available_replicas = [
                {'url': url, 'status': 'unknown', 'last_checked': None}
                for url in self.replica_urls
            ]
            return self.replica_urls
        
        try:
            url = f"{registry_domain}/apps/{self.app_id}/"
            headers = {}
            if self.auth_token:
                headers['Authorization'] = f'Token {self.auth_token}'
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            app_data = response.json()
            self.replica_urls = [
                replica['replica_url'].rstrip('/') 
                for replica in app_data.get('replicas', [])
            ]
            
            # Initialize available replicas with status
            self.available_replicas = [
                {'url': url, 'status': 'unknown', 'last_checked': None}
                for url in self.replica_urls
            ]
            
            logger.info(f"Fetched {len(self.replica_urls)} replica URLs from registry")
            return self.replica_urls
            
        except requests.RequestException as e:
            logger.error(f"Failed to fetch replica URLs from registry: {str(e)}")
            # Fallback to hardcoded replicas
            self.replica_urls = [
                'https://selfstudyjouserlab1.pythonanywhere.com',
                'https://selfstudyuserlab2.pythonanywhere.com',
                'https://selfstudylabuser.pythonanywhere.com'
            ]
            self.available_replicas = [
                {'url': url, 'status': 'unknown', 'last_checked': None}
                for url in self.replica_urls
            ]
            return self.replica_urls
        except Exception as e:
            logger.error(f"Unexpected error fetching replicas: {str(e)}")
            self.replica_urls = [
                'https://selfstudyjouserlab1.pythonanywhere.com',
                'https://selfstudyuserlab2.pythonanywhere.com',
                'https://selfstudylabuser.pythonanywhere.com'
            ]
            self.available_replicas = [
                {'url': url, 'status': 'unknown', 'last_checked': None}
                for url in self.replica_urls
            ]
            return self.replica_urls
    
    def check_replica_health(self, replica_url):
        """Check if a specific replica is healthy"""
        try:
            test_url = f"{replica_url}/api/students/"
            headers = {}
            if self.auth_token:
                headers['Authorization'] = f'Token {self.auth_token}'
            
            response = requests.get(test_url, headers=headers, timeout=5)
            return response.status_code == 200
        except requests.RequestException:
            return False
    
    def get_all_replicas_with_status(self):
        """Get all replicas with their health status"""
        if not self.available_replicas:
            self.fetch_replica_urls()
        
        # Check health of all replicas
        for replica in self.available_replicas:
            replica['status'] = 'healthy' if self.check_replica_health(replica['url']) else 'unhealthy'
        
        return self.available_replicas
    
    def get_random_replica(self):
        """Get a random working replica URL"""
        if not self.replica_urls:
            self.fetch_replica_urls()
            
        if not self.replica_urls:
            logger.error("No replica URLs available")
            return None
            
        # Try replicas in random order
        shuffled_replicas = self.replica_urls.copy()
        random.shuffle(shuffled_replicas)
        
        for replica_url in shuffled_replicas:
            try:
                # Try to access a simple endpoint to check if replica is working
                test_url = f"{replica_url}/api/students/"
                headers = {}
                if self.auth_token:
                    headers['Authorization'] = f'Token {self.auth_token}'
                
                response = requests.get(test_url, headers=headers, timeout=5)
                if response.status_code == 200:
                    logger.info(f"Using replica: {replica_url}")
                    return replica_url
            except requests.RequestException as e:
                logger.warning(f"Replica {replica_url} health check failed: {str(e)}")
                continue
                
        logger.warning("No replicas passed health check, using first replica as fallback")
        return self.replica_urls[0] if self.replica_urls else None

    def get_specific_replica(self, replica_url):
        """Get a specific replica URL if it's healthy"""
        if self.check_replica_health(replica_url):
            return replica_url
        else:
            logger.warning(f"Selected replica {replica_url} is unhealthy, falling back to random")
            return self.get_random_replica()

class SelfStudyUserLabAPI:
    """API client for SelfStudy User Lab operations"""
    
    def __init__(self):
        self.domain_discovery = DomainDiscovery()
        self.selected_replica = None
    
    def set_selected_replica(self, replica_url):
        """Set a specific replica to use for requests"""
        self.selected_replica = replica_url
    
    def make_authenticated_request(self, method, endpoint, data=None):
        """Make authenticated request to selected or random replica"""
        replica_url = None
        
        if self.selected_replica:
            # Use the selected replica if it's healthy
            replica_url = self.domain_discovery.get_specific_replica(self.selected_replica)
        else:
            # Use random replica if no specific replica is selected
            replica_url = self.domain_discovery.get_random_replica()
        
        if not replica_url:
            return {'error': 'No working replicas available', 'code': 'NO_REPLICAS'}
        
        try:
            # Ensure endpoint starts with /
            if not endpoint.startswith('/'):
                endpoint = '/' + endpoint
                
            url = f"{replica_url}{endpoint}"
            headers = {
                'Content-Type': 'application/json'
            }
            
            # Add authorization if token is available
            if self.domain_discovery.auth_token:
                headers['Authorization'] = f'Token {self.domain_discovery.auth_token}'
            
            logger.info(f"Making {method} request to: {url}")
            
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return {'error': 'Invalid HTTP method', 'code': 'INVALID_METHOD'}
            
            # Log response status for debugging
            logger.info(f"Response status: {response.status_code}")
            
            if response.status_code >= 400:
                return {
                    'error': f'API returned status {response.status_code}',
                    'code': 'API_ERROR',
                    'details': response.text
                }
            
            return response.json() if response.content else {'success': True}
            
        except requests.RequestException as e:
            logger.error(f"API request failed: {str(e)}")
            return {'error': f'API request failed: {str(e)}', 'code': 'API_ERROR'}
        except Exception as e:
            logger.error(f"Unexpected API error: {str(e)}")
            return {'error': f'Unexpected error: {str(e)}', 'code': 'UNEXPECTED_ERROR'}
    
    def get_replica_status(self):
        """Get status of all replicas"""
        return self.domain_discovery.get_all_replicas_with_status()
    
    # CRUD Operations - FIXED ENDPOINT URLs
    def get_students(self):
        """Get all students"""
        return self.make_authenticated_request('GET', '/api/students/')
    
    def get_student(self, student_id):
        """Get student by ID"""
        return self.make_authenticated_request('GET', f'/api/students/{student_id}/')
    
    def create_student(self, student_data):
        """Create new student"""
        return self.make_authenticated_request('POST', '/api/create-student/', student_data)
    
    def update_student(self, student_id, student_data):
        """Update student"""
        return self.make_authenticated_request('PUT', f'/api/students/{student_id}/update/', student_data)
    
    def delete_student(self, student_id):
        """Delete student"""
        return self.make_authenticated_request('DELETE', f'/api/students/{student_id}/delete/')
    
    def get_student_count(self):
        """Get student count"""
        return self.make_authenticated_request('GET', '/api/student-count/')

# Global instance to maintain replica selection state
_api_client_instance = None

def get_api_client():
    """Get or create the global API client instance"""
    global _api_client_instance
    if _api_client_instance is None:
        _api_client_instance = SelfStudyUserLabAPI()
    return _api_client_instance

@method_decorator(login_required, name='dispatch')
class SelfStudyUserLabView(View):
    """Main view for User Labs Management"""
    
    def get(self, request):
        api_client = get_api_client()
        
        # Get initial data
        students_data = api_client.get_students()
        count_data = api_client.get_student_count()
        replica_status = api_client.get_replica_status()
        
        # Handle different response formats
        students_list = []
        student_count = 0
        api_error = None
        
        if isinstance(students_data, list):
            students_list = students_data
        elif isinstance(students_data, dict) and 'error' in students_data:
            api_error = students_data.get('error')
            # Try to get students from first replica directly as fallback
            try:
                fallback_url = "https://selfstudyjouserlab1.pythonanywhere.com/api/students/"
                response = requests.get(fallback_url, timeout=10)
                if response.status_code == 200:
                    students_list = response.json()
                    api_error = None  # Clear error since fallback worked
            except:
                pass
        
        if isinstance(count_data, dict) and 'student_count' in count_data:
            student_count = count_data['student_count']
        elif isinstance(count_data, dict) and 'error' in count_data:
            # If count fails, use length of students list
            student_count = len(students_list)
        
        # Count healthy replicas
        healthy_replicas = len([r for r in replica_status if r.get('status') == 'healthy'])
        
        context = {
            'students': students_list,
            'student_count': student_count,
            'replica_count': healthy_replicas,
            'replica_status': replica_status,
            'api_error': api_error
        }
        
        return render(request, 'selfstudyuserlab.html', context)

@method_decorator(login_required, name='dispatch')
class SelfStudyUserLabAPIView(View):
    """API endpoint for AJAX operations"""
    
    def get(self, request, *args, **kwargs):
        api_client = get_api_client()
        action = request.GET.get('action')
        replica_url = request.GET.get('replica_url')
        
        # Set replica if provided in GET request
        if replica_url:
            api_client.set_selected_replica(replica_url)
        
        if action == 'get_students':
            data = api_client.get_students()
        elif action == 'get_student_count':
            data = api_client.get_student_count()
        elif action == 'get_replica_status':
            data = api_client.get_replica_status()
        else:
            data = {'error': 'Invalid action', 'code': 'INVALID_ACTION'}
        
        return JsonResponse(data, safe=False)
    
    def post(self, request, *args, **kwargs):
        import json
        try:
            api_client = get_api_client()
            data = json.loads(request.body)
            action = data.get('action')
            
            if action == 'create_student':
                # Use the currently set replica - no need to pass selected_replica
                result = api_client.create_student(data.get('student_data', {}))
            elif action == 'update_student':
                # Use the currently set replica - no need to pass selected_replica
                result = api_client.update_student(
                    data.get('student_id'), 
                    data.get('student_data', {})
                )
            elif action == 'delete_student':
                # Use the currently set replica - no need to pass selected_replica
                result = api_client.delete_student(data.get('student_id'))
            elif action == 'set_replica':
                # Set the replica for future requests
                selected_replica = data.get('replica_url')
                if selected_replica:
                    api_client.set_selected_replica(selected_replica)
                    result = {'success': True, 'message': f'Replica set to {selected_replica}'}
                else:
                    result = {'error': 'No replica URL provided', 'code': 'INVALID_REPLICA'}
            else:
                result = {'error': 'Invalid action', 'code': 'INVALID_ACTION'}
                
            return JsonResponse(result, safe=False)
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON', 'code': 'INVALID_JSON'})