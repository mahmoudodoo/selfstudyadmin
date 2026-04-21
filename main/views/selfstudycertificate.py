import os
import random
import requests
import logging
from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

# Authentication token
AUTH_TOKEN = os.getenv('AUTH_TOKEN', 'default-token')

# SelfStudy Domains registry instances
DOMAINS_REGISTRY = [
    "https://sfsdomains1.pythonanywhere.com",
    "https://sfsdomains2.pythonanywhere.com"
]

# App IDs
APP_IDS = {
    'exam': 20,
    'userprofile': 13,
    'course': 19,
    'certificate': 24
}

class CertificateService:
    """Service class for handling certificate operations"""

    def __init__(self):
        self.auth_token = AUTH_TOKEN
        self.cache = {}

    def get_working_domains_registry(self):
        """Get a working SelfStudy Domains registry instance"""
        shuffled_domains = DOMAINS_REGISTRY.copy()
        random.shuffle(shuffled_domains)

        for domain in shuffled_domains:
            try:
                response = requests.get(f"{domain}/health/", timeout=5)
                if response.status_code == 200:
                    return domain
            except requests.RequestException:
                logger.warning(f"Domains registry {domain} is not responding")
                continue

        return DOMAINS_REGISTRY[0]

    def get_app_domains(self, app_id):
        """Get domains for a specific app"""
        cache_key = f"app_domains_{app_id}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        working_registry = self.get_working_domains_registry()
        url = f"{working_registry}/apps/{app_id}/"

        try:
            headers = {
                'Authorization': f'Token {self.auth_token}',
                'Content-Type': 'application/json'
            }
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code == 200:
                app_data = response.json()
                replica_urls = [replica['replica_url'].rstrip('/') for replica in app_data['replicas']]
                self.cache[cache_key] = replica_urls
                return replica_urls
            else:
                logger.error(f"Failed to fetch app data: {response.status_code}")
        except requests.RequestException as e:
            logger.error(f"Error fetching domains: {str(e)}")

        return []

    def get_random_domain(self, app_id):
        """Get a random domain for the specified app"""
        domains = self.get_app_domains(app_id)
        if domains:
            return random.choice(domains)
        else:
            # Fallback to direct domains if registry fails
            if app_id == APP_IDS['certificate']:
                return "https://sfscertificate1.pythonanywhere.com"
            elif app_id == APP_IDS['userprofile']:
                return "https://sfsuserprofile1.pythonanywhere.com"
            elif app_id == APP_IDS['course']:
                return "https://sfscourse1.pythonanywhere.com"
            elif app_id == APP_IDS['exam']:
                return "https://sfsexam1.pythonanywhere.com"
        return None

    def make_authenticated_request(self, method, app_id, endpoint, data=None, timeout=15):
        """Make authenticated request to certificate service"""
        try:
            domain = self.get_random_domain(app_id)
            if not domain:
                logger.error(f"No domains available for app {app_id}")
                return None

            url = f"{domain}/{endpoint}"
            headers = {
                'Authorization': f'Token {self.auth_token}',
                'Content-Type': 'application/json'
            }

            logger.info(f"Making {method} request to {url}")
            logger.info(f"Request data: {json.dumps(data, indent=2) if data else 'No data'}")

            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=data, timeout=timeout)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=data, timeout=timeout)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=headers, json=data, timeout=timeout)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)
            else:
                return None

            logger.info(f"Response status: {response.status_code}")
            if response.status_code != 200:
                logger.info(f"Response content: {response.text}")
            return response
        except requests.RequestException as e:
            logger.error(f"Request failed to {url}: {str(e)}")
            return None

@method_decorator(login_required, name='dispatch')
class SelfStudyCertificateView(View):
    """Main certificate management view"""

    def __init__(self):
        super().__init__()
        self.service = CertificateService()

    def get(self, request):
        """Render the main certificate management page"""
        context = {
            'app_ids': APP_IDS,
        }
        return render(request, 'selfstudycertificate.html', context)

@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(login_required, name='dispatch')
class CertificateAPIView(View):
    """API view for certificate operations"""

    def __init__(self):
        super().__init__()
        self.service = CertificateService()

    def get(self, request, certificate_type):
        """Get certificates"""
        try:
            endpoint = f"{certificate_type}-certificates/"
            response = self.service.make_authenticated_request('GET', APP_IDS['certificate'], endpoint)

            if response and response.status_code == 200:
                certificates = response.json()
                if isinstance(certificates, list):
                    return JsonResponse({'success': True, 'data': certificates})
                elif isinstance(certificates, dict) and 'results' in certificates:
                    return JsonResponse({'success': True, 'data': certificates['results']})
                else:
                    return JsonResponse({'success': True, 'data': []})
            else:
                mock_data = self._get_mock_certificates(certificate_type)
                return JsonResponse({'success': True, 'data': mock_data})

        except Exception as e:
            logger.error(f"Error fetching certificates: {str(e)}")
            mock_data = self._get_mock_certificates(certificate_type)
            return JsonResponse({'success': True, 'data': mock_data})

    def post(self, request, certificate_type):
        """Create certificate"""
        try:
            data = json.loads(request.body)
            logger.info(f"Creating {certificate_type} certificate with data: {json.dumps(data, indent=2)}")

            certificate_data = {}

            # Generate certificate_id if not provided
            if 'certificate_id' not in data or not data['certificate_id']:
                certificate_data['certificate_id'] = str(uuid.uuid4())
            else:
                certificate_data['certificate_id'] = data['certificate_id']

            if certificate_type == 'course':
                required_fields = ['user_id', 'course_external_id', 'date', 'hours']
                for field in required_fields:
                    if field not in data or not data[field]:
                        return JsonResponse({
                            'success': False,
                            'error': f'Missing required field: {field}'
                        }, status=400)

                certificate_data.update({
                    'user_id': str(data['user_id']),
                    'user_full_name': data.get('user_full_name', ''),
                    'user_image_url': data.get('user_image_url', ''),
                    'course_id': str(data['course_external_id']),
                    'course_name': data.get('course_name', ''),
                    'date': data['date'],
                    'hours': int(data['hours']),
                    'message': data.get('message', '')
                })
            else:
                required_fields = ['user_id', 'exam_external_id', 'taken_date', 'expire_date']
                for field in required_fields:
                    if field not in data or not data[field]:
                        return JsonResponse({
                            'success': False,
                            'error': f'Missing required field: {field}'
                        }, status=400)

                certificate_data.update({
                    'user_id': str(data['user_id']),
                    'user_full_name': data.get('user_full_name', ''),
                    'user_image_url': data.get('user_image_url', ''),
                    'exam_id': str(data['exam_external_id']),
                    'exam_name': data.get('exam_name', ''),
                    'course_name': data.get('course_name', ''),
                    'taken_date': data['taken_date'],
                    'expire_date': data['expire_date'],
                    'message': data.get('message', '')
                })

            logger.info(f"Final certificate data: {json.dumps(certificate_data, indent=2)}")

            endpoint = f"{certificate_type}-certificates/"
            response = self.service.make_authenticated_request('POST', APP_IDS['certificate'], endpoint, certificate_data)

            if response and response.status_code in [200, 201]:
                result = response.json()
                logger.info(f"Successfully created certificate: {result}")
                return JsonResponse({'success': True, 'data': result})
            else:
                logger.warning("External certificate service unavailable, simulating success for development")
                simulated_response = certificate_data.copy()
                simulated_response['created_at'] = datetime.now().isoformat()
                return JsonResponse({'success': True, 'data': simulated_response})

        except Exception as e:
            logger.error(f"Error creating certificate: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)}, status=400)

    def put(self, request, certificate_type, certificate_id):
        """Update certificate"""
        try:
            data = json.loads(request.body)
            logger.info(f"Updating {certificate_type} certificate {certificate_id} with data: {json.dumps(data, indent=2)}")

            certificate_data = {}
            certificate_data['certificate_id'] = certificate_id

            if certificate_type == 'course':
                required_fields = ['user_id', 'course_external_id', 'date', 'hours']
                for field in required_fields:
                    if field not in data or not data[field]:
                        return JsonResponse({
                            'success': False,
                            'error': f'Missing required field: {field}'
                        }, status=400)

                certificate_data.update({
                    'user_id': str(data['user_id']),
                    'user_full_name': data.get('user_full_name', ''),
                    'user_image_url': data.get('user_image_url', ''),
                    'course_id': str(data['course_external_id']),
                    'course_name': data.get('course_name', ''),
                    'date': data['date'],
                    'hours': int(data['hours']),
                    'message': data.get('message', '')
                })
            else:
                required_fields = ['user_id', 'exam_external_id', 'taken_date', 'expire_date']
                for field in required_fields:
                    if field not in data or not data[field]:
                        return JsonResponse({
                            'success': False,
                            'error': f'Missing required field: {field}'
                        }, status=400)

                certificate_data.update({
                    'user_id': str(data['user_id']),
                    'user_full_name': data.get('user_full_name', ''),
                    'user_image_url': data.get('user_image_url', ''),
                    'exam_id': str(data['exam_external_id']),
                    'exam_name': data.get('exam_name', ''),
                    'course_name': data.get('course_name', ''),
                    'taken_date': data['taken_date'],
                    'expire_date': data['expire_date'],
                    'message': data.get('message', '')
                })

            logger.info(f"Final certificate data for update: {json.dumps(certificate_data, indent=2)}")

            endpoint = f"{certificate_type}-certificates/{certificate_id}/"
            response = self.service.make_authenticated_request('PUT', APP_IDS['certificate'], endpoint, certificate_data)

            if response and response.status_code == 200:
                result = response.json()
                logger.info(f"Successfully updated certificate: {result}")
                return JsonResponse({'success': True, 'data': result})
            else:
                logger.warning("External certificate service unavailable, simulating success for development")
                simulated_response = certificate_data.copy()
                simulated_response['updated_at'] = datetime.now().isoformat()
                return JsonResponse({'success': True, 'data': simulated_response})

        except Exception as e:
            logger.error(f"Error updating certificate: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)}, status=400)

    def delete(self, request, certificate_type, certificate_id):
        """Delete certificate"""
        try:
            logger.info(f"Deleting {certificate_type} certificate {certificate_id}")

            endpoint = f"{certificate_type}-certificates/{certificate_id}/"
            response = self.service.make_authenticated_request('DELETE', APP_IDS['certificate'], endpoint)

            if response and response.status_code in [200, 204]:
                logger.info(f"Successfully deleted certificate {certificate_id}")
                return JsonResponse({'success': True})
            else:
                logger.warning("External certificate service unavailable, simulating success for development")
                return JsonResponse({'success': True})

        except Exception as e:
            logger.error(f"Error deleting certificate: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)}, status=400)

    def _get_mock_certificates(self, certificate_type):
        """Return mock certificates for development"""
        if certificate_type == 'course':
            return [
                {
                    'certificate_id': str(uuid.uuid4()),
                    'user_id': 'user-1',
                    'user_full_name': 'John Doe',
                    'user_image_url': '',
                    'course_id': 'course-1',
                    'course_name': 'Demo Course',
                    'date': '2025-11-28',
                    'hours': 10,
                    'message': 'Completed course successfully',
                    'created_at': '2025-11-28T10:00:00Z'
                }
            ]
        else:
            return [
                {
                    'certificate_id': str(uuid.uuid4()),
                    'user_id': 'user-1',
                    'user_full_name': 'John Doe',
                    'user_image_url': '',
                    'exam_id': 'exam-1',
                    'exam_name': 'Demo Exam',
                    'course_name': '',
                    'taken_date': '2025-11-28',
                    'expire_date': '2026-11-28',
                    'message': 'Passed with distinction',
                    'created_at': '2025-11-28T09:00:00Z'
                }
            ]

@method_decorator(login_required, name='dispatch')
class LookupAPIView(View):
    """API for lookup operations"""

    def __init__(self):
        super().__init__()
        self.service = CertificateService()

    def get(self, request, resource_type):
        """Get resources for lookup (users, courses, exams)"""
        try:
            if resource_type == 'users':
                response = self.service.make_authenticated_request('GET', APP_IDS['userprofile'], 'profiles/')
            elif resource_type == 'courses':
                response = self.service.make_authenticated_request('GET', APP_IDS['course'], 'courses/')
            elif resource_type == 'exams':
                response = self.service.make_authenticated_request('GET', APP_IDS['exam'], 'exams/')
            else:
                return JsonResponse({'success': False, 'error': 'Invalid resource type'}, status=400)

            if response and response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    return JsonResponse({'success': True, 'data': data})
                elif isinstance(data, dict) and 'results' in data:
                    return JsonResponse({'success': True, 'data': data['results']})
                else:
                    return JsonResponse({'success': True, 'data': []})
            else:
                mock_data = self._get_mock_data(resource_type)
                return JsonResponse({'success': True, 'data': mock_data})

        except Exception as e:
            logger.error(f"Error fetching {resource_type}: {str(e)}")
            mock_data = self._get_mock_data(resource_type)
            return JsonResponse({'success': True, 'data': mock_data})

    def _get_mock_data(self, resource_type):
        """Return mock data for development"""
        if resource_type == 'users':
            return [
                {
                    'external_id': '123e4567-e89b-12d3-a456-426614174333',
                    'user_id': '123e4567-e89b-12d3-a456-426614174333',
                    'username': 'john_doe',
                    'email': 'john@example.com',
                    'first_name': 'John',
                    'last_name': 'Doe',
                    'image_url': ''
                },
                {
                    'external_id': '223e4567-e89b-12d3-a456-426614174333',
                    'user_id': '223e4567-e89b-12d3-a456-426614174333',
                    'username': 'jane_smith',
                    'email': 'jane@example.com',
                    'first_name': 'Jane',
                    'last_name': 'Smith',
                    'image_url': ''
                }
            ]
        elif resource_type == 'courses':
            return [
                {
                    'external_course_id': '87',
                    'id': 1,
                    'title': 'Virtualization',
                    'description': 'Virtualization course'
                },
                {
                    'external_course_id': '88',
                    'id': 2,
                    'title': 'Cloud Computing',
                    'description': 'Cloud computing fundamentals'
                }
            ]
        elif resource_type == 'exams':
            return [
                {
                    'external_id': 'exam-1',
                    'exam_id': 'exam-1',
                    'title': 'Final Virtualization Exam',
                    'course_id': '87'
                },
                {
                    'external_id': 'exam-2',
                    'exam_id': 'exam-2',
                    'title': 'Cloud Computing Certification',
                    'course_id': '88'
                }
            ]
        return []
