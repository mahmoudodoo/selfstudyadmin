import os
import random
import requests
import sys
from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.contrib.auth.models import User
from django.contrib import messages
from django.db import IntegrityError
from django.core.paginator import Paginator
from django.http import JsonResponse

AUTH_TOKEN = os.getenv('AUTH_TOKEN', '')
DOMAINS_REGISTRY = [
    'https://sfsdomains1.pythonanywhere.com',
    'https://sfsdomains2.pythonanywhere.com'
]

# Optional: print to console for debugging (remove in production)
def debug_print(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

@method_decorator(login_required, name='dispatch')
class AdminDashboardView(View):
    def get(self, request):
        return render(request, 'admin_dashboard.html')

@method_decorator(login_required, name='dispatch')
class SelfStudyAdminView(View):
    def get(self, request):
        users = User.objects.all().order_by('-date_joined')
        paginator = Paginator(users, 10)
        page_number = request.GET.get('page')
        page_obj = paginator.get_page(page_number)
        context = {
            'users': users,
            'page_obj': page_obj,
        }
        return render(request, 'selfstudyadmin.html', context)

@method_decorator(login_required, name='dispatch')
class UserCreateView(View):
    def get(self, request):
        return render(request, 'user_form.html', {'form_type': 'create'})

    def post(self, request):
        try:
            username = request.POST.get('username')
            email = request.POST.get('email')
            first_name = request.POST.get('first_name')
            last_name = request.POST.get('last_name')
            password = request.POST.get('password')
            is_staff = 'is_staff' in request.POST
            is_superuser = 'is_superuser' in request.POST

            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_staff=is_staff,
                is_superuser=is_superuser
            )
            messages.success(request, f'User {username} created successfully!')
            return redirect('admin_dashboard')

        except IntegrityError:
            messages.error(request, 'Username already exists!')
            return render(request, 'user_form.html', {'form_type': 'create', 'form_data': request.POST})
        except Exception as e:
            messages.error(request, f'Error creating user: {str(e)}')
            return render(request, 'user_form.html', {'form_type': 'create', 'form_data': request.POST})

@method_decorator(login_required, name='dispatch')
class UserUpdateView(View):
    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        return render(request, 'user_form.html', {'form_type': 'update', 'user': user})

    def post(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        try:
            user.username = request.POST.get('username')
            user.email = request.POST.get('email')
            user.first_name = request.POST.get('first_name')
            user.last_name = request.POST.get('last_name')
            user.is_staff = 'is_staff' in request.POST
            user.is_superuser = 'is_superuser' in request.POST

            password = request.POST.get('password')
            if password:
                user.set_password(password)

            user.save()
            messages.success(request, f'User {user.username} updated successfully!')
            return redirect('admin_dashboard')

        except IntegrityError:
            messages.error(request, 'Username already exists!')
            return render(request, 'user_form.html', {'form_type': 'update', 'user': user})
        except Exception as e:
            messages.error(request, f'Error updating user: {str(e)}')
            return render(request, 'user_form.html', {'form_type': 'update', 'user': user})

@method_decorator(login_required, name='dispatch')
class UserDeleteView(View):
    def post(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        username = user.username
        user.delete()
        messages.success(request, f'User {username} deleted successfully!')
        return redirect('admin_dashboard')

# ================= NEW DASHBOARD API VIEWS =================
@method_decorator(login_required, name='dispatch')
class DashboardAppsAPIView(View):
    """
    Returns the list of all apps (with their replicas) from a random working domain.
    Includes detailed error logging.
    """
    def get(self, request):
        # Check token presence
        if not AUTH_TOKEN:
            debug_print("ERROR: AUTH_TOKEN environment variable not set!")
            return JsonResponse(
                {'error': 'AUTH_TOKEN not configured on server'},
                status=500
            )

        # Shuffle domains for load distribution
        domains = DOMAINS_REGISTRY[:]
        random.shuffle(domains)

        headers = {'Authorization': f'Token {AUTH_TOKEN}'}
        last_error = None

        for domain in domains:
            try:
                url = f"{domain}/apps/"
                debug_print(f"Trying domain: {url}")
                resp = requests.get(url, headers=headers, timeout=10)

                if resp.status_code == 200:
                    debug_print(f"Success from {domain}")
                    return JsonResponse(resp.json(), safe=False)
                else:
                    debug_print(f"Failed from {domain}: HTTP {resp.status_code} - {resp.text}")
                    last_error = f"{domain} returned {resp.status_code}"
            except requests.exceptions.Timeout:
                debug_print(f"Timeout from {domain}")
                last_error = f"{domain} timeout"
            except requests.exceptions.ConnectionError as e:
                debug_print(f"Connection error from {domain}: {str(e)}")
                last_error = f"{domain} connection error"
            except requests.exceptions.RequestException as e:
                debug_print(f"Request exception from {domain}: {str(e)}")
                last_error = f"{domain} request exception: {str(e)}"

        # If we reach here, all domains failed
        return JsonResponse(
            {'error': 'No domain available', 'details': last_error},
            status=503
        )

@method_decorator(login_required, name='dispatch')
class ReplicaMetricsAPIView(View):
    """
    Proxies a request to a replica's /metrics/ endpoint.
    Expects ?url=<replica_url> query parameter.
    """
    def get(self, request):
        replica_url = request.GET.get('url')
        if not replica_url:
            return JsonResponse({'error': 'Missing url parameter'}, status=400)

        if not AUTH_TOKEN:
            return JsonResponse({'error': 'AUTH_TOKEN not configured'}, status=500)

        metrics_url = replica_url.rstrip('/') + '/metrics/'
        headers = {'Authorization': f'Token {AUTH_TOKEN}'}
        try:
            resp = requests.get(metrics_url, headers=headers, timeout=10)
            if resp.status_code == 200:
                return JsonResponse(resp.json())
            else:
                return JsonResponse(
                    {'error': f'Replica returned {resp.status_code}'},
                    status=resp.status_code
                )
        except requests.exceptions.RequestException as e:
            return JsonResponse({'error': str(e)}, status=503)