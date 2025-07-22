from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from .metrics import metrics_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('main.urls')),
    path('metrics/', metrics_view, name='metrics'),
]
# Static and media files serving during development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
