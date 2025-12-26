from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
import requests
import os
import random
import logging
import uuid
from dotenv import load_dotenv
load_dotenv()
logger = logging.getLogger(__name__)

def get_dynamic_domains(app_id):
    """
    Get dynamic domains from SelfStudy Domains registry for given app_id
    """
    registry_instances = [
        "https://sfsdomains1.pythonanywhere.com",
        "https://sfsdomains2.pythonanywhere.com"
    ]
    
    auth_token = os.getenv('AUTH_TOKEN')
    
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
                logger.info(f"Successfully fetched {len(replica_urls)} replicas for app_id {app_id}")
                return replica_urls
                
        except requests.RequestException as e:
            logger.error(f"Request failed for {registry_url}: {str(e)}")
            continue
        except Exception as e:
            logger.error(f"Unexpected error fetching from {registry_url}: {str(e)}")
            continue
    
    # Fallback domains
    fallback_domains = {
        13: ["https://selfstudyuserprofile1.pythonanywhere.com", "https://selfstudyuserprofile2.pythonanywhere.com"],
        18: ["https://selfstudymedia1.pythonanywhere.com", "https://selfstudymedia2.pythonanywhere.com"],
    }
    return fallback_domains.get(app_id, [])

def get_random_replica_url(app_id=13):
    """
    Get a random replica URL from available domains for given app
    """
    domains = get_dynamic_domains(app_id)
    if domains:
        return random.choice(domains)
    return None

def make_api_request(endpoint, method='GET', data=None, headers=None, app_id=13, files=None):
    """
    Make API request to selected replica with authentication
    """
    base_url = get_random_replica_url(app_id)
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
    if data and not files:
        logger.info(f"Request data: { {k: '****' if k == 'password' else v for k, v in data.items()} }")
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, headers=default_headers, timeout=10)
        elif method.upper() == 'POST':
            if files:
                # For file uploads, use different headers
                headers_for_file = {'Authorization': f'Token {auth_token}'} if auth_token else {}
                response = requests.post(url, files=files, data=data, headers=headers_for_file, timeout=30)
            else:
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

def upload_profile_image(image_file, user_id, username=None):
    """
    Upload profile image to media app with username
    """
    # Get media domains
    domains = get_dynamic_domains(18)
    if not domains:
        return None, "No media domains available"
    
    media_url = f"{random.choice(domains)}/profile-images/"
    auth_token = os.getenv('AUTH_TOKEN')
    
    # Prepare data for media app
    files = {'image': image_file}
    data = {
        'user_id': user_id,
        'username': username if username else f'user_{user_id[:8]}'
    }
    
    logger.info(f"Uploading profile image to: {media_url}")
    logger.info(f"User ID for media: {data['user_id']}")
    logger.info(f"Username for media: {data['username']}")

    try:
        headers = {'Authorization': f'Token {auth_token}'} if auth_token else {}
        response = requests.post(
            media_url,
            files=files,
            data=data,
            headers=headers,
            timeout=30
        )
        
        logger.info(f"Media upload response status: {response.status_code}")
        logger.info(f"Media upload response: {response.text}")
        
        if response.status_code in [200, 201]:
            result = response.json()
            if 'image' in result:
                return result['image'], None
            elif 'image_url' in result:
                return result['image_url'], None
            else:
                return None, "Media upload response missing image URL"
        else:
            return None, f"Media upload failed: {response.status_code}"
            
    except requests.RequestException as e:
        logger.error(f"Media upload request failed: {str(e)}")
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
        
        # Handle profile image upload if provided
        image_file = request.FILES.get('profile_image')
        if image_file:
            # Generate user ID first
            user_id = str(uuid.uuid4())
            # Upload to media app
            image_url, error = upload_profile_image(
                image_file, 
                user_id, 
                username=user_data['username']
            )
            if error:
                logger.error(f"Failed to upload profile image: {error}")
                # Continue without image URL
            else:
                user_data['image_url'] = image_url
        
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
        
        # Handle profile image upload if provided
        image_file = request.FILES.get('profile_image')
        if image_file:
            # Upload to media app
            image_url, error = upload_profile_image(
                image_file, 
                user_id, 
                username=user_data['username']
            )
            if error:
                logger.error(f"Failed to upload profile image: {error}")
                # Keep existing image URL
            else:
                user_data['image_url'] = image_url
        
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