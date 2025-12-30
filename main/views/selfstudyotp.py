from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import requests
import os
import random
import logging
import json
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

@method_decorator([login_required, csrf_exempt], name='dispatch')
class SelfStudyOTPView(View):
    def get(self, request):
        # Get domains dynamically from registry
        otp_domains = self.get_otp_domains()
        userprofile_domains = self.get_userprofile_domains()
        
        # Fetch real OTPs from OTP service
        otp_list = self.fetch_real_otp_list()
        
        # Fetch users from UserProfile service
        users_list = self.fetch_all_users()
        
        context = {
            'title': 'OTP Management',
            'page_title': 'OTP Verification Management',
            'otp_domains': otp_domains,
            'userprofile_domains': userprofile_domains,
            'otp_list': otp_list,
            'users_list': users_list,
        }
        return render(request, 'selfstudyotp.html', context)
    
    def fetch_real_otp_list(self):
        """Fetch real OTP list from OTP service"""
        otp_domains = self.get_otp_domains()
        if not otp_domains:
            return []
        
        domain = self.get_random_domain(otp_domains)
        if not domain:
            return []
        
        auth_token = os.getenv('AUTH_TOKEN')
        if not auth_token:
            logger.error("AUTH_TOKEN not configured in environment")
            return []
        
        try:
            # Use the new list endpoint
            url = f"{domain}/list/"
            headers = {
                'Authorization': f'Bearer {auth_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                otps = response.json()
                # Format OTPs for template
                formatted_otps = []
                for otp in otps:
                    formatted_otps.append({
                        'user_id': otp.get('user_id', ''),
                        'username': otp.get('username', ''),
                        'email': otp.get('email', ''),
                        'code': otp.get('code', ''),
                        'created_at': otp.get('created_at', ''),
                        'is_used': otp.get('is_used', False)
                    })
                return formatted_otps
            else:
                logger.error(f"Failed to fetch OTPs: {response.status_code}")
                return []
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed for OTPs: {str(e)}")
            return []
        except Exception as e:
            logger.error(f"Error fetching OTPs: {str(e)}")
            return []
    
    def fetch_all_users(self):
        """Fetch all users from UserProfile service"""
        userprofile_domains = self.get_userprofile_domains()
        if not userprofile_domains:
            return []
        
        domain = self.get_random_domain(userprofile_domains)
        if not domain:
            return []
        
        auth_token = os.getenv('AUTH_TOKEN')
        if not auth_token:
            logger.error("AUTH_TOKEN not configured in environment")
            return []
        
        try:
            # Use profiles endpoint to get all users
            url = f"{domain}/profiles/"
            headers = {
                'Authorization': f'Token {auth_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                users = response.json()
                # Format users for dropdown
                formatted_users = []
                for user in users:
                    formatted_users.append({
                        'user_id': str(user.get('user_id', '')),
                        'username': user.get('username', ''),
                        'email': user.get('email', ''),
                        'first_name': user.get('first_name', ''),
                        'last_name': user.get('last_name', ''),
                        'is_email_verified': user.get('is_email_verified', False)
                    })
                return formatted_users
            else:
                logger.error(f"Failed to fetch users: {response.status_code}")
                return []
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed for users: {str(e)}")
            return []
        except Exception as e:
            logger.error(f"Error fetching users: {str(e)}")
            return []
    
    def get_otp_domains(self):
        """Get OTP domains dynamically from registry"""
        return self.fetch_dynamic_domains(14)  # app_id=14 for OTP
    
    def get_userprofile_domains(self):
        """Get UserProfile domains dynamically from registry"""
        return self.fetch_dynamic_domains(13)  # app_id=13 for UserProfile
    
    def fetch_dynamic_domains(self, app_id):
        """
        Fetch replica domains dynamically from SelfStudy Domains registry
        """
        # SelfStudy Domains registry instances
        registry_instances = [
            "https://sfsdomains1.pythonanywhere.com",
            "https://sfsdomains2.pythonanywhere.com"
        ]
        
        # Shuffle for load balancing
        random.shuffle(registry_instances)
        
        auth_token = os.getenv('AUTH_TOKEN')
        if not auth_token:
            logger.error("AUTH_TOKEN not configured in environment")
            return []
        
        headers = {
            'Authorization': f'Token {auth_token}',
            'Content-Type': 'application/json'
        }
        
        for registry_domain in registry_instances:
            try:
                url = f"{registry_domain.rstrip('/')}/apps/{app_id}/"
                logger.info(f"Fetching domains for app_id {app_id} from {url}")
                response = requests.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    app_data = response.json()
                    replica_urls = [
                        replica['replica_url'].rstrip('/') 
                        for replica in app_data.get('replicas', [])
                    ]
                    logger.info(f"Successfully fetched {len(replica_urls)} domains for app_id {app_id}")
                    return replica_urls
                else:
                    logger.warning(f"Failed to fetch from {registry_domain}: {response.status_code}")
            except requests.exceptions.RequestException as e:
                logger.error(f"Request failed for {registry_domain}: {str(e)}")
                continue
        
        # Fallback to empty list if all registries fail
        logger.warning(f"All registry instances failed for app_id {app_id}")
        return []
    
    def get_random_domain(self, domains):
        """Select a random working domain with health checking"""
        if not domains:
            return None
        
        # Shuffle for random selection
        shuffled_domains = domains.copy()
        random.shuffle(shuffled_domains)
        
        for domain in shuffled_domains:
            try:
                # Simple health check
                health_url = f"{domain}/health/" if 'otp' in domain.lower() else f"{domain}/metrics/"
                response = requests.get(health_url, timeout=5)
                if response.status_code == 200:
                    return domain
            except requests.exceptions.RequestException:
                continue
        
        # If no working domain found, return first one
        return domains[0] if domains else None
    
    def post(self, request):
        """Handle OTP operations via AJAX"""
        try:
            action = request.POST.get('action')
            
            if action == 'generate_otp':
                return self.handle_generate_otp(request)
            elif action == 'verify_otp':
                return self.handle_verify_otp(request)
            elif action == 'resend_otp':
                return self.handle_resend_otp(request)
            elif action == 'get_user_data':
                return self.handle_get_user_data(request)
            elif action == 'fetch_users':
                return self.handle_fetch_users(request)
            elif action == 'fetch_otps':
                return self.handle_fetch_otps(request)  # NEW ACTION
            elif action == 'delete_otp':
                return self.handle_delete_otp(request)
            else:
                return JsonResponse({
                    'success': False,
                    'message': 'Invalid action'
                }, status=400)
        except Exception as e:
            logger.error(f"Error in POST handler: {str(e)}")
            return JsonResponse({
                'success': False,
                'message': f'Server error: {str(e)}'
            }, status=500)
    
    def handle_fetch_otps(self, request):
        """Fetch OTPs from OTP service"""
        try:
            otps = self.fetch_real_otp_list()
            return JsonResponse({
                'success': True,
                'otps': otps
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Failed to fetch OTPs: {str(e)}'
            }, status=500)
    
    def handle_fetch_users(self, request):
        """Fetch all users from UserProfile service"""
        try:
            users = self.fetch_all_users()
            return JsonResponse({
                'success': True,
                'users': users
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Failed to fetch users: {str(e)}'
            }, status=500)
    
    # Update the handle_delete_otp method:
    def handle_delete_otp(self, request):
        """Delete OTP from OTP service"""
        user_id = request.POST.get('user_id', '').strip()
        
        if not user_id:
            return JsonResponse({
                'success': False,
                'message': 'User ID is required'
            }, status=400)
        
        # Get OTP domains
        otp_domains = self.get_otp_domains()
        if not otp_domains:
            return JsonResponse({
                'success': False,
                'message': 'No OTP domains available'
            }, status=503)
        
        # Select random domain
        domain = self.get_random_domain(otp_domains)
        if not domain:
            return JsonResponse({
                'success': False,
                'message': 'No working OTP domain found'
            }, status=503)
        
        auth_token = os.getenv('AUTH_TOKEN')
        if not auth_token:
            logger.error("AUTH_TOKEN not configured in environment")
            return JsonResponse({
                'success': False,
                'message': 'Server authentication not configured'
            }, status=500)
        
        try:
            delete_url = f"{domain}/delete/{user_id}/"
            headers = {
                'Authorization': f'Bearer {auth_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.delete(delete_url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                return JsonResponse({
                    'success': True,
                    'message': result.get('status', 'OTP deleted successfully'),
                    'user_id': user_id
                })
            else:
                error_data = response.json() if response.content else {}
                error_message = error_data.get('error', f'Failed to delete OTP: {response.status_code}')
                return JsonResponse({
                    'success': False,
                    'message': error_message
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Connection error during OTP deletion: {str(e)}")
            return JsonResponse({
                'success': False,
                'message': f'Connection error: {str(e)}'
            }, status=503)
        except Exception as e:
            logger.error(f"Error during OTP deletion: {str(e)}")
            return JsonResponse({
                'success': False,
                'message': f'Error: {str(e)}'
            }, status=500)
    
    def handle_get_user_data(self, request):
        """Get user data by username from UserProfile service"""
        username = request.POST.get('username', '').strip().lower()
        
        if not username:
            return JsonResponse({
                'success': False,
                'message': 'Username is required'
            }, status=400)
        
        # Get UserProfile domains
        userprofile_domains = self.get_userprofile_domains()
        if not userprofile_domains:
            return JsonResponse({
                'success': False,
                'message': 'No UserProfile domains available'
            }, status=503)
        
        # Select random domain
        domain = self.get_random_domain(userprofile_domains)
        if not domain:
            return JsonResponse({
                'success': False,
                'message': 'No working UserProfile domain found'
            }, status=503)
        
        try:
            # Get all profiles and filter by username
            url = f"{domain}/profiles/"
            auth_token = os.getenv('AUTH_TOKEN')
            headers = {
                'Authorization': f'Token {auth_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                profiles = response.json()
                # Find profile with matching username
                user_profile = None
                for profile in profiles:
                    if profile.get('username', '').lower() == username:
                        user_profile = profile
                        break
                
                if user_profile:
                    return JsonResponse({
                        'success': True,
                        'user_id': user_profile.get('user_id'),
                        'email': user_profile.get('email'),
                        'first_name': user_profile.get('first_name', ''),
                        'last_name': user_profile.get('last_name', ''),
                        'is_email_verified': user_profile.get('is_email_verified', False)
                    })
                else:
                    return JsonResponse({
                        'success': False,
                        'message': 'User not found'
                    }, status=404)
            else:
                return JsonResponse({
                    'success': False,
                    'message': f'Failed to fetch user data: {response.status_code}'
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({
                'success': False,
                'message': f'Connection error: {str(e)}'
            }, status=503)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Error: {str(e)}'
            }, status=500)
    
    def handle_generate_otp(self, request):
        """Generate OTP for user"""
        user_id = request.POST.get('user_id', '').strip()
        email = request.POST.get('email', '').strip().lower()
        username = request.POST.get('username', '').strip().lower()
        
        if not all([user_id, email, username]):
            return JsonResponse({
                'success': False,
                'message': 'All fields are required'
            }, status=400)
        
        # Get OTP domains
        otp_domains = self.get_otp_domains()
        if not otp_domains:
            return JsonResponse({
                'success': False,
                'message': 'No OTP domains available'
            }, status=503)
        
        # Select random domain
        domain = self.get_random_domain(otp_domains)
        if not domain:
            return JsonResponse({
                'success': False,
                'message': 'No working OTP domain found'
            }, status=503)
        
        try:
            generate_url = f"{domain}/generate/"
            auth_token = os.getenv('AUTH_TOKEN')
            headers = {
                'Authorization': f'Bearer {auth_token}',
                'Content-Type': 'application/json'
            }
            data = {
                'user_id': user_id,
                'email': email,
                'username': username
            }
            
            response = requests.post(generate_url, json=data, headers=headers, timeout=10)
            
            if response.status_code == 201:
                result = response.json()
                return JsonResponse({
                    'success': True,
                    'message': 'OTP generated successfully',
                    'data': result
                })
            else:
                return JsonResponse({
                    'success': False,
                    'message': f'Failed to generate OTP: {response.status_code} - {response.text}'
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({
                'success': False,
                'message': f'Connection error: {str(e)}'
            }, status=503)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Error: {str(e)}'
            }, status=500)
    
    def handle_verify_otp(self, request):
        """Verify OTP"""
        user_id = request.POST.get('user_id', '').strip()
        code = request.POST.get('code', '').strip()
        
        if not all([user_id, code]):
            return JsonResponse({
                'success': False,
                'message': 'All fields are required'
            }, status=400)
        
        # Get OTP domains
        otp_domains = self.get_otp_domains()
        if not otp_domains:
            return JsonResponse({
                'success': False,
                'message': 'No OTP domains available'
            }, status=503)
        
        # Select random domain
        domain = self.get_random_domain(otp_domains)
        if not domain:
            return JsonResponse({
                'success': False,
                'message': 'No working OTP domain found'
            }, status=503)
        
        try:
            verify_url = f"{domain}/verify/"
            auth_token = os.getenv('AUTH_TOKEN')
            headers = {
                'Authorization': f'Bearer {auth_token}',
                'Content-Type': 'application/json'
            }
            data = {
                'user_id': user_id,
                'code': code
            }
            
            response = requests.post(verify_url, json=data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                return JsonResponse({
                    'success': True,
                    'message': 'OTP verified successfully',
                    'data': result
                })
            else:
                error_data = response.json() if response.content else {}
                return JsonResponse({
                    'success': False,
                    'message': error_data.get('error', f'Failed to verify OTP: {response.status_code}')
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({
                'success': False,
                'message': f'Connection error: {str(e)}'
            }, status=503)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Error: {str(e)}'
            }, status=500)
    
    def handle_resend_otp(self, request):
        """Resend OTP"""
        user_id = request.POST.get('user_id', '').strip()
        email = request.POST.get('email', '').strip().lower()
        username = request.POST.get('username', '').strip().lower()
        
        if not all([user_id, email, username]):
            return JsonResponse({
                'success': False,
                'message': 'All fields are required'
            }, status=400)
        
        # Get OTP domains
        otp_domains = self.get_otp_domains()
        if not otp_domains:
            return JsonResponse({
                'success': False,
                'message': 'No OTP domains available'
            }, status=503)
        
        # Select random domain
        domain = self.get_random_domain(otp_domains)
        if not domain:
            return JsonResponse({
                'success': False,
                'message': 'No working OTP domain found'
            }, status=503)
        
        try:
            resend_url = f"{domain}/resend/"
            auth_token = os.getenv('AUTH_TOKEN')
            headers = {
                'Authorization': f'Bearer {auth_token}',
                'Content-Type': 'application/json'
            }
            data = {
                'user_id': user_id,
                'email': email,
                'username': username
            }
            
            response = requests.post(resend_url, json=data, headers=headers, timeout=10)
            
            if response.status_code == 201:
                result = response.json()
                return JsonResponse({
                    'success': True,
                    'message': 'OTP resent successfully',
                    'data': result
                })
            else:
                return JsonResponse({
                    'success': False,
                    'message': f'Failed to resend OTP: {response.status_code} - {response.text}'
                }, status=response.status_code)
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({
                'success': False,
                'message': f'Connection error: {str(e)}'
            }, status=503)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Error: {str(e)}'
            }, status=500)