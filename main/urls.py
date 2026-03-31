from django.urls import path
from . import views
from .views.selfstudydomains import SelfStudyDomainsView, SelfStudyDomainsAPIView
from .views.selfstudymedia import (
    SelfStudyMediaView,
    SelfStudyMediaAPIView,
    ExternalDataAPIView,
    ReplicaAPIView
)
from .views.selfstudychat import SelfStudyChatView, ChatRoomAPIView
from .views.selfstudyotp import SelfStudyOTPView
from .views.selfstudyrunbook import SelfStudyRunbookView
from .views.selfstudyallauth import SelfStudyAllAuthView

# ResearchFlow views
from .views.selfstudyresearchflow import (
    SelfStudyResearchFlowView,
    DiagnosticAPIView,
    UserProfileListAPIView,
    ResearcherProfilesListAPIView,
    ResearchersAPIView,
    ProjectsAPIView,
    OpenAlexLibrariesAPIView,
    LocalProjectsLibrariesAPIView,
    UserActivitiesAPIView,
    TeamsAPIView,
    CollaborationsAPIView,
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

    # Subscription Management URLs
    path('selfstudysubscriptions/', views.SelfStudySubscriptionsView.as_view(), name='selfstudysubscriptions'),
    path('selfstudysubscriptions/api/', views.SubscriptionAPIView.as_view(), name='selfstudysubscriptions_api'),

    # SelfStudy Media Management URLs
    path('selfstudymedia/', SelfStudyMediaView.as_view(), name='selfstudymedia'),
    path('selfstudymedia/api/media/', SelfStudyMediaAPIView.as_view(), name='selfstudymedia_api'),
    path('selfstudymedia/api/external-data/', ExternalDataAPIView.as_view(), name='selfstudymedia_external_data'),
    path('selfstudymedia/api/replicas/', ReplicaAPIView.as_view(), name='selfstudymedia_replicas'),

    # SelfStudy Chat Management URLs
    path('selfstudychat/', SelfStudyChatView.as_view(), name='selfstudychat'),
    path('selfstudychat/api/rooms/', ChatRoomAPIView.as_view(), name='selfstudychat_api_rooms'),
    path('selfstudychat/api/rooms/<int:room_id>/messages/', ChatRoomAPIView.as_view(), {'action': 'messages'}, name='selfstudychat_api_room_messages'),
    path('selfstudychat/api/block-ip/', ChatRoomAPIView.as_view(), {'action': 'block-ip'}, name='selfstudychat_api_block_ip'),
    path('selfstudychat/api/unblock-ip/', ChatRoomAPIView.as_view(), {'action': 'unblock-ip'}, name='selfstudychat_api_unblock_ip'),
    path('selfstudychat/api/delete-room/', ChatRoomAPIView.as_view(), {'action': 'delete-room'}, name='selfstudychat_api_delete_room'),
    path('selfstudychat/api/send-message/', ChatRoomAPIView.as_view(), {'action': 'send-message'}, name='selfstudychat_api_send_message'),
    path('selfstudychat/api/mark-seen/', ChatRoomAPIView.as_view(), {'action': 'mark-seen'}, name='selfstudychat_api_mark_seen'),

    # OTP Management URLs
    path('selfstudyotp/', SelfStudyOTPView.as_view(), name='selfstudyotp'),

    # Other Self Study Service URLs
    path('selfstudydomains/', SelfStudyDomainsView.as_view(), name='selfstudydomains'),
    path('selfstudydomains/api/', SelfStudyDomainsAPIView.as_view(), name='selfstudydomains_api'),

    # SelfStudy Proctor URLs
    path('selfstudyproctor/', views.SelfStudyProctorView.as_view(), name='selfstudyproctor'),
    path('selfstudyproctor/api/', views.SelfStudyProctorAPIView.as_view(), name='selfstudyproctor_api'),
    path('selfstudyproctor/api/<str:proctor_id>/', views.SelfStudyProctorAPIView.as_view(), name='selfstudyproctor_api_detail'),
    path('selfstudyproctor/api/availability/', views.SelfStudyProctorAPIView.as_view(), {'action': 'update_availability'}, name='selfstudyproctor_api_availability'),

    # SelfStudy Runbook URLs
    path('selfstudyrunbook/', SelfStudyRunbookView.as_view(), name='selfstudyrunbook'),

    # Main management page
    path('selfstudyallauth/', SelfStudyAllAuthView.as_view(), name='selfstudyallauth'),

    # API endpoints for AJAX requests
    path('selfstudyallauth/api/', views.SelfStudyAllAuthAPIView.as_view(), name='selfstudyallauth_api'),

    # User Lab URLs
    path('selfstudyuserlab/api/', views.SelfStudyUserLabAPIView.as_view(), name='selfstudyuserlab_api'),

    # Dashboard API endpoints
    path('api/dashboard/apps/', views.DashboardAppsAPIView.as_view(), name='dashboard_apps'),
    path('api/dashboard/metrics/', views.ReplicaMetricsAPIView.as_view(), name='dashboard_metrics'),

    # ========= SELFSTUDY RESEARCH FLOW MANAGEMENT =========
    path('selfstudyresearchflow/', SelfStudyResearchFlowView.as_view(), name='selfstudyresearchflow'),
    path('selfstudyresearchflow/api/diagnostic/', DiagnosticAPIView.as_view(), name='rf_api_diagnostic'),
    path('selfstudyresearchflow/api/users/', UserProfileListAPIView.as_view(), name='rf_api_users'),
    path('selfstudyresearchflow/api/researcher-profiles-list/', ResearcherProfilesListAPIView.as_view(), name='rf_api_researcher_profiles_list'),
    path('selfstudyresearchflow/api/researchers/', ResearchersAPIView.as_view(), name='rf_api_researchers'),
    path('selfstudyresearchflow/api/researchers/<str:profile_id>/', ResearchersAPIView.as_view(), name='rf_api_researcher_detail'),
    path('selfstudyresearchflow/api/projects/', ProjectsAPIView.as_view(), name='rf_api_projects'),
    path('selfstudyresearchflow/api/projects/<str:project_id>/', ProjectsAPIView.as_view(), name='rf_api_project_detail'),
    path('selfstudyresearchflow/api/openalex-libraries/', OpenAlexLibrariesAPIView.as_view(), name='rf_api_openalex'),
    path('selfstudyresearchflow/api/openalex-libraries/<str:paper_id>/', OpenAlexLibrariesAPIView.as_view(), name='rf_api_openalex_detail'),
    path('selfstudyresearchflow/api/local-libraries/', LocalProjectsLibrariesAPIView.as_view(), name='rf_api_locallibs'),
    path('selfstudyresearchflow/api/local-libraries/<str:project_id>/', LocalProjectsLibrariesAPIView.as_view(), name='rf_api_locallib_detail'),
    path('selfstudyresearchflow/api/activities/', UserActivitiesAPIView.as_view(), name='rf_api_activities'),
    path('selfstudyresearchflow/api/activities/<str:activity_id>/', UserActivitiesAPIView.as_view(), name='rf_api_activity_detail'),
    path('selfstudyresearchflow/api/teams/', TeamsAPIView.as_view(), name='rf_api_teams'),
    path('selfstudyresearchflow/api/collaborations/', CollaborationsAPIView.as_view(), name='rf_api_collaborations'),
    path('selfstudyresearchflow/api/collaborations/<str:request_id>/', CollaborationsAPIView.as_view(), name='rf_api_collaboration_detail'),
]