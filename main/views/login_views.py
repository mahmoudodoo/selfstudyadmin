from django.shortcuts import render, redirect
from django.views import View
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.forms import AuthenticationForm
from django.contrib import messages

class CustomLoginView(View):
    def get(self, request):
        if request.user.is_authenticated:
            return redirect('admin_dashboard')
        form = AuthenticationForm()
        return render(request, 'login.html', {'form': form})
    
    def post(self, request):
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                login(request, user)
                messages.success(request, f'Welcome back, {username}!')
                next_url = request.GET.get('next', 'admin_dashboard')
                return redirect(next_url)
            else:
                messages.error(request, 'Invalid username or password.')
        else:
            messages.error(request, 'Invalid username or password.')
        return render(request, 'login.html', {'form': form})

class CustomLogoutView(View):
    def get(self, request):
        logout(request)
        messages.success(request, 'You have been successfully logged out.')
        return redirect('login')