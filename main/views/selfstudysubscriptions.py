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

                    # Health check each replica
                    healthy_replicas = []
                    for replica in replica_urls:
                        try:
                            health_url = f"{replica}/features/"
                            health_response = requests.get(health_url, headers=headers, timeout=5)
                            if health_response.status_code in [200, 401]:  # 401 means auth required, which is fine
                                healthy_replicas.append(replica)
                                logger.info(f"Replica {replica} is healthy")
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
        Make authenticated request to subscription service
        """
        auth_token = self.get_auth_token()
        if not auth_token:
            return JsonResponse({
                'error': 'Authentication token not configured. Please set AUTH_TOKEN environment variable.'
            }, status=503)

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
                return JsonResponse({'error': f'Unsupported method: {method}'}, status=400)

            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = {'detail': response.text}

            return JsonResponse(response_data, status=response.status_code, safe=False)

        except requests.exceptions.RequestException as e:
            logger.error(f"Request error to {url}: {str(e)}")
            return JsonResponse({'error': f'Service unavailable: {str(e)}'}, status=503)

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
                return JsonResponse({
                    'error': 'User profile service unavailable. Check AUTH_TOKEN environment variable.'
                }, status=503)

            url = f"{userprofile_domain}/api/user-profiles/"
            return self.make_authenticated_request('GET', url, app_id=13)

        elif action == 'features':
            # Get features
            domain = self.get_working_domain(22)
            if not domain:
                return JsonResponse({
                    'error': 'Subscription service unavailable. Check AUTH_TOKEN environment variable.'
                }, status=503)

            url = f"{domain}/features/"
            return self.make_authenticated_request('GET', url)

        elif action == 'subscription-types':
            # Get subscription types
            domain = self.get_working_domain(22)
            if not domain:
                return JsonResponse({
                    'error': 'Subscription service unavailable. Check AUTH_TOKEN environment variable.'
                }, status=503)

            url = f"{domain}/subscription-types/"
            return self.make_authenticated_request('GET', url)

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

            return self.make_authenticated_request('GET', url, data=params)

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

        return self.make_authenticated_request('POST', url, data=data)

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

        return self.make_authenticated_request('PUT', url, data=data)

    def delete(self, request, *args, **kwargs):
        """Handle DELETE requests"""
        data = request.GET
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

        return self.make_authenticated_request('DELETE', url)
