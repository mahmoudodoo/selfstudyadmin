from django.shortcuts import render
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
import requests
import random
import logging
import os
import json
import time

logger = logging.getLogger(__name__)

# SelfStudy Domains registry instances
SFS_DOMAINS = [
    "https://sfsdomains1.pythonanywhere.com",
    "https://sfsdomains2.pythonanywhere.com"
]

# App ID for runbooks service
RUNBOOKS_APP_ID = 17

# Fallback runbook domains - REPLACE WITH YOUR ACTUAL DEPLOYED RUNBOOK SERVICE URLs
FALLBACK_RUNBOOK_DOMAINS = [
    "https://selfstudyrunbook1.pythonanywhere.com",
    "https://selfstudyrunbook2.pythonanywhere.com",
]


class SelfStudyRunbookView(View):
    """
    View for managing selfstudyrunbook with dynamic domain discovery
    """

    def fetch_replicas_from_registry(self, registry_domain, app_id=RUNBOOKS_APP_ID):
        """
        Fetch replica URLs from a specific registry instance.
        Returns list of replica URLs or None if fails.
        """
        auth_token = os.getenv('AUTH_TOKEN')
        if not auth_token:
            logger.error("AUTH_TOKEN not set in environment")
            return None

        url = f"{registry_domain}/apps/{app_id}/"
        headers = {
            'Authorization': f'Token {auth_token}',
            'Content-Type': 'application/json'
        }

        try:
            logger.info(f"Attempting to fetch from registry: {url}")
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code != 200:
                logger.warning(f"Registry {registry_domain} returned {response.status_code}")
                return None

            data = response.json()
            replicas = data.get('replicas', [])
            if not replicas:
                logger.warning(f"No replicas found in registry response for {registry_domain}")
                return None

            replica_urls = [replica['replica_url'].rstrip('/') for replica in replicas]
            logger.info(f"Successfully fetched {len(replica_urls)} replicas from {registry_domain}")
            return replica_urls

        except requests.exceptions.Timeout:
            logger.error(f"Timeout connecting to registry {registry_domain}")
        except requests.exceptions.ConnectionError:
            logger.error(f"Connection error to registry {registry_domain}")
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from registry {registry_domain}")
        except Exception as e:
            logger.error(f"Unexpected error from registry {registry_domain}: {str(e)}")

        return None

    def discover_domains(self):
        """
        Discover runbook service domains using registry.
        Returns list of domain URLs (could be empty if all fail).
        """
        logger.info("Starting dynamic domain discovery for runbooks...")

        # Try each registry instance in random order
        registry_instances = random.sample(SFS_DOMAINS, len(SFS_DOMAINS))

        for registry in registry_instances:
            replicas = self.fetch_replicas_from_registry(registry)
            if replicas:
                logger.info(f"Dynamic discovery successful: {replicas}")
                return replicas

        logger.warning("All registry attempts failed. Using fallback domains.")
        return []

    def test_fallback_domains(self):
        """
        Test which fallback domains are actually reachable.
        Returns list of working domains.
        """
        auth_token = os.getenv('AUTH_TOKEN')
        headers = {'Authorization': f'Token {auth_token}'} if auth_token else {}
        working = []

        for domain in FALLBACK_RUNBOOK_DOMAINS:
            try:
                # Test the runbooks list endpoint (plural)
                test_url = f"{domain}/runbooks/"
                response = requests.get(test_url, headers=headers, timeout=5)
                if response.status_code == 200:
                    working.append(domain)
                    logger.info(f"Fallback domain {domain} is reachable")
                else:
                    logger.warning(f"Fallback domain {domain} returned {response.status_code}")
            except Exception as e:
                logger.warning(f"Fallback domain {domain} error: {str(e)}")

        return working

    def get_domains(self):
        """
        Get all domains for the runbook service.
        Priority: dynamic discovery > fallback working > empty list.
        """
        # Try dynamic discovery first
        dynamic_domains = self.discover_domains()
        if dynamic_domains:
            return dynamic_domains

        # Fallback to hardcoded domains with health check
        logger.info("Trying fallback domains...")
        working_fallbacks = self.test_fallback_domains()
        if working_fallbacks:
            logger.info(f"Using {len(working_fallbacks)} working fallback domains")
            return working_fallbacks

        # Last resort: return all fallbacks (even if untested) to avoid breaking UI
        logger.error("No working runbook domains found, returning fallback list anyway")
        return FALLBACK_RUNBOOK_DOMAINS

    @method_decorator(login_required)
    def get(self, request):
        """
        Render the runbook management interface
        """
        domains = self.get_domains()
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