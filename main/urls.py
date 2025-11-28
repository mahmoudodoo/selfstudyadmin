from django.urls import path
from . import views

urlpatterns = [
    # Authentication URLs
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', views.CustomLogoutView.as_view(), name='logout'),

    # Admin Dashboard and User Management URLs
    path('', views.AdminDashboardView.as_view(), name='admin_dashboard'),
    path('users/create/', views.UserCreateView.as_view(), name='user_create'),
    path('users/<int:user_id>/update/', views.UserUpdateView.as_view(), name='user_update'),
    path('users/<int:user_id>/delete/', views.UserDeleteView.as_view(), name='user_delete'),  # Fixed duplicate name

    # Self Study URLs
    path('selfstudyadmin/', views.SelfStudyAdminView.as_view(), name='selfstudyadmin'),
    path('selfstudyuserprofile/', views.SelfStudyUserProfileView.as_view(), name='selfstudyuserprofile'),
    path('selfstudyuserlab/', views.SelfStudyUserLabView.as_view(), name='selfstudyuserlab'),
    path('selfstudycourse/', views.SelfStudyCourseView.as_view(), name='selfstudycourse'),
    path('selfstudycourse/api/', views.CourseAPIView.as_view(), name='selfstudycourse_api'),

    # Self Study Live Course URLs
    path('selfstudylivecourse/', views.SelfStudyLiveCourseView.as_view(), name='selfstudylivecourse'),
    path('selfstudylivecourse/api/data/', views.LiveCourseDataView.as_view(), name='selfstudylivecourse_api_data'),

    # Self Study Exam URLs - UPDATED
    path('selfstudyexam/', views.SelfStudyExamView.as_view(), name='selfstudyexam'),
    path('selfstudyexam/api/', views.SelfStudyExamAPIView.as_view(), name='selfstudyexam_api'),

    # Certificate Management URLs
    path('selfstudycertificate/', views.SelfStudyCertificateView.as_view(), name='selfstudycertificate'),
    path('selfstudycertificate/api/certificates/<str:certificate_type>/', views.CertificateAPIView.as_view(), name='certificate_api'),
    path('selfstudycertificate/api/certificates/<str:certificate_type>/<str:certificate_id>/', views.CertificateAPIView.as_view(), name='certificate_api_detail'),
    path('selfstudycertificate/api/lookup/<str:resource_type>/', views.LookupAPIView.as_view(), name='lookup_api'),

    # Other Self Study URLs
    path('selfstudynotification/', views.SelfStudyNotificationView.as_view(), name='selfstudynotification'),
    
    # Notification API endpoints
    path('selfstudynotification/api/', views.NotificationAPIView.as_view(), name='selfstudynotification_api'),
    path('selfstudynotification/api/<str:notification_id>/', views.NotificationAPIView.as_view(), name='selfstudynotification_api_detail'),
    
    # Users API endpoint
    path('selfstudynotification/api/users/', views.UserAPIView.as_view(), name='selfstudynotification_users_api'),
    
    path('selfstudypayment/', views.SelfStudyPaymentView.as_view(), name='selfstudypayment'),
    path('selfstudysubscriptions/', views.SelfStudySubscriptionsView.as_view(), name='selfstudysubscriptions'),
    path('selfstudydomains/', views.SelfStudyDomainsView.as_view(), name='selfstudydomains'),
    path('selfstudymedia/', views.SelfStudyMediaView.as_view(), name='selfstudymedia'),
    path('selfstudychat/', views.SelfStudyChatView.as_view(), name='selfstudychat'),
    path('selfstudyotp/', views.SelfStudyOTPView.as_view(), name='selfstudyotp'),
    path('selfstudyproctor/', views.SelfStudyProctorView.as_view(), name='selfstudyproctor'),
    path('selfstudyrunbook/', views.SelfStudyRunbookView.as_view(), name='selfstudyrunbook'),
    path('selfstudyallauth/', views.SelfStudyAllAuthView.as_view(), name='selfstudyallauth'),

    path('selfstudyuserlab/', views.SelfStudyUserLabView.as_view(), name='selfstudyuserlab'),
    path('selfstudyuserlab/api/', views.SelfStudyUserLabAPIView.as_view(), name='selfstudyuserlab_api'),
]