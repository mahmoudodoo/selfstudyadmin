from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator


@method_decorator(login_required, name='dispatch')
class SelfStudyDomainsView(View):
    def get(self, request):
        return render(request, 'selfstudydomains.html')

@method_decorator(login_required, name='dispatch')
class SelfStudyMediaView(View):
    def get(self, request):
        return render(request, 'selfstudymedia.html')

@method_decorator(login_required, name='dispatch')
class SelfStudyChatView(View):
    def get(self, request):
        return render(request, 'selfstudychat.html')

@method_decorator(login_required, name='dispatch')
class SelfStudyOTPView(View):
    def get(self, request):
        return render(request, 'selfstudyotp.html')

@method_decorator(login_required, name='dispatch')
class SelfStudyProctorView(View):
    def get(self, request):
        return render(request, 'selfstudyproctor.html')

@method_decorator(login_required, name='dispatch')
class SelfStudyRunbookView(View):
    def get(self, request):
        return render(request, 'selfstudyrunbook.html')

@method_decorator(login_required, name='dispatch')
class SelfStudyAllAuthView(View):
    def get(self, request):
        return render(request, 'selfstudyallauth.html')