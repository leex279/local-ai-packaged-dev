#!/usr/bin/env python3
"""
start_configurator.py

This script starts the LocalAI UI configurator webapp using Docker and automatically opens it in the browser.
It builds and runs the Docker container with proper volume mounts and error handling.
"""

import os
import sys
import subprocess
import time
import webbrowser
import platform
import signal
import threading
from pathlib import Path

# Get the script directory for reliable path resolution
# Use a more robust approach for WSL environments
try:
    SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
except (OSError, FileNotFoundError):
    # Fallback for problematic environments - assume current directory is project root
    try:
        import sys
        SCRIPT_DIR = os.path.dirname(os.path.realpath(sys.argv[0]))
    except (OSError, FileNotFoundError):
        # Ultimate fallback - assume we're in the project root
        SCRIPT_DIR = '.'

LOCALAI_UI_DIR = os.path.join(SCRIPT_DIR, 'localai-ui')

# Configuration
BACKEND_PORT = 5001
FRONTEND_PORT = 5000
WAIT_TIMEOUT = 60  # seconds to wait for services to start
CONTAINER_NAME = "localai-ui-configurator"

def print_banner():
    """Print a welcome banner."""
    print("=" * 60)
    print("🚀 LocalAI UI Configurator (Docker)")
    print("=" * 60)
    print("Building and starting webapp in Docker container...")
    print(f"Backend will run on: http://localhost:{BACKEND_PORT}")
    print(f"Frontend will run on: http://localhost:{FRONTEND_PORT}")
    print("=" * 60)

def check_dependencies():
    """Check if required dependencies are available."""
    print("📋 Checking dependencies...")
    
    # Check if Docker is available
    try:
        result = subprocess.run(['docker', '--version'], capture_output=True, text=True, check=True)
        print(f"✅ Docker found: {result.stdout.strip()}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ Error: Docker is not installed or not accessible.")
        print("💡 Please install Docker and ensure it's running, then try again.")
        return False
    
    # Check if docker-compose is available
    try:
        result = subprocess.run(['docker-compose', '--version'], capture_output=True, text=True, check=True)
        print(f"✅ Docker Compose found: {result.stdout.strip()}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        try:
            # Try docker compose (newer syntax)
            result = subprocess.run(['docker', 'compose', 'version'], capture_output=True, text=True, check=True)
            print(f"✅ Docker Compose found: {result.stdout.strip()}")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ Error: Docker Compose is not installed or not accessible.")
            print("💡 Please install Docker Compose and try again.")
            return False
    
    # Check if we're in the right directory (project root with localai-ui subdirectory)
    dockerfile_path = os.path.join(LOCALAI_UI_DIR, 'Dockerfile')
    compose_path = os.path.join(LOCALAI_UI_DIR, 'docker-compose.yml')
    
    if not os.path.exists(dockerfile_path):
        print(f"❌ Error: {dockerfile_path} not found. Please run this script from the project root directory.")
        return False
    
    if not os.path.exists(compose_path):
        print(f"❌ Error: {compose_path} not found. Please run this script from the project root directory.")
        return False
    
    print("✅ Dependencies check completed")
    return True

def ensure_directories():
    """Ensure required directories exist."""
    print("📁 Setting up directories...")
    
    directories = [
        os.path.join(LOCALAI_UI_DIR, 'input'),
        os.path.join(LOCALAI_UI_DIR, 'output'), 
        os.path.join(SCRIPT_DIR, 'shared')  # Shared directory for custom_services.json
    ]
    
    for directory in directories:
        dir_path = Path(directory)
        if not dir_path.exists():
            print(f"📁 Creating directory: {directory}")
            dir_path.mkdir(parents=True, exist_ok=True)
    
    # Copy default files if they don't exist
    input_compose = Path(os.path.join(LOCALAI_UI_DIR, 'input', 'docker-compose.yml'))
    if not input_compose.exists():
        # Check if there's a template in the project root
        root_compose = Path(os.path.join(SCRIPT_DIR, 'docker-compose.yml'))
        if root_compose.exists():
            print("📋 Copying docker-compose.yml template to input directory...")
            import shutil
            shutil.copy2(str(root_compose), str(input_compose))
        else:
            print("⚠️  Warning: No docker-compose.yml found in input directory")
    
    # Create default env file if it doesn't exist
    input_env = Path(os.path.join(LOCALAI_UI_DIR, 'input', 'env'))
    if not input_env.exists():
        # Check for .env file in shared directory first, then root
        shared_env = Path(os.path.join(SCRIPT_DIR, 'shared', '.env'))
        root_env = Path(os.path.join(SCRIPT_DIR, '.env'))
        
        if shared_env.exists():
            print("📋 Copying .env from shared directory to input directory...")
            import shutil
            shutil.copy2(str(shared_env), str(input_env))
        elif root_env.exists():
            print("📋 Copying .env template to input directory...")
            import shutil
            shutil.copy2(str(root_env), str(input_env))
        else:
            # Create a minimal env file
            print("📋 Creating minimal env template...")
            input_env.write_text("""# LocalAI UI Configuration Environment
# Copy this file and customize as needed

# Example environment variables
# POSTGRES_PASSWORD=your_secure_password
# JWT_SECRET=your_jwt_secret
""")
    
    print("✅ Directory setup completed")
    return True

def stop_existing_container():
    """Stop and remove any existing containers and images."""
    print("🧹 Cleaning up existing containers...")
    
    try:
        # Use docker-compose to stop and remove from localai-ui directory
        subprocess.run(['docker', 'compose', 'down', '--remove-orphans'], 
                      cwd=LOCALAI_UI_DIR, capture_output=True, check=False)
        
        # Remove any leftover images
        subprocess.run(['docker', 'image', 'rm', 'localai-ui', '-f'], 
                      capture_output=True, check=False)
        subprocess.run(['docker', 'image', 'rm', 'localai-ui-localai-ui', '-f'], 
                      capture_output=True, check=False)
        
        print("✅ Cleanup completed")
    except Exception as e:
        print(f"⚠️  Warning during cleanup: {e}")

def build_container():
    """Build the Docker container using docker-compose."""
    print("🔨 Building Docker container...")
    
    try:
        # Use docker-compose to build from localai-ui directory
        result = subprocess.run([
            'docker', 'compose', 'build', '--no-cache'
        ], cwd=LOCALAI_UI_DIR, check=True, capture_output=True, text=True)
        
        print("✅ Container built successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error building container: {e}")
        print("STDOUT:", e.stdout)
        print("STDERR:", e.stderr)
        return False

def start_container():
    """Start the Docker container using docker-compose."""
    print("🚀 Starting Docker container...")
    
    try:
        # Try docker-compose first, then fall back to docker compose from localai-ui directory
        try:
            subprocess.run(['docker-compose', 'up', '-d'], cwd=LOCALAI_UI_DIR, check=True, capture_output=True)
        except FileNotFoundError:
            subprocess.run(['docker', 'compose', 'up', '-d'], cwd=LOCALAI_UI_DIR, check=True, capture_output=True)
        
        print("✅ Container started successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error starting container: {e}")
        return False

def wait_for_service(url, service_name, timeout):
    """Wait for a service to become available."""
    print(f"⏳ Waiting for {service_name} to start...")
    
    import urllib.request
    import urllib.error
    import socket
    
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = urllib.request.urlopen(url, timeout=3)
            if response.status == 200:
                print(f"✅ {service_name} is ready!")
                return True
        except (urllib.error.URLError, urllib.error.HTTPError, socket.error, ConnectionResetError, OSError) as e:
            print(f"⏳ {service_name} not ready yet... ({type(e).__name__})")
            time.sleep(3)
        except Exception as e:
            print(f"⏳ {service_name} not ready yet... ({type(e).__name__}: {e})")
            time.sleep(3)
    
    print(f"❌ {service_name} failed to start within {timeout} seconds")
    return False

def show_logs(follow=False):
    """Show container logs, optionally following them."""
    def log_thread():
        try:
            # Try docker-compose first, then fall back to docker compose from localai-ui directory
            log_cmd = ['logs', '-f'] if follow else ['logs', '--tail', '50']
            try:
                subprocess.run(['docker-compose'] + log_cmd, cwd=LOCALAI_UI_DIR, check=False)
            except FileNotFoundError:
                subprocess.run(['docker', 'compose'] + log_cmd, cwd=LOCALAI_UI_DIR, check=False)
        except KeyboardInterrupt:
            pass
    
    if follow:
        thread = threading.Thread(target=log_thread, daemon=True)
        thread.start()
    else:
        log_thread()

def open_browser(url):
    """Open the webapp in the default browser."""
    print(f"🌐 Opening browser to {url}")
    
    try:
        if platform.system() == "Darwin":  # macOS
            subprocess.run(['open', url], timeout=5)
        elif platform.system() == "Windows":
            subprocess.run(['start', url], shell=True, timeout=5)
        else:  # Linux and others
            subprocess.run(['xdg-open', url], timeout=5)
        print("✅ Browser opened successfully")
    except subprocess.TimeoutExpired:
        print(f"⚠️  Browser opening timed out")
        print(f"💡 Please manually open: {url}")
    except Exception as e:
        print(f"⚠️  Could not open browser automatically: {e}")
        print(f"💡 Please manually open: {url}")

def handle_shutdown(signum, frame):
    """Handle shutdown signals."""
    print("\\n🛑 Shutdown signal received, stopping services...")
    
    try:
        # Try docker-compose first, then fall back to docker compose from localai-ui directory
        try:
            subprocess.run(['docker-compose', 'down'], cwd=LOCALAI_UI_DIR, check=False, capture_output=True)
        except FileNotFoundError:
            subprocess.run(['docker', 'compose', 'down'], cwd=LOCALAI_UI_DIR, check=False, capture_output=True)
        
        print("✅ Services stopped")
    except Exception as e:
        print(f"⚠️  Error during shutdown: {e}")
    
    sys.exit(0)

def main():
    """Main function."""
    # Parse arguments
    import argparse
    parser = argparse.ArgumentParser(description='Start LocalAI UI Configurator')
    parser.add_argument('--logs', action='store_true', 
                       help='Show container logs and keep console open (default: detached mode)')
    parser.add_argument('--no-browser', action='store_true',
                       help='Do not open browser automatically')
    args = parser.parse_args()
    
    # Set up signal handlers only if we're showing logs
    if args.logs:
        signal.signal(signal.SIGINT, handle_shutdown)
        signal.signal(signal.SIGTERM, handle_shutdown)
    
    print_banner()
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Setup directories
    if not ensure_directories():
        sys.exit(1)
    
    # Stop any existing containers
    stop_existing_container()
    
    # Build container
    if not build_container():
        sys.exit(1)
    
    # Start container
    if not start_container():
        sys.exit(1)
    
    # Give containers time to initialize
    print("⏳ Giving containers time to initialize...")
    time.sleep(10)
    
    # Wait for services to be ready
    backend_url = f"http://localhost:{BACKEND_PORT}/api/status"
    frontend_url = f"http://localhost:{FRONTEND_PORT}"
    
    # Try a quick check first
    import urllib.request
    try:
        response = urllib.request.urlopen(backend_url, timeout=3)
        if response.status == 200:
            print("✅ Backend is ready!")
        else:
            print(f"⚠️  Backend returned status {response.status}, waiting...")
            if not wait_for_service(backend_url, "Backend", WAIT_TIMEOUT):
                print("❌ Backend failed to start")
                sys.exit(1)
    except:
        print("⏳ Backend not immediately ready, waiting...")
        if not wait_for_service(backend_url, "Backend", WAIT_TIMEOUT):
            print("❌ Backend failed to start")
            sys.exit(1)
    
    # Quick check for frontend
    try:
        response = urllib.request.urlopen(frontend_url, timeout=3)
        if response.status == 200:
            print("✅ Frontend is ready!")
        else:
            print(f"⚠️  Frontend returned status {response.status}, waiting...")
            if not wait_for_service(frontend_url, "Frontend", WAIT_TIMEOUT):
                print("❌ Frontend failed to start")
                sys.exit(1)
    except:
        print("⏳ Frontend not immediately ready, waiting...")
        if not wait_for_service(frontend_url, "Frontend", WAIT_TIMEOUT):
            print("❌ Frontend failed to start")
            sys.exit(1)
    
    # Open browser
    if not args.no_browser:
        open_browser(frontend_url)
    
    # Show initial logs
    print("\\n📋 Recent container logs:")
    show_logs(follow=False)
    
    # Show status
    print("\\n" + "=" * 60)
    print("🎉 LocalAI UI Configurator is now running!")
    print(f"🌐 Access the webapp at: {frontend_url}")
    print(f"🔧 Backend API at: http://localhost:{BACKEND_PORT}")
    
    if args.logs:
        print("👆 Press Ctrl+C to stop all services")
        print("📋 Following container logs...")
        print("=" * 60)
        
        # Show logs and keep running
        show_logs(follow=True)
        
        # Keep the script running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            handle_shutdown(None, None)
    else:
        print("🔧 Services running in detached mode")
        print("💡 Use 'python3 start_configurator.py --logs' to view logs")
        print("💡 Use 'docker compose -f localai-ui/docker-compose.yml down' to stop services")
        print("=" * 60)

if __name__ == "__main__":
    main()