#!/usr/bin/env python3
"""
start_services.py

This script starts the Supabase stack first, waits for it to initialize, and then starts
the local AI stack. Both stacks use the same Docker Compose project name ("localai")
so they appear together in Docker Desktop.
"""

import os
import subprocess
import shutil
import time
import argparse
import platform
import sys
import json

def run_command(cmd, cwd=None):
    """Run a shell command and print it."""
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, cwd=cwd, check=True)

def clone_supabase_repo():
    """Clone the Supabase repository using sparse checkout if not already present."""
    # Check if directory exists and has valid git repo
    if os.path.exists("supabase"):
        print("Supabase repository already exists, updating...")
        try:
            # Check if it's a valid git repository
            run_command(["git", "status"], cwd="supabase")
            run_command(["git", "pull"], cwd="supabase")
            return
        except subprocess.CalledProcessError:
            print("Git operation failed, removing and re-cloning supabase repository...")
            try:
                shutil.rmtree("supabase")
            except (OSError, PermissionError) as e:
                print(f"Warning: Could not remove supabase directory: {e}")
                # Try to force remove with system command
                try:
                    run_command(["rm", "-rf", "supabase"])
                except subprocess.CalledProcessError:
                    print("Failed to remove supabase directory. Please remove it manually and try again.")
                    raise
    
    # Force remove any remaining traces and clone fresh
    if os.path.exists("supabase"):
        print("Directory still exists, attempting force removal...")
        try:
            run_command(["rm", "-rf", "supabase"])
        except subprocess.CalledProcessError:
            pass
    
    print("Cloning the Supabase repository...")
    try:
        run_command([
            "git", "clone", "--filter=blob:none", "--no-checkout",
            "https://github.com/supabase/supabase.git"
        ])
        run_command(["git", "sparse-checkout", "init", "--cone"], cwd="supabase")
        run_command(["git", "sparse-checkout", "set", "docker"], cwd="supabase")
        run_command(["git", "checkout", "master"], cwd="supabase")
    except subprocess.CalledProcessError as e:
        print(f"Failed to clone Supabase repository: {e}")
        print("You may need to manually remove the supabase directory and try again.")
        raise

def prepare_supabase_env():
    """Copy .env to .env in supabase/docker."""
    env_path = os.path.join("supabase", "docker", ".env")
    
    # Check for .env file in shared directory first (created by LocalAI UI), then root
    shared_env_path = os.path.join("shared", ".env")
    root_env_path = ".env"
    
    if os.path.exists(shared_env_path):
        env_source_path = shared_env_path
        print("Using .env from shared/ directory (created by LocalAI UI configurator)...")
    elif os.path.exists(root_env_path):
        env_source_path = root_env_path
        print("Using .env from project root...")
    else:
        print("ERROR: No .env file found in shared/ or project root!")
        print("Please create a .env file or use the LocalAI UI configurator to generate one.")
        sys.exit(1)
    
    # Ensure destination directory exists
    os.makedirs(os.path.dirname(env_path), exist_ok=True)
    
    # Check if destination file exists and ask for confirmation
    if os.path.exists(env_path):
        response = input(f"File {env_path} already exists. Do you want to overwrite it? (y/N): ").strip().lower()
        if response not in ['y', 'yes']:
            print("Skipping file copy. Using existing .env file.")
            return
    
    print(f"Copying {env_source_path} to {env_path}...")
    try:
        shutil.copyfile(env_source_path, env_path)
        print(f"Successfully copied environment file to {env_path}")
    except Exception as e:
        print(f"ERROR: Failed to copy environment file: {e}")
        sys.exit(1)

def stop_existing_containers(profile=None, config=None):
    print("Stopping and removing existing containers for the unified project 'localai'...")
    cmd = ["docker", "compose", "-p", "localai"]
    if profile and profile != "none":
        cmd.extend(["--profile", profile])
    
    # Add compose files based on configuration
    cmd.extend(["-f", "docker-compose.yml"])
    
    # Only include Supabase compose file if Supabase is enabled and the file exists
    if should_start_supabase(config) and os.path.exists("supabase/docker/docker-compose.yml"):
        cmd.extend(["-f", "supabase/docker/docker-compose.yml"])
    
    cmd.append("down")
    run_command(cmd)

def start_supabase(environment=None):
    """Start the Supabase services (using its compose file)."""
    print("Starting Supabase services...")
    cmd = ["docker", "compose", "-p", "localai", "-f", "supabase/docker/docker-compose.yml"]
    if environment and environment == "public":
        cmd.extend(["-f", "docker-compose.override.public.supabase.yml"])
    cmd.extend(["up", "-d"])
    run_command(cmd)

def start_local_ai(profile=None, environment=None, services=None, config=None):
    """Start the local AI services (using its compose file)."""
    if services:
        print(f"Starting selected services: {', '.join(services)}")
    else:
        print("Starting all local AI services...")
    
    cmd = ["docker", "compose", "-p", "localai"]
    if profile and profile != "none":
        cmd.extend(["--profile", profile])
    cmd.extend(["-f", "docker-compose.yml"])
    
    # Only include Supabase compose file if Supabase is enabled and the file exists
    if should_start_supabase(config) and os.path.exists("supabase/docker/docker-compose.yml"):
        cmd.extend(["-f", "supabase/docker/docker-compose.yml"])
    
    if environment and environment == "private":
        cmd.extend(["-f", "docker-compose.override.private.yml"])
    if environment and environment == "public":
        cmd.extend(["-f", "docker-compose.override.public.yml"])
    cmd.extend(["up", "-d"])
    
    # Add specific services if provided
    if services:
        cmd.extend(services)
    
    run_command(cmd)

def generate_searxng_secret_key():
    """Generate a secret key for SearXNG based on the current platform."""
    print("Checking SearXNG settings...")
    
    # Define paths for SearXNG settings files
    settings_path = os.path.join("searxng", "settings.yml")
    settings_base_path = os.path.join("searxng", "settings-base.yml")
    
    # Check if settings-base.yml exists
    if not os.path.exists(settings_base_path):
        print(f"Warning: SearXNG base settings file not found at {settings_base_path}")
        return
    
    # Check if settings.yml exists, if not create it from settings-base.yml
    if not os.path.exists(settings_path):
        print(f"SearXNG settings.yml not found. Creating from {settings_base_path}...")
        try:
            shutil.copyfile(settings_base_path, settings_path)
            print(f"Created {settings_path} from {settings_base_path}")
        except Exception as e:
            print(f"Error creating settings.yml: {e}")
            return
    else:
        print(f"SearXNG settings.yml already exists at {settings_path}")
    
    print("Generating SearXNG secret key...")
    
    # Detect the platform and run the appropriate command
    system = platform.system()
    
    try:
        if system == "Windows":
            print("Detected Windows platform, using PowerShell to generate secret key...")
            # PowerShell command to generate a random key and replace in the settings file
            ps_command = [
                "powershell", "-Command",
                "$randomBytes = New-Object byte[] 32; " +
                "(New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($randomBytes); " +
                "$secretKey = -join ($randomBytes | ForEach-Object { \"{0:x2}\" -f $_ }); " +
                "(Get-Content searxng/settings.yml) -replace 'ultrasecretkey', $secretKey | Set-Content searxng/settings.yml"
            ]
            subprocess.run(ps_command, check=True)
            
        elif system == "Darwin":  # macOS
            print("Detected macOS platform, using sed command with empty string parameter...")
            # macOS sed command requires an empty string for the -i parameter
            openssl_cmd = ["openssl", "rand", "-hex", "32"]
            random_key = subprocess.check_output(openssl_cmd).decode('utf-8').strip()
            sed_cmd = ["sed", "-i", "", f"s|ultrasecretkey|{random_key}|g", settings_path]
            subprocess.run(sed_cmd, check=True)
            
        else:  # Linux and other Unix-like systems
            print("Detected Linux/Unix platform, using standard sed command...")
            # Standard sed command for Linux
            openssl_cmd = ["openssl", "rand", "-hex", "32"]
            random_key = subprocess.check_output(openssl_cmd).decode('utf-8').strip()
            sed_cmd = ["sed", "-i", f"s|ultrasecretkey|{random_key}|g", settings_path]
            subprocess.run(sed_cmd, check=True)
            
        print("SearXNG secret key generated successfully.")
        
    except Exception as e:
        print(f"Error generating SearXNG secret key: {e}")
        print("You may need to manually generate the secret key using the commands:")
        print("  - Linux: sed -i \"s|ultrasecretkey|$(openssl rand -hex 32)|g\" searxng/settings.yml")
        print("  - macOS: sed -i '' \"s|ultrasecretkey|$(openssl rand -hex 32)|g\" searxng/settings.yml")
        print("  - Windows (PowerShell):")
        print("    $randomBytes = New-Object byte[] 32")
        print("    (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($randomBytes)")
        print("    $secretKey = -join ($randomBytes | ForEach-Object { \"{0:x2}\" -f $_ })")
        print("    (Get-Content searxng/settings.yml) -replace 'ultrasecretkey', $secretKey | Set-Content searxng/settings.yml")

def check_and_fix_docker_compose_for_searxng():
    """Check and modify docker-compose.yml for SearXNG first run."""
    docker_compose_path = "docker-compose.yml"
    if not os.path.exists(docker_compose_path):
        print(f"Warning: Docker Compose file not found at {docker_compose_path}")
        return
    
    try:
        # Read the docker-compose.yml file
        with open(docker_compose_path, 'r') as file:
            content = file.read()
        
        # Default to first run
        is_first_run = True
        
        # Check if Docker is running and if the SearXNG container exists
        try:
            # Check if the SearXNG container is running
            container_check = subprocess.run(
                ["docker", "ps", "--filter", "name=searxng", "--format", "{{.Names}}"],
                capture_output=True, text=True, check=True
            )
            searxng_containers = container_check.stdout.strip().split('\n')
            
            # If SearXNG container is running, check inside for uwsgi.ini
            if any(container for container in searxng_containers if container):
                container_name = next(container for container in searxng_containers if container)
                print(f"Found running SearXNG container: {container_name}")
                
                # Check if uwsgi.ini exists inside the container
                container_check = subprocess.run(
                    ["docker", "exec", container_name, "sh", "-c", "[ -f /etc/searxng/uwsgi.ini ] && echo 'found' || echo 'not_found'"],
                    capture_output=True, text=True, check=False
                )
                
                if "found" in container_check.stdout:
                    print("Found uwsgi.ini inside the SearXNG container - not first run")
                    is_first_run = False
                else:
                    print("uwsgi.ini not found inside the SearXNG container - first run")
                    is_first_run = True
            else:
                print("No running SearXNG container found - assuming first run")
        except Exception as e:
            print(f"Error checking Docker container: {e} - assuming first run")
        
        if is_first_run and "cap_drop: - ALL" in content:
            print("First run detected for SearXNG. Temporarily removing 'cap_drop: - ALL' directive...")
            # Temporarily comment out the cap_drop line
            modified_content = content.replace("cap_drop: - ALL", "# cap_drop: - ALL  # Temporarily commented out for first run")
            
            # Write the modified content back
            with open(docker_compose_path, 'w') as file:
                file.write(modified_content)
                
            print("Note: After the first run completes successfully, you should re-add 'cap_drop: - ALL' to docker-compose.yml for security reasons.")
        elif not is_first_run and "# cap_drop: - ALL  # Temporarily commented out for first run" in content:
            print("SearXNG has been initialized. Re-enabling 'cap_drop: - ALL' directive for security...")
            # Uncomment the cap_drop line
            modified_content = content.replace("# cap_drop: - ALL  # Temporarily commented out for first run", "cap_drop: - ALL")
            
            # Write the modified content back
            with open(docker_compose_path, 'w') as file:
                file.write(modified_content)
    
    except Exception as e:
        print(f"Error checking/modifying docker-compose.yml for SearXNG: {e}")

def load_custom_services_config():
    """Load the custom services configuration from the shared directory."""
    config_path = os.path.join("shared", "custom_services.json")
    
    if not os.path.exists(config_path):
        print(f"No custom services configuration found at {config_path}")
        print("Starting all services (default behavior)")
        return None
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        print(f"Loaded custom services configuration from {config_path}")
        return config
    except Exception as e:
        print(f"Error loading custom services configuration: {e}")
        print("Starting all services (default behavior)")
        return None

def get_enabled_services(config, profile='cpu'):
    """Extract enabled services from the configuration, handling profile-specific services."""
    if not config or 'services' not in config:
        return None
    
    enabled_services = []
    
    for category, services in config['services'].items():
        for service_id, service_config in services.items():
            if service_config.get('enabled', False):
                # Skip services with external_compose since they're handled separately
                if service_config.get('external_compose', False):
                    continue
                
                # Skip localai-ui as it runs independently 
                if service_id == 'localai-ui':
                    continue
                    
                # Handle profile-specific services (e.g., ollama variants)
                if 'profiles' in service_config and profile in service_config['profiles']:
                    actual_service_id = service_config['profiles'][profile]
                    enabled_services.append(actual_service_id)
                    
                    # Add pull services if they exist for this profile
                    if 'pull_services' in service_config and profile in service_config['pull_services']:
                        enabled_services.append(service_config['pull_services'][profile])
                else:
                    enabled_services.append(service_id)
    
    return enabled_services

def resolve_service_dependencies(config, enabled_services):
    """Resolve dependencies for enabled services."""
    if not config or not enabled_services:
        return enabled_services
    
    resolved_services = set(enabled_services)
    
    def add_dependencies(service_id):
        # Find the service in the configuration
        for category, services in config['services'].items():
            if service_id in services:
                service_config = services[service_id]
                dependencies = service_config.get('dependencies', [])
                
                for dep in dependencies:
                    if dep not in resolved_services:
                        # Find the dependency service configuration
                        dep_config = None
                        for dep_category, dep_services in config['services'].items():
                            if dep in dep_services:
                                dep_config = dep_services[dep]
                                break
                        
                        # Skip services with external_compose since they're handled separately
                        if dep_config and dep_config.get('external_compose', False):
                            continue
                            
                        resolved_services.add(dep)
                        add_dependencies(dep)  # Recursively resolve dependencies
                break
    
    # Resolve dependencies for all enabled services
    for service in list(enabled_services):
        add_dependencies(service)
    
    return list(resolved_services)

def should_start_supabase(config):
    """Check if Supabase should be started based on the configuration."""
    if not config:
        return True  # Default behavior
    
    # Check if supabase service is enabled
    supabase_config = config.get('services', {}).get('databases', {}).get('supabase', {})
    return supabase_config.get('enabled', False)

def should_start_searxng(config):
    """Check if SearXNG should be started based on the configuration."""
    if not config:
        return True  # Default behavior
    
    # Check if searxng service is enabled
    searxng_config = config.get('services', {}).get('utilities', {}).get('searxng', {})
    return searxng_config.get('enabled', False)

def main():
    parser = argparse.ArgumentParser(description='Start the local AI and Supabase services.')
    parser.add_argument('--profile', choices=['cpu', 'gpu-nvidia', 'gpu-amd', 'none'], default='cpu',
                      help='Profile to use for Docker Compose (default: cpu)')
    parser.add_argument('--environment', choices=['private', 'public'], default='private',
                      help='Environment to use for Docker Compose (default: private)')
    args = parser.parse_args()

    # Load custom services configuration
    config = load_custom_services_config()
    
    # Only clone and prepare Supabase if it's enabled in the configuration
    if should_start_supabase(config):
        clone_supabase_repo()
        prepare_supabase_env()
    
    # Generate SearXNG secret key and check docker-compose.yml only if SearXNG is enabled
    if should_start_searxng(config):
        generate_searxng_secret_key()
        check_and_fix_docker_compose_for_searxng()
    else:
        print("SearXNG is disabled in configuration. Skipping SearXNG setup...")
    
    stop_existing_containers(args.profile, config)
    
    # Check if Supabase should be started based on configuration
    if should_start_supabase(config):
        print("Supabase is enabled in configuration.")
        start_supabase(args.environment)
        
        # Give Supabase some time to initialize
        print("Waiting for Supabase to initialize...")
        time.sleep(10)
    else:
        print("Supabase is disabled in configuration. Skipping...")
    
    # Get enabled services from configuration
    enabled_services = get_enabled_services(config, args.profile)
    
    if enabled_services:
        # Resolve dependencies
        final_services = resolve_service_dependencies(config, enabled_services)
        print(f"Enabled services: {enabled_services}")
        print(f"With dependencies: {final_services}")
        
        # Start only the selected services
        start_local_ai(args.profile, args.environment, final_services, config)
    else:
        # No configuration or no enabled services - start all (default behavior)
        print("No custom configuration found or no services enabled.")
        print("Starting all services (default behavior)...")
        start_local_ai(args.profile, args.environment, None, config)

if __name__ == "__main__":
    main()
