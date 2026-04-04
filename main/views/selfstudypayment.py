from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
import requests
import random
import logging
import os
import uuid
import time
from django.conf import settings

logger = logging.getLogger(__name__)

# Module-level cache for domains to avoid repeated registry lookups
_domain_cache = {
    'payment': {'domains': None, 'timestamp': 0},
    'userprofile': {'domains': None, 'timestamp': 0},
    'subscription': {'domains': None, 'timestamp': 0},
}
_CACHE_DURATION = 300  # 5 minutes


def _get_auth_token():
    """Get AUTH_TOKEN from environment - cached at module level"""
    token = os.getenv('AUTH_TOKEN', '').strip()
    if not token:
        logger.error("\u274c AUTH_TOKEN is empty or not found in environment variables!")
    return token


def _get_domains_registry_instances():
    """Get list of SelfStudy Domains registry instances"""
    return [
        "https://sfsdomains1.pythonanywhere.com",
        "https://sfsdomains2.pythonanywhere.com"
    ]


def _get_working_registry_instance(auth_token):
    """
    Get a working SelfStudy Domains registry instance.
    Tests each instance with a simple GET request.
    """
    instances = _get_domains_registry_instances()
    random.shuffle(instances)

    for domain in instances:
        try:
            # Try root endpoint - some registries may not require auth for root
            response = requests.get(
                f"{domain}/",
                timeout=5,
                headers={'Authorization': f'Token {auth_token}'} if auth_token else {}
            )
            if response.status_code in [200, 301, 302]:
                logger.info(f"\u2705 Registry instance available: {domain}")
                return domain
        except requests.exceptions.RequestException as e:
            logger.warning(f"Registry {domain} not accessible: {str(e)}")
            continue

    logger.error("\u274c No working SelfStudy Domains registry instances available")
    return None


def _fetch_dynamic_domains(app_id, auth_token):
    """
    Fetch replica domains dynamically from SelfStudy Domains registry.
    Tries all registry instances until one works.
    """
    instances = _get_domains_registry_instances()
    random.shuffle(instances)

    for registry_domain in instances:
        try:
            url = f"{registry_domain}/apps/{app_id}/"
            headers = {}
            if auth_token:
                headers['Authorization'] = f'Token {auth_token}'
                headers['Content-Type'] = 'application/json'

            logger.info(f"\U0001f4e1 Fetching domains for app_id={app_id} from {url}")
            logger.info(f"\U0001f511 Using auth: {'Yes' if auth_token else 'No'}")

            response = requests.get(url, headers=headers, timeout=10)

            logger.info(f"\U0001f4ca Registry response status: {response.status_code}")

            if response.status_code == 200:
                app_data = response.json()
                replicas = app_data.get('replicas', [])
                replica_urls = [
                    replica['replica_url'].rstrip('/')
                    for replica in replicas
                    if replica.get('replica_url')
                ]
                logger.info(
                    f"\u2705 Fetched {len(replica_urls)} domains for app_id={app_id}: {replica_urls}"
                )
                return replica_urls
            elif response.status_code == 401:
                logger.warning(
                    f"\u26a0\ufe0f Auth failed for registry {registry_domain} (401). "
                    f"Token preview: {auth_token[:10] if auth_token else 'NONE'}..."
                )
                # Try next registry instance
                continue
            elif response.status_code == 403:
                logger.warning(
                    f"\u26a0\ufe0f Forbidden for registry {registry_domain} (403). "
                    f"Token may be invalid."
                )
                continue
            elif response.status_code == 404:
                logger.warning(
                    f"\u26a0\ufe0f App {app_id} not found on registry {registry_domain} (404)"
                )
                continue
            else:
                logger.warning(
                    f"\u26a0\ufe0f Unexpected status {response.status_code} from {registry_domain}: "
                    f"{response.text[:200]}"
                )
                continue

        except requests.exceptions.Timeout:
            logger.warning(f"\u23f1\ufe0f Timeout fetching from registry {registry_domain}")
            continue
        except requests.exceptions.ConnectionError as e:
            logger.warning(f"\U0001f50c Connection error to registry {registry_domain}: {str(e)}")
            continue
        except requests.exceptions.RequestException as e:
            logger.error(f"\u274c Request error fetching from {registry_domain}: {str(e)}")
            continue
        except Exception as e:
            logger.error(f"\u274c Unexpected error fetching from {registry_domain}: {str(e)}")
            continue

    logger.error(f"\u274c All registry instances failed for app_id={app_id}")
    return []


def _get_cached_domains(app_id, cache_key, auth_token):
    """
    Get domains with caching to avoid excessive registry lookups.
    """
    global _domain_cache

    current_time = time.time()
    cache_entry = _domain_cache.get(cache_key, {'domains': None, 'timestamp': 0})

    # Return cached domains if still fresh
    if (cache_entry['domains'] is not None and
            (current_time - cache_entry['timestamp']) < _CACHE_DURATION):
        logger.debug(f"Using cached domains for {cache_key}: {cache_entry['domains']}")
        return cache_entry['domains']

    # Fetch fresh domains
    logger.info(f"\U0001f504 Refreshing domain cache for {cache_key} (app_id={app_id})")
    domains = _fetch_dynamic_domains(app_id, auth_token)

    # Update cache (even if empty, to avoid hammering registry)
    _domain_cache[cache_key] = {
        'domains': domains,
        'timestamp': current_time
    }

    if not domains:
        logger.warning(f"\u26a0\ufe0f No domains found for {cache_key} (app_id={app_id})")
    else:
        logger.info(f"\u2705 Cached {len(domains)} domains for {cache_key}")

    return domains


def _clear_domain_cache(cache_key=None):
    """Clear domain cache to force refresh"""
    global _domain_cache
    if cache_key:
        if cache_key in _domain_cache:
            _domain_cache[cache_key] = {'domains': None, 'timestamp': 0}
    else:
        for key in _domain_cache:
            _domain_cache[key] = {'domains': None, 'timestamp': 0}


@method_decorator([login_required, ensure_csrf_cookie], name='dispatch')
class SelfStudyPaymentView(View):
    template_name = 'selfstudypayment.html'

    # App IDs
    PAYMENT_APP_ID = 23
    USER_PROFILE_APP_ID = 13
    SUBSCRIPTION_APP_ID = 22

    @property
    def AUTH_TOKEN(self):
        """Get auth token from environment each time (handles hot-reload)"""
        return _get_auth_token()

    def get_payment_domains(self):
        """Get payment domains with caching"""
        return _get_cached_domains(self.PAYMENT_APP_ID, 'payment', self.AUTH_TOKEN)

    def get_user_profile_domains(self):
        """Get user profile domains with caching"""
        return _get_cached_domains(self.USER_PROFILE_APP_ID, 'userprofile', self.AUTH_TOKEN)

    def get_subscription_domains(self):
        """Get subscription domains with caching"""
        return _get_cached_domains(self.SUBSCRIPTION_APP_ID, 'subscription', self.AUTH_TOKEN)

    def get_random_payment_domain(self):
        """Get a random working payment domain"""
        domains = self.get_payment_domains()
        if not domains:
            # Clear cache and retry once
            _clear_domain_cache('payment')
            domains = _get_cached_domains(self.PAYMENT_APP_ID, 'payment', self.AUTH_TOKEN)

        if not domains:
            logger.warning("No payment domains found, trying fallback domains")
            fallback_domains = [
                "https://selfstudypayments1.pythonanywhere.com",
                "https://selfstudypayments2.pythonanywhere.com",
                "https://selfstudypayment1.pythonanywhere.com",
                "https://selfstudypayment2.pythonanywhere.com"
            ]
            working_domains = []
            for domain in fallback_domains:
                try:
                    response = requests.get(f"{domain}/", timeout=5)
                    if response.status_code == 200:
                        working_domains.append(domain)
                        logger.info(f"Found working fallback payment domain: {domain}")
                except Exception:
                    continue

            if working_domains:
                return random.choice(working_domains)
            raise Exception("No payment domains available (registry and fallback both failed)")

        return random.choice(domains)

    def make_authenticated_request(self, method, url, data=None):
        """Make authenticated request to a microservice"""
        try:
            auth_token = self.AUTH_TOKEN
            if not auth_token:
                logger.error("\u274c No AUTH_TOKEN available for request!")
                return None

            headers = {
                'Authorization': f'Token {auth_token}',
                'Content-Type': 'application/json'
            }

            logger.info(f"\U0001f511 Making {method} request to {url}")

            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=15)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=15)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=15)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=15)
            else:
                logger.error(f"\u274c Unsupported HTTP method: {method}")
                return None

            if response.status_code >= 400:
                logger.error(f"\u274c Error {response.status_code} for {method} {url}")
                logger.error(f"\u274c Response body: {response.text[:500]}")
            else:
                logger.info(f"\u2705 Success {response.status_code} for {method} {url}")

            return response

        except requests.exceptions.Timeout:
            logger.error(f"\u23f1\ufe0f Request timeout to {url}")
            return None
        except requests.exceptions.ConnectionError as e:
            logger.error(f"\U0001f50c Connection error to {url}: {str(e)}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"\u274c Request failed to {url}: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"\u274c Unexpected error in make_authenticated_request: {str(e)}")
            return None

    def get(self, request):
        """Render the main payment management page"""
        # Pre-warm the domain caches in background
        auth_token = self.AUTH_TOKEN

        context = {
            'page_title': 'Payments Management',
            'active_tab': 'payments',
            'auth_token_set': bool(auth_token)
        }
        return render(request, self.template_name, context)

    def post(self, request):
        """Handle AJAX requests for payment operations"""
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

        if not is_ajax:
            return JsonResponse({
                'success': False,
                'error': 'This endpoint only accepts AJAX requests'
            }, status=400)

        action = request.POST.get('action')

        try:
            action_map = {
                'get_payments': self.get_payments_list,
                'get_payment': self.get_payment_detail,
                'create_payment': self.create_payment,
                'update_payment': self.update_payment,
                'delete_payment': self.delete_payment,
                'get_users': self.get_users_list,
                'get_subscriptions': self.get_subscriptions_list,
                'get_bank_accounts': self.get_bank_accounts_list,
                'get_cliq_accounts': self.get_cliq_accounts_list,
                'payment_action': self.handle_payment_action,
                'refresh_domains': self.refresh_domains_cache,
            }

            handler = action_map.get(action)
            if handler:
                return handler(request)
            else:
                return JsonResponse({
                    'success': False,
                    'error': f'Invalid action specified: {action}'
                }, status=400)

        except Exception as e:
            logger.error(f"\u274c Error processing action {action}: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Server error: {str(e)}'
            }, status=500)

    def refresh_domains_cache(self, request):
        """Force refresh all domain caches"""
        _clear_domain_cache()
        auth_token = self.AUTH_TOKEN

        payment_domains = _get_cached_domains(
            self.PAYMENT_APP_ID, 'payment', auth_token
        )
        userprofile_domains = _get_cached_domains(
            self.USER_PROFILE_APP_ID, 'userprofile', auth_token
        )
        subscription_domains = _get_cached_domains(
            self.SUBSCRIPTION_APP_ID, 'subscription', auth_token
        )

        return JsonResponse({
            'success': True,
            'message': 'Domain caches refreshed',
            'data': {
                'payment_domains': len(payment_domains),
                'userprofile_domains': len(userprofile_domains),
                'subscription_domains': len(subscription_domains),
            }
        })

    def get_payments_list(self, request):
        """Get list of payments"""
        try:
            if not self.AUTH_TOKEN:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication token not configured. Please set AUTH_TOKEN environment variable.'
                })

            domain = self.get_random_payment_domain()
            url = f"{domain}/payments/"

            logger.info(f"\U0001f4e5 Fetching payments from: {url}")
            response = self.make_authenticated_request('GET', url)

            if response is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to payment service'
                })

            if response.status_code == 200:
                payments = response.json()
                logger.info(f"\u2705 Successfully fetched {len(payments)} payments")
                return JsonResponse({'success': True, 'data': payments})
            elif response.status_code == 403:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication failed (403). Please verify AUTH_TOKEN matches payment service token.'
                })
            else:
                error_msg = f"Payment service returned status {response.status_code}"
                return JsonResponse({'success': False, 'error': error_msg})

        except Exception as e:
            logger.error(f"\u274c Error fetching payments: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Failed to load payments: {str(e)}'
            })

    def get_payment_detail(self, request):
        """Get specific payment details"""
        try:
            external_id = request.POST.get('external_id')
            if not external_id:
                return JsonResponse({
                    'success': False,
                    'error': 'External ID is required'
                })

            if not self.AUTH_TOKEN:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication token not configured.'
                })

            domain = self.get_random_payment_domain()
            url = f"{domain}/payments/{external_id}/"

            response = self.make_authenticated_request('GET', url)

            if response is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to payment service'
                })

            if response.status_code == 200:
                return JsonResponse({'success': True, 'data': response.json()})
            elif response.status_code == 403:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication failed (403). Please verify AUTH_TOKEN.'
                })
            elif response.status_code == 404:
                return JsonResponse({
                    'success': False,
                    'error': 'Payment not found'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f"Payment service returned status {response.status_code}"
                })

        except Exception as e:
            logger.error(f"\u274c Error fetching payment: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Failed to load payment: {str(e)}'
            })

    def create_payment(self, request):
        """Create a new payment"""
        try:
            if not self.AUTH_TOKEN:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication token not configured. Please set AUTH_TOKEN environment variable.'
                })

            payment_data = {
                'user_id': request.POST.get('user_id'),
                'subscription_id': request.POST.get('subscription_id'),
                'amount': request.POST.get('amount'),
                'currency': request.POST.get('currency', 'JOD'),
                'payment_method': request.POST.get('payment_method'),
                'reference': request.POST.get('reference', ''),
                'notes': request.POST.get('notes', '')
            }

            required_fields = ['user_id', 'subscription_id', 'amount', 'payment_method']
            missing_fields = [f for f in required_fields if not payment_data.get(f)]

            if missing_fields:
                return JsonResponse({
                    'success': False,
                    'error': f'Missing required fields: {", ".join(missing_fields)}'
                })

            try:
                float(payment_data['amount'])
            except ValueError:
                return JsonResponse({
                    'success': False,
                    'error': 'Amount must be a valid number'
                })

            domain = self.get_random_payment_domain()
            url = f"{domain}/payments/"

            logger.info(f"\U0001f195 Creating payment at: {url}")
            response = self.make_authenticated_request('POST', url, payment_data)

            if response is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to payment service'
                })

            if response.status_code == 201:
                payment = response.json()
                logger.info(f"\u2705 Successfully created payment: {payment.get('external_id')}")
                return JsonResponse({
                    'success': True,
                    'data': payment,
                    'message': 'Payment created successfully'
                })
            elif response.status_code == 403:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication failed (403). Please verify AUTH_TOKEN.'
                })
            elif response.status_code == 400:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error') or error_data.get('detail') or str(error_data)
                except Exception:
                    error_msg = response.text
                return JsonResponse({
                    'success': False,
                    'error': f'Validation error: {error_msg}'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f"Payment service returned status {response.status_code}: {response.text[:200]}"
                })

        except Exception as e:
            logger.error(f"\u274c Error creating payment: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Failed to create payment: {str(e)}'
            })

    def update_payment(self, request):
        """Update an existing payment"""
        try:
            if not self.AUTH_TOKEN:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication token not configured.'
                })

            external_id = request.POST.get('external_id')
            if not external_id:
                return JsonResponse({
                    'success': False,
                    'error': 'External ID is required'
                })

            payment_data = {
                'status': request.POST.get('status'),
                'notes': request.POST.get('notes', '')
            }
            payment_data = {k: v for k, v in payment_data.items() if v is not None}

            domain = self.get_random_payment_domain()
            url = f"{domain}/payments/{external_id}/"

            response = self.make_authenticated_request('PUT', url, payment_data)

            if response is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to payment service'
                })

            if response.status_code == 200:
                return JsonResponse({
                    'success': True,
                    'data': response.json(),
                    'message': 'Payment updated successfully'
                })
            elif response.status_code == 403:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication failed (403). Please verify AUTH_TOKEN.'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f"Payment service returned status {response.status_code}"
                })

        except Exception as e:
            logger.error(f"\u274c Error updating payment: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Failed to update payment: {str(e)}'
            })

    def delete_payment(self, request):
        """Delete a payment"""
        try:
            if not self.AUTH_TOKEN:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication token not configured.'
                })

            external_id = request.POST.get('external_id')
            if not external_id:
                return JsonResponse({
                    'success': False,
                    'error': 'External ID is required'
                })

            domain = self.get_random_payment_domain()
            url = f"{domain}/payments/{external_id}/"

            response = self.make_authenticated_request('DELETE', url)

            if response is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to payment service'
                })

            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'Payment deleted successfully'
                })
            elif response.status_code == 403:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication failed (403). Please verify AUTH_TOKEN.'
                })
            elif response.status_code == 404:
                return JsonResponse({
                    'success': False,
                    'error': 'Payment not found'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f"Payment service returned status {response.status_code}"
                })

        except Exception as e:
            logger.error(f"\u274c Error deleting payment: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Failed to delete payment: {str(e)}'
            })

    def get_users_list(self, request):
        """Get list of users from user profile service"""
        try:
            if not self.AUTH_TOKEN:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication token not configured.'
                })

            # Get domains with cache-busting retry
            domains = self.get_user_profile_domains()

            if not domains:
                # Force cache refresh and retry
                logger.warning("No user profile domains in cache, forcing refresh...")
                _clear_domain_cache('userprofile')
                domains = _get_cached_domains(
                    self.USER_PROFILE_APP_ID, 'userprofile', self.AUTH_TOKEN
                )

            if not domains:
                logger.error(
                    f"\u274c Still no user profile domains after refresh. "
                    f"app_id={self.USER_PROFILE_APP_ID}"
                )
                return JsonResponse({
                    'success': False,
                    'error': (
                        'No user profile service domains available. '
                        'Please check that the domains registry is accessible and '
                        f'app_id={self.USER_PROFILE_APP_ID} is registered. '
                        'Try clicking "Refresh Domains" button.'
                    )
                })

            logger.info(f"\U0001f4cb User profile domains to try: {domains}")

            # Try each domain with multiple endpoint patterns
            last_error = None
            for domain in domains:
                endpoints_to_try = [
                    f"{domain}/profiles/",
                    f"{domain}/users/",
                    f"{domain}/api/profiles/",
                ]

                for endpoint in endpoints_to_try:
                    logger.info(f"Trying user endpoint: {endpoint}")
                    response = self.make_authenticated_request('GET', endpoint)

                    if response is None:
                        last_error = f"Connection failed to {endpoint}"
                        continue

                    if response.status_code == 200:
                        try:
                            users = response.json()
                        except Exception as e:
                            logger.warning(f"Failed to parse JSON from {endpoint}: {e}")
                            last_error = f"Invalid JSON from {endpoint}"
                            continue

                        logger.info(
                            f"\u2705 Successfully fetched {len(users) if isinstance(users, list) else 'unknown'} "
                            f"users from {endpoint}"
                        )

                        # Handle paginated responses
                        if isinstance(users, dict) and 'results' in users:
                            users = users['results']

                        if not isinstance(users, list):
                            logger.warning(f"Unexpected response format from {endpoint}: {type(users)}")
                            last_error = f"Unexpected response format from {endpoint}"
                            continue

                        # Transform user data
                        transformed_users = []
                        for user in users:
                            transformed_user = {
                                'external_id': str(
                                    user.get('user_id')
                                    or user.get('external_id')
                                    or user.get('id')
                                    or ''
                                ),
                                'username': user.get('username', ''),
                                'email': user.get('email', ''),
                                'first_name': user.get('first_name', ''),
                                'last_name': user.get('last_name', ''),
                                'full_name': (
                                    f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                                    or user.get('username', '')
                                ),
                                'is_active': user.get('is_active', True)
                            }
                            transformed_users.append(transformed_user)

                        return JsonResponse({
                            'success': True,
                            'data': transformed_users
                        })

                    elif response.status_code == 401:
                        last_error = f"Authentication failed (401) at {endpoint}"
                        logger.warning(last_error)
                    elif response.status_code == 403:
                        last_error = f"Forbidden (403) at {endpoint}"
                        logger.warning(last_error)
                    elif response.status_code == 404:
                        last_error = f"Not found (404) at {endpoint}"
                        logger.debug(last_error)
                    else:
                        last_error = f"Status {response.status_code} from {endpoint}"
                        logger.warning(last_error)

            error_detail = f" Last error: {last_error}" if last_error else ""
            return JsonResponse({
                'success': False,
                'error': (
                    f'Failed to fetch users from all available domains ({len(domains)} tried).{error_detail} '
                    'Please check if user profile service is running and accessible.'
                )
            })

        except Exception as e:
            logger.error(f"\u274c Error fetching users: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Failed to load users: {str(e)}'
            })

    def get_subscriptions_list(self, request):
        """Get list of subscription types from subscription service"""
        try:
            if not self.AUTH_TOKEN:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication token not configured.'
                })

            # Get domains with cache-busting retry
            domains = self.get_subscription_domains()

            if not domains:
                # Force cache refresh and retry
                logger.warning("No subscription domains in cache, forcing refresh...")
                _clear_domain_cache('subscription')
                domains = _get_cached_domains(
                    self.SUBSCRIPTION_APP_ID, 'subscription', self.AUTH_TOKEN
                )

            if not domains:
                logger.error(
                    f"\u274c Still no subscription domains after refresh. "
                    f"app_id={self.SUBSCRIPTION_APP_ID}"
                )
                return JsonResponse({
                    'success': False,
                    'error': (
                        'No subscription service domains available. '
                        'Please check that the domains registry is accessible and '
                        f'app_id={self.SUBSCRIPTION_APP_ID} is registered. '
                        'Try clicking "Refresh Domains" button.'
                    )
                })

            logger.info(f"\U0001f4cb Subscription domains to try: {domains}")

            # Try each domain with multiple endpoint patterns
            last_error = None
            for domain in domains:
                endpoints_to_try = [
                    f"{domain}/subscription-types/",
                    f"{domain}/api/subscription-types/",
                    f"{domain}/subscriptions/types/",
                    f"{domain}/subscriptions/",
                ]

                for endpoint in endpoints_to_try:
                    logger.info(f"Trying subscription endpoint: {endpoint}")
                    response = self.make_authenticated_request('GET', endpoint)

                    if response is None:
                        last_error = f"Connection failed to {endpoint}"
                        continue

                    if response.status_code == 200:
                        try:
                            subscription_types = response.json()
                        except Exception as e:
                            logger.warning(f"Failed to parse JSON from {endpoint}: {e}")
                            last_error = f"Invalid JSON from {endpoint}"
                            continue

                        logger.info(
                            f"\u2705 Successfully fetched data from {endpoint}"
                        )

                        # Handle paginated responses
                        if isinstance(subscription_types, dict) and 'results' in subscription_types:
                            subscription_types = subscription_types['results']

                        if not isinstance(subscription_types, list):
                            logger.warning(
                                f"Unexpected response format from {endpoint}: "
                                f"{type(subscription_types)}"
                            )
                            last_error = f"Unexpected format from {endpoint}"
                            continue

                        logger.info(
                            f"\u2705 Fetched {len(subscription_types)} subscription types from {endpoint}"
                        )

                        # Transform subscription data
                        transformed_subscriptions = []
                        for sub_type in subscription_types:
                            transformed = {
                                'external_id': str(
                                    sub_type.get('external_id')
                                    or sub_type.get('id')
                                    or sub_type.get('pk')
                                    or ''
                                ),
                                'title': (
                                    sub_type.get('title')
                                    or sub_type.get('name')
                                    or 'Untitled Subscription Type'
                                ),
                                'description': sub_type.get('description', ''),
                                'price': str(sub_type.get('price', '0.00')),
                                'duration_days': (
                                    sub_type.get('duration_days')
                                    or sub_type.get('validity_days')
                                    or 30
                                ),
                                'is_active': sub_type.get('is_active', True),
                                'features': sub_type.get('features', [])
                            }
                            transformed_subscriptions.append(transformed)

                        return JsonResponse({
                            'success': True,
                            'data': transformed_subscriptions
                        })

                    elif response.status_code == 401:
                        last_error = f"Authentication failed (401) at {endpoint}"
                        logger.warning(last_error)
                    elif response.status_code == 403:
                        last_error = f"Forbidden (403) at {endpoint}"
                        logger.warning(last_error)
                    elif response.status_code == 404:
                        last_error = f"Not found (404) at {endpoint}"
                        logger.debug(last_error)
                    else:
                        last_error = f"Status {response.status_code} from {endpoint}"
                        logger.warning(last_error)

            error_detail = f" Last error: {last_error}" if last_error else ""
            return JsonResponse({
                'success': False,
                'error': (
                    f'Failed to fetch subscription types from all available domains '
                    f'({len(domains)} tried).{error_detail} '
                    'Please check if subscription service is running.'
                )
            })

        except Exception as e:
            logger.error(f"\u274c Error fetching subscription types: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Failed to load subscription types: {str(e)}'
            })

    def get_bank_accounts_list(self, request):
        """Get list of bank accounts"""
        try:
            if not self.AUTH_TOKEN:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication token not configured.'
                })

            domain = self.get_random_payment_domain()
            url = f"{domain}/bank-accounts/"

            response = self.make_authenticated_request('GET', url)

            if response and response.status_code == 200:
                return JsonResponse({'success': True, 'data': response.json()})
            else:
                status_code = response.status_code if response else 'No response'
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to fetch bank accounts: {status_code}'
                })

        except Exception as e:
            logger.error(f"\u274c Error fetching bank accounts: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Failed to load bank accounts: {str(e)}'
            })

    def get_cliq_accounts_list(self, request):
        """Get list of cliq accounts"""
        try:
            if not self.AUTH_TOKEN:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication token not configured.'
                })

            domain = self.get_random_payment_domain()
            url = f"{domain}/cliq-accounts/"

            response = self.make_authenticated_request('GET', url)

            if response and response.status_code == 200:
                return JsonResponse({'success': True, 'data': response.json()})
            else:
                status_code = response.status_code if response else 'No response'
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to fetch cliq accounts: {status_code}'
                })

        except Exception as e:
            logger.error(f"\u274c Error fetching cliq accounts: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Failed to load cliq accounts: {str(e)}'
            })

    def handle_payment_action(self, request):
        """Handle payment actions (mark as paid, verify, reject)"""
        try:
            if not self.AUTH_TOKEN:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication token not configured.'
                })

            external_id = request.POST.get('external_id')
            action_type = request.POST.get('action_type')

            if not external_id or not action_type:
                return JsonResponse({
                    'success': False,
                    'error': 'External ID and action type are required'
                })

            valid_actions = ['mark_as_paid', 'verify', 'reject']
            if action_type not in valid_actions:
                return JsonResponse({
                    'success': False,
                    'error': f'Invalid action type. Must be one of: {", ".join(valid_actions)}'
                })

            domain = self.get_random_payment_domain()
            url = f"{domain}/payments/{external_id}/{action_type}/"

            logger.info(f"Performing {action_type} on payment at: {url}")
            response = self.make_authenticated_request('POST', url, {})

            if response is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to payment service'
                })

            if response.status_code == 200:
                payment = response.json()
                action_message = {
                    'mark_as_paid': 'marked as paid',
                    'verify': 'verified',
                    'reject': 'rejected'
                }.get(action_type, 'updated')

                return JsonResponse({
                    'success': True,
                    'data': payment,
                    'message': f'Payment {action_message} successfully'
                })
            elif response.status_code == 403:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication failed (403). Please verify AUTH_TOKEN.'
                })
            else:
                try:
                    error_detail = response.json().get('detail', response.text)
                except Exception:
                    error_detail = response.text
                return JsonResponse({
                    'success': False,
                    'error': f"Payment service returned status {response.status_code}: {error_detail}"
                })

        except Exception as e:
            logger.error(f"\u274c Error performing payment action: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Failed to perform action: {str(e)}'
            })