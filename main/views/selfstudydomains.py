from django.shortcuts import render
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

DOMAINS = [
    "https://sfsdomains1.pythonanywhere.com",
    "https://sfsdomains2.pythonanywhere.com"
]

def fetch_all_data():
    # Get data from just one domain to avoid duplicates
    domain = DOMAINS[0]  # Always use the first domain for reading
    try:
        apps_response = requests.get(f"{domain}/apps/")
        replicas_response = requests.get(f"{domain}/replicas/")
        
        apps_data = apps_response.json() if apps_response.status_code == 200 else []
        replicas_data = replicas_response.json() if replicas_response.status_code == 200 else []
        
        return apps_data, replicas_data
    except requests.RequestException:
        return [], []

def check_sync_status():
    sync_status = {
        'domains': [],
        'out_of_sync': False,
        'details': {}
    }
    
    try:
        reference_apps = requests.get(f"{DOMAINS[0]}/apps/").json()
        reference_replicas = requests.get(f"{DOMAINS[0]}/replicas/").json()
    except requests.RequestException:
        return sync_status
    
    for i, domain in enumerate(DOMAINS[1:], start=1):
        try:
            domain_apps = requests.get(f"{domain}/apps/").json()
            domain_replicas = requests.get(f"{domain}/replicas/").json()
            
            apps_diff = len(reference_apps) - len(domain_apps)
            replicas_diff = len(reference_replicas) - len(domain_replicas)
            
            if apps_diff != 0 or replicas_diff != 0:
                sync_status['out_of_sync'] = True
                sync_status['details'][domain] = {
                    'apps_diff': apps_diff,
                    'replicas_diff': replicas_diff
                }
                
            sync_status['domains'].append({
                'url': domain,
                'in_sync': apps_diff == 0 and replicas_diff == 0,
                'apps_count': len(domain_apps),
                'replicas_count': len(domain_replicas)
            })
        except requests.RequestException:
            continue
    
    return sync_status

def self_study_domains(request):
    apps_data, replicas_data = fetch_all_data()
    sync_status = check_sync_status()
    
    context = {
        'title': 'Self Study Domains Management',
        'apps': apps_data,
        'replicas': replicas_data,
        'domains': DOMAINS,
        'sync_status': sync_status
    }
    return render(request, 'selfstudydomains.html', context)

@csrf_exempt
def sync_data(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            source_domain = data.get('source_domain')
            
            if source_domain not in DOMAINS:
                return JsonResponse({'status': 'error', 'message': 'Invalid source domain'})
            
            try:
                apps_response = requests.get(f"{source_domain}/apps/")
                replicas_response = requests.get(f"{source_domain}/replicas/")
                
                if apps_response.status_code != 200 or replicas_response.status_code != 200:
                    return JsonResponse({'status': 'error', 'message': 'Failed to fetch data from source domain'})
                
                apps_data = apps_response.json()
                replicas_data = replicas_response.json()
            except requests.RequestException:
                return JsonResponse({'status': 'error', 'message': 'Connection error with source domain'})
            
            for domain in DOMAINS:
                if domain == source_domain:
                    continue
                
                try:
                    requests.delete(f"{domain}/apps/")
                    requests.delete(f"{domain}/replicas/")
                    
                    for app in apps_data:
                        requests.post(f"{domain}/apps/", json=app)
                    
                    for replica in replicas_data:
                        requests.post(f"{domain}/replicas/", json=replica)
                except requests.RequestException:
                    continue
            
            return JsonResponse({'status': 'success', 'message': 'Data synchronized successfully'})
        except json.JSONDecodeError:
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'})
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'})

@csrf_exempt
def add_app(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            app_data = {
                'app_name': data.get('app_name'),
                'description': data.get('description'),
                'github_link': data.get('github_link')
            }
            
            responses = []
            for domain in DOMAINS:
                try:
                    response = requests.post(f"{domain}/apps/", json=app_data)
                    responses.append(response.status_code == 201)
                except requests.RequestException:
                    return JsonResponse({'status': 'error', 'message': f'Connection error with {domain}'})
            
            if all(responses):
                return JsonResponse({'status': 'success', 'message': 'App created successfully on all domains'})
            return JsonResponse({'status': 'error', 'message': 'Failed to create app on some domains'})
        except json.JSONDecodeError:
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'})
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'})

@csrf_exempt
def update_app(request, app_id):
    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
            app_data = {
                'app_name': data.get('app_name'),
                'description': data.get('description'),
                'github_link': data.get('github_link')
            }
            
            responses = []
            for domain in DOMAINS:
                try:
                    response = requests.put(f"{domain}/apps/{app_id}/", json=app_data)
                    responses.append(response.status_code == 200)
                except requests.RequestException:
                    return JsonResponse({'status': 'error', 'message': f'Connection error with {domain}'})
            
            if all(responses):
                return JsonResponse({'status': 'success', 'message': 'App updated successfully on all domains'})
            return JsonResponse({'status': 'error', 'message': 'Failed to update app on some domains'})
        except json.JSONDecodeError:
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'})
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'})

@csrf_exempt
def add_replica(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            replica_data = {
                'app': data.get('app_id'),
                'replica_url': data.get('replica_url'),
                'replica_username': data.get('replica_username'),
                'replica_password': data.get('replica_password'),
                'admin_username': data.get('admin_username'),
                'admin_password': data.get('admin_password'),
                'db_host': data.get('db_host'),
                'db_name': data.get('db_name'),
                'db_username': data.get('db_username'),
                'db_password': data.get('db_password')
            }
            
            responses = []
            for domain in DOMAINS:
                try:
                    response = requests.post(f"{domain}/replicas/", json=replica_data)
                    responses.append(response.status_code == 201)
                except requests.RequestException:
                    return JsonResponse({'status': 'error', 'message': f'Connection error with {domain}'})
            
            if all(responses):
                return JsonResponse({'status': 'success', 'message': 'Replica created successfully on all domains'})
            return JsonResponse({'status': 'error', 'message': 'Failed to create replica on some domains'})
        except json.JSONDecodeError:
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'})
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'})

@csrf_exempt
def update_replica(request, replica_id):
    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
            replica_data = {
                'app': data.get('app_id'),
                'replica_url': data.get('replica_url'),
                'replica_username': data.get('replica_username'),
                'replica_password': data.get('replica_password'),
                'admin_username': data.get('admin_username'),
                'admin_password': data.get('admin_password'),
                'db_host': data.get('db_host'),
                'db_name': data.get('db_name'),
                'db_username': data.get('db_username'),
                'db_password': data.get('db_password')
            }
            
            responses = []
            for domain in DOMAINS:
                try:
                    response = requests.put(f"{domain}/replicas/{replica_id}/", json=replica_data)
                    responses.append(response.status_code == 200)
                except requests.RequestException:
                    return JsonResponse({'status': 'error', 'message': f'Connection error with {domain}'})
            
            if all(responses):
                return JsonResponse({'status': 'success', 'message': 'Replica updated successfully on all domains'})
            return JsonResponse({'status': 'error', 'message': 'Failed to update replica on some domains'})
        except json.JSONDecodeError:
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'})
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'})

@csrf_exempt
def delete_app(request, app_id):
    if request.method == 'DELETE':
        responses = []
        for domain in DOMAINS:
            try:
                response = requests.delete(f"{domain}/apps/{app_id}/")
                responses.append(response.status_code == 204)
            except requests.RequestException:
                return JsonResponse({'status': 'error', 'message': f'Connection error with {domain}'})
        
        if all(responses):
            return JsonResponse({'status': 'success', 'message': 'App deleted successfully from all domains'})
        return JsonResponse({'status': 'error', 'message': 'Failed to delete app from some domains'})
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'})

@csrf_exempt
def delete_replica(request, replica_id):
    if request.method == 'DELETE':
        responses = []
        for domain in DOMAINS:
            try:
                response = requests.delete(f"{domain}/replicas/{replica_id}/")
                responses.append(response.status_code == 204)
            except requests.RequestException:
                return JsonResponse({'status': 'error', 'message': f'Connection error with {domain}'})
        
        if all(responses):
            return JsonResponse({'status': 'success', 'message': 'Replica deleted successfully from all domains'})
        return JsonResponse({'status': 'error', 'message': 'Failed to delete replica from some domains'})
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'})


@csrf_exempt
def get_app(request, app_id):
    if request.method == 'GET':
        for domain in DOMAINS:
            try:
                response = requests.get(f"{domain}/apps/{app_id}/")
                if response.status_code == 200:
                    return JsonResponse(response.json())
            except requests.RequestException:
                continue
        return JsonResponse({'status': 'error', 'message': 'App not found'}, status=404)
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=400)

@csrf_exempt
def get_replica(request, replica_id):
    if request.method == 'GET':
        for domain in DOMAINS:
            try:
                response = requests.get(f"{domain}/replicas/{replica_id}/")
                if response.status_code == 200:
                    return JsonResponse(response.json())
            except requests.RequestException:
                continue
        return JsonResponse({'status': 'error', 'message': 'Replica not found'}, status=404)
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=400)