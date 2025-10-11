from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.contrib.auth.models import User
from django.contrib import messages
from django.db import IntegrityError
from django.core.paginator import Paginator


@method_decorator(login_required, name='dispatch')
class AdminDashboardView(View):
    def get(self, request):
        return render(request, 'admin_dashboard.html')

@method_decorator(login_required, name='dispatch')
class SelfStudyAdminView(View):
    def get(self, request):
        users = User.objects.all().order_by('-date_joined')
        
        # Pagination
        paginator = Paginator(users, 10)  # Show 10 users per page
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
    

