#!/usr/bin/env python
"""
Enhanced Professional Django Project Setup Script with python-decouple - Final Clean Version
"""

import os
import sys
import subprocess
import argparse
import secrets
import string
from pathlib import Path
import platform

def print_header(message):
    """Print formatted header message with consistent styling"""
    header = f" {message.upper()} "
    print("\n" + "=" * len(header))
    print(header)
    print("=" * len(header) + "\n")

def run_command(command, cwd=None, env=None, shell=None):
    """Run a shell command with comprehensive error handling"""
    if shell is None:
        shell = (platform.system() == "Windows")

    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            env=env or os.environ,
            shell=shell,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            universal_newlines=True
        )
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error running command: {e.cmd}")
        if e.stderr:
            print(f"Error details:\n{e.stderr}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        return False

def create_venv(venv_name="venv"):
    """Create a Python virtual environment"""
    print_header("Creating Virtual Environment")
    venv_path = Path(venv_name).absolute()

    if venv_path.exists():
        print(f"✔ Virtual environment '{venv_name}' already exists")
        return True

    print(f"Creating virtual environment at: {venv_path}")
    return run_command([sys.executable, "-m", "venv", str(venv_path)])

def get_venv_bin_path(venv_name="venv"):
    """Get the correct bin/Scripts path for the virtual environment"""
    venv_path = Path(venv_name).absolute()
    if platform.system() == "Windows":
        return venv_path / "Scripts"
    return venv_path / "bin"

def get_venv_executable(venv_name="venv", executable="python"):
    """Get path to an executable in the virtual environment"""
    bin_path = get_venv_bin_path(venv_name)
    if platform.system() == "Windows":
        executable += ".exe"
    return str(bin_path / executable)

def create_requirements_file():
    """Create requirements.txt with specified packages"""
    print_header("Creating Requirements File")
    requirements = [
        "django",
        "django-simpleui",
        "Pillow",
        "djangorestframework",
        "django-filter",
        "requests",
        "whitenoise",
        "django-cors-headers",
        "pandas",
        "django-import-export",
        "python-decouple"
    ]

    with open("requirements.txt", "w") as f:
        f.write("\n".join(requirements) + "\n")

    print("✔ requirements.txt created with packages:")
    print(", ".join(requirements))
    return True

def install_requirements(venv_name="venv"):
    """Install packages from requirements.txt in virtual environment"""
    print_header("Installing Requirements")
    pip_executable = get_venv_executable(venv_name, "pip")

    # Upgrade pip first
    if not run_command([pip_executable, "install", "--upgrade", "pip"]):
        return False

    return run_command([pip_executable, "install", "-r", "requirements.txt"])

def create_django_project(project_name, apps, venv_name="venv"):
    """Create Django project and specified apps in current directory"""
    print_header("Creating Django Project")
    python_executable = get_venv_executable(venv_name)

    # Create project in current directory using dot notation
    if not run_command([python_executable, "-m", "django", "startproject", project_name, "."]):
        return False

    # Create apps
    for app in apps:
        print(f"Creating app: {app}")
        if not run_command([python_executable, "manage.py", "startapp", app]):
            return False

        # Create urls.py for each app
        app_urls = Path(app) / "urls.py"
        with open(app_urls, "w") as f:
            f.write("from django.urls import path\n\n")
            f.write("urlpatterns = [\n    # Add your app URLs here\n]\n")

        # Create app directories (templates and static)
        (Path(app) / "templates" / app).mkdir(parents=True, exist_ok=True)
        (Path(app) / "static" / app).mkdir(parents=True, exist_ok=True)
        print(f"Created directories for app: {app}")

    return True

def create_project_structure(project_name, apps):
    """Create standard project directory structure"""
    print_header("Creating Project Structure")

    # Root directories
    dirs = [
        "static/css",
        "static/imgs",
        "static/js",
        "media",
        "templates",
    ]

    for dir_path in dirs:
        full_path = Path(dir_path)
        full_path.mkdir(parents=True, exist_ok=True)
        print(f"Created: {full_path}")

    # Create empty files to maintain directory structure in git
    for dir_path in ["static/css", "static/js"]:
        (Path(dir_path) / ".gitkeep").touch()

    return True

def generate_secret_key():
    """Generate a Django-compatible secret key without Django dependencies"""
    chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*(-_=+)'
    return ''.join(secrets.choice(chars) for _ in range(50))

def create_env_file(project_name):
    """Create .env file in project settings directory"""
    print_header("Creating .env File")
    env_path = Path(project_name) / ".env"

    env_content = """# Django Environment Configuration
DJANGO_ENV=dev
DJANGO_DEBUG=True
DJANGO_SECRET_KEY={secret_key}
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# Database Configuration (Development)
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=db.sqlite3
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=

# Database Configuration (Production)
# DB_ENGINE=django.db.backends.mysql
# DB_NAME=prod_db
# DB_USER=user
# DB_PASSWORD=password
# DB_HOST=localhost
# DB_PORT=3306

# Email Configuration
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=
EMAIL_PORT=25
EMAIL_USE_TLS=False
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=

# Security Settings (Production)
# SECURE_SSL_REDIRECT=True
# SESSION_COOKIE_SECURE=True
# CSRF_COOKIE_SECURE=True
# SECURE_HSTS_SECONDS=3600
# SECURE_HSTS_INCLUDE_SUBDOMAINS=True
# SECURE_HSTS_PRELOAD=True
"""

    # Generate a secret key without Django dependency
    secret_key = generate_secret_key()
    env_content = env_content.format(secret_key=secret_key)

    try:
        with open(env_path, "w") as f:
            f.write(env_content)
        print(f"✔ .env file created at: {env_path}")
        return True
    except IOError as e:
        print(f"❌ Error creating .env file: {e}")
        return False

def update_settings(project_name, apps):
    """Update Django settings with comprehensive configurations using python-decouple"""
    print_header("Updating Settings")
    settings_file = Path(project_name) / "settings.py"

    try:
        with open(settings_file, "r") as f:
            content = f.read()
    except IOError as e:
        print(f"❌ Error reading settings file: {e}")
        return False

    # Ensure os is imported
    if "import os" not in content:
        content = "import os\n" + content

    # Add decouple import at the top
    if "from decouple import config" not in content:
        content = "from decouple import config\n" + content

    # Remove duplicate settings by identifying and removing existing sections
    settings_to_remove = [
        "SECRET_KEY = ",
        "DEBUG = ",
        "ALLOWED_HOSTS = ",
        "STATIC_URL = ",
        "DATABASES = {",
        "EMAIL_BACKEND = "
    ]

    for setting in settings_to_remove:
        start_idx = content.find(setting)
        if start_idx != -1:
            end_idx = content.find("\n\n", start_idx)
            if end_idx == -1:
                end_idx = len(content)
            content = content[:start_idx] + content[end_idx:]

    # Add required apps
    installed_apps = [
        "'simpleui'",
        "'rest_framework'",
        "'corsheaders'",
        "'import_export'",
        "'django_filters'",
        "'whitenoise.runserver_nostatic'",
    ] + [f"'{app}'" for app in apps]

    # Find and update INSTALLED_APPS
    start_marker = "INSTALLED_APPS = ["
    end_marker = "]"
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker, start_idx)

    if start_idx == -1 or end_idx == -1:
        print("❌ Could not find INSTALLED_APPS in settings.py")
        return False

    new_content = (
        content[:start_idx + len(start_marker)] +
        content[start_idx + len(start_marker):end_idx].rstrip() +
        ("," if not content[start_idx + len(start_marker):end_idx].strip().endswith(",") else "") +
        "\n    " + ",\n    ".join(installed_apps) + ",\n" +
        content[end_idx:]
    )

    # Prepare template directories (root + each app)
    template_dirs = ["os.path.join(BASE_DIR, 'templates')"]
    for app in apps:
        template_dirs.append(f"os.path.join(BASE_DIR, '{app}', 'templates')")

    # Prepare static directories (root + each app)
    static_dirs = ["os.path.join(BASE_DIR, 'static')"]
    for app in apps:
        static_dirs.append(f"os.path.join(BASE_DIR, '{app}', 'static')")

    # Add our configurations at the end of the file
    additional_settings = f"""
# ======================
# Custom Configuration
# ======================

# Static and Media files
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [
    {',\n    '.join(static_dirs)}
]
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# SimpleUI Configuration
SIMPLEUI_LOGO = '/static/imgs/logo.png'
SIMPLEUI_HOME_INFO = False
SIMPLEUI_ANALYSIS = False

# REST Framework Configuration
REST_FRAMEWORK = {{
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.DjangoModelPermissionsOrAnonReadOnly'
    ]
}}

# CORS Headers Configuration
CORS_ORIGIN_ALLOW_ALL = True

# Security Settings
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Middleware Updates
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
MIDDLEWARE.insert(2, 'corsheaders.middleware.CorsMiddleware')

# Environment Variables Configuration using python-decouple
SECRET_KEY = config('DJANGO_SECRET_KEY')
DEBUG = config('DJANGO_DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('DJANGO_ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

# Database Configuration
DATABASES = {{
    'default': {{
        'ENGINE': config('DB_ENGINE', default='django.db.backends.sqlite3'),
        'NAME': config('DB_NAME', default=os.path.join(BASE_DIR, 'db.sqlite3')),
        'USER': config('DB_USER', default=''),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default=''),
        'PORT': config('DB_PORT', default=''),
    }}
}}

# Email Configuration
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='')
EMAIL_PORT = config('EMAIL_PORT', default=25, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=False, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='webmaster@localhost')

# Security Settings (Production)
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=False, cast=bool)
SESSION_COOKIE_SECURE = config('SESSION_COOKIE_SECURE', default=False, cast=bool)
CSRF_COOKIE_SECURE = config('CSRF_COOKIE_SECURE', default=False, cast=bool)
SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=0, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = config('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=False, cast=bool)
SECURE_HSTS_PRELOAD = config('SECURE_HSTS_PRELOAD', default=False, cast=bool)
SECURE_CONTENT_TYPE_NOSNIFF = config('SECURE_CONTENT_TYPE_NOSNIFF', default=False, cast=bool)
SECURE_BROWSER_XSS_FILTER = config('SECURE_BROWSER_XSS_FILTER', default=False, cast=bool)
X_FRAME_OPTIONS = config('X_FRAME_OPTIONS', default='SAMEORIGIN')
"""

    # Update TEMPLATES DIRS
    templates_start = new_content.find("'DIRS': [")
    templates_end = new_content.find("]", templates_start)
    if templates_start != -1 and templates_end != -1:
        existing_dirs = new_content[templates_start + 9:templates_end].strip()
        if existing_dirs:
            template_dirs = [existing_dirs] + template_dirs
        new_content = (
            new_content[:templates_start + 9] +
            ",\n        ".join(template_dirs) +
            new_content[templates_end:]
        )

    # Insert additional settings at the end
    new_content = new_content.rstrip() + "\n\n" + additional_settings

    # Write updated settings
    try:
        with open(settings_file, "w") as f:
            f.write(new_content)
    except IOError as e:
        print(f"❌ Error writing settings file: {e}")
        return False

    return True

def update_root_urls(project_name, apps):
    """Configure URL routing for the project and apps"""
    print_header("Configuring URL Routing")
    urls_file = Path(project_name) / "urls.py"

    # Prepare imports and URL patterns
    imports = [
        "from django.contrib import admin",
        "from django.urls import path, include",
        "from django.conf import settings",
        "from django.conf.urls.static import static"
    ]

    urlpatterns = [
        "path('admin/', admin.site.urls),"
    ] + [f"path('{app}/', include('{app}.urls'))," for app in apps]

    # Build new content
    new_content = (
        "\n".join(imports) + "\n\n" +
        "urlpatterns = [\n    " + "\n    ".join(urlpatterns) + "\n]"
    )

    # Add static/media serving in development only once
    new_content += """
# Static and media files serving during development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
"""

    # Write updated URLs
    try:
        with open(urls_file, "w") as f:
            f.write(new_content)
    except IOError as e:
        print(f"❌ Error writing URLs file: {e}")
        return False

    return True

def print_success_message(project_name, venv_name="venv"):
    """Print final instructions and success message"""
    print_header("Project Setup Complete")

    venv_path = Path(venv_name).absolute()
    project_path = Path().absolute()

    # Determine activation command based on platform
    if platform.system() == "Windows":
        activate_cmd = f"{venv_path}\\Scripts\\activate"
        cd_cmd = f"cd {project_path}"
    else:
        activate_cmd = f"source {venv_path}/bin/activate"
        cd_cmd = f"cd {project_path}"

    print("\n✅ Django project setup completed successfully!\n")
    print("Next steps:\n")
    print(f"1. Activate virtual environment:")
    print(f"   {activate_cmd}")
    print(f"2. Change to project directory:")
    print(f"   {cd_cmd}")
    print("3. Run database migrations:")
    print("   python manage.py migrate")
    print("4. Create superuser (optional):")
    print("   python manage.py createsuperuser")
    print("5. Run development server:")
    print("   python manage.py runserver")
    print("\nEnvironment Configuration:")
    print(f"   - Environment file located at: {project_name}/.env")
    print("   - To switch to production, set DJANGO_ENV=prod in .env")
    print("   - Never commit .env to version control!")
    print("\nHappy coding! 🚀\n")

def activate_virtualenv(venv_name="venv"):
    """Attempt to activate the virtual environment in the current shell"""
    print_header("Activating Virtual Environment")

    venv_path = Path(venv_name).absolute()
    if platform.system() == "Windows":
        activate_script = venv_path / "Scripts" / "activate.bat"
        activate_cmd = f"call {activate_script}"
    else:
        activate_script = venv_path / "bin" / "activate"
        activate_cmd = f"source {activate_script}"

    print("To activate the virtual environment, run:")
    print(f"  {activate_cmd}")
    print("\nOr execute this command:")
    print(f"  {' '.join(sys.argv[:1])} && {activate_cmd}")

def main():
    """Main entry point for the script"""
    parser = argparse.ArgumentParser(
        description="Professional Django Project Setup Script",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "project_name",
        nargs="?",
        default="project",
        help="Name of the Django project"
    )
    parser.add_argument(
        "apps",
        nargs="*",
        default=["main"],
        help="Names of Django apps to create"
    )
    parser.add_argument(
        "--venv",
        default="venv",
        help="Name of the virtual environment to create"
    )
    parser.add_argument(
        "--no-venv",
        action="store_true",
        help="Skip virtual environment creation"
    )

    args = parser.parse_args()

    try:
        # Step 1: Create virtual environment
        if not args.no_venv and not create_venv(args.venv):
            sys.exit(1)

        # Step 2: Create requirements.txt
        create_requirements_file()

        # Step 3: Install requirements
        if not args.no_venv and not install_requirements(args.venv):
            sys.exit(1)

        # Step 4: Create Django project and apps
        if not create_django_project(args.project_name, args.apps, args.venv):
            sys.exit(1)

        # Step 5: Create project structure
        create_project_structure(args.project_name, args.apps)

        # Step 6: Create .env file
        if not create_env_file(args.project_name):
            sys.exit(1)

        # Step 7: Update settings.py
        if not update_settings(args.project_name, args.apps):
            sys.exit(1)

        # Step 8: Update root urls.py
        if not update_root_urls(args.project_name, args.apps):
            sys.exit(1)

        # Print success message
        print_success_message(args.project_name, args.venv)

        # Attempt to activate virtualenv
        if not args.no_venv:
            activate_virtualenv(args.venv)

    except KeyboardInterrupt:
        print("\n❌ Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
