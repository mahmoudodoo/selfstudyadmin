from django.urls import path
from .views import (user_profiles, self_study_domains, sync_data, 
                   add_app, update_app, delete_app, get_app,
                   add_replica, update_replica, delete_replica, get_replica,
                   create_user, update_user, delete_user, get_user_details)
from .views.selfstudycertificate import (certificate_management, get_courses, 
                                        get_exams, create_certificate, 
                                        update_certificate, delete_certificate,
                                        get_certificate_details, get_users_for_certificates)

urlpatterns = [
    path('', self_study_domains, name='self_study_domains'),
    path('users/', user_profiles, name='user_profiles'),
    path('users/create/', create_user, name='create_user'),
    path('users/update/<uuid:user_id>/', update_user, name='update_user'),
    path('users/delete/<uuid:user_id>/', delete_user, name='delete_user'),
    path('users/details/', get_user_details, name='get_user_details'),
    path('sync-data/', sync_data, name='sync_data'),
    path('add-app/', add_app, name='add_app'),
    path('get-app/<int:app_id>/', get_app, name='get_app'),
    path('update-app/<int:app_id>/', update_app, name='update_app'),
    path('delete-app/<int:app_id>/', delete_app, name='delete_app'),
    path('add-replica/', add_replica, name='add_replica'),
    path('get-replica/<int:replica_id>/', get_replica, name='get_replica'),
    path('update-replica/<int:replica_id>/', update_replica, name='update_replica'),
    path('delete-replica/<int:replica_id>/', delete_replica, name='delete_replica'),
    
    # Certificate management URLs
    path('certificates/', certificate_management, name='certificate_management'),
    path('certificates/users/', get_users_for_certificates, name='get_users_for_certificates'),
    path('certificates/courses/', get_courses, name='get_courses'),
    path('certificates/exams/', get_exams, name='get_exams'),
    path('certificates/create/', create_certificate, name='create_certificate'),
    path('certificates/update/<str:certificate_id>/', update_certificate, name='update_certificate'),
    path('certificates/delete/<str:certificate_id>/', delete_certificate, name='delete_certificate'),
    path('certificates/details/<str:certificate_id>/', get_certificate_details, name='get_certificate_details'),
]