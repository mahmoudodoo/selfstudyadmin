from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
import requests
import os
import random
import logging
from dotenv import load_dotenv
load_dotenv()
logger = logging.getLogger(__name__)

def get_dynamic_domains():
    """
    Get dynamic domains from SelfStudy Domains registry for app_id=13
    """
    registry_instances = [
        "https://sfsdomains1.pythonanywhere.com",
        "https://sfsdomains2.pythonanywhere.com"
    ]
    
    auth_token = os.getenv('AUTH_TOKEN')
    app_id = 13
    
    for registry_url in registry_instances:
        try:
            url = f"{registry_url.rstrip('/')}/apps/{app_id}/"
            headers = {'Content-Type': 'application/json'}
            if auth_token:
                headers['Authorization'] = f'Token {auth_token}'

            logger.info(f"Fetching domains from: {url}")
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code == 200:
                app_data = response.json()
                replica_urls = [replica['replica_url'].rstrip('/') for replica in app_data.get('replicas', [])]
                logger.info(f"Successfully fetched {len(replica_urls)} replicas")
                return replica_urls
                
        except requests.RequestException as e:
            logger.error(f"Request failed for {registry_url}: {str(e)}")
            continue
        except Exception as e:
            logger.error(f"Unexpected error fetching from {registry_url}: {str(e)}")
            continue
    
    # Fallback to empty list if all fail
    logger.warning("All registry instances failed, returning empty domain list")
    return []

def get_random_replica_url():
    """
    Get a random replica URL from available domains
    """
    domains = get_dynamic_domains()
    if domains:
        return random.choice(domains)
    return None

def make_api_request(endpoint, method='GET', data=None, headers=None):
    """
    Make API request to selected replica with authentication
    """
    base_url = get_random_replica_url()
    if not base_url:
        return None, "No available domains"
    
    url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"
    auth_token = os.getenv('AUTH_TOKEN')
    
    default_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Token {auth_token}' if auth_token else ''
    }
    
    if headers:
        default_headers.update(headers)
    
    logger.info(f"Making {method} request to: {url}")
    if data:
        logger.info(f"Request data: { {k: '****' if k == 'password' else v for k, v in data.items()} }")
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, headers=default_headers, timeout=10)
        elif method.upper() == 'POST':
            response = requests.post(url, json=data, headers=default_headers, timeout=10)
        elif method.upper() == 'PUT':
            response = requests.put(url, json=data, headers=default_headers, timeout=10)
        elif method.upper() == 'PATCH':
            response = requests.patch(url, json=data, headers=default_headers, timeout=10)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, headers=default_headers, timeout=10)
        else:
            return None, f"Unsupported method: {method}"
        
        logger.info(f"Response status: {response.status_code}")
        logger.info(f"Response content: {response.text}")
            
        return response, None
        
    except requests.RequestException as e:
        logger.error(f"API request failed for {url}: {str(e)}")
        return None, str(e)

@method_decorator(login_required, name='dispatch')
class SelfStudyUserProfileView(View):
    def get(self, request):
        # Fetch all user profiles
        response, error = make_api_request('profiles/')
        users = []
        
        if error:
            logger.error(f"Failed to fetch users: {error}")
        elif response and response.status_code == 200:
            users = response.json()
            logger.info(f"Successfully fetched {len(users)} users")
        elif response:
            logger.error(f"Failed to fetch users: {response.status_code} - {response.text}")
        
        context = {
            'users': users,
            'error': error
        }
        return render(request, 'selfstudyuserprofile.html', context)
    
    def post(self, request):
        action_type = request.POST.get('action')
        logger.info(f"Processing {action_type} action")
        
        if action_type == 'create':
            return self._create_user(request)
        elif action_type == 'update':
            return self._update_user(request)
        elif action_type == 'delete':
            return self._delete_user(request)
        else:
            return self.get(request)
    
    def _create_user(self, request):
        user_data = {
            'username': request.POST.get('username', '').lower(),
            'email': request.POST.get('email', '').lower(),
            'password': request.POST.get('password', ''),
            'first_name': request.POST.get('first_name', ''),
            'last_name': request.POST.get('last_name', ''),
            'gender': request.POST.get('gender', ''),
            'image_url': request.POST.get('image_url', ''),
            'lab_url': request.POST.get('lab_url', ''),
            'is_email_verified': request.POST.get('is_email_verified') == 'true'
        }
        
        response, error = make_api_request('profiles/', 'POST', user_data)
        
        if error or not response or response.status_code not in [200, 201]:
            error_msg = error or f"Failed to create user: {response.status_code if response else 'No response'}"
            logger.error(error_msg)
        else:
            logger.info("User created successfully")
        
        return self.get(request)
    
    def _update_user(self, request):
        user_id = request.POST.get('user_id')
        logger.info(f"Updating user with ID: {user_id}")
        
        user_data = {
            'username': request.POST.get('username', '').lower(),
            'email': request.POST.get('email', '').lower(),
            'first_name': request.POST.get('first_name', ''),
            'last_name': request.POST.get('last_name', ''),
            'gender': request.POST.get('gender', ''),
            'image_url': request.POST.get('image_url', ''),
            'lab_url': request.POST.get('lab_url', ''),
            'is_email_verified': request.POST.get('is_email_verified') == 'true'
        }
        
        # Only include password if provided
        password = request.POST.get('password')
        if password:
            user_data['password'] = password
        
        # Try PUT first, then PATCH if PUT fails
        response, error = make_api_request(f'profiles/{user_id}/', 'PUT', user_data)
        
        if error or not response:
            logger.error(f"PUT failed: {error}")
            # Try PATCH as fallback
            response, error = make_api_request(f'profiles/{user_id}/', 'PATCH', user_data)
        
        if error or not response or response.status_code not in [200, 201]:
            error_msg = error or f"Failed to update user: {response.status_code if response else 'No response'} - {response.text if response else ''}"
            logger.error(error_msg)
        else:
            logger.info(f"User {user_id} updated successfully")
        
        return self.get(request)
    
    def _delete_user(self, request):
        user_id = request.POST.get('user_id')
        
        response, error = make_api_request(f'profiles/{user_id}/', 'DELETE')
        
        if error or not response or response.status_code != 204:
            error_msg = error or f"Failed to delete user: {response.status_code if response else 'No response'}"
            logger.error(error_msg)
        else:
            logger.info(f"User {user_id} deleted successfully")
        
        return self.get(request)