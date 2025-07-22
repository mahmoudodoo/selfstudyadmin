from django.http import HttpResponse
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Gauge
import psutil

# Create Gauges for disk usage metrics in GB
disk_usage_total_gb = Gauge('disk_usage_total_gb', 'Total disk space in gigabytes')
disk_usage_used_gb = Gauge('disk_usage_used_gb', 'Used disk space in gigabytes')
disk_usage_free_gb = Gauge('disk_usage_free_gb', 'Free disk space in gigabytes')

# Function to collect disk metrics for a specific path
def collect_disk_metrics(path='/home'):  # Adjust this path if needed
    try:
        disk_info = psutil.disk_usage(path)
        total_gb = disk_info.total / (1024 ** 3)
        used_gb = disk_info.used / (1024 ** 3)
        free_gb = disk_info.free / (1024 ** 3)

        # Print values for debugging (optional)
        print(f"Path: {path}, Total: {total_gb:.2f} GB, Used: {used_gb:.2f} GB, Free: {free_gb:.2f} GB")

        # Set the gauge metrics with the correct values
        disk_usage_total_gb.set(round(total_gb, 2))
        disk_usage_used_gb.set(round(used_gb, 2))
        disk_usage_free_gb.set(round(free_gb, 2))
    except Exception as e:
        print(f"Error collecting disk metrics for path {path}: {e}")

def metrics_view(request):
    # Ensure the correct path is monitored (e.g., '/' or '/home/selfstudyjo')
    collect_disk_metrics(path='/home')  # Adjust to match the path from `df -h`
    response = HttpResponse(generate_latest(), content_type=CONTENT_TYPE_LATEST)
    return response
