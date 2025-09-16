import requests
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.contrib import messages

# Certificate domains
CERTIFICATE_DOMAINS = [
    "http://sfscertificate1.pythonanywhere.com",
    "http://sfscertificate2.pythonanywhere.com"
]

# User profile domains
USER_PROFILE_DOMAINS = [
    "http://selfstudyuserprofile.pythonanywhere.com",
    "http://selfstudyprofileuser2.pythonanywhere.com"
]

# Course domains
COURSE_DOMAINS = [
    "http://selfstudycourse1.pythonanywhere.com",
    "http://selfstudycourse2.pythonanywhere.com"
]

# Exam domains
EXAM_DOMAINS = [
    "http://selfstudyexam1.pythonanywhere.com",
    "http://selfstudyexam2.pythonanywhere.com"
]

def get_healthy_domain(domains):
    for domain in domains:
        try:
            response = requests.get(f"{domain}/metrics", timeout=3)
            if response.status_code == 200:
                return domain
        except requests.RequestException:
            continue
    return None

def certificate_management(request):
    return render(request, 'selfstudycertificate.html')

def get_users_from_all_domains():
    users = []
    for domain in USER_PROFILE_DOMAINS:
        try:
            response = requests.get(f"{domain}/profiles/", timeout=3)
            if response.status_code == 200:
                users.extend(response.json())
        except requests.RequestException:
            continue
    return users

def get_courses(request):
    domain = get_healthy_domain(COURSE_DOMAINS)
    if not domain:
        return JsonResponse({'error': 'No healthy course domains available'}, status=503)
    
    try:
        response = requests.get(f"{domain}/courses/", timeout=3)
        if response.status_code == 200:
            return JsonResponse(response.json(), safe=False)
        return JsonResponse({'error': 'Failed to fetch courses'}, status=response.status_code)
    except requests.RequestException as e:
        return JsonResponse({'error': str(e)}, status=500)

def get_exams(request):
    domain = get_healthy_domain(EXAM_DOMAINS)
    if not domain:
        return JsonResponse({'error': 'No healthy exam domains available'}, status=503)
    
    try:
        response = requests.get(f"{domain}/exams/", timeout=3)
        if response.status_code == 200:
            return JsonResponse(response.json(), safe=False)
        return JsonResponse({'error': 'Failed to fetch exams'}, status=response.status_code)
    except requests.RequestException as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def create_certificate(request):
    if request.method == 'POST':
        certificate_type = request.POST.get('certificate_type')
        user_id = request.POST.get('user_id')
        date = request.POST.get('date')
        message = request.POST.get('message', '')
        
        if certificate_type == 'course':
            course_id = request.POST.get('course_id')
            hours = request.POST.get('hours')
            
            if not all([user_id, course_id, hours, date]):
                messages.error(request, 'Missing required fields for course certificate')
                return redirect('certificate_management')
            
            data = {
                'course_id': course_id,
                'user_id': user_id,
                'hours': hours,
                'date': date,
                'message': message
            }
            
            endpoint = 'course-certificates'
            
        elif certificate_type == 'exam':
            exam_id = request.POST.get('exam_id')
            taken_date = request.POST.get('taken_date')
            expire_date = request.POST.get('expire_date')
            
            if not all([user_id, exam_id, taken_date, expire_date]):
                messages.error(request, 'Missing required fields for exam certificate')
                return redirect('certificate_management')
            
            data = {
                'exam_id': exam_id,
                'user_id': user_id,
                'taken_date': taken_date,
                'expire_date': expire_date,
                'message': message
            }
            
            endpoint = 'exam-certificates'
            
        else:
            messages.error(request, 'Invalid certificate type')
            return redirect('certificate_management')
        
        # Create certificate on all domains
        success_domains = []
        failed_domains = []
        
        for domain in CERTIFICATE_DOMAINS:
            try:
                response = requests.post(
                    f"{domain}/{endpoint}/",
                    data=data,
                    timeout=5
                )
                if response.status_code in [200, 201]:
                    success_domains.append(domain)
                else:
                    failed_domains.append(domain)
            except requests.RequestException:
                failed_domains.append(domain)
        
        if success_domains:
            messages.success(request, f'Certificate created successfully on {len(success_domains)} domains')
        if failed_domains:
            messages.warning(request, f'Failed to create certificate on {len(failed_domains)} domains')
        
        return redirect('certificate_management')
    
    return redirect('certificate_management')

def get_certificate_details(request, certificate_id):
    domain = get_healthy_domain(CERTIFICATE_DOMAINS)
    if not domain:
        return JsonResponse({'error': 'No healthy certificate domains available'}, status=503)
    
    # Try course certificates first
    try:
        response = requests.get(f"{domain}/course-certificates/?certificate_id={certificate_id}", timeout=3)
        if response.status_code == 200 and response.json():
            return JsonResponse({'type': 'course', 'data': response.json()[0]})
    except requests.RequestException:
        pass
    
    # If not found in course certificates, try exam certificates
    try:
        response = requests.get(f"{domain}/exam-certificates/?certificate_id={certificate_id}", timeout=3)
        if response.status_code == 200 and response.json():
            return JsonResponse({'type': 'exam', 'data': response.json()[0]})
    except requests.RequestException:
        pass
    
    return JsonResponse({'error': 'Certificate not found'}, status=404)

@csrf_exempt
def update_certificate(request, certificate_id):
    if request.method == 'POST':
        certificate_type = request.POST.get('certificate_type')
        date = request.POST.get('date')
        message = request.POST.get('message', '')
        
        if certificate_type == 'course':
            hours = request.POST.get('hours')
            
            if not all([hours, date]):
                messages.error(request, 'Missing required fields for course certificate')
                return redirect('certificate_management')
            
            data = {
                'hours': hours,
                'date': date,
                'message': message
            }
            
            endpoint = 'course-certificates'
            
        elif certificate_type == 'exam':
            taken_date = request.POST.get('taken_date')
            expire_date = request.POST.get('expire_date')
            
            if not all([taken_date, expire_date]):
                messages.error(request, 'Missing required fields for exam certificate')
                return redirect('certificate_management')
            
            data = {
                'taken_date': taken_date,
                'expire_date': expire_date,
                'message': message
            }
            
            endpoint = 'exam-certificates'
            
        else:
            messages.error(request, 'Invalid certificate type')
            return redirect('certificate_management')
        
        # Update certificate on all domains
        success_domains = []
        failed_domains = []
        
        for domain in CERTIFICATE_DOMAINS:
            try:
                response = requests.patch(
                    f"{domain}/{endpoint}/{certificate_id}/",
                    data=data,
                    timeout=5
                )
                if response.status_code in [200, 204]:
                    success_domains.append(domain)
                else:
                    failed_domains.append(domain)
            except requests.RequestException:
                failed_domains.append(domain)
        
        if success_domains:
            messages.success(request, f'Certificate updated successfully on {len(success_domains)} domains')
        if failed_domains:
            messages.warning(request, f'Failed to update certificate on {len(failed_domains)} domains')
        
        return redirect('certificate_management')
    
    return redirect('certificate_management')

@csrf_exempt
def delete_certificate(request, certificate_id):
    if request.method == 'POST':
        # First determine the type of certificate
        details = get_certificate_details(request, certificate_id)
        if details.status_code != 200:
            messages.error(request, 'Certificate not found')
            return redirect('certificate_management')
        
        data = details.json()
        endpoint = 'course-certificates' if data['type'] == 'course' else 'exam-certificates'
        
        # Delete certificate from all domains
        success_domains = []
        failed_domains = []
        
        for domain in CERTIFICATE_DOMAINS:
            try:
                response = requests.delete(
                    f"{domain}/{endpoint}/{certificate_id}/",
                    timeout=5
                )
                if response.status_code in [200, 204]:
                    success_domains.append(domain)
                else:
                    failed_domains.append(domain)
            except requests.RequestException:
                failed_domains.append(domain)
        
        if success_domains:
            messages.success(request, f'Certificate deleted successfully from {len(success_domains)} domains')
        if failed_domains:
            messages.warning(request, f'Failed to delete certificate from {len(failed_domains)} domains')
        
        return redirect('certificate_management')
    
    return redirect('certificate_management')

def get_users_for_certificates(request):
    """Get all users from all user profile domains for certificate management"""
    users = []
    for domain in USER_PROFILE_DOMAINS:
        try:
            response = requests.get(f"{domain}/profiles/", timeout=3)
            if response.status_code == 200:
                user_data = response.json()
                # Ensure we have results key if using DRF pagination
                if isinstance(user_data, dict) and 'results' in user_data:
                    user_data = user_data['results']
                users.extend(user_data)
        except requests.RequestException as e:
            print(f"Error fetching users from {domain}: {str(e)}")
            continue
    
    # Transform the data to include both user_id and a display name
    formatted_users = []
    for user in users:
        formatted_users.append({
            'user_id': str(user.get('user_id', '')),
            'username': user.get('username', ''),
            'email': user.get('email', ''),
            'display_name': f"{user.get('username', '')} ({user.get('email', '')})"
        })
    
    return JsonResponse(formatted_users, safe=False)