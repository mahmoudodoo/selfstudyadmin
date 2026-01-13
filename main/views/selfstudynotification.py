# selfstudyadmin/selfstudynotification.py
from django.shortcuts import render, redirect
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.contrib import messages
import requests
import random
import os
import logging
import json
import uuid
from django.conf import settings

logger = logging.getLogger(__name__)

# SelfStudy Domains registry instances
SFS_DOMAINS = [
    'https://sfsdomains1.pythonanywhere.com',
    'https://sfsdomains2.pythonanywhere.com',
]

# App IDs
NOTIFICATIONS_APP_ID = 16
USER_PROFILE_APP_ID = 13

# Fallback domains
FALLBACK_NOTIFICATION_DOMAINS = [
    'https://selfstudyjonotification2.pythonanywhere.com',
    'https://notificationsselfstudy.pythonanywhere.com',
]

FALLBACK_USER_DOMAINS = [
    'https://selfstudyuserprofile.pythonanywhere.com',
    'https://selfstudyprofileuser2.pythonanywhere.com',
]

@method_decorator(login_required, name='dispatch')
class SelfStudyNotificationView(View):
    def _get_auth_headers(self):
        """Get authentication headers"""
        auth_token = os.getenv('AUTH_TOKEN')
        if not auth_token:
            logger.error("AUTH_TOKEN environment variable is not set")
            return {}
        return {
            'Content-Type': 'application/json',
            'Authorization': f'Token {auth_token}'
        }

    def _get_dynamic_sync_domains(self, app_id):
        """Fetch replica domains dynamically from SelfStudy Domains registry"""
        shuffled_domains = SFS_DOMAINS.copy()
        random.shuffle(shuffled_domains)

        for domain in shuffled_domains:
            try:
                headers = self._get_auth_headers()
                if not headers:
                    continue

                url = f"{domain}/apps/{app_id}/"
                logger.info(f"Attempting to fetch domains from: {url}")

                response = requests.get(url, headers=headers, timeout=10)

                if response.status_code == 200:
                    app_data = response.json()
                    replica_urls = [replica['replica_url'].rstrip('/') for replica in app_data.get('replicas', [])]

                    if replica_urls:
                        logger.info(f"Successfully fetched {len(replica_urls)} replica domains from {domain}")
                        return replica_urls
                    else:
                        logger.warning(f"No replicas found in response from {domain}")
                else:
                    logger.warning(f"Failed to fetch from {domain}, status: {response.status_code}")

            except requests.exceptions.RequestException as e:
                logger.warning(f"Domain registry {domain} is unreachable: {str(e)}")
                continue
            except Exception as e:
                logger.error(f"Unexpected error fetching from {domain}: {str(e)}")
                continue

        logger.error("All SelfStudy Domains registry instances are unreachable")
        return []

    def _test_domain_health(self, domain, endpoint='/api/notifications/'):
        """Test if a domain is healthy and responsive"""
        try:
            headers = self._get_auth_headers()
            if not headers:
                return False

            test_url = f"{domain}{endpoint}"
            response = requests.get(test_url, headers=headers, timeout=5)
            return response.status_code in [200, 201]
        except Exception as e:
            logger.warning(f"Domain {domain} health check failed: {str(e)}")
            return False

    def _get_working_domains(self, app_id, fallback_domains=None):
        """Get list of working domains with health checking"""
        domains = self._get_dynamic_sync_domains(app_id)

        # If no domains from registry, use fallback domains
        if not domains and fallback_domains:
            domains = fallback_domains.copy()
            logger.info(f"Using fallback domains: {domains}")

        working_domains = []

        for domain in domains:
            # Determine the appropriate endpoint for health check
            endpoint = '/api/notifications/' if app_id == NOTIFICATIONS_APP_ID else '/profiles/'
            if self._test_domain_health(domain, endpoint):
                working_domains.append(domain)
                logger.info(f"Domain {domain} passed health check")
            else:
                logger.warning(f"Domain {domain} failed health check")

        return working_domains

    def _get_random_working_domain(self, app_id):
        """Get a random working domain for the specified app"""
        if app_id == NOTIFICATIONS_APP_ID:
            fallback_domains = FALLBACK_NOTIFICATION_DOMAINS
        else:
            fallback_domains = FALLBACK_USER_DOMAINS

        working_domains = self._get_working_domains(app_id, fallback_domains)
        if working_domains:
            selected = random.choice(working_domains)
            logger.info(f"Selected domain: {selected} for app {app_id}")
            return selected
        else:
            logger.error(f"No working domains available for app {app_id}")
            return None

    def _make_api_request(self, app_id, endpoint, method='GET', data=None):
        """Make API request to a random working domain"""
        domain = self._get_random_working_domain(app_id)
        if not domain:
            return None, "No working domains available"

        try:
            url = f"{domain}{endpoint}"
            headers = self._get_auth_headers()
            if not headers:
                return None, "Authentication not configured"

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
                return None, f"Unsupported method: {method}"

            logger.info(f"Response status: {response.status_code}")

            if response.status_code in [200, 201, 204]:
                # Handle empty responses
                if response.status_code == 204 or not response.content:
                    return {}, None

                try:
                    response_data = response.json()
                    return response_data, None
                except json.JSONDecodeError:
                    return None, "Invalid JSON response"

            else:
                error_msg = f"API error: {response.status_code}"
                try:
                    error_detail = response.json()
                    if isinstance(error_detail, dict):
                        error_msg += f" - {error_detail.get('detail', error_detail)}"
                    else:
                        error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text}"
                return None, error_msg

        except requests.exceptions.RequestException as e:
            error_msg = f"Network error: {str(e)}"
            logger.error(error_msg)
            return None, error_msg
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return None, error_msg

    def _extract_users_from_response(self, users_data):
        """Extract users list from API response"""
        users = []
        if users_data:
            if isinstance(users_data, list):
                users = users_data
            elif isinstance(users_data, dict) and 'results' in users_data:
                users = users_data['results']
            elif isinstance(users_data, dict) and 'items' in users_data:
                users = users_data['items']
        return users

    def _format_users_for_template(self, users):
        """Format users for template with proper serialization"""
        formatted_users = []
        for user in users:
            formatted_user = {
                'username': user.get('username', ''),
                'email': user.get('email', ''),
                'first_name': user.get('first_name', ''),
                'last_name': user.get('last_name', ''),
                'display_name': self._get_user_display_name(user)
            }
            formatted_users.append(formatted_user)
        return formatted_users

    def get(self, request):
        """Handle GET request - display notifications"""
        try:
            # Get notifications
            notifications_data, error = self._make_api_request(
                NOTIFICATIONS_APP_ID,
                '/api/notifications/'
            )

            # Get users for dropdown
            users_data, users_error = self._make_api_request(
                USER_PROFILE_APP_ID,
                '/profiles/'
            )

            # Extract notifications
            notifications = []
            if notifications_data and not error:
                if isinstance(notifications_data, list):
                    notifications = notifications_data
                elif isinstance(notifications_data, dict) and 'results' in notifications_data:
                    notifications = notifications_data['results']
                elif isinstance(notifications_data, dict) and 'items' in notifications_data:
                    notifications = notifications_data['items']

            # Extract users with usernames
            users = self._extract_users_from_response(users_data)

            # Format users for template
            formatted_users = self._format_users_for_template(users)

            # Convert to JSON for JavaScript
            users_json = json.dumps(formatted_users)

            context = {
                'notifications': notifications,
                'users': formatted_users,
                'users_json': users_json,
                'error': error,
                'users_error': users_error
            }

            return render(request, 'selfstudynotification.html', context)

        except Exception as e:
            logger.error(f"Error in notification view: {str(e)}")
            messages.error(request, f"Error loading notifications: {str(e)}")
            return render(request, 'selfstudynotification.html', {
                'notifications': [],
                'users': [],
                'users_json': '[]',
                'error': str(e)
            })

    def _get_user_display_name(self, user):
        """Get display name for user"""
        name_parts = []
        if user.get('first_name'):
            name_parts.append(user['first_name'])
        if user.get('last_name'):
            name_parts.append(user['last_name'])

        if name_parts:
            display_name = ' '.join(name_parts)
        else:
            display_name = user.get('username', 'Unknown User')

        # Add email if available
        if user.get('email'):
            display_name += f" ({user['email']})"
        elif user.get('username'):
            display_name += f" ({user['username']})"

        return display_name


# API endpoints for AJAX calls
@method_decorator(login_required, name='dispatch')
class NotificationAPIView(View):
    def _get_auth_headers(self):
        """Get authentication headers"""
        auth_token = os.getenv('AUTH_TOKEN')
        if not auth_token:
            logger.error("AUTH_TOKEN environment variable is not set")
            return {}
        return {
            'Content-Type': 'application/json',
            'Authorization': f'Token {auth_token}'
        }

    def _get_random_working_domain(self, app_id):
        """Get a random working domain for the specified app"""
        view = SelfStudyNotificationView()
        if app_id == NOTIFICATIONS_APP_ID:
            fallback_domains = FALLBACK_NOTIFICATION_DOMAINS
        else:
            fallback_domains = FALLBACK_USER_DOMAINS

        working_domains = view._get_working_domains(app_id, fallback_domains)
        if working_domains:
            return random.choice(working_domains)
        else:
            logger.error(f"No working domains available for app {app_id}")
            return None

    def _make_api_request(self, app_id, endpoint, method='GET', data=None):
        """Make API request to a random working domain"""
        domain = self._get_random_working_domain(app_id)
        if not domain:
            return None, "No working domains available"

        try:
            url = f"{domain}{endpoint}"
            headers = self._get_auth_headers()
            if not headers:
                return None, "Authentication not configured"

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
                return None, f"Unsupported method: {method}"

            logger.info(f"Response status: {response.status_code}")

            if response.status_code in [200, 201, 204]:
                # Handle empty responses
                if response.status_code == 204 or not response.content:
                    return {}, None

                try:
                    response_data = response.json()
                    return response_data, None
                except json.JSONDecodeError:
                    return None, "Invalid JSON response"

            else:
                error_msg = f"API error: {response.status_code}"
                try:
                    error_detail = response.json()
                    if isinstance(error_detail, dict):
                        error_msg += f" - {error_detail.get('detail', error_detail)}"
                    else:
                        error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text}"
                return None, error_msg

        except requests.exceptions.RequestException as e:
            error_msg = f"Network error: {str(e)}"
            logger.error(error_msg)
            return None, error_msg
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return None, error_msg

    def _get_all_users(self):
        """Get all users from user profile service"""
        try:
            users_data, error = self._make_api_request(
                USER_PROFILE_APP_ID,
                '/profiles/'
            )

            if error:
                logger.error(f"Failed to fetch users: {error}")
                return []

            users = []
            if users_data:
                if isinstance(users_data, list):
                    users = users_data
                elif isinstance(users_data, dict) and 'results' in users_data:
                    users = users_data['results']
                elif isinstance(users_data, dict) and 'items' in users_data:
                    users = users_data['items']

            # Extract usernames
            usernames = []
            for user in users:
                if user.get('username'):
                    usernames.append(user['username'])

            logger.info(f"Found {len(usernames)} users for general notification")
            return usernames

        except Exception as e:
            logger.error(f"Error fetching users: {str(e)}")
            return []

    def get(self, request, notification_id=None):
        """Get single notification or list"""
        try:
            if notification_id:
                result, error = self._make_api_request(
                    NOTIFICATIONS_APP_ID,
                    f'/api/notifications/{notification_id}/'
                )
            else:
                result, error = self._make_api_request(
                    NOTIFICATIONS_APP_ID,
                    '/api/notifications/'
                )

            if error:
                return JsonResponse({'success': False, 'error': error}, status=400)

            # Handle different response formats
            response_data = result
            if isinstance(result, list):
                response_data = {'items': result}

            return JsonResponse({'success': True, 'data': response_data})

        except Exception as e:
            logger.error(f"API Error: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    def post(self, request):
        """Create new notification via API"""
        try:
            data = json.loads(request.body)

            # Validate required fields
            if not data.get('title'):
                return JsonResponse({'success': False, 'error': 'Title is required'}, status=400)
            if not data.get('message'):
                return JsonResponse({'success': False, 'error': 'Message is required'}, status=400)

            # Handle recipient based on notification type
            notification_type = data.get('notification_type', 'general')
            recipient = data.get('recipient', '')

            # Set read field - default to False for new notifications
            data['read'] = data.get('read', False)

            if notification_type == 'personal':
                if not recipient:
                    return JsonResponse({'success': False, 'error': 'Recipient is required for personal notifications'}, status=400)
            elif notification_type == 'group':
                if not recipient:
                    return JsonResponse({'success': False, 'error': 'At least one recipient is required for group notifications'}, status=400)
                # Generate UUID for group_name
                data['group_name'] = str(uuid.uuid4())
                logger.info(f"Generated group UUID: {data['group_name']} for group notification")
            else:  # general
                # For general notifications, get ALL users
                all_usernames = self._get_all_users()
                if all_usernames:
                    recipient = ','.join(all_usernames)
                    logger.info(f"General notification will be sent to {len(all_usernames)} users")
                else:
                    return JsonResponse({'success': False, 'error': 'No users found for general notification'}, status=400)

            # Ensure sender has a value
            if not data.get('sender'):
                data['sender'] = 'admin'

            # Update recipient in data
            data['recipient'] = recipient

            logger.info(f"Creating {notification_type} notification with {len(recipient.split(',')) if recipient else 0} recipients")

            result, error = self._make_api_request(
                NOTIFICATIONS_APP_ID,
                '/api/notifications/',
                'POST',
                data
            )

            if error:
                return JsonResponse({'success': False, 'error': error}, status=400)
            return JsonResponse({'success': True, 'data': result})

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return JsonResponse({'success': False, 'error': 'Invalid JSON data'}, status=400)
        except Exception as e:
            logger.error(f"API Error: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    def put(self, request, notification_id):
        """Update notification via API"""
        try:
            data = json.loads(request.body)

            # Validate required fields
            if not data.get('title'):
                return JsonResponse({'success': False, 'error': 'Title is required'}, status=400)
            if not data.get('message'):
                return JsonResponse({'success': False, 'error': 'Message is required'}, status=400)

            # Handle recipient based on notification type
            notification_type = data.get('notification_type', 'general')
            recipient = data.get('recipient', '')

            if notification_type == 'personal':
                if not recipient:
                    return JsonResponse({'success': False, 'error': 'Recipient is required for personal notifications'}, status=400)
            elif notification_type == 'group':
                if not recipient:
                    return JsonResponse({'success': False, 'error': 'At least one recipient is required for group notifications'}, status=400)
                # For group notifications, preserve existing group_name if not provided
                if 'group_name' not in data:
                    # Fetch existing notification to get group_name
                    existing_result, existing_error = self._make_api_request(
                        NOTIFICATIONS_APP_ID,
                        f'/api/notifications/{notification_id}/'
                    )
                    if not existing_error and existing_result:
                        data['group_name'] = existing_result.get('group_name')
                        logger.info(f"Preserving existing group UUID: {data['group_name']}")
            else:  # general
                # For general notifications, get ALL users
                all_usernames = self._get_all_users()
                if all_usernames:
                    recipient = ','.join(all_usernames)
                    logger.info(f"General notification updated to {len(all_usernames)} users")
                else:
                    return JsonResponse({'success': False, 'error': 'No users found for general notification'}, status=400)

            # Ensure sender has a value
            if not data.get('sender'):
                data['sender'] = 'admin'

            # Update recipient in data
            data['recipient'] = recipient

            logger.info(f"Updating {notification_type} notification {notification_id} with {len(recipient.split(',')) if recipient else 0} recipients")

            result, error = self._make_api_request(
                NOTIFICATIONS_APP_ID,
                f'/api/notifications/{notification_id}/',
                'PUT',
                data
            )

            if error:
                return JsonResponse({'success': False, 'error': error}, status=400)
            return JsonResponse({'success': True, 'data': result})

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return JsonResponse({'success': False, 'error': 'Invalid JSON data'}, status=400)
        except Exception as e:
            logger.error(f"API Error: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    def delete(self, request, notification_id):
        """Delete notification via API"""
        try:
            result, error = self._make_api_request(
                NOTIFICATIONS_APP_ID,
                f'/api/notifications/{notification_id}/',
                'DELETE'
            )

            if error:
                return JsonResponse({'success': False, 'error': error}, status=400)
            return JsonResponse({'success': True, 'data': result})

        except Exception as e:
            logger.error(f"API Error: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)


# User API for fetching users
@method_decorator(login_required, name='dispatch')
class UserAPIView(View):
    def _get_auth_headers(self):
        """Get authentication headers"""
        auth_token = os.getenv('AUTH_TOKEN')
        if not auth_token:
            logger.error("AUTH_TOKEN environment variable is not set")
            return {}
        return {
            'Content-Type': 'application/json',
            'Authorization': f'Token {auth_token}'
        }

    def _get_random_working_domain(self, app_id):
        """Get a random working domain for the specified app"""
        view = SelfStudyNotificationView()
        if app_id == NOTIFICATIONS_APP_ID:
            fallback_domains = FALLBACK_NOTIFICATION_DOMAINS
        else:
            fallback_domains = FALLBACK_USER_DOMAINS

        working_domains = view._get_working_domains(app_id, fallback_domains)
        if working_domains:
            return random.choice(working_domains)
        else:
            logger.error(f"No working domains available for app {app_id}")
            return None

    def _make_api_request(self, app_id, endpoint, method='GET', data=None):
        """Make API request to a random working domain"""
        domain = self._get_random_working_domain(app_id)
        if not domain:
            return None, "No working domains available"

        try:
            url = f"{domain}{endpoint}"
            headers = self._get_auth_headers()
            if not headers:
                return None, "Authentication not configured"

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
                return None, f"Unsupported method: {method}"

            logger.info(f"Response status: {response.status_code}")

            if response.status_code in [200, 201, 204]:
                # Handle empty responses
                if response.status_code == 204 or not response.content:
                    return {}, None

                try:
                    response_data = response.json()
                    return response_data, None
                except json.JSONDecodeError:
                    return None, "Invalid JSON response"

            else:
                error_msg = f"API error: {response.status_code}"
                try:
                    error_detail = response.json()
                    if isinstance(error_detail, dict):
                        error_msg += f" - {error_detail.get('detail', error_detail)}"
                    else:
                        error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text}"
                return None, error_msg

        except requests.exceptions.RequestException as e:
            error_msg = f"Network error: {str(e)}"
            logger.error(error_msg)
            return None, error_msg
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return None, error_msg

    def get(self, request):
        """Get users list for dropdown"""
        try:
            users_data, error = self._make_api_request(
                USER_PROFILE_APP_ID,
                '/profiles/'
            )

            if error:
                return JsonResponse({'success': False, 'error': error}, status=400)

            users = []
            if users_data:
                if isinstance(users_data, list):
                    users = users_data
                elif isinstance(users_data, dict) and 'results' in users_data:
                    users = users_data['results']
                elif isinstance(users_data, dict) and 'items' in users_data:
                    users = users_data['items']

            # Format users for dropdown - using usernames
            formatted_users = []
            for user in users:
                if user.get('username'):  # Only include users with usernames
                    formatted_user = {
                        'username': user['username'],
                        'email': user.get('email', ''),
                        'first_name': user.get('first_name', ''),
                        'last_name': user.get('last_name', ''),
                        'display_name': self._get_user_display_name(user)
                    }
                    formatted_users.append(formatted_user)

            return JsonResponse({'success': True, 'data': formatted_users})

        except Exception as e:
            logger.error(f"User API Error: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    def _get_user_display_name(self, user):
        """Get display name for user"""
        name_parts = []
        if user.get('first_name'):
            name_parts.append(user['first_name'])
        if user.get('last_name'):
            name_parts.append(user['last_name'])

        if name_parts:
            display_name = ' '.join(name_parts)
        else:
            display_name = user.get('username', 'Unknown User')

        # Add email if available
        if user.get('email'):
            display_name += f" ({user['email']})"
        elif user.get('username'):
            display_name += f" ({user['username']})"

        return display_name
