import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'simpleui',
    'rest_framework',
    'corsheaders',
    'import_export',
    'django_filters',
    'whitenoise.runserver_nostatic',
    'main',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'selfstudyadmin.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'selfstudyadmin.wsgi.application'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ======================
# Custom Configuration
# ======================

# Static and Media files
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
    os.path.join(BASE_DIR, 'main', 'static')
]
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# SimpleUI Configuration
SIMPLEUI_LOGO = '/static/imgs/logo.png'
SIMPLEUI_HOME_INFO = False
SIMPLEUI_ANALYSIS = False

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.DjangoModelPermissionsOrAnonReadOnly'
    ]
}
# CORS Headers Configuration
CORS_ORIGIN_ALLOW_ALL = True

# Security Settings
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Middleware Updates
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
MIDDLEWARE.insert(2, 'corsheaders.middleware.CorsMiddleware')

# ======================
# Environment Variables
# ======================

# Django core settings
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')  # Required; will raise error if missing

# Debug: convert string to bool
DEBUG = os.getenv('DJANGO_DEBUG', 'False').lower() in ('true', '1', 'yes')

# Allowed hosts: split comma-separated string
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Database configuration
DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.sqlite3'),
        'NAME': os.getenv('DB_NAME', os.path.join(BASE_DIR, 'db.sqlite3')),
        'USER': os.getenv('DB_USER', ''),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', ''),
        'PORT': os.getenv('DB_PORT', ''),
    }
}

# Add SSL option only for PostgreSQL
if DATABASES['default']['ENGINE'] in ('django.db.backends.postgresql', 'django.db.backends.postgresql_psycopg2'):
    DATABASES['default']['OPTIONS'] = {'sslmode': 'require'}

# Email configuration
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', '')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '25'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'False').lower() in ('true', '1', 'yes')
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'webmaster@localhost')

# Security settings (production)
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'False').lower() in ('true', '1', 'yes')
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False').lower() in ('true', '1', 'yes')
CSRF_COOKIE_SECURE = os.getenv('CSRF_COOKIE_SECURE', 'False').lower() in ('true', '1', 'yes')
SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '0'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.getenv('SECURE_HSTS_INCLUDE_SUBDOMAINS', 'False').lower() in ('true', '1', 'yes')
SECURE_HSTS_PRELOAD = os.getenv('SECURE_HSTS_PRELOAD', 'False').lower() in ('true', '1', 'yes')
SECURE_CONTENT_TYPE_NOSNIFF = os.getenv('SECURE_CONTENT_TYPE_NOSNIFF', 'False').lower() in ('true', '1', 'yes')
SECURE_BROWSER_XSS_FILTER = os.getenv('SECURE_BROWSER_XSS_FILTER', 'False').lower() in ('true', '1', 'yes')
X_FRAME_OPTIONS = os.getenv('X_FRAME_OPTIONS', 'SAMEORIGIN')

# Authentication URLs
LOGIN_URL = '/login/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/login/'

# Message framework
MESSAGE_STORAGE = 'django.contrib.messages.storage.session.SessionStorage'

# Authentication backends
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
]