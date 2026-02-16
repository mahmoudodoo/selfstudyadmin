import os
from django.apps import AppConfig
from django.core.management import call_command
from django.db.utils import OperationalError, ProgrammingError
from django.contrib.auth import get_user_model

class MainConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'main'

    def ready(self):
        """
        Runs once when Django starts. Performs migrations and creates a default
        superuser if it doesn't exist.
        """
        # Avoid running in management commands (like migrate itself) to prevent recursion
        if os.environ.get('RUN_MAIN') == 'true' or 'werkzeug' in os.environ.get('SERVER_SOFTWARE', ''):
            # Development server double-run protection
            return

        # Use a flag file to ensure setup runs only once (prevents repeated runs on every worker start)
        flag_file = '/tmp/django_setup_complete'
        if os.path.exists(flag_file):
            return

        try:
            # Run migrations
            call_command('migrate', interactive=False)

            # Create default superuser if it doesn't exist
            User = get_user_model()
            if not User.objects.filter(username='admin').exists():
                # In production, read password from environment variable!
                admin_password = os.environ.get('ADMIN_PASSWORD', '201211212admin')
                User.objects.create_superuser(
                    username='admin',
                    email='admin@abc.com',
                    password=admin_password
                )
                print("Default superuser 'admin' created.")

            # Mark setup as complete
            with open(flag_file, 'w') as f:
                f.write('done')
        except (OperationalError, ProgrammingError) as e:
            # Database might not be ready yet; log and continue
            print(f"Initial setup failed: {e}")
        except Exception as e:
            print(f"Unexpected error during setup: {e}")