import os
import logging
import random
import requests
import json
import uuid
from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

logger = logging.getLogger(__name__)

@method_decorator(login_required, name='dispatch')
class SelfStudyExamView(View):
    def get(self, request):
        """Render the main exam management interface"""
        try:
            # Get dynamic domains for the template
            domains = self.get_dynamic_domains()
            courses = self.fetch_courses()
            profiles = self.fetch_user_profiles()
            
            context = {
                'domains': domains,
                'courses': courses,
                'profiles': profiles,
            }
            return render(request, 'selfstudyexam.html', context)
        except Exception as e:
            logger.error(f"Error loading exam interface: {str(e)}")
            return render(request, 'selfstudyexam.html', {'error': str(e)})

    def get_dynamic_domains(self):
        """Fetch dynamic domains from SelfStudy Domains registry"""
        try:
            # SelfStudy Domains registry instances
            SFS_DOMAINS = [
                'https://sfsdomains1.pythonanywhere.com',
                'https://sfsdomains2.pythonanywhere.com'
            ]
            
            # App ID for SelfStudy Exam service
            SELFSTUDY_EXAM_APP_ID = 20
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            
            # Try each registry instance
            for domain in SFS_DOMAINS:
                try:
                    url = f"{domain}/apps/{SELFSTUDY_EXAM_APP_ID}/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.get(url, headers=headers, timeout=10)
                    if response.status_code == 200:
                        app_data = response.json()
                        replica_urls = [replica['replica_url'].rstrip('/') for replica in app_data.get('replicas', [])]
                        logger.info(f"Successfully fetched {len(replica_urls)} domains from {domain}")
                        return replica_urls
                except requests.RequestException as e:
                    logger.warning(f"Registry {domain} failed: {str(e)}")
                    continue
            
            logger.error("All registry instances failed")
            return []
            
        except Exception as e:
            logger.error(f"Error fetching dynamic domains: {str(e)}")
            return []

    def fetch_courses(self):
        """Fetch courses from selfstudycourse app"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = self.get_course_domains()
            
            if not domains:
                logger.warning("No course domains available")
                return []
            
            # Select first working domain for performance
            selected_domain = self.get_working_domain(domains)
            if not selected_domain:
                return []
                
            url = f"{selected_domain}/courses/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                courses = response.json()
                logger.info(f"Successfully fetched {len(courses)} courses")
                return courses
            else:
                logger.error(f"Failed to fetch courses: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error fetching courses: {str(e)}")
            return []

    def fetch_user_profiles(self):
        """Fetch user profiles from selfstudyuserprofile app"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = self.get_userprofile_domains()
            
            if not domains:
                logger.warning("No userprofile domains available")
                return []
            
            # Select first working domain for performance
            selected_domain = self.get_working_domain(domains)
            if not selected_domain:
                return []
                
            url = f"{selected_domain}/profiles/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                profiles = response.json()
                logger.info(f"Successfully fetched {len(profiles)} profiles")
                return profiles
            else:
                logger.error(f"Failed to fetch profiles: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error fetching profiles: {str(e)}")
            return []

    def get_course_domains(self):
        """Get domains for selfstudycourse app (ID: 19)"""
        return self._fetch_app_domains(19)

    def get_userprofile_domains(self):
        """Get domains for selfstudyuserprofile app (ID: 13)"""
        return self._fetch_app_domains(13)

    def _fetch_app_domains(self, app_id):
        """Generic method to fetch domains for any app"""
        try:
            SFS_DOMAINS = [
                'https://sfsdomains1.pythonanywhere.com',
                'https://sfsdomains2.pythonanywhere.com'
            ]
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            
            for domain in SFS_DOMAINS:
                try:
                    url = f"{domain}/apps/{app_id}/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.get(url, headers=headers, timeout=10)
                    if response.status_code == 200:
                        app_data = response.json()
                        replica_urls = [replica['replica_url'].rstrip('/') for replica in app_data.get('replicas', [])]
                        return replica_urls
                except requests.RequestException:
                    continue
            
            return []
            
        except Exception as e:
            logger.error(f"Error fetching domains for app {app_id}: {str(e)}")
            return []

    def get_working_domain(self, domains):
        """Get first working domain from list for better performance"""
        for domain in domains:
            try:
                # Quick health check
                response = requests.get(f"{domain}/health/", timeout=3)
                if response.status_code == 200:
                    return domain
            except:
                continue
        return domains[0] if domains else None

@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(login_required, name='dispatch')
class SelfStudyExamAPIView(View):
    """API endpoints for exam CRUD operations - COMPLETELY FIXED VERSION"""
    
    def get(self, request, *args, **kwargs):
        """Fetch exams from dynamic domains"""
        try:
            action = request.GET.get('action')
            
            if action == 'fetch_exams':
                return self.fetch_exams()
            elif action == 'fetch_quizzes':
                return self.fetch_quizzes()
            elif action == 'fetch_lessons':
                course_id = request.GET.get('course_id')
                return self.fetch_lessons(course_id)
            elif action == 'fetch_exam_questions':
                exam_id = request.GET.get('exam_id')
                return self.fetch_exam_questions(exam_id)
            elif action == 'fetch_quiz_questions':
                quiz_id = request.GET.get('quiz_id')
                return self.fetch_quiz_questions(quiz_id)
            elif action == 'fetch_exam_question_details':
                question_id = request.GET.get('question_id')
                return self.fetch_exam_question_details(question_id)
            elif action == 'fetch_quiz_question_details':
                question_id = request.GET.get('question_id')
                return self.fetch_quiz_question_details(question_id)
            elif action == 'fetch_exam_appointments':
                return self.fetch_exam_appointments()
            elif action == 'fetch_user_exam_results':
                return self.fetch_user_exam_results()
            elif action == 'fetch_user_quiz_results':
                return self.fetch_user_quiz_results()
            else:
                return JsonResponse({'error': 'Invalid action'}, status=400)
                
        except Exception as e:
            logger.error(f"Error in GET API: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def post(self, request, *args, **kwargs):
        """Create or update exam/quiz data - COMPLETELY FIXED"""
        try:
            data = json.loads(request.body)
            action = data.get('action')
            
            # CRUD operations for exams and quizzes
            if action == 'create_exam':
                return self.create_exam(data)
            elif action == 'update_exam':
                return self.update_exam(data)
            elif action == 'delete_exam':
                return self.delete_exam(data)
            elif action == 'create_quiz':
                return self.create_quiz(data)
            elif action == 'update_quiz':
                return self.update_quiz(data)
            elif action == 'delete_quiz':
                return self.delete_quiz(data)
            
            # Question operations - USE REGULAR ENDPOINTS
            elif action == 'create_exam_question':
                return self.create_exam_question_direct(data)
            elif action == 'update_exam_question':
                return self.update_exam_question_direct(data)
            elif action == 'delete_exam_question':
                return self.delete_exam_question_direct(data)
            elif action == 'create_quiz_question':
                return self.create_quiz_question_direct(data)
            elif action == 'update_quiz_question':
                return self.update_quiz_question_direct(data)
            elif action == 'delete_quiz_question':
                return self.delete_quiz_question_direct(data)
            
            # Answer operations - FIXED VERSION
            elif action == 'create_exam_answer':
                return self.create_exam_answer_fixed(data)
            elif action == 'update_exam_answer':
                return self.update_exam_answer_fixed(data)
            elif action == 'delete_exam_answer':
                return self.delete_exam_answer_fixed(data)
            elif action == 'create_quiz_answer':
                return self.create_quiz_answer_fixed(data)
            elif action == 'update_quiz_answer':
                return self.update_quiz_answer_fixed(data)
            elif action == 'delete_quiz_answer':
                return self.delete_quiz_answer_fixed(data)
            
            # New operations for appointments and results
            elif action == 'update_exam_appointment':
                return self.update_exam_appointment(data)
            elif action == 'update_user_exam_result':
                return self.update_user_exam_result(data)
            elif action == 'update_user_quiz_result':
                return self.update_user_quiz_result(data)
            else:
                return JsonResponse({'error': 'Invalid action'}, status=400)
                
        except Exception as e:
            logger.error(f"Error in POST API: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    # OPTIMIZED METHODS - SINGLE DOMAIN REQUESTS
    def get_single_domain(self):
        """Get a single working domain for better performance"""
        domains = SelfStudyExamView().get_dynamic_domains()
        if not domains:
            return None
        return SelfStudyExamView().get_working_domain(domains)

    def fetch_exams(self):
        """Fetch exams from single domain for performance"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            url = f"{domain}/exams/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                exams = response.json()
                return JsonResponse({'success': True, 'exams': exams})
            else:
                logger.error(f"Failed to fetch exams: {response.status_code}")
                return JsonResponse({'error': f'Failed to fetch exams: {response.status_code}'}, status=response.status_code)
            
        except Exception as e:
            logger.error(f"Error fetching exams: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def fetch_quizzes(self):
        """Fetch quizzes from single domain for performance"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            url = f"{domain}/quizzes/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                quizzes = response.json()
                return JsonResponse({'success': True, 'quizzes': quizzes})
            else:
                logger.error(f"Failed to fetch quizzes: {response.status_code}")
                return JsonResponse({'error': f'Failed to fetch quizzes: {response.status_code}'}, status=response.status_code)
            
        except Exception as e:
            logger.error(f"Error fetching quizzes: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def fetch_exam_appointments(self):
        """Fetch exam appointments from single domain"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            url = f"{domain}/exam-appointments/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                appointments = response.json()
                return JsonResponse({'success': True, 'appointments': appointments})
            else:
                logger.error(f"Failed to fetch exam appointments: {response.status_code}")
                return JsonResponse({'error': f'Failed to fetch exam appointments: {response.status_code}'}, status=response.status_code)
            
        except Exception as e:
            logger.error(f"Error fetching exam appointments: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def fetch_user_exam_results(self):
        """Fetch user exam results from single domain"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            url = f"{domain}/user-exam-results/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                results = response.json()
                return JsonResponse({'success': True, 'results': results})
            else:
                logger.error(f"Failed to fetch user exam results: {response.status_code}")
                return JsonResponse({'error': f'Failed to fetch user exam results: {response.status_code}'}, status=response.status_code)
            
        except Exception as e:
            logger.error(f"Error fetching user exam results: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def fetch_user_quiz_results(self):
        """Fetch user quiz results from single domain"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            url = f"{domain}/user-quiz-results/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                results = response.json()
                return JsonResponse({'success': True, 'results': results})
            else:
                logger.error(f"Failed to fetch user quiz results: {response.status_code}")
                return JsonResponse({'error': f'Failed to fetch user quiz results: {response.status_code}'}, status=response.status_code)
            
        except Exception as e:
            logger.error(f"Error fetching user quiz results: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def fetch_lessons(self, course_id):
        """Fetch lessons for a specific course"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_course_domains()
            
            if not domains or not course_id:
                return JsonResponse({'success': True, 'lessons': []})
            
            domain = SelfStudyExamView().get_working_domain(domains)
            if not domain:
                return JsonResponse({'success': True, 'lessons': []})
            
            url = f"{domain}/lessons/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            params = {'course_id': course_id}
            
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code == 200:
                lessons = response.json()
                return JsonResponse({'success': True, 'lessons': lessons})
            else:
                return JsonResponse({'success': True, 'lessons': []})
            
        except Exception as e:
            logger.error(f"Error fetching lessons: {str(e)}")
            return JsonResponse({'success': True, 'lessons': []})

    def fetch_exam_questions(self, exam_id):
        """Fetch questions for a specific exam"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain or not exam_id:
                return JsonResponse({'success': True, 'questions': []})
            
            url = f"{domain}/exam-questions/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            params = {'exam': exam_id}
            
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code == 200:
                questions = response.json()
                return JsonResponse({'success': True, 'questions': questions})
            else:
                return JsonResponse({'success': True, 'questions': []})
            
        except Exception as e:
            logger.error(f"Error fetching exam questions: {str(e)}")
            return JsonResponse({'success': True, 'questions': []})

    def fetch_quiz_questions(self, quiz_id):
        """Fetch questions for a specific quiz"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain or not quiz_id:
                return JsonResponse({'success': True, 'questions': []})
            
            url = f"{domain}/quiz-questions/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            params = {'quiz': quiz_id}
            
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code == 200:
                questions = response.json()
                return JsonResponse({'success': True, 'questions': questions})
            else:
                return JsonResponse({'success': True, 'questions': []})
            
        except Exception as e:
            logger.error(f"Error fetching quiz questions: {str(e)}")
            return JsonResponse({'success': True, 'questions': []})

    def fetch_exam_question_details(self, question_id):
        """Fetch detailed information for a specific exam question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain or not question_id:
                return JsonResponse({'error': 'Missing domain or question_id'}, status=400)
            
            url = f"{domain}/exam-questions/{question_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                question_data = response.json()
                return JsonResponse({'success': True, 'question': question_data})
            else:
                return JsonResponse({'error': 'Failed to fetch question details'}, status=404)
            
        except Exception as e:
            logger.error(f"Error fetching exam question details: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def fetch_quiz_question_details(self, question_id):
        """Fetch detailed information for a specific quiz question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain or not question_id:
                return JsonResponse({'error': 'Missing domain or question_id'}, status=400)
            
            url = f"{domain}/quiz-questions/{question_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                question_data = response.json()
                return JsonResponse({'success': True, 'question': question_data})
            else:
                return JsonResponse({'error': 'Failed to fetch question details'}, status=404)
            
        except Exception as e:
            logger.error(f"Error fetching quiz question details: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    # OPTIMIZED CRUD OPERATIONS - SINGLE DOMAIN
    def create_exam(self, data):
        """Create a new exam - single domain"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            url = f"{domain}/exams/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            response = requests.post(url, json=data, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Exam created successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to create exam: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating exam: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_exam(self, data):
        """Update an existing exam - single domain"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            url = f"{domain}/exams/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            response = requests.put(url, json=data, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Exam updated successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to update exam: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating exam: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_exam(self, data):
        """Delete an exam - single domain"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            url = f"{domain}/exams/{external_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            response = requests.delete(url, headers=headers, timeout=10)
            
            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'Exam deleted successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to delete exam: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting exam: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def create_quiz(self, data):
        """Create a new quiz - single domain"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            url = f"{domain}/quizzes/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            response = requests.post(url, json=data, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Quiz created successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to create quiz: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating quiz: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_quiz(self, data):
        """Update an existing quiz - single domain"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            url = f"{domain}/quizzes/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            response = requests.put(url, json=data, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Quiz updated successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to update quiz: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating quiz: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_quiz(self, data):
        """Delete a quiz - single domain"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            url = f"{domain}/quizzes/{external_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            response = requests.delete(url, headers=headers, timeout=10)
            
            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'Quiz deleted successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to delete quiz: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting quiz: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    # FIXED: Question operations - USE REGULAR ENDPOINTS
    def create_exam_question_direct(self, data):
        """Create a new exam question - USE REGULAR ENDPOINT"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            # Use the regular endpoint (NOT sync)
            url = f"{domain}/exam-questions/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Creating exam question with data: {data}")
            response = requests.post(url, json=data, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Exam question created successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to create exam question: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to create exam question: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating exam question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_exam_question_direct(self, data):
        """Update an existing exam question - USE REGULAR ENDPOINT"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            # Use the regular endpoint (NOT sync)
            url = f"{domain}/exam-questions/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Updating exam question with data: {data}")
            response = requests.put(url, json=data, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Exam question updated successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to update exam question: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to update exam question: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating exam question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_exam_question_direct(self, data):
        """Delete an exam question - USE REGULAR ENDPOINT"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            # Use the regular endpoint (NOT sync)
            url = f"{domain}/exam-questions/{external_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            logger.info(f"Deleting exam question with external_id: {external_id}")
            response = requests.delete(url, headers=headers, timeout=10)
            
            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'Exam question deleted successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to delete exam question: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to delete exam question: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting exam question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def create_quiz_question_direct(self, data):
        """Create a new quiz question - USE REGULAR ENDPOINT"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            # Use the regular endpoint (NOT sync)
            url = f"{domain}/quiz-questions/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Creating quiz question with data: {data}")
            response = requests.post(url, json=data, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Quiz question created successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to create quiz question: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to create quiz question: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating quiz question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_quiz_question_direct(self, data):
        """Update an existing quiz question - USE REGULAR ENDPOINT"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            # Use the regular endpoint (NOT sync)
            url = f"{domain}/quiz-questions/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Updating quiz question with data: {data}")
            response = requests.put(url, json=data, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Quiz question updated successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to update quiz question: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to update quiz question: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating quiz question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_quiz_question_direct(self, data):
        """Delete a quiz question - USE REGULAR ENDPOINT"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            # Use the regular endpoint (NOT sync)
            url = f"{domain}/quiz-questions/{external_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            logger.info(f"Deleting quiz question with external_id: {external_id}")
            response = requests.delete(url, headers=headers, timeout=10)
            
            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'Quiz question deleted successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to delete quiz question: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to delete quiz question: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting quiz question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    # FIXED: Answer operations - COMPLETELY REWRITTEN
    def create_exam_answer_fixed(self, data):
        """Create a new exam answer - COMPLETELY FIXED"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            # Get the actual question external_id from the hidden field
            question_external_id = data.get('exam_question')
            if not question_external_id:
                return JsonResponse({'error': 'Question external_id is required'}, status=400)
            
            # Use the regular endpoint with proper data structure
            url = f"{domain}/exam-answers/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            # Prepare the payload with the question external_id
            payload = {
                'external_id': data.get('external_id'),
                'exam_question': question_external_id,  # This should be the UUID external_id
                'text': data.get('text'),
                'is_correct': data.get('is_correct', False)
            }
            
            logger.info(f"Creating exam answer with payload: {payload}")
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Exam answer created successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to create exam answer: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to create exam answer: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating exam answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_exam_answer_fixed(self, data):
        """Update an existing exam answer - FIXED VERSION"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            # Get the actual question external_id from the hidden field
            question_external_id = data.get('exam_question')
            if not question_external_id:
                return JsonResponse({'error': 'Question external_id is required'}, status=400)
            
            # Use the regular endpoint with ALL required fields
            url = f"{domain}/exam-answers/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            # Prepare the payload with ALL required fields
            payload = {
                'external_id': external_id,  # Required field
                'exam_question': question_external_id,  # Required field
                'text': data.get('text'),
                'is_correct': data.get('is_correct', False)
            }
            
            logger.info(f"Updating exam answer with payload: {payload}")
            response = requests.put(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Exam answer updated successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to update exam answer: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to update exam answer: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating exam answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_exam_answer_fixed(self, data):
        """Delete an exam answer - COMPLETELY FIXED"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            # Use the regular endpoint
            url = f"{domain}/exam-answers/{external_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            logger.info(f"Deleting exam answer with external_id: {external_id}")
            response = requests.delete(url, headers=headers, timeout=10)
            
            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'Exam answer deleted successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to delete exam answer: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to delete exam answer: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting exam answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def create_quiz_answer_fixed(self, data):
        """Create a new quiz answer - COMPLETELY FIXED"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            
            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            # Get the actual question external_id from the hidden field
            question_external_id = data.get('quiz_question')
            if not question_external_id:
                return JsonResponse({'error': 'Question external_id is required'}, status=400)
            
            # Use the regular endpoint with proper data structure
            url = f"{domain}/quiz-answers/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            # Prepare the payload with the question external_id
            payload = {
                'external_id': data.get('external_id'),
                'quiz_question': question_external_id,  # This should be the UUID external_id
                'text': data.get('text'),
                'is_correct': data.get('is_correct', False)
            }
            
            logger.info(f"Creating quiz answer with payload: {payload}")
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Quiz answer created successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to create quiz answer: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to create quiz answer: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating quiz answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_quiz_answer_fixed(self, data):
        """Update an existing quiz answer - FIXED VERSION"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            # Get the actual question external_id from the hidden field
            question_external_id = data.get('quiz_question')
            if not question_external_id:
                return JsonResponse({'error': 'Question external_id is required'}, status=400)
            
            # Use the regular endpoint with ALL required fields
            url = f"{domain}/quiz-answers/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            # Prepare the payload with ALL required fields
            payload = {
                'external_id': external_id,  # Required field
                'quiz_question': question_external_id,  # Required field
                'text': data.get('text'),
                'is_correct': data.get('is_correct', False)
            }
            
            logger.info(f"Updating quiz answer with payload: {payload}")
            response = requests.put(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Quiz answer updated successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to update quiz answer: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to update quiz answer: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating quiz answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_quiz_answer_fixed(self, data):
        """Delete a quiz answer - COMPLETELY FIXED"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            # Use the regular endpoint
            url = f"{domain}/quiz-answers/{external_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}
            
            logger.info(f"Deleting quiz answer with external_id: {external_id}")
            response = requests.delete(url, headers=headers, timeout=10)
            
            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'Quiz answer deleted successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to delete quiz answer: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to delete quiz answer: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting quiz answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    # FIXED: Exam appointment update method
    def update_exam_appointment(self, data):
        """Update an exam appointment - COMPLETELY FIXED"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            # Use the sync endpoint which handles foreign key conversion
            payload = {
                'appointment_status': data.get('appointment_status'),
                'can_start': data.get('can_start', False),
                'is_entered': data.get('is_entered', False),
                'proctor_id': data.get('proctor_id', '')
            }
            
            # Remove empty proctor_id if not provided
            if not payload['proctor_id']:
                del payload['proctor_id']
            
            # Use the sync endpoint for better foreign key handling
            url = f"{domain}/sync/exam-appointments/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Updating exam appointment with payload: {payload}")
            response = requests.put(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'Exam appointment updated successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to update exam appointment: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to update exam appointment: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating exam appointment: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    # FIXED: User result update methods
    def update_user_exam_result(self, data):
        """Update a user exam result - COMPLETELY FIXED"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            # Use the sync endpoint which handles foreign key conversion
            payload = {
                'score': data.get('score'),
                'result_status': data.get('result_status'),
                'result_message': data.get('result_message', '')
            }
            
            # Remove empty result_message if not provided
            if not payload['result_message']:
                del payload['result_message']
            
            # Use the sync endpoint for better foreign key handling
            url = f"{domain}/sync/user-exam-results/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Updating user exam result with payload: {payload}")
            response = requests.put(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'User exam result updated successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to update user exam result: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to update user exam result: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating user exam result: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_user_quiz_result(self, data):
        """Update a user quiz result - COMPLETELY FIXED"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')
            
            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)
            
            # Use the sync endpoint which handles foreign key conversion
            payload = {
                'score': data.get('score'),
                'result_status': data.get('result_status'),
                'result_message': data.get('result_message', '')
            }
            
            # Remove empty result_message if not provided
            if not payload['result_message']:
                del payload['result_message']
            
            # Use the sync endpoint for better foreign key handling
            url = f"{domain}/sync/user-quiz-results/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Updating user quiz result with payload: {payload}")
            response = requests.put(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                return JsonResponse({
                    'success': True,
                    'message': 'User quiz result updated successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to update user quiz result: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to update user quiz result: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating user quiz result: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)