from django.shortcuts import render, redirect
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.conf import settings
import requests
import json
import random
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

# SelfStudy Domains registry instances
SFS_DOMAINS = [
    "https://sfsdomains1.pythonanywhere.com",
    "https://sfsdomains2.pythonanywhere.com"
]

class SelfStudySubscriptionsView(View):
    """Main view for Subscriptions Management"""

    @method_decorator(login_required)
    def get(self, request):
        """Render the main subscriptions management page"""
        context = {
            'page_title': 'Subscriptions Management',
            'app_id': 22,  # selfstudysubscriptions app ID
            'user_profile_app_id': 13,  # selfstudyuserprofile app ID
        }
        return render(request, 'selfstudysubscriptions.html', context)

class SubscriptionAPIView(View):
    """API view for handling subscription operations"""

    @method_decorator(login_required)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def get_auth_token(self):
        """
        Get authentication token from environment variable
        Priority: 1. Environment variable 2. Django settings
        """
        # First try environment variable
        auth_token = os.getenv('AUTH_TOKEN')

        # If not in environment, try Django settings
        if not auth_token:
            auth_token = getattr(settings, 'AUTH_TOKEN', None)

        if not auth_token:
            logger.warning("AUTH_TOKEN not configured in environment or settings")

        return auth_token

    def get_dynamic_domains(self, app_id):
        """
        Fetch dynamic domains for a specific app from SelfStudy Domains registry
        Returns list of replica URLs with load balancing
        """
        auth_token = self.get_auth_token()
        if not auth_token:
            logger.error("AUTH_TOKEN not configured in environment or settings")
            return []

        headers = {
            'Authorization': f'Token {auth_token}',
            'Content-Type': 'application/json'
        }

        # Try each SFS domain until we get a successful response
        random.shuffle(SFS_DOMAINS)  # Load balancing: randomize order

        for domain in SFS_DOMAINS:
            try:
                url = f"{domain}/apps/{app_id}/"
                logger.info(f"Fetching domains for app {app_id} from: {url}")

                response = requests.get(url, headers=headers, timeout=10)

                if response.status_code == 200:
                    app_data = response.json()
                    replica_urls = [replica['replica_url'].rstrip('/') for replica in app_data['replicas']]
                    logger.info(f"Successfully fetched {len(replica_urls)} domains for app {app_id}")

                    # Health check each replica - use appropriate endpoint based on app_id
                    healthy_replicas = []
                    for replica in replica_urls:
                        try:
                            if app_id == 22:  # Subscription service
                                health_url = f"{replica}/features/"
                            elif app_id == 13:  # Userprofile service
                                health_url = f"{replica}/profiles/"
                            else:
                                # Default health check
                                health_url = f"{replica}/"

                            logger.info(f"Checking health of {replica} at {health_url}")
                            health_response = requests.get(health_url, headers=headers, timeout=5)

                            # Accept 200, 401 (auth required), or 403 (forbidden) as healthy
                            if health_response.status_code in [200, 401, 403]:
                                healthy_replicas.append(replica)
                                logger.info(f"Replica {replica} is healthy (status: {health_response.status_code})")
                            else:
                                logger.warning(f"Replica {replica} failed health check: {health_response.status_code}")
                        except Exception as e:
                            logger.warning(f"Replica {replica} unreachable: {str(e)}")

                    if healthy_replicas:
                        return healthy_replicas

                else:
                    logger.warning(f"Failed to fetch from {domain} for app {app_id}: Status {response.status_code}")

            except requests.exceptions.RequestException as e:
                logger.warning(f"Domain {domain} unavailable for app {app_id}: {str(e)}")
                continue

        logger.error(f"All SelfStudy Domains instances are unavailable for app {app_id}")
        return []

    def get_working_domain(self, app_id):
        """
        Get a working domain for the specified app with random selection
        """
        domains = self.get_dynamic_domains(app_id)
        if domains:
            return random.choice(domains)  # Load balancing: random selection
        return None

    def make_authenticated_request(self, method, url, data=None, app_id=22):
        """
        Make authenticated request to service
        """
        auth_token = self.get_auth_token()
        if not auth_token:
            logger.error("AUTH_TOKEN not available for authenticated request")
            return None

        headers = {
            'Authorization': f'Token {auth_token}',
            'Content-Type': 'application/json'
        }

        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=data, timeout=10)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, data=json.dumps(data), timeout=10)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=headers, data=json.dumps(data), timeout=10)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                logger.error(f"Unsupported HTTP method: {method}")
                return None

            logger.info(f"Request to {url} returned status {response.status_code}")
            return response

        except requests.exceptions.RequestException as e:
            logger.error(f"Request error to {url}: {str(e)}")
            return None

    def get(self, request, *args, **kwargs):
        """Handle GET requests for subscriptions data"""
        action = request.GET.get('action', '')

        if action == 'domains':
            # Get available domains
            app_id = request.GET.get('app_id', 22)

            # Check if AUTH_TOKEN is configured
            auth_token = self.get_auth_token()
            if not auth_token:
                return JsonResponse({
                    'domains': [],
                    'warning': 'AUTH_TOKEN not configured. Please set AUTH_TOKEN environment variable.'
                })

            domains = self.get_dynamic_domains(int(app_id))
            return JsonResponse({'domains': domains})

        elif action == 'users':
            # Get users from userprofile service
            userprofile_domain = self.get_working_domain(13)  # userprofile app ID
            if not userprofile_domain:
                logger.error("Could not get working domain for userprofile service")
                # Try direct domains as fallback
                fallback_domains = [
                    "https://selfstudyuserprofile.pythonanywhere.com",
                    "https://selfstudyprofileuser2.pythonanywhere.com"
                ]

                for domain in fallback_domains:
                    try:
                        url = f"{domain}/profiles/"
                        headers = {'Authorization': f'Token {self.get_auth_token()}'}
                        response = requests.get(url, headers=headers, timeout=5)
                        if response.status_code in [200, 401, 403]:
                            userprofile_domain = domain
                            logger.info(f"Using fallback domain: {domain}")
                            break
                    except:
                        continue

                if not userprofile_domain:
                    return JsonResponse({
                        'error': 'User profile service unavailable. Check AUTH_TOKEN environment variable.'
                    }, status=503)

            # Use profiles endpoint for userprofile service
            url = f"{userprofile_domain}/profiles/"
            logger.info(f"Fetching users from: {url}")

            response = self.make_authenticated_request('GET', url, app_id=13)

            if response is None:
                return JsonResponse({
                    'error': 'Failed to connect to user profile service'
                }, status=503)

            if response.status_code == 200:
                try:
                    users_data = response.json()
                    # Transform the data to match expected format
                    transformed_users = []
                    for user in users_data:
                        transformed_users.append({
                            'user_id': user.get('user_id'),
                            'username': user.get('username'),
                            'email': user.get('email'),
                            'first_name': user.get('first_name'),
                            'last_name': user.get('last_name')
                        })
                    return JsonResponse(transformed_users, safe=False)
                except Exception as e:
                    logger.error(f"Error parsing user response: {str(e)}")
                    return JsonResponse({
                        'error': f'Error parsing user data: {str(e)}'
                    }, status=500)
            else:
                logger.error(f"Failed to fetch users: {response.status_code} - {response.text}")
                # Try to return empty list instead of error for better UX
                return JsonResponse([], safe=False)

        elif action == 'features':
            # Get features
            domain = self.get_working_domain(22)
            if not domain:
                logger.error("Could not get working domain for subscription service")
                return JsonResponse({
                    'error': 'Subscription service unavailable. Check AUTH_TOKEN environment variable.'
                }, status=503)

            url = f"{domain}/features/"
            response = self.make_authenticated_request('GET', url, app_id=22)

            if response is None:
                return JsonResponse({
                    'error': 'Failed to connect to subscription service'
                }, status=503)

            if response.status_code == 200:
                try:
                    return JsonResponse(response.json(), safe=False)
                except:
                    return JsonResponse({'error': 'Invalid response from service'}, status=500)
            else:
                logger.error(f"Failed to fetch features: {response.status_code} - {response.text}")
                return JsonResponse({
                    'error': f'Service returned error: {response.status_code}'
                }, status=response.status_code)

        elif action == 'subscription-types':
            # Get subscription types
            domain = self.get_working_domain(22)
            if not domain:
                return JsonResponse({
                    'error': 'Subscription service unavailable. Check AUTH_TOKEN environment variable.'
                }, status=503)

            url = f"{domain}/subscription-types/"
            response = self.make_authenticated_request('GET', url, app_id=22)

            if response is None:
                return JsonResponse({
                    'error': 'Failed to connect to subscription service'
                }, status=503)

            if response.status_code == 200:
                try:
                    return JsonResponse(response.json(), safe=False)
                except:
                    return JsonResponse({'error': 'Invalid response from service'}, status=500)
            else:
                logger.error(f"Failed to fetch subscription types: {response.status_code} - {response.text}")
                return JsonResponse({
                    'error': f'Service returned error: {response.status_code}'
                }, status=response.status_code)

        elif action == 'subscriptions':
            # Get subscriptions
            domain = self.get_working_domain(22)
            if not domain:
                return JsonResponse({
                    'error': 'Subscription service unavailable. Check AUTH_TOKEN environment variable.'
                }, status=503)

            url = f"{domain}/subscriptions/"
            params = {}
            user_id = request.GET.get('user_id')
            if user_id:
                params['user_id'] = user_id

            response = self.make_authenticated_request('GET', url, data=params, app_id=22)

            if response is None:
                return JsonResponse({
                    'error': 'Failed to connect to subscription service'
                }, status=503)

            if response.status_code == 200:
                try:
                    return JsonResponse(response.json(), safe=False)
                except:
                    return JsonResponse({'error': 'Invalid response from service'}, status=500)
            else:
                logger.error(f"Failed to fetch subscriptions: {response.status_code} - {response.text}")
                return JsonResponse({
                    'error': f'Service returned error: {response.status_code}'
                }, status=response.status_code)

        else:
            return JsonResponse({'error': 'Invalid action'}, status=400)

    def post(self, request, *args, **kwargs):
        """Handle POST requests (create operations)"""
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)

        resource_type = data.get('resource_type')

        domain = self.get_working_domain(22)
        if not domain:
            return JsonResponse({
                'error': 'Subscription service unavailable. Check AUTH_TOKEN environment variable.'
            }, status=503)

        if resource_type == 'feature':
            url = f"{domain}/features/"
        elif resource_type == 'subscription_type':
            url = f"{domain}/subscription-types/"
        elif resource_type == 'subscription':
            url = f"{domain}/subscriptions/"
        else:
            return JsonResponse({'error': 'Invalid resource type'}, status=400)

        # Remove resource_type from data
        if 'resource_type' in data:
            del data['resource_type']

        response = self.make_authenticated_request('POST', url, data=data, app_id=22)

        if response is None:
            return JsonResponse({'error': 'Failed to connect to service'}, status=503)

        if response.status_code in [200, 201]:
            try:
                return JsonResponse(response.json(), safe=False, status=response.status_code)
            except:
                return JsonResponse({'detail': 'Created successfully'}, status=response.status_code)
        else:
            logger.error(f"Failed to create resource: {response.status_code} - {response.text}")
            return JsonResponse({'error': f'Service returned error: {response.status_code}'}, status=response.status_code)

    def put(self, request, *args, **kwargs):
        """Handle PUT requests (update operations)"""
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)

        resource_type = data.get('resource_type')
        resource_id = data.get('id')

        if not resource_id:
            return JsonResponse({'error': 'Resource ID required'}, status=400)

        domain = self.get_working_domain(22)
        if not domain:
            return JsonResponse({
                'error': 'Subscription service unavailable. Check AUTH_TOKEN environment variable.'
            }, status=503)

        if resource_type == 'feature':
            url = f"{domain}/features/{resource_id}/"
        elif resource_type == 'subscription_type':
            url = f"{domain}/subscription-types/{resource_id}/"
        elif resource_type == 'subscription':
            url = f"{domain}/subscriptions/{resource_id}/"
        else:
            return JsonResponse({'error': 'Invalid resource type'}, status=400)

        # Remove resource_type and id from data
        if 'resource_type' in data:
            del data['resource_type']
        if 'id' in data:
            del data['id']

        response = self.make_authenticated_request('PUT', url, data=data, app_id=22)

        if response is None:
            return JsonResponse({'error': 'Failed to connect to service'}, status=503)

        if response.status_code in [200, 201]:
            try:
                return JsonResponse(response.json(), safe=False, status=response.status_code)
            except:
                return JsonResponse({'detail': 'Updated successfully'}, status=response.status_code)
        else:
            logger.error(f"Failed to update resource: {response.status_code} - {response.text}")
            return JsonResponse({'error': f'Service returned error: {response.status_code}'}, status=response.status_code)

    def delete(self, request, *args, **kwargs):
        """Handle DELETE requests"""
        try:
            # For DELETE requests, data should be in request body
            if request.body:
                data = json.loads(request.body)
            else:
                # Fallback to query parameters for backward compatibility
                data = request.GET.dict()
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)

        resource_type = data.get('resource_type')
        resource_id = data.get('id')

        if not resource_id:
            return JsonResponse({'error': 'Resource ID required'}, status=400)
        if not resource_type:
            return JsonResponse({'error': 'Resource type required'}, status=400)

        domain = self.get_working_domain(22)
        if not domain:
            return JsonResponse({
                'error': 'Subscription service unavailable. Check AUTH_TOKEN environment variable.'
            }, status=503)

        if resource_type == 'feature':
            url = f"{domain}/features/{resource_id}/"
        elif resource_type == 'subscription_type':
            url = f"{domain}/subscription-types/{resource_id}/"
        elif resource_type == 'subscription':
            url = f"{domain}/subscriptions/{resource_id}/"
        else:
            return JsonResponse({'error': 'Invalid resource type'}, status=400)

        response = self.make_authenticated_request('DELETE', url, app_id=22)

        if response is None:
            return JsonResponse({'error': 'Failed to connect to service'}, status=503)

        if response.status_code in [200, 204]:
            return JsonResponse({'detail': 'Deleted successfully'}, status=response.status_code)
        else:
            logger.error(f"Failed to delete resource: {response.status_code} - {response.text}")
            return JsonResponse({'error': f'Service returned error: {response.status_code}'}, status=response.status_code)
