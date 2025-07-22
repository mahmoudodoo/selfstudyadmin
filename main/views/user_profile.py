import requests
from django.shortcuts import render, redirect
from django.contrib import messages
from django.conf import settings
from django.http import JsonResponse

USER_PROFILE_DOMAINS = [
    "https://selfstudyuserprofile.pythonanywhere.com",
    "https://selfstudyprofileuser2.pythonanywhere.com"
]

def get_healthy_domain():
    """Check which domain is healthy by hitting /metrics endpoint"""
    for domain in USER_PROFILE_DOMAINS:
        try:
            response = requests.get(f"{domain}/metrics", timeout=3)
            if response.status_code == 200:
                return domain
        except requests.RequestException:
            continue
    return None

def fetch_all_users():
    """Fetch users from all domains and combine them"""
    all_users = []
    
    for domain in USER_PROFILE_DOMAINS:
        try:
            response = requests.get(f"{domain}/profiles/", timeout=3)
            if response.status_code == 200:
                users = response.json()
                for user in users:
                    user['domain'] = domain  # Add domain info to each user
                all_users.extend(users)
        except requests.RequestException:
            continue
    
    return all_users

def user_profiles(request):
    users = fetch_all_users()
    
    # Transform to match our template structure
    transformed_users = []
    for user in users:
        transformed_users.append({
            'id': user['user_id'],
            'name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user['username'],
            'email': user['email'],
            'role': 'User',  # Default role, can be extended
            'status': 'active' if user.get('is_email_verified', False) else 'inactive',
            'last_login': 'Recently',  # This field isn't in your model, using placeholder
            'avatar': user.get('image_url', 'https://ui-avatars.com/api/?name=' + user['username'] + '&background=random'),
            'domain': user.get('domain', '')
        })
    
    return render(request, 'userprofiles.html', {
        'users': transformed_users,
        'title': 'User Profiles',
        'domains': USER_PROFILE_DOMAINS
    })

def create_user(request):
    if request.method == 'POST':
        domain = get_healthy_domain()
        if not domain:
            messages.error(request, "No healthy user profile domains available")
            return redirect('user_profiles')
        
        data = {
            'user_id': request.POST.get('user_id'),
            'username': request.POST.get('username'),
            'email': request.POST.get('email'),
            'password': request.POST.get('password'),
            'first_name': request.POST.get('first_name'),
            'last_name': request.POST.get('last_name'),
            'gender': request.POST.get('gender'),
            'image_url': request.POST.get('image_url', ''),
            'lab_url': request.POST.get('lab_url', ''),
            'notification_url': request.POST.get('notification_url', '')
        }
        
        try:
            response = requests.post(f"{domain}/profiles/", json=data)
            if response.status_code == 201:
                messages.success(request, "User created successfully")
            else:
                messages.error(request, f"Error creating user: {response.text}")
        except requests.RequestException as e:
            messages.error(request, f"Error connecting to user service: {str(e)}")
        
        return redirect('user_profiles')
    
    return JsonResponse({'error': 'Invalid request method'}, status=400)

def update_user(request, user_id):
    if request.method == 'POST':
        domain = request.POST.get('domain')
        if not domain:
            messages.error(request, "Domain information missing")
            return redirect('user_profiles')
        
        data = {
            'username': request.POST.get('username'),
            'email': request.POST.get('email'),
            'first_name': request.POST.get('first_name'),
            'last_name': request.POST.get('last_name'),
            'gender': request.POST.get('gender'),
            'image_url': request.POST.get('image_url', ''),
            'lab_url': request.POST.get('lab_url', ''),
            'notification_url': request.POST.get('notification_url', ''),
            'is_email_verified': request.POST.get('is_email_verified', 'false') == 'true'
        }
        
        # Remove empty fields to avoid overwriting with empty values
        data = {k: v for k, v in data.items() if v is not None and v != ''}
        
        try:
            response = requests.patch(f"{domain}/profiles/{user_id}/", json=data)
            if response.status_code == 200:
                messages.success(request, "User updated successfully")
            else:
                messages.error(request, f"Error updating user: {response.text}")
        except requests.RequestException as e:
            messages.error(request, f"Error connecting to user service: {str(e)}")
        
        return redirect('user_profiles')
    
    return JsonResponse({'error': 'Invalid request method'}, status=400)

def delete_user(request, user_id):
    if request.method == 'POST':
        domain = request.POST.get('domain')
        if not domain:
            messages.error(request, "Domain information missing")
            return redirect('user_profiles')
        
        try:
            response = requests.delete(f"{domain}/profiles/{user_id}/")
            if response.status_code == 204:
                messages.success(request, "User deleted successfully")
            else:
                messages.error(request, f"Error deleting user: {response.text}")
        except requests.RequestException as e:
            messages.error(request, f"Error connecting to user service: {str(e)}")
        
        return redirect('user_profiles')
    
    return JsonResponse({'error': 'Invalid request method'}, status=400)

def get_user_details(request):
    if request.method == 'GET':
        user_id = request.GET.get('user_id')
        domain = request.GET.get('domain')
        
        # Add proper validation
        if not user_id or str(user_id).lower() == 'none' or not domain:
            return JsonResponse({'error': 'Invalid parameters'}, status=400)
        
        try:
            # Ensure domain ends with slash
            domain = domain.rstrip('/') + '/'
            response = requests.get(f"{domain}profiles/{user_id}/", timeout=5)
            
            if response.status_code == 200:
                return JsonResponse(response.json())
            return JsonResponse({'error': 'User not found'}, status=404)
            
        except requests.RequestException as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Invalid request method'}, status=400)