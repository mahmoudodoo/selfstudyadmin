from django.urls import path
from . import views
from .views.selfstudydomains import SelfStudyDomainsView, SelfStudyDomainsAPIView
from .views.selfstudymedia import (
    SelfStudyMediaView,
    SelfStudyMediaAPIView,
    ExternalDataAPIView,
    ReplicaAPIView
)

urlpatterns = [
    # Authentication URLs
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', views.CustomLogoutView.as_view(), name='logout'),

    # Admin Dashboard and User Management URLs
    path('', views.AdminDashboardView.as_view(), name='admin_dashboard'),
    path('users/create/', views.UserCreateView.as_view(), name='user_create'),
    path('users/<int:user_id>/update/', views.UserUpdateView.as_view(), name='user_update'),
    path('users/<int:user_id>/delete/', views.UserDeleteView.as_view(), name='user_delete'),

    # Self Study URLs
    path('selfstudyadmin/', views.SelfStudyAdminView.as_view(), name='selfstudyadmin'),
    path('selfstudyuserprofile/', views.SelfStudyUserProfileView.as_view(), name='selfstudyuserprofile'),
    path('selfstudyuserlab/', views.SelfStudyUserLabView.as_view(), name='selfstudyuserlab'),
    path('selfstudycourse/', views.SelfStudyCourseView.as_view(), name='selfstudycourse'),
    path('selfstudycourse/api/', views.CourseAPIView.as_view(), name='selfstudycourse_api'),

    # Self Study Live Course URLs
    path('selfstudylivecourse/', views.SelfStudyLiveCourseView.as_view(), name='selfstudylivecourse'),
    path('selfstudylivecourse/api/data/', views.LiveCourseDataView.as_view(), name='selfstudylivecourse_api_data'),

    # Self Study Exam URLs
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

    # Payment Management URLs
    path('selfstudypayment/', views.SelfStudyPaymentView.as_view(), name='selfstudypayment'),
    path('selfstudypayment/api/', views.SelfStudyPaymentView.as_view(), name='selfstudypayment_api'),

    # Subscription Management URLs - UPDATED
    path('selfstudysubscriptions/', views.SelfStudySubscriptionsView.as_view(), name='selfstudysubscriptions'),
    path('selfstudysubscriptions/api/', views.SubscriptionAPIView.as_view(), name='selfstudysubscriptions_api'),

    # SelfStudy Media Management URLs - UPDATED
    path('selfstudymedia/', SelfStudyMediaView.as_view(), name='selfstudymedia'),
    path('selfstudymedia/api/media/', SelfStudyMediaAPIView.as_view(), name='selfstudymedia_api'),
    path('selfstudymedia/api/external-data/', ExternalDataAPIView.as_view(), name='selfstudymedia_external_data'),
    path('selfstudymedia/api/replicas/', ReplicaAPIView.as_view(), name='selfstudymedia_replicas'),
    # Other Self Study Service URLs
    path('selfstudydomains/', SelfStudyDomainsView.as_view(), name='selfstudydomains'),
    path('selfstudydomains/api/', SelfStudyDomainsAPIView.as_view(), name='selfstudydomains_api'),
    path('selfstudychat/', views.SelfStudyChatView.as_view(), name='selfstudychat'),
    path('selfstudyotp/', views.SelfStudyOTPView.as_view(), name='selfstudyotp'),
    path('selfstudyproctor/', views.SelfStudyProctorView.as_view(), name='selfstudyproctor'),
    path('selfstudyrunbook/', views.SelfStudyRunbookView.as_view(), name='selfstudyrunbook'),
    path('selfstudyallauth/', views.SelfStudyAllAuthView.as_view(), name='selfstudyallauth'),

    # User Lab URLs
    path('selfstudyuserlab/', views.SelfStudyUserLabView.as_view(), name='selfstudyuserlab'),
    path('selfstudyuserlab/api/', views.SelfStudyUserLabAPIView.as_view(), name='selfstudyuserlab_api'),
]