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
            
            # Randomly select a domain for load balancing
            selected_domain = random.choice(domains)
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
            
            # Randomly select a domain for load balancing
            selected_domain = random.choice(domains)
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

@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(login_required, name='dispatch')
class SelfStudyExamAPIView(View):
    """API endpoints for exam CRUD operations"""
    
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
            else:
                return JsonResponse({'error': 'Invalid action'}, status=400)
                
        except Exception as e:
            logger.error(f"Error in GET API: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def post(self, request, *args, **kwargs):
        """Create or update exam/quiz data"""
        try:
            data = json.loads(request.body)
            action = data.get('action')
            
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
            elif action == 'create_exam_question':
                return self.create_exam_question(data)
            elif action == 'update_exam_question':
                return self.update_exam_question(data)
            elif action == 'delete_exam_question':
                return self.delete_exam_question(data)
            elif action == 'create_quiz_question':
                return self.create_quiz_question(data)
            elif action == 'update_quiz_question':
                return self.update_quiz_question(data)
            elif action == 'delete_quiz_question':
                return self.delete_quiz_question(data)
            elif action == 'create_exam_answer':
                return self.create_exam_answer(data)
            elif action == 'update_exam_answer':
                return self.update_exam_answer(data)
            elif action == 'delete_exam_answer':
                return self.delete_exam_answer(data)
            elif action == 'create_quiz_answer':
                return self.create_quiz_answer(data)
            elif action == 'update_quiz_answer':
                return self.update_quiz_answer(data)
            elif action == 'delete_quiz_answer':
                return self.delete_quiz_answer(data)
            else:
                return JsonResponse({'error': 'Invalid action'}, status=400)
                
        except Exception as e:
            logger.error(f"Error in POST API: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def fetch_exams(self):
        """Fetch exams from dynamic domains"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Try domains in random order for load balancing
            random.shuffle(domains)
            
            for domain in domains:
                try:
                    url = f"{domain}/exams/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.get(url, headers=headers, timeout=10)
                    if response.status_code == 200:
                        exams = response.json()
                        return JsonResponse({'success': True, 'exams': exams})
                except requests.RequestException as e:
                    logger.warning(f"Domain {domain} failed: {str(e)}")
                    continue
            
            return JsonResponse({'error': 'All domains failed'}, status=503)
            
        except Exception as e:
            logger.error(f"Error fetching exams: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def fetch_quizzes(self):
        """Fetch quizzes from dynamic domains"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            random.shuffle(domains)
            
            for domain in domains:
                try:
                    url = f"{domain}/quizzes/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.get(url, headers=headers, timeout=10)
                    if response.status_code == 200:
                        quizzes = response.json()
                        return JsonResponse({'success': True, 'quizzes': quizzes})
                except requests.RequestException as e:
                    logger.warning(f"Domain {domain} failed: {str(e)}")
                    continue
            
            return JsonResponse({'error': 'All domains failed'}, status=503)
            
        except Exception as e:
            logger.error(f"Error fetching quizzes: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def fetch_lessons(self, course_id):
        """Fetch lessons for a specific course"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_course_domains()
            
            if not domains or not course_id:
                return JsonResponse({'success': True, 'lessons': []})
            
            random.shuffle(domains)
            
            for domain in domains:
                try:
                    url = f"{domain}/lessons/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    params = {'course_id': course_id}
                    
                    response = requests.get(url, headers=headers, params=params, timeout=10)
                    if response.status_code == 200:
                        lessons = response.json()
                        return JsonResponse({'success': True, 'lessons': lessons})
                except requests.RequestException:
                    continue
            
            return JsonResponse({'success': True, 'lessons': []})
            
        except Exception as e:
            logger.error(f"Error fetching lessons: {str(e)}")
            return JsonResponse({'success': True, 'lessons': []})

    def fetch_exam_questions(self, exam_id):
        """Fetch questions for a specific exam"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains or not exam_id:
                return JsonResponse({'success': True, 'questions': []})
            
            random.shuffle(domains)
            
            for domain in domains:
                try:
                    url = f"{domain}/exam-questions/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    params = {'exam': exam_id}
                    
                    response = requests.get(url, headers=headers, params=params, timeout=10)
                    if response.status_code == 200:
                        questions = response.json()
                        return JsonResponse({'success': True, 'questions': questions})
                except requests.RequestException:
                    continue
            
            return JsonResponse({'success': True, 'questions': []})
            
        except Exception as e:
            logger.error(f"Error fetching exam questions: {str(e)}")
            return JsonResponse({'success': True, 'questions': []})

    def fetch_quiz_questions(self, quiz_id):
        """Fetch questions for a specific quiz"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains or not quiz_id:
                return JsonResponse({'success': True, 'questions': []})
            
            random.shuffle(domains)
            
            for domain in domains:
                try:
                    url = f"{domain}/quiz-questions/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    params = {'quiz': quiz_id}
                    
                    response = requests.get(url, headers=headers, params=params, timeout=10)
                    if response.status_code == 200:
                        questions = response.json()
                        return JsonResponse({'success': True, 'questions': questions})
                except requests.RequestException:
                    continue
            
            return JsonResponse({'success': True, 'questions': []})
            
        except Exception as e:
            logger.error(f"Error fetching quiz questions: {str(e)}")
            return JsonResponse({'success': True, 'questions': []})

    def fetch_exam_question_details(self, question_id):
        """Fetch detailed information for a specific exam question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains or not question_id:
                return JsonResponse({'error': 'Missing domains or question_id'}, status=400)
            
            random.shuffle(domains)
            
            for domain in domains:
                try:
                    url = f"{domain}/exam-questions/{question_id}/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.get(url, headers=headers, timeout=10)
                    if response.status_code == 200:
                        question_data = response.json()
                        return JsonResponse({'success': True, 'question': question_data})
                except requests.RequestException:
                    continue
            
            return JsonResponse({'error': 'Failed to fetch question details'}, status=404)
            
        except Exception as e:
            logger.error(f"Error fetching exam question details: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def fetch_quiz_question_details(self, question_id):
        """Fetch detailed information for a specific quiz question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains or not question_id:
                return JsonResponse({'error': 'Missing domains or question_id'}, status=400)
            
            random.shuffle(domains)
            
            for domain in domains:
                try:
                    url = f"{domain}/quiz-questions/{question_id}/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.get(url, headers=headers, timeout=10)
                    if response.status_code == 200:
                        question_data = response.json()
                        return JsonResponse({'success': True, 'question': question_data})
                except requests.RequestException:
                    continue
            
            return JsonResponse({'error': 'Failed to fetch question details'}, status=404)
            
        except Exception as e:
            logger.error(f"Error fetching quiz question details: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def create_exam(self, data):
        """Create a new exam"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/exams/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.post(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Exam created on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to create exam on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating exam: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_exam(self, data):
        """Update an existing exam"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/exams/{external_id}/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.put(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Exam updated on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to update exam on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating exam: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_exam(self, data):
        """Delete an exam"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/exams/{external_id}/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.delete(url, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 204]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Exam deleted on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to delete exam on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting exam: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def create_quiz(self, data):
        """Create a new quiz"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/quizzes/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.post(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Quiz created on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to create quiz on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating quiz: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_quiz(self, data):
        """Update an existing quiz"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/quizzes/{external_id}/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.put(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Quiz updated on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to update quiz on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating quiz: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_quiz(self, data):
        """Delete a quiz"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/quizzes/{external_id}/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.delete(url, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 204]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Quiz deleted on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to delete quiz on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting quiz: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def create_exam_question(self, data):
        """Create a new exam question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/exam-questions/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.post(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Exam question created on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to create exam question on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating exam question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_exam_question(self, data):
        """Update an existing exam question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/exam-questions/{external_id}/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.put(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Exam question updated on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to update exam question on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating exam question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_exam_question(self, data):
        """Delete an exam question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/exam-questions/{external_id}/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.delete(url, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 204]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Exam question deleted on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to delete exam question on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting exam question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def create_quiz_question(self, data):
        """Create a new quiz question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/quiz-questions/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.post(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Quiz question created on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to create quiz question on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating quiz question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_quiz_question(self, data):
        """Update an existing quiz question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/quiz-questions/{external_id}/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.put(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Quiz question updated on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to update quiz question on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating quiz question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_quiz_question(self, data):
        """Delete a quiz question"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/quiz-questions/{external_id}/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.delete(url, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 204]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Quiz question deleted on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to delete quiz question on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting quiz question: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def create_exam_answer(self, data):
        """Create a new exam answer"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/exam-answers/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.post(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Exam answer created on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to create exam answer on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating exam answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_exam_answer(self, data):
        """Update an existing exam answer"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/exam-answers/{external_id}/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.put(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Exam answer updated on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to update exam answer on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating exam answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_exam_answer(self, data):
        """Delete an exam answer"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/exam-answers/{external_id}/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.delete(url, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 204]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Exam answer deleted on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to delete exam answer on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting exam answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def create_quiz_answer(self, data):
        """Create a new quiz answer"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            
            if not domains:
                return JsonResponse({'error': 'No domains available'}, status=503)
            
            # Generate external_id if not provided
            if not data.get('external_id'):
                data['external_id'] = str(uuid.uuid4())
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/quiz-answers/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.post(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Quiz answer created on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to create quiz answer on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error creating quiz answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def update_quiz_answer(self, data):
        """Update an existing quiz answer"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/quiz-answers/{external_id}/"
                    headers = {
                        'Authorization': f'Token {AUTH_TOKEN}',
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.put(url, json=data, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 201]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Quiz answer updated on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to update quiz answer on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error updating quiz answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)

    def delete_quiz_answer(self, data):
        """Delete a quiz answer"""
        try:
            AUTH_TOKEN = os.getenv('AUTH_TOKEN')
            domains = SelfStudyExamView().get_dynamic_domains()
            external_id = data.get('external_id')
            
            if not domains or not external_id:
                return JsonResponse({'error': 'Missing domains or external_id'}, status=400)
            
            results = []
            for domain in domains:
                try:
                    url = f"{domain}/quiz-answers/{external_id}/"
                    headers = {'Authorization': f'Token {AUTH_TOKEN}'}
                    
                    response = requests.delete(url, headers=headers, timeout=10)
                    results.append({
                        'domain': domain,
                        'status': response.status_code,
                        'success': response.status_code in [200, 204]
                    })
                    
                except requests.RequestException as e:
                    results.append({
                        'domain': domain,
                        'status': 'error',
                        'success': False,
                        'error': str(e)
                    })
            
            successful_ops = [r for r in results if r['success']]
            if successful_ops:
                return JsonResponse({
                    'success': True,
                    'message': f'Quiz answer deleted on {len(successful_ops)} domains',
                    'results': results
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to delete quiz answer on all domains',
                    'results': results
                }, status=500)
                
        except Exception as e:
            logger.error(f"Error deleting quiz answer: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)