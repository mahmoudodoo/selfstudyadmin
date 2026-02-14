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
            # Fetch proctors for the appointments tab
            proctors = self.fetch_proctors()

            context = {
                'domains': domains,
                'courses': courses,
                'profiles': profiles,
                'proctors': proctors,  # Add proctors to context
            }
            return render(request, 'selfstudyexam.html', context)
        except Exception as e:
            logger.error(f"Error loading exam interface: {str(e)}")
            return render(request, 'selfstudyexam.html', {'error': str(e)})

    def get_dynamic_domains(self):
        """Fetch dynamic domains from SelfStudy Domains registry"""
        try:
            # Select random registry instance
            SFS_DOMAINS = [
                'https://sfsdomains1.pythonanywhere.com',
                'https://sfsdomains2.pythonanywhere.com'
            ]
            random.shuffle(SFS_DOMAINS)

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

    def fetch_proctors(self):
        """Fetch proctors from selfstudyproctor app"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = self.get_proctor_domains()

            if not domains:
                logger.warning("No proctor domains available")
                return []

            # Select first working domain for performance
            selected_domain = self.get_working_domain(domains)
            if not selected_domain:
                return []

            url = f"{selected_domain}/proctors/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}

            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                proctors = response.json()
                logger.info(f"Successfully fetched {len(proctors)} proctors")
                return proctors
            else:
                logger.error(f"Failed to fetch proctors: {response.status_code}")
                return []

        except Exception as e:
            logger.error(f"Error fetching proctors: {str(e)}")
            return []

    def get_course_domains(self):
        """Get domains for selfstudycourse app (ID: 19)"""
        return self._fetch_app_domains(19)

    def get_userprofile_domains(self):
        """Get domains for selfstudyuserprofile app (ID: 13)"""
        return self._fetch_app_domains(13)

    def get_proctor_domains(self):
        """Get domains for selfstudyproctor app (ID: 21)"""
        return self._fetch_app_domains(21)

    def _fetch_app_domains(self, app_id):
        """Generic method to fetch domains for any app"""
        try:
            # Select random registry instance
            SFS_DOMAINS = [
                'https://sfsdomains1.pythonanywhere.com',
                'https://sfsdomains2.pythonanywhere.com'
            ]
            random.shuffle(SFS_DOMAINS)

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
    """API endpoints for exam CRUD operations - COMPLETELY FIXED SYNC VERSION"""

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
            elif action == 'fetch_proctors':
                return self.fetch_proctors()
            else:
                return JsonResponse({'error': 'Invalid action'}, status=400)

        except Exception as e:
            logger.error(f"Error in GET API: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def post(self, request, *args, **kwargs):
        """Create or update exam/quiz data - FIXED SYNC"""
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

            # Question operations
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

            # Answer operations
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

            # Appointment operations
            elif action == 'update_exam_appointment':
                return self.update_exam_appointment_complete(data)
            elif action == 'delete_exam_appointment':
                return self.delete_exam_appointment_complete(data)

            # Exam result operations
            elif action == 'update_user_exam_result':
                return self.update_user_exam_result_complete(data)
            elif action == 'delete_user_exam_result':
                return self.delete_user_exam_result_complete(data)

            # Quiz result operations
            elif action == 'update_user_quiz_result':
                return self.update_user_quiz_result_complete(data)
            elif action == 'delete_user_quiz_result':
                return self.delete_user_quiz_result_complete(data)

            # ===== NEW: Full JSON import actions =====
            elif action == 'create_exam_full':
                return self._create_exam_full(data)
            elif action == 'create_quiz_full':
                return self._create_quiz_full(data)

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

    def get_proctor_domain(self):
        """Get a single working domain for proctor service"""
        domains = SelfStudyExamView().get_proctor_domains()
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

    def fetch_proctors(self):
        """Fetch proctors from proctor service"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_proctor_domain()

            if not domain:
                return JsonResponse({'error': 'No proctor domains available'}, status=503)

            url = f"{domain}/proctors/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}

            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                proctors = response.json()
                return JsonResponse({'success': True, 'proctors': proctors})
            else:
                logger.error(f"Failed to fetch proctors: {response.status_code}")
                return JsonResponse({'error': f'Failed to fetch proctors: {response.status_code}'}, status=response.status_code)

        except Exception as e:
            logger.error(f"Error fetching proctors: {str(e)}")
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

    # FIXED: This method now properly filters questions by exam_id
    def fetch_exam_questions(self, exam_id):
        """Fetch questions for a specific exam - FIXED FILTERING"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()

            if not domain or not exam_id:
                return JsonResponse({'success': True, 'questions': []})

            url = f"{domain}/exam-questions/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}

            # Make request to get ALL questions first
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                all_questions = response.json()

                # Filter questions by exam on the client side
                filtered_questions = []
                for question in all_questions:
                    # Check if question belongs to the specified exam
                    if question.get('exam') == exam_id:
                        filtered_questions.append(question)

                logger.info(f"Fetched {len(filtered_questions)} questions for exam {exam_id}")
                return JsonResponse({'success': True, 'questions': filtered_questions})
            else:
                return JsonResponse({'success': True, 'questions': []})

        except Exception as e:
            logger.error(f"Error fetching exam questions: {str(e)}")
            return JsonResponse({'success': True, 'questions': []})

    # FIXED: This method now properly filters questions by quiz_id
    def fetch_quiz_questions(self, quiz_id):
        """Fetch questions for a specific quiz - FIXED FILTERING"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()

            if not domain or not quiz_id:
                return JsonResponse({'success': True, 'questions': []})

            url = f"{domain}/quiz-questions/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}

            # Make request to get ALL questions first
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                all_questions = response.json()

                # Filter questions by quiz on the client side
                filtered_questions = []
                for question in all_questions:
                    # Check if question belongs to the specified quiz
                    if question.get('quiz') == quiz_id:
                        filtered_questions.append(question)

                logger.info(f"Fetched {len(filtered_questions)} questions for quiz {quiz_id}")
                return JsonResponse({'success': True, 'questions': filtered_questions})
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

    # FIXED: Question operations
    def create_exam_question_direct(self, data):
        """Create a new exam question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()

            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)

            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())

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
        """Update an existing exam question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

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
        """Delete an exam question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

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
        """Create a new quiz question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()

            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)

            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())

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
        """Update an existing quiz question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

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
        """Delete a quiz question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

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

    # FIXED: Answer operations
    def create_exam_answer_fixed(self, data):
        """Create a new exam answer"""
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

            url = f"{domain}/exam-answers/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }

            payload = {
                'external_id': data.get('external_id'),
                'exam_question': question_external_id,
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
        """Update an existing exam answer"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

            question_external_id = data.get('exam_question')
            if not question_external_id:
                return JsonResponse({'error': 'Question external_id is required'}, status=400)

            url = f"{domain}/exam-answers/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }

            payload = {
                'external_id': external_id,
                'exam_question': question_external_id,
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
        """Delete an exam answer"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

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
        """Create a new quiz answer"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()

            if not domain:
                return JsonResponse({'error': 'No domains available'}, status=503)

            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())

            question_external_id = data.get('quiz_question')
            if not question_external_id:
                return JsonResponse({'error': 'Question external_id is required'}, status=400)

            url = f"{domain}/quiz-answers/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }

            payload = {
                'external_id': data.get('external_id'),
                'quiz_question': question_external_id,
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
        """Update an existing quiz answer"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

            question_external_id = data.get('quiz_question')
            if not question_external_id:
                return JsonResponse({'error': 'Question external_id is required'}, status=400)

            url = f"{domain}/quiz-answers/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }

            payload = {
                'external_id': external_id,
                'quiz_question': question_external_id,
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
        """Delete a quiz answer"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

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

    # COMPLETELY FIXED: Sync update operations - USE REGULAR ENDPOINTS
    def update_exam_appointment_complete(self, data):
        """Update an exam appointment - USE REGULAR ENDPOINT FOR SYNC - UPDATED WITH ALL FIELDS"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

            # Use the regular endpoint (NOT sync) - the sync will be handled by the selfstudyexam app
            url = f"{domain}/exam-appointments/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }

            # Prepare complete payload with ALL fields
            payload = {
                'appointment_status': data.get('appointment_status'),
                'appointment_date': data.get('appointment_date'),
                'can_start': data.get('can_start', False),
                'is_entered': data.get('is_entered', False),
                'entered_datetime': data.get('entered_datetime'),
                'proctor_id': data.get('proctor_id', ''),
                'room_url_1': data.get('room_url_1', ''),
                'room_url_2': data.get('room_url_2', ''),
                'exam_time': data.get('exam_time')
            }

            # Remove empty fields
            payload = {k: v for k, v in payload.items() if v is not None and v != ''}

            logger.info(f"Updating exam appointment with payload: {payload}")
            response = requests.patch(url, json=payload, headers=headers, timeout=10)

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

    def delete_exam_appointment_complete(self, data):
        """Delete an exam appointment"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

            url = f"{domain}/exam-appointments/{external_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}

            logger.info(f"Deleting exam appointment with external_id: {external_id}")
            response = requests.delete(url, headers=headers, timeout=10)

            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'Exam appointment deleted successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to delete exam appointment: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to delete exam appointment: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)

        except Exception as e:
            logger.error(f"Error deleting exam appointment: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_user_exam_result_complete(self, data):
        """Update a user exam result - USE REGULAR ENDPOINT FOR SYNC"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

            # Use the regular endpoint (NOT sync) - the sync will be handled by the selfstudyexam app
            url = f"{domain}/user-exam-results/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }

            # Prepare complete payload
            payload = {
                'score': data.get('score'),
                'result_status': data.get('result_status'),
                'result_message': data.get('result_message', '')
            }

            # Remove empty result_message if not provided
            if not payload['result_message']:
                payload.pop('result_message', None)

            logger.info(f"Updating user exam result with payload: {payload}")
            response = requests.patch(url, json=payload, headers=headers, timeout=10)

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

    def delete_user_exam_result_complete(self, data):
        """Delete a user exam result"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

            url = f"{domain}/user-exam-results/{external_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}

            logger.info(f"Deleting user exam result with external_id: {external_id}")
            response = requests.delete(url, headers=headers, timeout=10)

            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'User exam result deleted successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to delete user exam result: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to delete user exam result: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)

        except Exception as e:
            logger.error(f"Error deleting user exam result: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_user_quiz_result_complete(self, data):
        """Update a user quiz result - USE REGULAR ENDPOINT FOR SYNC"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

            # Use the regular endpoint (NOT sync) - the sync will be handled by the selfstudyexam app
            url = f"{domain}/user-quiz-results/{external_id}/"
            headers = {
                'Authorization': f'Token {AUTH_TOKEN}',
                'Content-Type': 'application/json'
            }

            # Prepare complete payload
            payload = {
                'score': data.get('score'),
                'result_status': data.get('result_status'),
                'result_message': data.get('result_message', '')
            }

            # Remove empty result_message if not provided
            if not payload['result_message']:
                payload.pop('result_message', None)

            logger.info(f"Updating user quiz result with payload: {payload}")
            response = requests.patch(url, json=payload, headers=headers, timeout=10)

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

    def delete_user_quiz_result_complete(self, data):
        """Delete a user quiz result"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domain = self.get_single_domain()
            external_id = data.get('external_id')

            if not domain or not external_id:
                return JsonResponse({'error': 'Missing domain or external_id'}, status=400)

            url = f"{domain}/user-quiz-results/{external_id}/"
            headers = {'Authorization': f'Token {AUTH_TOKEN}'}

            logger.info(f"Deleting user quiz result with external_id: {external_id}")
            response = requests.delete(url, headers=headers, timeout=10)

            if response.status_code in [200, 204]:
                return JsonResponse({
                    'success': True,
                    'message': 'User quiz result deleted successfully',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': True}]
                })
            else:
                logger.error(f"Failed to delete user quiz result: {response.status_code} - {response.text}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to delete user quiz result: {response.status_code} - {response.text}',
                    'results': [{'domain': domain, 'status': response.status_code, 'success': False}]
                }, status=500)

        except Exception as e:
            logger.error(f"Error deleting user quiz result: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    # ===== NEW: Full JSON import methods =====
    def _create_exam_full(self, data):
        """Create exam with nested questions and answers."""
        AUTH_TOKEN = os.getenv('AUTH_TOKEN')
        domain = self.get_single_domain()
        if not domain:
            return JsonResponse({'error': 'No working domain available'}, status=503)

        # Check if exam already exists
        exam_ext_id = data.get('external_id')
        if not exam_ext_id:
            return JsonResponse({'error': 'external_id is required'}, status=400)

        check_url = f"{domain}/exams/{exam_ext_id}/"
        headers = {'Authorization': f'Token {AUTH_TOKEN}'}
        try:
            resp = requests.get(check_url, headers=headers, timeout=10)
            if resp.status_code == 200:
                return JsonResponse({'error': f'Exam with external_id {exam_ext_id} already exists'}, status=400)
        except requests.RequestException as e:
            logger.warning(f"Failed to check exam existence: {e}")

        # Prepare exam data (remove nested fields)
        exam_data = {
            'external_id': exam_ext_id,
            'title': data.get('title'),
            'course_id': data.get('course_id'),
            'exam_duration': data.get('exam_duration'),
            'exam_instructions': data.get('exam_instructions', ''),
            'video_instructions_url': data.get('video_instructions_url', '')
        }

        # Create exam
        exam_url = f"{domain}/exams/"
        try:
            resp = requests.post(exam_url, json=exam_data, headers=headers, timeout=10)
            if resp.status_code not in (200, 201):
                logger.error(f"Failed to create exam: {resp.text}")
                return JsonResponse({'error': f'Failed to create exam: {resp.text}'}, status=500)
        except requests.RequestException as e:
            logger.error(f"Error creating exam: {e}")
            return JsonResponse({'error': str(e)}, status=500)

        # Create questions and answers
        questions = data.get('questions', [])
        for q in questions:
            q_data = {
                'external_id': q.get('external_id'),
                'exam': exam_ext_id,
                'text': q.get('text'),
                'score': q.get('score', 1)
            }
            q_url = f"{domain}/exam-questions/"
            try:
                q_resp = requests.post(q_url, json=q_data, headers=headers, timeout=10)
                if q_resp.status_code not in (200, 201):
                    logger.error(f"Failed to create question: {q_resp.text}")
                    # Optionally rollback? For simplicity, continue but log.
            except requests.RequestException as e:
                logger.error(f"Error creating question: {e}")
                continue

            # Create answers for this question
            answers = q.get('answers', [])
            for a in answers:
                a_data = {
                    'external_id': a.get('external_id'),
                    'exam_question': q.get('external_id'),
                    'text': a.get('text'),
                    'is_correct': a.get('is_correct', False)
                }
                a_url = f"{domain}/exam-answers/"
                try:
                    a_resp = requests.post(a_url, json=a_data, headers=headers, timeout=10)
                    if a_resp.status_code not in (200, 201):
                        logger.error(f"Failed to create answer: {a_resp.text}")
                except requests.RequestException as e:
                    logger.error(f"Error creating answer: {e}")

        return JsonResponse({'success': True, 'message': 'Exam created successfully'})

    def _create_quiz_full(self, data):
        """Create quiz with nested questions and answers."""
        AUTH_TOKEN = os.getenv('AUTH_TOKEN')
        domain = self.get_single_domain()
        if not domain:
            return JsonResponse({'error': 'No working domain available'}, status=503)

        quiz_ext_id = data.get('external_id')
        if not quiz_ext_id:
            return JsonResponse({'error': 'external_id is required'}, status=400)

        check_url = f"{domain}/quizzes/{quiz_ext_id}/"
        headers = {'Authorization': f'Token {AUTH_TOKEN}'}
        try:
            resp = requests.get(check_url, headers=headers, timeout=10)
            if resp.status_code == 200:
                return JsonResponse({'error': f'Quiz with external_id {quiz_ext_id} already exists'}, status=400)
        except requests.RequestException as e:
            logger.warning(f"Failed to check quiz existence: {e}")

        quiz_data = {
            'external_id': quiz_ext_id,
            'title': data.get('title'),
            'course_id': data.get('course_id'),
            'lesson_id': data.get('lesson_id'),
            'quiz_duration': data.get('quiz_duration'),
            'description': data.get('description', '')
        }

        quiz_url = f"{domain}/quizzes/"
        try:
            resp = requests.post(quiz_url, json=quiz_data, headers=headers, timeout=10)
            if resp.status_code not in (200, 201):
                logger.error(f"Failed to create quiz: {resp.text}")
                return JsonResponse({'error': f'Failed to create quiz: {resp.text}'}, status=500)
        except requests.RequestException as e:
            logger.error(f"Error creating quiz: {e}")
            return JsonResponse({'error': str(e)}, status=500)

        questions = data.get('questions', [])
        for q in questions:
            q_data = {
                'external_id': q.get('external_id'),
                'quiz': quiz_ext_id,
                'text': q.get('text'),
                'score': q.get('score', 1)
            }
            q_url = f"{domain}/quiz-questions/"
            try:
                q_resp = requests.post(q_url, json=q_data, headers=headers, timeout=10)
                if q_resp.status_code not in (200, 201):
                    logger.error(f"Failed to create question: {q_resp.text}")
            except requests.RequestException as e:
                logger.error(f"Error creating question: {e}")
                continue

            answers = q.get('answers', [])
            for a in answers:
                a_data = {
                    'external_id': a.get('external_id'),
                    'quiz_question': q.get('external_id'),
                    'text': a.get('text'),
                    'is_correct': a.get('is_correct', False)
                }
                a_url = f"{domain}/quiz-answers/"
                try:
                    a_resp = requests.post(a_url, json=a_data, headers=headers, timeout=10)
                    if a_resp.status_code not in (200, 201):
                        logger.error(f"Failed to create answer: {a_resp.text}")
                except requests.RequestException as e:
                    logger.error(f"Error creating answer: {e}")

        return JsonResponse({'success': True, 'message': 'Quiz created successfully'})