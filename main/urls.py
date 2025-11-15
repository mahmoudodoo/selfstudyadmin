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

    path('selfstudyexam/', views.SelfStudyExamView.as_view(), name='selfstudyexam'),
    path('selfstudycertificate/', views.SelfStudyCertificateView.as_view(), name='selfstudycertificate'),
    path('selfstudynotification/', views.SelfStudyNotificationView.as_view(), name='selfstudynotification'),
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