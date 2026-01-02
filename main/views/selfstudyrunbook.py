from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.conf import settings
import requests
import random
import logging
import os
import json
import time
import uuid

logger = logging.getLogger(__name__)

# SelfStudy Domains registry instances
SFS_DOMAINS = [
    "https://sfsdomains1.pythonanywhere.com",
    "https://sfsdomains2.pythonanywhere.com"
]

# App ID for runbooks service
RUNBOOKS_APP_ID = 17

class SelfStudyRunbookView(View):
    """
    View for managing selfstudyrunbook with dynamic domain discovery
    """
    
    def get_working_domain_instance(self, max_retries=2):
        """
        Get a working SelfStudy Domains instance with retry logic
        """
        domains_to_try = random.sample(SFS_DOMAINS, len(SFS_DOMAINS))
        
        for domain in domains_to_try:
            for attempt in range(max_retries):
                try:
                    response = requests.get(domain, timeout=5)
                    if response.status_code == 200:
                        logger.info(f"Found working SelfStudy Domains: {domain}")
                        return domain
                except requests.exceptions.RequestException as e:
                    logger.warning(f"Domain {domain} unavailable: {str(e)}")
                if attempt < max_retries - 1:
                    time.sleep(1)
        
        logger.error("All SelfStudy Domains instances are unavailable")
        return None
    
    def fetch_domains_from_registry(self, working_domain, app_id=RUNBOOKS_APP_ID):
        """
        Fetch replica URLs from SelfStudy Domains registry
        """
        auth_token = os.getenv('AUTH_TOKEN')
        if not auth_token:
            logger.error("AUTH_TOKEN not set in environment")
            return []
        
        try:
            url = f"{working_domain}/apps/{app_id}/"
            headers = {
                'Authorization': f'Token {auth_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code != 200:
                logger.error(f"Failed to fetch app details: HTTP {response.status_code}")
                return []
            
            try:
                app_data = response.json()
            except json.JSONDecodeError:
                logger.error("Failed to parse JSON response")
                return []
            
            # Extract replica URLs
            replicas = app_data.get('replicas', [])
            replica_urls = []
            
            for replica in replicas:
                replica_url = replica.get('replica_url', '').strip()
                if replica_url:
                    replica_urls.append(replica_url.rstrip('/'))
            
            logger.info(f"Retrieved {len(replica_urls)} replica URLs")
            return replica_urls
            
        except requests.exceptions.Timeout:
            logger.error("Request timeout while fetching domains")
            return []
        except requests.exceptions.ConnectionError:
            logger.error("Connection error while fetching domains")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching domains: {str(e)}")
            return []
    
    def get_domains(self):
        """
        Get all domains for the runbook service
        """
        logger.info("Starting domain discovery...")
        
        # Step 1: Get working SelfStudy Domains instance
        working_domain = self.get_working_domain_instance()
        if not working_domain:
            logger.error("No working SelfStudy Domains instance")
            return []
        
        # Step 2: Fetch domains from registry
        replica_urls = self.fetch_domains_from_registry(working_domain)
        
        if not replica_urls:
            logger.warning("No replica URLs found, using fallback to direct testing")
            # Fallback: Test direct access to known domains
            fallback_domains = [
                "https://selfstudyrunbook1.pythonanywhere.com",
                "https://selfstudyrunbook2.pythonanywhere.com",
                "https://selfstudyrunbook3.pythonanywhere.com",
            ]
            
            for domain in fallback_domains:
                try:
                    auth_token = os.getenv('AUTH_TOKEN')
                    headers = {'Authorization': f'Token {auth_token}'} if auth_token else {}
                    response = requests.get(f"{domain}/runbooks/", headers=headers, timeout=5)
                    if response.status_code == 200:
                        replica_urls.append(domain)
                except:
                    continue
        
        return replica_urls
    
    @method_decorator(login_required)
    def get(self, request):
        """
        Render the runbook management interface
        """
        # Get domains for the service
        domains = self.get_domains()
        
        # Get auth token for frontend
        auth_token = os.getenv('AUTH_TOKEN')
        
        context = {
            'title': 'Runbook Management',
            'domains': domains,
            'user_info': {
                'username': request.user.username,
                'email': request.user.email,
                'is_staff': request.user.is_staff,
                'is_superuser': request.user.is_superuser,
            },
            'has_auth_token': bool(auth_token),
            'auth_token': auth_token,
            'app_id': RUNBOOKS_APP_ID,
        }
        
        return render(request, 'selfstudyrunbook.html', context)