import os
from django.shortcuts import render, redirect
from django.views import View
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.forms import AuthenticationForm
from django.contrib import messages
from django.core.management import call_command
from django.contrib.auth import get_user_model

class CustomLoginView(View):
    """
    Login view that also runs initial setup (migrations and superuser creation)
    on first access.
    """

    def get(self, request):
        # Path to a temporary flag file that indicates setup is complete
        setup_flag = '/tmp/django_setup_done'

        # If the flag file does not exist, run initial setup
        if not os.path.exists(setup_flag):
            try:
                # Run all pending migrations
                call_command('migrate', interactive=False)

                # Create default superuser if it doesn't exist
                User = get_user_model()
                if not User.objects.filter(username='admin').exists():
                    # IMPORTANT: Hardcoded password is insecure.
                    # For production, use environment variable:
                    # admin_password = os.environ.get('ADMIN_PASSWORD', 'fallback')
                    User.objects.create_superuser(
                        username='admin',
                        email='admin@abc.com',
                        password='201211212admin'   # CHANGE THIS!
                    )
                    messages.success(request, 'Default superuser created.')

                # Create flag file to mark setup as done
                with open(setup_flag, 'w') as f:
                    f.write('done')

                messages.success(request, 'Database initialized successfully.')

            except Exception as e:
                # If setup fails, show an error but still allow login attempt
                messages.error(request, f'Initial setup failed: {e}')

        # If user is already authenticated, redirect to dashboard
        if request.user.is_authenticated:
            return redirect('admin_dashboard')

        # Display empty login form
        form = AuthenticationForm()
        return render(request, 'login.html', {'form': form})

    def post(self, request):
        """
        Handle login form submission.
        """
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
    """
    Logout view that displays a success message and redirects to login page.
    """
    def get(self, request):
        logout(request)
        messages.success(request, 'You have been successfully logged out.')
        return redirect('login')