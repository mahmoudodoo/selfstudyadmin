import os
import time
import random
import logging
import requests
from django.views import View
from django.http import JsonResponse
from django.shortcuts import render
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from functools import wraps

logger = logging.getLogger(__name__)

_NO_PROXY = {'http': None, 'https': None}

# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Domain / Registry helpers
# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

REGISTRY_INSTANCES = [
    "https://sfsdomains1.pythonanywhere.com",
    "https://sfsdomains2.pythonanywhere.com",
]

RESEARCH_FLOW_APP_ID = 28
USERPROFILE_APP_ID   = 13

_domain_cache = {}
CACHE_TTL     = 300


def _get_auth_token():
    return os.environ.get('AUTH_TOKEN', '')


def _build_headers(user_id=None):
    """Build headers with Authorization and optional X-User-ID."""
    h = {
        'Authorization': f'Token {_get_auth_token()}',
        'Content-Type':  'application/json',
    }
    if user_id:
        h['X-User-ID'] = str(user_id).strip()
    return h


def _make_request(method, url, **kwargs):
    """Try without proxy first, fall back to system proxy."""
    token   = _get_auth_token()
    headers = kwargs.pop('headers', {})
    if token and 'Authorization' not in headers:
        headers['Authorization'] = f'Token {token}'
    timeout = kwargs.pop('timeout', 15)

    for attempt, proxies in enumerate([_NO_PROXY, None]):
        try:
            kw = dict(kwargs, headers=headers, timeout=timeout)
            if proxies is not None:
                kw['proxies'] = proxies
            resp = requests.request(method, url, **kw)
            logger.debug(f"[attempt {attempt+1}] {method} {url} -> {resp.status_code}")
            return resp
        except requests.RequestException as exc:
            logger.warning(f"[attempt {attempt+1}] {method} {url} failed: {exc}")
    return None


def _fetch_replicas_from_registry(registry_url, app_id):
    url  = f"{registry_url.rstrip('/')}/apps/{app_id}/"
    resp = _make_request('GET', url, timeout=10)
    if resp and resp.status_code == 200:
        data = resp.json()
        return [r['replica_url'].rstrip('/') for r in data.get('replicas', [])]
    return None


def _get_replica_urls(app_id):
    now    = time.time()
    cached = _domain_cache.get(app_id)
    if cached and (now - cached[0]) < CACHE_TTL:
        return cached[1]

    instances = REGISTRY_INSTANCES[:]
    random.shuffle(instances)
    for registry in instances:
        urls = _fetch_replicas_from_registry(registry, app_id)
        if urls is not None:
            _domain_cache[app_id] = (now, urls)
            logger.info(f"app_id={app_id}: fetched {len(urls)} replicas from {registry}")
            return urls

    logger.warning(f"app_id={app_id}: all registries failed")
    return []


def _pick_working_replica(urls):
    if not urls:
        return None
    shuffled = urls[:]
    random.shuffle(shuffled)
    for url in shuffled:
        resp = _make_request('GET', f"{url}/api/projects/", timeout=8)
        if resp and resp.status_code in (200, 401, 403):
            return url
    return shuffled[0] if shuffled else None


def _rf_request(method, path, user_id=None, json_body=None, timeout=15):
    """Make a request to a working research-flow replica."""
    urls = _get_replica_urls(RESEARCH_FLOW_APP_ID)
    base = _pick_working_replica(urls)
    if not base:
        logger.error("No working research-flow replica found")
        return None
    headers = _build_headers(user_id=user_id)
    url     = f"{base}{path}"
    kwargs  = {'headers': headers, 'timeout': timeout}
    if json_body is not None:
        kwargs['json'] = json_body
    return _make_request(method, url, **kwargs)


def _up_request(method, path, user_id=None, timeout=10):
    """Make a request to a working userprofile replica."""
    urls = _get_replica_urls(USERPROFILE_APP_ID)
    if not urls:
        return None
    base    = random.choice(urls)
    headers = _build_headers(user_id=user_id)
    return _make_request(method, f"{base}{path}", headers=headers, timeout=timeout)


# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Auth decorator
# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

def require_admin(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            from django.shortcuts import redirect
            return redirect('login')
        return view_func(request, *args, **kwargs)
    return wrapper


# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Page view
# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

class SelfStudyResearchFlowView(View):
    @method_decorator(require_admin)
    def get(self, request):
        rf_urls = _get_replica_urls(RESEARCH_FLOW_APP_ID)
        up_urls = _get_replica_urls(USERPROFILE_APP_ID)
        context = {
            'rf_replicas':      rf_urls,
            'up_replicas':      up_urls,
            'rf_replica_count': len(rf_urls),
            'up_replica_count': len(up_urls),
        }
        return render(request, 'selfstudyresearchflow.html', context)


# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# API proxy view
# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

@method_decorator(csrf_exempt, name='dispatch')
class ResearchFlowAPIView(View):

    @method_decorator(require_admin)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    # \u2500\u2500 helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

    def _resolve_user_id(self, request, body=None):
        """
        Priority order for X-User-ID:
        1. user_id in POST body
        2. user_id in GET params
        3. session stored rf_user_id
        4. owner_id in POST body
        Returns empty string if none found.
        """
        # 1. body
        if body and body.get('user_id'):
            uid = str(body['user_id']).strip()
            if uid:
                return uid

        # 2. query param
        uid = request.GET.get('user_id', '').strip()
        if uid:
            return uid

        # 3. session
        uid = request.session.get('rf_user_id', '').strip()
        if uid:
            return uid

        # 4. owner_id fallback
        if body and body.get('owner_id'):
            uid = str(body['owner_id']).strip()
            if uid:
                return uid

        return ''

    def _json_response(self, resp):
        """Convert requests.Response to JsonResponse."""
        if resp is None:
            return JsonResponse({'error': 'No research-flow replica available'}, status=503)
        try:
            data = resp.json()
        except Exception:
            data = {'raw': resp.text}
        return JsonResponse(data, status=resp.status_code, safe=False)

    # \u2500\u2500 GET \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

    def get(self, request, *args, **kwargs):
        action  = request.GET.get('action', 'projects')
        user_id = self._resolve_user_id(request)

        # \u2500\u2500 Replicas info (no user needed) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'replicas':
            rf_urls = _get_replica_urls(RESEARCH_FLOW_APP_ID)
            up_urls = _get_replica_urls(USERPROFILE_APP_ID)
            return JsonResponse({
                'research_flow_replicas': rf_urls,
                'userprofile_replicas':   up_urls,
            })

        # \u2500\u2500 Projects \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'projects':
            resp = _rf_request('GET', '/api/projects/', user_id=user_id)
            return self._json_response(resp)

        if action == 'project':
            pid  = request.GET.get('project_id', '')
            resp = _rf_request('GET', f'/api/projects/{pid}', user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Files \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'files':
            pid  = request.GET.get('project_id', '')
            resp = _rf_request('GET', f'/api/projects/{pid}/files/', user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Team \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'team':
            pid  = request.GET.get('project_id', '')
            resp = _rf_request('GET', f'/api/projects/{pid}/team/', user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Comments \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'comments':
            pid  = request.GET.get('project_id', '')
            resp = _rf_request('GET', f'/api/projects/{pid}/comments/', user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Collaborations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'collaborations':
            status_f = request.GET.get('status', '')
            path     = '/api/collaboration-requests/'
            if status_f:
                path += f'?status={status_f}'
            resp = _rf_request('GET', path, user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Notifications \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'notifications':
            resp = _rf_request('GET', '/api/notifications/', user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Activities \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'activities':
            resp = _rf_request('GET', '/api/activities/', user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Stats (aggregated, no /dashboard/ endpoint needed) \u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'stats':
            return self._get_stats(user_id)

        # \u2500\u2500 Imported Papers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'imported_papers':
            resp = _rf_request('GET', '/api/imported-papers/', user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Search \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'search':
            q    = request.GET.get('q', '')
            pg   = request.GET.get('page', '1')
            resp = _rf_request('GET', f'/api/search/?q={q}&page={pg}', user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 OpenAlex search \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'openalex_search':
            q    = request.GET.get('q', '')
            resp = _rf_request('GET', f'/api/openalex/search/?q={q}', user_id=user_id)
            return self._json_response(resp)

        return JsonResponse({'error': 'Unknown action'}, status=400)

    # \u2500\u2500 aggregated stats \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

    def _get_stats(self, user_id):
        try:
            # projects
            r_proj   = _rf_request('GET', '/api/projects/', user_id=user_id)
            projects = []
            if r_proj and r_proj.status_code == 200:
                d        = r_proj.json()
                projects = d if isinstance(d, list) else d.get('results', [])

            total_views     = sum(p.get('views',     0) for p in projects)
            total_downloads = sum(p.get('downloads', 0) for p in projects)

            # files \u2014 first 5 projects only for performance
            total_files  = 0
            recent_files = []
            for p in projects[:5]:
                rf = _rf_request('GET', f"/api/projects/{p['id']}/files/", user_id=user_id)
                if rf and rf.status_code == 200:
                    fd = rf.json()
                    fl = fd if isinstance(fd, list) else fd.get('results', [])
                    total_files  += len(fl)
                    recent_files += fl
            recent_files = sorted(
                recent_files, key=lambda f: f.get('uploaded_at', ''), reverse=True
            )[:5]

            # collaborations
            total_collabs    = 0
            pending_requests = []
            r_col = _rf_request('GET', '/api/collaboration-requests/', user_id=user_id)
            if r_col and r_col.status_code == 200:
                cd = r_col.json()
                cl = cd if isinstance(cd, list) else cd.get('results', [])
                total_collabs    = len([c for c in cl if c.get('status') == 'approved'])
                pending_requests = sorted(
                    [c for c in cl if c.get('status') == 'pending'],
                    key=lambda c: c.get('created_at', ''), reverse=True
                )[:5]

            # activities
            recent_activity = []
            r_act = _rf_request('GET', '/api/activities/', user_id=user_id)
            if r_act and r_act.status_code == 200:
                ad = r_act.json()
                al = ad if isinstance(ad, list) else ad.get('results', [])
                recent_activity = sorted(
                    al, key=lambda a: a.get('created_at', ''), reverse=True
                )[:10]

            recent_projects = sorted(
                projects, key=lambda p: p.get('created_at', ''), reverse=True
            )[:5]

            return JsonResponse({
                'stats': {
                    'total_projects': len(projects),
                    'research_files': total_files,
                    'collaborations': total_collabs,
                    'total_views':    total_views,
                    'downloads':      total_downloads,
                },
                'recent_projects':        recent_projects,
                'recent_files':           recent_files,
                'collaboration_requests': pending_requests,
                'recent_activity':        recent_activity,
            })
        except Exception as exc:
            logger.exception("Stats aggregation failed")
            return JsonResponse({'error': str(exc)}, status=500)

    # \u2500\u2500 POST \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

    def post(self, request, *args, **kwargs):
        import json as _json
        action = request.GET.get('action', '')

        # parse body
        try:
            body = _json.loads(request.body)
        except Exception:
            body = {}

        # resolve user_id \u2014 this is the key fix
        user_id = self._resolve_user_id(request, body)

        # store in session for subsequent requests
        if user_id:
            request.session['rf_user_id'] = user_id

        logger.info(f"POST action={action} user_id={user_id}")

        # \u2500\u2500 Set context user \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'set_user_id':
            uid = body.get('user_id', '').strip()
            if uid:
                request.session['rf_user_id'] = uid
            return JsonResponse({'ok': True, 'user_id': uid})

        # \u2500\u2500 Guard: user_id required for most write operations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        NEEDS_USER = [
            'create_project', 'update_project', 'delete_project',
            'mark_notification_read', 'mark_all_notifications_read',
            'delete_all_notifications', 'respond_collaboration',
            'add_comment', 'delete_comment', 'delete_file',
            'delete_imported_paper', 'openalex_save',
        ]
        if action in NEEDS_USER and not user_id:
            return JsonResponse(
                {'error': 'No context user set. Please pick a user first.'},
                status=400
            )

        # \u2500\u2500 Projects \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'create_project':
            # strip owner_id / user_id from payload sent to RF
            # RF uses X-User-ID header as the owner
            payload = {k: v for k, v in body.items()
                       if k not in ('user_id', 'owner_id')}
            resp = _rf_request('POST', '/api/projects/',
                               user_id=user_id, json_body=payload)
            return self._json_response(resp)

        if action == 'update_project':
            pid     = body.get('project_id', '').strip()
            payload = {k: v for k, v in body.items()
                       if k not in ('project_id', 'user_id', 'owner_id')}
            resp = _rf_request('PUT', f'/api/projects/{pid}',
                               user_id=user_id, json_body=payload)
            return self._json_response(resp)

        if action == 'delete_project':
            pid  = body.get('project_id', '').strip()
            resp = _rf_request('DELETE', f'/api/projects/{pid}', user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Notifications \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'mark_notification_read':
            nid  = body.get('notification_id', '').strip()
            resp = _rf_request('POST', f'/api/notifications/{nid}/mark_read/',
                               user_id=user_id)
            return self._json_response(resp)

        if action == 'mark_all_notifications_read':
            resp = _rf_request('POST', '/api/notifications/mark_all_read/',
                               user_id=user_id)
            return self._json_response(resp)

        if action == 'delete_all_notifications':
            resp = _rf_request('DELETE', '/api/notifications/delete_all/',
                               user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Collaborations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'respond_collaboration':
            rid      = body.get('request_id', '').strip()
            act_type = body.get('action_type', 'approve')
            resp = _rf_request('POST',
                               f'/api/collaboration-requests/{rid}/respond/',
                               user_id=user_id,
                               json_body={'action': act_type})
            return self._json_response(resp)

        # \u2500\u2500 Comments \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'add_comment':
            pid     = body.get('project_id', '').strip()
            content = body.get('content', '')
            resp = _rf_request('POST', f'/api/projects/{pid}/comments/',
                               user_id=user_id, json_body={'content': content})
            return self._json_response(resp)

        if action == 'delete_comment':
            cid  = body.get('comment_id', '').strip()
            resp = _rf_request('DELETE', f'/api/comments/{cid}/', user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Files \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'delete_file':
            fid  = body.get('file_id', '').strip()
            resp = _rf_request('DELETE', f'/api/files/{fid}/', user_id=user_id)
            return self._json_response(resp)

        # \u2500\u2500 Imported Papers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if action == 'delete_imported_paper':
            paper_id = body.get('paper_id', '').strip()
            resp = _rf_request('DELETE', f'/api/imported-papers/{paper_id}',
                               user_id=user_id)
            return self._json_response(resp)

        if action == 'openalex_save':
            resp = _rf_request('POST', '/api/openalex/save-to-library/',
                               user_id=user_id, json_body=body)
            return self._json_response(resp)

        return JsonResponse({'error': 'Unknown action'}, status=400)


# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# UserProfile lookup
# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

@method_decorator(csrf_exempt, name='dispatch')
class ResearchFlowUserAPIView(View):

    @method_decorator(require_admin)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def get(self, request, *args, **kwargs):
        action = request.GET.get('action', 'list')

        if action == 'list':
            resp = _up_request('GET', '/profiles/')
            if resp is None:
                return JsonResponse(
                    {'error': 'Userprofile service unavailable'}, status=503)
            try:
                return JsonResponse(resp.json(), status=resp.status_code, safe=False)
            except Exception:
                return JsonResponse({'error': resp.text}, status=500)

        if action == 'lookup':
            uid  = request.GET.get('user_id', '').strip()
            resp = _up_request('GET', f'/profiles/{uid}/')
            if resp is None:
                return JsonResponse(
                    {'error': 'Userprofile service unavailable'}, status=503)
            try:
                return JsonResponse(resp.json(), status=resp.status_code, safe=False)
            except Exception:
                return JsonResponse({'error': resp.text}, status=500)

        return JsonResponse({'error': 'Unknown action'}, status=400)