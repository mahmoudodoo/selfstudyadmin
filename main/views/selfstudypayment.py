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
from django.conf import settings

logger = logging.getLogger(__name__)

@method_decorator([login_required, ensure_csrf_cookie], name='dispatch')
class SelfStudyPaymentView(View):
    template_name = 'selfstudypayment.html'
    
    # SelfStudy Domains registry instances
    SELFSYUDY_DOMAINS_REGISTRY = [
        "https://sfsdomains1.pythonanywhere.com",
        "https://sfsdomains2.pythonanywhere.com"
    ]
    
    # App IDs
    PAYMENT_APP_ID = 23
    USER_PROFILE_APP_ID = 13
    SUBSCRIPTION_APP_ID = 22
    
    def __init__(self):
        # Get AUTH_TOKEN from environment - CRITICAL: Must be same as payment service
        self.AUTH_TOKEN = os.getenv('AUTH_TOKEN', '').strip()
        if not self.AUTH_TOKEN:
            logger.error("❌ AUTH_TOKEN is empty or not found in environment variables!")
            logger.error("Please set AUTH_TOKEN environment variable to match payment service token")
        else:
            logger.info(f"✅ AUTH_TOKEN loaded (first 10 chars): {self.AUTH_TOKEN[:10]}...")
        super().__init__()

    def get_domains_registry_instance(self):
        """Get a working SelfStudy Domains registry instance"""
        instances = self.SELFSYUDY_DOMAINS_REGISTRY.copy()
        random.shuffle(instances)
        
        for domain in instances:
            try:
                response = requests.get(f"{domain}/", timeout=5)
                if response.status_code == 200:
                    return domain
            except requests.exceptions.RequestException as e:
                logger.warning(f"Domain registry {domain} is not accessible: {str(e)}")
                continue
        raise Exception("No working SelfStudy Domains registry instances available")

    def fetch_dynamic_domains(self, app_id):
        """Fetch replica domains dynamically from SelfStudy Domains registry"""
        try:
            registry_domain = self.get_domains_registry_instance()
            url = f"{registry_domain}/apps/{app_id}/"
            
            # IMPORTANT: Use same auth token for registry
            headers = {'Authorization': f'Token {self.AUTH_TOKEN}'} if self.AUTH_TOKEN else {}

            logger.info(f"Fetching domains for app_id {app_id} from {url}")
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code != 200:
                logger.error(f"Failed to fetch domains for app_id {app_id}: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return []

            app_data = response.json()
            replica_urls = [replica['replica_url'].rstrip('/') for replica in app_data.get('replicas', [])]

            logger.info(f"Fetched {len(replica_urls)} domains for app_id {app_id}: {replica_urls}")
            return replica_urls

        except Exception as e:
            logger.error(f"Error fetching dynamic domains for app_id {app_id}: {str(e)}")
            return []

    def get_payment_domains(self):
        """Get payment domains dynamically"""
        domains = self.fetch_dynamic_domains(self.PAYMENT_APP_ID)
        return domains if domains else []

    def get_user_profile_domains(self):
        """Get user profile domains dynamically"""
        domains = self.fetch_dynamic_domains(self.USER_PROFILE_APP_ID)
        logger.info(f"User profile domains: {domains}")
        return domains if domains else []

    def get_subscription_domains(self):
        """Get subscription domains dynamically"""
        domains = self.fetch_dynamic_domains(self.SUBSCRIPTION_APP_ID)
        logger.info(f"Subscription domains: {domains}")
        return domains if domains else []

    def get_random_payment_domain(self):
        """Get a random payment domain"""
        domains = self.get_payment_domains()
        if not domains:
            logger.warning("No payment domains found from registry, using fallback")
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
                except:
                    continue
            
            if working_domains:
                return random.choice(working_domains)
            raise Exception("No payment domains available")
        
        return random.choice(domains)

    def make_authenticated_request(self, method, url, data=None):
        """Make authenticated request to service - FIXED VERSION"""
        try:
            if not self.AUTH_TOKEN:
                logger.error("❌ No AUTH_TOKEN available for request!")
                return None
            
            headers = {
                'Authorization': f'Token {self.AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"🔑 Making {method} request to {url}")
            logger.info(f"🔑 Using auth header: Authorization: Token {self.AUTH_TOKEN[:10]}...")
            
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
            
            logger.info(f"📊 Response status: {response.status_code}")
            
            # Log more details for debugging
            if response.status_code >= 400:
                logger.error(f"❌ Error {response.status_code} for {method} {url}")
                logger.error(f"❌ Response headers: {dict(response.headers)}")
                logger.error(f"❌ Response body: {response.text[:500]}")
            else:
                logger.info(f"✅ Success {response.status_code} for {method} {url}")
                
            return response
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Request failed to {url}: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"❌ Unexpected error in make_authenticated_request: {str(e)}")
            return None

    def get(self, request):
        """Render the main payment management page"""
        context = {
            'page_title': 'Payments Management',
            'active_tab': 'payments',
            'auth_token_set': bool(self.AUTH_TOKEN)
        }
        return render(request, self.template_name, context)

    def post(self, request):
        """Handle AJAX requests for payment operations"""
        # Check if it's an AJAX request
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        
        if not is_ajax:
            return JsonResponse({
                'success': False, 
                'error': 'This endpoint only accepts AJAX requests'
            }, status=400)
            
        action = request.POST.get('action')
        
        try:
            if action == 'get_payments':
                return self.get_payments_list(request)
            elif action == 'get_payment':
                return self.get_payment_detail(request)
            elif action == 'create_payment':
                return self.create_payment(request)
            elif action == 'update_payment':
                return self.update_payment(request)
            elif action == 'delete_payment':
                return self.delete_payment(request)
            elif action == 'get_users':
                return self.get_users_list(request)
            elif action == 'get_subscriptions':
                return self.get_subscriptions_list(request)
            elif action == 'get_bank_accounts':
                return self.get_bank_accounts_list(request)
            elif action == 'get_cliq_accounts':
                return self.get_cliq_accounts_list(request)
            elif action == 'payment_action':
                return self.handle_payment_action(request)
            else:
                return JsonResponse({
                    'success': False, 
                    'error': 'Invalid action specified'
                }, status=400)
                
        except Exception as e:
            logger.error(f"❌ Error processing action {action}: {str(e)}")
            return JsonResponse({
                'success': False, 
                'error': f'Server error: {str(e)}'
            }, status=500)

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
            
            logger.info(f"📥 Fetching payments from: {url}")
            response = self.make_authenticated_request('GET', url)
            
            if response is None:
                return JsonResponse({
                    'success': False, 
                    'error': 'Unable to connect to payment service'
                })
                
            if response.status_code == 200:
                payments = response.json()
                logger.info(f"✅ Successfully fetched {len(payments)} payments")
                return JsonResponse({'success': True, 'data': payments})
            elif response.status_code == 403:
                logger.error("❌ Authentication failed - 403 Forbidden")
                logger.error(f"❌ Token used: Token {self.AUTH_TOKEN[:20]}...")
                return JsonResponse({
                    'success': False, 
                    'error': 'Authentication failed (403). Please verify AUTH_TOKEN matches payment service token.'
                })
            else:
                error_msg = f"Payment service returned status {response.status_code}"
                logger.error(f"❌ {error_msg}: {response.text}")
                return JsonResponse({
                    'success': False, 
                    'error': error_msg
                })
                
        except Exception as e:
            logger.error(f"❌ Error fetching payments: {str(e)}")
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
            
            logger.info(f"📥 Fetching payment details from: {url}")
            response = self.make_authenticated_request('GET', url)
            
            if response is None:
                return JsonResponse({
                    'success': False, 
                    'error': 'Unable to connect to payment service'
                })
                
            if response.status_code == 200:
                payment = response.json()
                return JsonResponse({'success': True, 'data': payment})
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
                error_msg = f"Payment service returned status {response.status_code}"
                return JsonResponse({
                    'success': False, 
                    'error': error_msg
                })
                
        except Exception as e:
            logger.error(f"❌ Error fetching payment: {str(e)}")
            return JsonResponse({
                'success': False, 
                'error': f'Failed to load payment: {str(e)}'
            })

    def create_payment(self, request):
        """Create a new payment"""
        try:
            # Check authentication first
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
            
            # Validate required fields
            required_fields = ['user_id', 'subscription_id', 'amount', 'payment_method']
            missing_fields = [field for field in required_fields if not payment_data[field]]
            
            if missing_fields:
                return JsonResponse({
                    'success': False, 
                    'error': f'Missing required fields: {", ".join(missing_fields)}'
                })
            
            # Validate amount
            try:
                float(payment_data['amount'])
            except ValueError:
                return JsonResponse({
                    'success': False, 
                    'error': 'Amount must be a valid number'
                })
            
            domain = self.get_random_payment_domain()
            url = f"{domain}/payments/"
            
            logger.info(f"🆕 Creating payment at: {url}")
            logger.info(f"📝 Payment data: {payment_data}")
            logger.info(f"🔑 Auth token present: {bool(self.AUTH_TOKEN)}")
            logger.info(f"🔑 Auth token preview: {self.AUTH_TOKEN[:20]}...")
            
            response = self.make_authenticated_request('POST', url, payment_data)
            
            if response is None:
                return JsonResponse({
                    'success': False, 
                    'error': 'Unable to connect to payment service'
                })
                
            if response.status_code == 201:
                payment = response.json()
                logger.info(f"✅ Successfully created payment: {payment['external_id']}")
                return JsonResponse({
                    'success': True, 
                    'data': payment, 
                    'message': 'Payment created successfully'
                })
            elif response.status_code == 403:
                logger.error("❌ Authentication failed - 403 Forbidden")
                logger.error(f"❌ Full response: {response.text}")
                logger.error(f"❌ Request headers sent: Authorization: Token {self.AUTH_TOKEN[:20]}...")
                return JsonResponse({
                    'success': False, 
                    'error': 'Authentication failed (403). The payment service rejected our authentication token. Please ensure the AUTH_TOKEN in your admin app matches exactly the token expected by the payment service.'
                })
            elif response.status_code == 400:
                error_data = response.json()
                error_msg = error_data.get('error') or error_data.get('detail') or response.text
                logger.error(f"❌ Validation error: {error_msg}")
                return JsonResponse({
                    'success': False, 
                    'error': f'Validation error: {error_msg}'
                })
            else:
                error_msg = f"Payment service returned status {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg = f"{error_msg}: {error_detail}"
                except:
                    error_msg = f"{error_msg}: {response.text}"
                    
                logger.error(f"❌ Failed to create payment: {error_msg}")
                return JsonResponse({
                    'success': False, 
                    'error': error_msg
                })
                
        except Exception as e:
            logger.error(f"❌ Error creating payment: {str(e)}")
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
            
            # Remove None values
            payment_data = {k: v for k, v in payment_data.items() if v is not None}
            
            domain = self.get_random_payment_domain()
            url = f"{domain}/payments/{external_id}/"
            
            logger.info(f"✏️ Updating payment at: {url}")
            logger.info(f"📝 Update data: {payment_data}")
            
            response = self.make_authenticated_request('PUT', url, payment_data)
            
            if response is None:
                return JsonResponse({
                    'success': False, 
                    'error': 'Unable to connect to payment service'
                })
                
            if response.status_code == 200:
                payment = response.json()
                logger.info(f"✅ Successfully updated payment: {external_id}")
                return JsonResponse({
                    'success': True, 
                    'data': payment, 
                    'message': 'Payment updated successfully'
                })
            elif response.status_code == 403:
                logger.error("❌ Authentication failed - 403 Forbidden")
                return JsonResponse({
                    'success': False, 
                    'error': 'Authentication failed (403). Please verify AUTH_TOKEN.'
                })
            else:
                error_msg = f"Payment service returned status {response.status_code}"
                return JsonResponse({
                    'success': False, 
                    'error': error_msg
                })
                
        except Exception as e:
            logger.error(f"❌ Error updating payment: {str(e)}")
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
            
            logger.info(f"🗑️ Deleting payment at: {url}")
            response = self.make_authenticated_request('DELETE', url)
            
            if response is None:
                return JsonResponse({
                    'success': False, 
                    'error': 'Unable to connect to payment service'
                })
                
            if response.status_code in [200, 204]:
                logger.info(f"✅ Successfully deleted payment: {external_id}")
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
                error_msg = f"Payment service returned status {response.status_code}"
                return JsonResponse({
                    'success': False, 
                    'error': error_msg
                })
                
        except Exception as e:
            logger.error(f"❌ Error deleting payment: {str(e)}")
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
                
            # Get domains dynamically from registry
            domains = self.get_user_profile_domains()
            logger.info(f"Trying to fetch users from domains: {domains}")
            
            if not domains:
                return JsonResponse({
                    'success': False, 
                    'error': 'No user profile domains available from registry'
                })
                
            # Try each domain until we get a successful response
            for domain in domains:
                # Try different possible endpoints for user profiles
                endpoints_to_try = [
                    f"{domain}/profiles/",  # Main profiles endpoint
                    f"{domain}/users/",     # Alternative users endpoint
                    f"{domain}/api/profiles/",  # API profiles endpoint
                ]
                
                for endpoint in endpoints_to_try:
                    logger.info(f"Trying endpoint: {endpoint}")
                    response = self.make_authenticated_request('GET', endpoint)
                    
                    if response and response.status_code == 200:
                        users = response.json()
                        logger.info(f"✅ Successfully fetched {len(users)} users from {endpoint}")
                        
                        # Transform the data to match our expected format if needed
                        if users and isinstance(users, list) and len(users) > 0:
                            # Check if we need to transform the data structure
                            if 'external_id' not in users[0]:
                                # Try to map common field names
                                transformed_users = []
                                for user in users:
                                    transformed_user = {
                                        'external_id': user.get('user_id') or user.get('id') or user.get('external_id') or str(uuid.uuid4()),
                                        'username': user.get('username'),
                                        'email': user.get('email'),
                                        'first_name': user.get('first_name'),
                                        'last_name': user.get('last_name'),
                                        'full_name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                                        'is_active': user.get('is_active', True)
                                    }
                                    transformed_users.append(transformed_user)
                                users = transformed_users
                        
                        return JsonResponse({'success': True, 'data': users})
                    elif response and response.status_code == 403:
                        logger.warning(f"Authentication failed for {endpoint}: 403")
                    else:
                        status_code = response.status_code if response else 'No response'
                        logger.warning(f"Failed to fetch from {endpoint}: {status_code}")
            
            return JsonResponse({
                'success': False, 
                'error': 'Failed to fetch users from all available domains and endpoints. Please check if user profile service is running and accessible.'
            })
                
        except Exception as e:
            logger.error(f"❌ Error fetching users: {str(e)}")
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
                
            # Get domains dynamically from registry
            domains = self.get_subscription_domains()
            logger.info(f"Trying to fetch subscription types from domains: {domains}")
            
            if not domains:
                return JsonResponse({
                    'success': False, 
                    'error': 'No subscription domains available from registry'
                })
                
            # Try each domain until we get a successful response
            for domain in domains:
                # Try subscription types endpoint first (this contains prices)
                endpoints_to_try = [
                    f"{domain}/subscription-types/",  # Main subscription types endpoint
                    f"{domain}/api/subscription-types/",  # API subscription types endpoint
                    f"{domain}/subscriptions/",       # Fallback to subscriptions
                ]
                
                for endpoint in endpoints_to_try:
                    logger.info(f"Trying subscription endpoint: {endpoint}")
                    response = self.make_authenticated_request('GET', endpoint)
                    
                    if response and response.status_code == 200:
                        subscription_types = response.json()
                        logger.info(f"✅ Successfully fetched {len(subscription_types)} subscription types from {endpoint}")
                        
                        # Transform the data to match our expected format
                        if subscription_types and isinstance(subscription_types, list) and len(subscription_types) > 0:
                            transformed_subscriptions = []
                            for subscription_type in subscription_types:
                                # Handle subscription types data structure
                                transformed_subscription = {
                                    'external_id': str(subscription_type.get('external_id') or subscription_type.get('id') or subscription_type.get('pk') or ''),
                                    'title': subscription_type.get('title') or subscription_type.get('name') or 'Untitled Subscription Type',
                                    'description': subscription_type.get('description') or '',
                                    'price': subscription_type.get('price') or '0.00',
                                    'duration_days': subscription_type.get('duration_days') or subscription_type.get('validity_days') or 30,
                                    'is_active': subscription_type.get('is_active', True),
                                    'features': subscription_type.get('features', [])
                                }
                                transformed_subscriptions.append(transformed_subscription)
                            subscription_types = transformed_subscriptions
                        
                        return JsonResponse({'success': True, 'data': subscription_types})
                    elif response and response.status_code == 403:
                        logger.warning(f"Authentication failed for {endpoint}: 403")
                    else:
                        status_code = response.status_code if response else 'No response'
                        logger.warning(f"Failed to fetch subscription types from {endpoint}: {status_code}")
            
            return JsonResponse({
                'success': False, 
                'error': 'Failed to fetch subscription types from all available domains. Please check if subscription service is running.'
            })
                
        except Exception as e:
            logger.error(f"❌ Error fetching subscription types: {str(e)}")
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
            
            logger.info(f"Fetching bank accounts from: {url}")
            response = self.make_authenticated_request('GET', url)
            
            if response and response.status_code == 200:
                bank_accounts = response.json()
                return JsonResponse({'success': True, 'data': bank_accounts})
            else:
                status_code = response.status_code if response else 'No response'
                return JsonResponse({
                    'success': False, 
                    'error': f'Failed to fetch bank accounts: {status_code}'
                })
                
        except Exception as e:
            logger.error(f"❌ Error fetching bank accounts: {str(e)}")
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
            
            logger.info(f"Fetching cliq accounts from: {url}")
            response = self.make_authenticated_request('GET', url)
            
            if response and response.status_code == 200:
                cliq_accounts = response.json()
                return JsonResponse({'success': True, 'data': cliq_accounts})
            else:
                status_code = response.status_code if response else 'No response'
                return JsonResponse({
                    'success': False, 
                    'error': f'Failed to fetch cliq accounts: {status_code}'
                })
                
        except Exception as e:
            logger.error(f"❌ Error fetching cliq accounts: {str(e)}")
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
                
                logger.info(f"✅ Successfully {action_message} payment: {external_id}")
                return JsonResponse({
                    'success': True, 
                    'data': payment, 
                    'message': f'Payment {action_message} successfully'
                })
            elif response.status_code == 403:
                logger.error("❌ Authentication failed - 403 Forbidden")
                return JsonResponse({
                    'success': False, 
                    'error': 'Authentication failed (403). Please verify AUTH_TOKEN.'
                })
            else:
                error_msg = f"Payment service returned status {response.status_code}"
                try:
                    error_detail = response.json().get('detail', response.text)
                    error_msg = f"{error_msg}: {error_detail}"
                except:
                    error_msg = f"{error_msg}: {response.text}"
                    
                logger.error(f"❌ Failed to {action_type} payment: {error_msg}")
                return JsonResponse({
                    'success': False, 
                    'error': error_msg
                })
                
        except Exception as e:
            logger.error(f"❌ Error performing payment action: {str(e)}")
            return JsonResponse({
                'success': False, 
                'error': f'Failed to perform action: {str(e)}'
            })