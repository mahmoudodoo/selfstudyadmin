import json
import logging
import os
import random
import time
import traceback
from urllib.parse import urljoin

import requests
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.views import View
from django.views.generic import TemplateView

logger = logging.getLogger(__name__)

DOMAINS_REGISTRY = [
    "https://sfsdomains1.pythonanywhere.com",
    "https://sfsdomains2.pythonanywhere.com"
]
CACHE_DURATION = 300
_replicas_cache = {}

def get_auth_token():
    return os.environ.get("AUTH_TOKEN")

def make_request(method, url, json_data=None, headers=None, timeout=30, user_id_for_header=None):
    token = get_auth_token()
    if not token:
        raise Exception("AUTH_TOKEN environment variable not set")
    default_headers = {
        "Authorization": f"Token {token}",
        "Content-Type": "application/json",
    }
    if user_id_for_header:
        default_headers["X-User-ID"] = user_id_for_header
    if headers:
        default_headers.update(headers)
    resp = requests.request(method, url, json=json_data, headers=default_headers, timeout=timeout)
    if resp.status_code >= 400:
        raise Exception(f"HTTP {resp.status_code}: {resp.text[:500]}")
    return resp.json() if resp.content else {}

def fetch_app_replicas_from_registry(registry_url, app_id):
    try:
        url = f"{registry_url.rstrip('/')}/apps/{app_id}/"
        token = get_auth_token()
        headers = {"Authorization": f"Token {token}"} if token else {}
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return [r["replica_url"].rstrip("/") for r in data.get("replicas", [])]
        return None
    except Exception:
        return None

def health_check_replica(base_url, app_type):
    token = get_auth_token()
    headers = {"Authorization": f"Token {token}"} if token else {}
    try:
        if app_type == "rf":
            url = urljoin(base_url, "/api/projects/?limit=1")
        else:
            url = urljoin(base_url, "/metrics/")
        resp = requests.get(url, headers=headers, timeout=5)
        return resp.status_code in (200, 401)
    except Exception:
        return False

def get_healthy_replicas(app_id, app_type, force_refresh=False):
    global _replicas_cache
    now = time.time()
    cache_key = f"{app_id}_{app_type}"
    if not force_refresh and cache_key in _replicas_cache:
        ts, urls = _replicas_cache[cache_key]
        if now - ts < CACHE_DURATION:
            return urls
    all_replicas = set()
    for registry in DOMAINS_REGISTRY:
        reps = fetch_app_replicas_from_registry(registry, app_id)
        if reps:
            all_replicas.update(reps)
    if not all_replicas:
        return []
    healthy = [u for u in all_replicas if health_check_replica(u, app_type)]
    if not healthy:
        healthy = list(all_replicas)
    _replicas_cache[cache_key] = (now, healthy)
    return healthy

def call_replica_api(app_id, app_type, endpoint, method="GET", data=None, user_id_for_header=None, retries=3):
    """
    Call API with retry across different replicas.
    Each retry picks a random replica from the healthy list.
    If all fail, refresh the list and try once more.
    """
    tried = set()
    for attempt in range(retries):
        replicas = get_healthy_replicas(app_id, app_type)
        # Filter out replicas we already tried
        available = [r for r in replicas if r not in tried]
        if not available:
            # If all tried, refresh the list and try again
            if attempt < retries - 1:
                replicas = get_healthy_replicas(app_id, app_type, force_refresh=True)
                available = [r for r in replicas if r not in tried]
            if not available:
                break
        base = random.choice(available)
        tried.add(base)
        url = urljoin(base, endpoint)
        try:
            # Increase timeout for write operations
            timeout = 30 if method in ["POST", "PUT", "DELETE"] else 10
            return make_request(method, url, json_data=data, timeout=timeout, user_id_for_header=user_id_for_header)
        except Exception as e:
            logger.warning(f"Attempt {attempt+1} on {base} failed: {e}")
            if attempt == retries - 1:
                raise
    raise Exception(f"All {retries} attempts failed for {endpoint}")

def parse_json_body(request):
    try:
        return json.loads(request.body)
    except json.JSONDecodeError as e:
        raise Exception(f"Invalid JSON: {str(e)}")

def get_any_researcher_user_id():
    """Fetch any existing researcher's user_id as fallback for X-User-ID."""
    try:
        data = call_replica_api(28, "rf", "/api/researcher-profiles/")
        if data and len(data) > 0:
            return data[0].get("user_id")
    except Exception as e:
        logger.warning(f"Could not fetch researcher user_id: {e}")
    return None

# ----------------------------------------------------------------------
# Main view
# ----------------------------------------------------------------------

class SelfStudyResearchFlowView(LoginRequiredMixin, TemplateView):
    template_name = "selfstudyresearchflow.html"
    login_url = '/login/'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["page_title"] = "Research Flow Management"
        context["auth_token"] = get_auth_token()
        return context

# ----------------------------------------------------------------------
# Diagnostic API
# ----------------------------------------------------------------------

class DiagnosticAPIView(LoginRequiredMixin, View):
    def get(self, request):
        try:
            replicas = get_healthy_replicas(28, "rf")
            result = {"replicas": replicas}
            if replicas:
                # Test each replica's basic availability
                statuses = {}
                for r in replicas:
                    test_url = urljoin(r, "/api/researcher-profiles/")
                    token = get_auth_token()
                    headers = {"Authorization": f"Token {token}"}
                    try:
                        resp = requests.get(test_url, headers=headers, timeout=5)
                        statuses[r] = resp.status_code
                    except Exception as e:
                        statuses[r] = str(e)
                result["replica_statuses"] = statuses
            return JsonResponse(result)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

# ----------------------------------------------------------------------
# Base API
# ----------------------------------------------------------------------

class BaseAPIView(LoginRequiredMixin, View):
    login_url = '/login/'

# ---------- Get users from userprofile (for researcher dropdown) ----------
class UserProfileListAPIView(BaseAPIView):
    def get(self, request):
        try:
            base = get_random_replica(13, "up")  # we still need this helper; define it below
            url = urljoin(base, "/profiles/")
            users = make_request("GET", url)
            simplified = [{
                "user_id": u["user_id"],
                "username": u["username"],
                "first_name": u.get("first_name", ""),
                "last_name": u.get("last_name", ""),
                "email": u.get("email", "")
            } for u in users]
            return JsonResponse(simplified, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)

# Helper for userprofile replicas (app_id=13)
def get_random_replica(app_id, app_type):
    replicas = get_healthy_replicas(app_id, app_type)
    if not replicas:
        raise Exception(f"No available replica for app_id={app_id}")
    return random.choice(replicas)

# ---------- Researcher profiles ----------
class ResearchersAPIView(BaseAPIView):
    def get(self, request, profile_id=None):
        try:
            if profile_id:
                data = call_replica_api(28, "rf", f"/api/researcher-profiles/{profile_id}/")
                return JsonResponse(data)
            else:
                data = call_replica_api(28, "rf", "/api/researcher-profiles/")
                # Enrich with userprofile details
                for p in data:
                    uid = p.get("user_id")
                    if uid:
                        try:
                            base_up = get_random_replica(13, "up")
                            url = urljoin(base_up, f"/profiles/{uid}/")
                            ud = make_request("GET", url)
                            p["username"] = ud.get("username", "")
                            p["first_name"] = ud.get("first_name", "")
                            p["last_name"] = ud.get("last_name", "")
                            p["email"] = ud.get("email", "")
                        except:
                            pass
                return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)

    def post(self, request):
        try:
            body = parse_json_body(request)
            user_id = body.get("user_id")
            if not user_id:
                return JsonResponse({"error": "user_id is required"}, status=400)
            payload = {
                "user_id": user_id,
                "username": body.get("username"),
                "first_name": body.get("first_name"),
                "last_name": body.get("last_name"),
                "email": body.get("email"),
                "university": body.get("university", ""),
                "institution": body.get("institution", ""),
                "department": body.get("department", ""),
                "bio": body.get("bio", ""),
                "research_interests": body.get("research_interests", []),
                "orcid_id": body.get("orcid_id", ""),
                "google_scholar_id": body.get("google_scholar_id", ""),
                "website": body.get("website", "")
            }
            payload = {k: v for k, v in payload.items() if v is not None}
            result = call_replica_api(28, "rf", "/api/researcher-profiles/", "POST", data=payload, user_id_for_header=user_id)
            return JsonResponse(result, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)

    def put(self, request, profile_id):
        try:
            body = parse_json_body(request)
            user_id = body.get("user_id")
            if not user_id:
                return JsonResponse({"error": "user_id is required"}, status=400)
            payload = {
                "user_id": user_id,
                "username": body.get("username"),
                "first_name": body.get("first_name"),
                "last_name": body.get("last_name"),
                "email": body.get("email"),
                "university": body.get("university", ""),
                "institution": body.get("institution", ""),
                "department": body.get("department", ""),
                "bio": body.get("bio", ""),
                "research_interests": body.get("research_interests", []),
                "orcid_id": body.get("orcid_id", ""),
                "google_scholar_id": body.get("google_scholar_id", ""),
                "website": body.get("website", "")
            }
            payload = {k: v for k, v in payload.items() if v is not None}
            result = call_replica_api(28, "rf", f"/api/researcher-profiles/{profile_id}/", "PUT", data=payload, user_id_for_header=user_id)
            return JsonResponse(result)
        except Exception as e:
            return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)

    def delete(self, request, profile_id):
        try:
            profile = call_replica_api(28, "rf", f"/api/researcher-profiles/{profile_id}/")
            user_id = profile.get("user_id")
            if not user_id:
                user_id = get_any_researcher_user_id()
            call_replica_api(28, "rf", f"/api/researcher-profiles/{profile_id}/", "DELETE", user_id_for_header=user_id)
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

class ResearcherProfilesListAPIView(BaseAPIView):
    def get(self, request):
        try:
            data = call_replica_api(28, "rf", "/api/researcher-profiles/")
            simplified = [{
                "user_id": p.get("user_id"),
                "name": f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or p.get("username", "")
            } for p in data]
            return JsonResponse(simplified, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

# ---------- Projects ----------
class ProjectsAPIView(BaseAPIView):
    def get(self, request, project_id=None):
        try:
            if project_id:
                data = call_replica_api(28, "rf", f"/api/projects/{project_id}")
                return JsonResponse(data)
            else:
                data = call_replica_api(28, "rf", "/api/projects/")
                return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    def post(self, request):
        try:
            body = parse_json_body(request)
            owner_id = body.get("owner_id")
            if not owner_id:
                return JsonResponse({"error": "owner_id is required"}, status=400)
            payload = {
                "title": body.get("title", ""),
                "description": body.get("description", ""),
                "access_level": body.get("access_level", "private"),
                "status": body.get("status", "draft"),
                "keywords": body.get("keywords", []),
                "owner_id": owner_id
            }
            result = call_replica_api(28, "rf", "/api/projects/", "POST", data=payload, user_id_for_header=owner_id)
            return JsonResponse(result, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)

    def put(self, request, project_id):
        try:
            body = parse_json_body(request)
            project = call_replica_api(28, "rf", f"/api/projects/{project_id}")
            owner_id = project.get("owner_id")
            if not owner_id:
                owner_id = get_any_researcher_user_id()
            payload = {
                "title": body.get("title"),
                "description": body.get("description"),
                "access_level": body.get("access_level"),
                "status": body.get("status"),
                "keywords": body.get("keywords")
            }
            payload = {k: v for k, v in payload.items() if v is not None}
            result = call_replica_api(28, "rf", f"/api/projects/{project_id}", "PUT", data=payload, user_id_for_header=owner_id)
            return JsonResponse(result)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    def delete(self, request, project_id):
        try:
            project = call_replica_api(28, "rf", f"/api/projects/{project_id}")
            owner_id = project.get("owner_id")
            if not owner_id:
                owner_id = get_any_researcher_user_id()
            call_replica_api(28, "rf", f"/api/projects/{project_id}", "DELETE", user_id_for_header=owner_id)
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

# ---------- OpenAlex libraries ----------
class OpenAlexLibrariesAPIView(BaseAPIView):
    def get(self, request, paper_id=None):
        try:
            if paper_id:
                data = call_replica_api(28, "rf", f"/api/imported-papers/{paper_id}")
                return JsonResponse(data)
            else:
                data = call_replica_api(28, "rf", "/api/imported-papers/")
                return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    def post(self, request):
        try:
            body = parse_json_body(request)
            user_id = body.get("user_id")
            if not user_id:
                return JsonResponse({"error": "user_id is required"}, status=400)
            payload = {
                "title": body.get("title"),
                "doi": body.get("doi"),
                "user_id": user_id,
                "openalex_id": body.get("openalex_id"),
                "authors": body.get("authors", []),
                "abstract": body.get("abstract", "")
            }
            result = call_replica_api(28, "rf", "/api/imported-papers/", "POST", data=payload, user_id_for_header=user_id)
            return JsonResponse(result, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    def delete(self, request, paper_id):
        try:
            paper = call_replica_api(28, "rf", f"/api/imported-papers/{paper_id}")
            user_id = paper.get("user_id")
            if not user_id:
                user_id = get_any_researcher_user_id()
            call_replica_api(28, "rf", f"/api/imported-papers/{paper_id}", "DELETE", user_id_for_header=user_id)
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

class LocalProjectsLibrariesAPIView(ProjectsAPIView):
    pass

class UserActivitiesAPIView(BaseAPIView):
    def get(self, request, activity_id=None):
        try:
            if activity_id:
                data = call_replica_api(28, "rf", "/api/activities/")
                activity = next((a for a in data if a.get("id") == activity_id), None)
                return JsonResponse(activity if activity else {})
            else:
                data = call_replica_api(28, "rf", "/api/activities/")
                return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    def post(self, request):
        try:
            body = parse_json_body(request)
            user_id = body.get("user_id")
            if not user_id:
                return JsonResponse({"error": "user_id is required"}, status=400)
            result = call_replica_api(28, "rf", "/api/activities/", "POST", data=body, user_id_for_header=user_id)
            return JsonResponse(result, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    def delete(self, request, activity_id):
        return JsonResponse({"error": "Delete not supported"}, status=501)

class TeamsAPIView(BaseAPIView):
    def get(self, request):
        return JsonResponse({"error": "Teams list not available", "results": []}, status=501)

class CollaborationsAPIView(BaseAPIView):
    def get(self, request, request_id=None):
        try:
            if request_id:
                data = call_replica_api(28, "rf", f"/api/collaboration-requests/{request_id}")
                return JsonResponse(data)
            else:
                data = call_replica_api(28, "rf", "/api/collaboration-requests/")
                return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    def post(self, request):
        try:
            body = parse_json_body(request)
            project_id = body.get("project_id")
            if not project_id:
                return JsonResponse({"error": "project_id is required"}, status=400)
            project = call_replica_api(28, "rf", f"/api/projects/{project_id}")
            requester_id = project.get("owner_id")
            if not requester_id:
                requester_id = get_any_researcher_user_id()
            payload = {
                "project": project_id,
                "message": body.get("message", "")
            }
            result = call_replica_api(28, "rf", "/api/collaboration-requests/", "POST", data=payload, user_id_for_header=requester_id)
            return JsonResponse(result, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    def delete(self, request, request_id):
        try:
            req = call_replica_api(28, "rf", f"/api/collaboration-requests/{request_id}")
            requester_id = req.get("requester_id")
            if not requester_id:
                requester_id = get_any_researcher_user_id()
            call_replica_api(28, "rf", f"/api/collaboration-requests/{request_id}", "DELETE", user_id_for_header=requester_id)
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)