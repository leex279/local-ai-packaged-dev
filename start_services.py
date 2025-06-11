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

def get_directory_size(path):
    """Get the size of a directory in MB."""
    try:
        total_size = 0
        for dirpath, dirnames, filenames in os.walk(path):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                if os.path.exists(filepath):
                    total_size += os.path.getsize(filepath)
        return total_size / (1024 * 1024)  # Convert to MB
    except Exception:
        return 0

def list_cleanup_items():
    """List all items that will be deleted during cleanup."""
    items = []
    
    # Docker resources
    items.append("Docker Resources:")
    items.append("  ✓ All containers for project 'localai'")
    
    # Get list of Docker volumes
    try:
        result = subprocess.run(["docker", "volume", "ls", "-q"], 
                              capture_output=True, text=True, check=False)
        volumes = [v for v in result.stdout.strip().split('\n') if v and 'localai' in v]
        if volumes:
            items.append(f"  ✓ {len(volumes)} Docker volumes (n8n_storage, ollama_storage, ...)")
        else:
            items.append("  ✓ Docker volumes (if any exist)")
    except Exception:
        items.append("  ✓ Docker volumes (if any exist)")
    
    items.append("  ✓ Docker networks for project 'localai'")
    items.append("")
    
    # Host directories
    items.append("Host Directories:")
    directories = [
        ("./supabase/", "Supabase repository"),
        ("./neo4j/", "Neo4j database and logs"),
        ("./shared/", "Shared files and configuration"),
        ("./localai-ui/node_modules/", "LocalAI UI frontend dependencies"),
        ("./localai-ui/backend/node_modules/", "LocalAI UI backend dependencies"),
        ("./localai-ui/dist/", "LocalAI UI built assets"),
        ("./localai-ui/output/", "LocalAI UI output files"),
    ]
    
    for dir_path, description in directories:
        if os.path.exists(dir_path):
            size = get_directory_size(dir_path)
            items.append(f"  ✓ {dir_path} ({description}) - {size:.1f} MB")
        else:
            items.append(f"  ✓ {dir_path} ({description}) - Not found")
    
    items.append("")
    
    # Configuration files
    items.append("Configuration Files:")
    config_files = [
        ("./searxng/settings.yml", "SearXNG generated settings"),
        ("./supabase/docker/.env", "Supabase environment file"),
    ]
    
    for file_path, description in config_files:
        if os.path.exists(file_path):
            items.append(f"  ✓ {file_path} ({description})")
        else:
            items.append(f"  ✓ {file_path} ({description}) - Not found")
    
    return items

def parse_env_file(file_path):
    """Parse an environment file and return a dictionary of variables."""
    env_vars = {}
    if not os.path.exists(file_path):
        return env_vars
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                # Skip empty lines and comments
                if not line or line.startswith('#'):
                    continue
                
                # Handle KEY=value format
                if '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    # Remove quotes if present
                    if value.startswith('"') and value.endswith('"'):
                        value = value[1:-1]
                    elif value.startswith("'") and value.endswith("'"):
                        value = value[1:-1]
                    env_vars[key] = value
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
    
    return env_vars

def validate_env_file():
    """Validate .env file against .env.example and return missing/extra variables."""
    env_path = ".env"
    example_path = ".env.example"
    
    if not os.path.exists(env_path):
        return None, f".env file not found at {env_path}"
    
    if not os.path.exists(example_path):
        return None, f".env.example file not found at {example_path}"
    
    current_vars = parse_env_file(env_path)
    example_vars = parse_env_file(example_path)
    
    missing_vars = set(example_vars.keys()) - set(current_vars.keys())
    extra_vars = set(current_vars.keys()) - set(example_vars.keys())
    
    return {
        'missing': list(missing_vars),
        'extra': list(extra_vars),
        'current_vars': current_vars,
        'example_vars': example_vars
    }, None

def update_env_file(missing_vars, example_vars):
    """Add missing variables to .env file."""
    env_path = ".env"
    
    try:
        # Read current .env file
        with open(env_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Add missing variables at the end
        if missing_vars:
            content += "\n# Added missing variables from .env.example\n"
            for var in missing_vars:
                value = example_vars.get(var, '')
                content += f"{var}={value}\n"
        
        # Write back to file
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return True
    except Exception as e:
        print(f"Error updating .env file: {e}")
        return False

def confirm_cleanup():
    """Ask user for confirmation and show what will be deleted."""
    print("\\033[91mWARNING: This will permanently delete ALL data from the local AI stack!\\033[0m\\n")
    
    items = list_cleanup_items()
    print("The following will be PERMANENTLY DELETED:")
    for item in items:
        print(item)
    
    print("\\nAre you ABSOLUTELY SURE you want to delete all this data? [y/N]: ", end="")
    response = input().strip().lower()
    return response in ['y', 'yes']

def clean_docker_resources():
    """Clean up Docker containers, volumes, and networks."""
    print("Cleaning Docker resources...")
    
    try:
        # Stop and remove containers with volumes
        print("  Stopping and removing containers...")
        subprocess.run([
            "docker", "compose", "-p", "localai", "down", "-v", "--remove-orphans"
        ], check=False, capture_output=True)
        
        # Remove any remaining volumes with localai in the name
        print("  Removing volumes...")
        result = subprocess.run(["docker", "volume", "ls", "-q"], 
                              capture_output=True, text=True, check=False)
        volumes = [v for v in result.stdout.strip().split('\\n') if v and 'localai' in v]
        
        for volume in volumes:
            subprocess.run(["docker", "volume", "rm", volume], check=False, capture_output=True)
        
        # Remove networks
        print("  Removing networks...")
        result = subprocess.run(["docker", "network", "ls", "--filter", "name=localai", "-q"], 
                              capture_output=True, text=True, check=False)
        networks = [n for n in result.stdout.strip().split('\\n') if n]
        
        for network in networks:
            subprocess.run(["docker", "network", "rm", network], check=False, capture_output=True)
            
    except Exception as e:
        print(f"  Warning: Some Docker cleanup operations failed: {e}")

def clean_host_directories():
    """Clean up host directories."""
    print("Cleaning host directories...")
    
    directories = [
        "./supabase/",
        "./neo4j/",
        "./shared/",
        "./localai-ui/node_modules/",
        "./localai-ui/backend/node_modules/",
        "./localai-ui/dist/",
        "./localai-ui/output/",
    ]
    
    for directory in directories:
        if os.path.exists(directory):
            try:
                print(f"  Removing {directory}...")
                shutil.rmtree(directory)
            except Exception as e:
                print(f"  Warning: Failed to remove {directory}: {e}")

def clean_config_files():
    """Clean up configuration files."""
    print("Cleaning configuration files...")
    
    files = [
        "./searxng/settings.yml",
        "./supabase/docker/.env",
    ]
    
    for file_path in files:
        if os.path.exists(file_path):
            try:
                print(f"  Removing {file_path}...")
                os.remove(file_path)
            except Exception as e:
                print(f"  Warning: Failed to remove {file_path}: {e}")

def handle_env_file():
    """Handle .env file deletion and validation."""
    env_path = ".env"
    
    if not os.path.exists(env_path):
        print("No .env file found.")
        return
    
    print(f"\\nDo you also want to delete the .env file? This contains your passwords and secrets. [y/N]: ", end="")
    response = input().strip().lower()
    
    if response in ['y', 'yes']:
        try:
            os.remove(env_path)
            print("Deleted .env file.")
        except Exception as e:
            print(f"Warning: Failed to delete .env file: {e}")
    else:
        print("\\nKeeping .env file. Validating against .env.example...")
        
        validation_result, error = validate_env_file()
        if error:
            print(f"⚠️  {error}")
            return
        
        missing_vars = validation_result['missing']
        extra_vars = validation_result['extra']
        
        print("✓ Found .env file")
        print("✓ Found .env.example template")
        
        if missing_vars:
            print(f"⚠️  Missing variables in .env:")
            for var in missing_vars:
                print(f"   - {var}")
            
            print(f"\\nWould you like to add the missing variables to .env? [y/N]: ", end="")
            response = input().strip().lower()
            
            if response in ['y', 'yes']:
                if update_env_file(missing_vars, validation_result['example_vars']):
                    print("✓ Updated .env file with missing variables (preserved existing values).")
                else:
                    print("⚠️  Failed to update .env file.")
        else:
            print("✓ All required variables present")
        
        if extra_vars:
            print(f"ℹ️  Extra variables in .env (not in template):")
            for var in extra_vars:
                print(f"   - {var}")

def perform_cleanup():
    """Perform the complete cleanup process."""
    if not confirm_cleanup():
        print("Cleanup cancelled.")
        sys.exit(0)
    
    print("\\nProceeding with cleanup...")
    
    # Clean Docker resources
    clean_docker_resources()
    
    # Clean host directories
    clean_host_directories()
    
    # Clean configuration files
    clean_config_files()
    
    # Handle .env file separately
    handle_env_file()

def main():
    parser = argparse.ArgumentParser(description='Start the local AI and Supabase services.')
    parser.add_argument('--profile', choices=['cpu', 'gpu-nvidia', 'gpu-amd', 'none'], default='cpu',
                      help='Profile to use for Docker Compose (default: cpu)')
    parser.add_argument('--environment', choices=['private', 'public'], default='private',
                      help='Environment to use for Docker Compose (default: private)')
    parser.add_argument('--clean', action='store_true',
                      help='Perform a clean install by removing all existing data and containers')
    args = parser.parse_args()

    # Handle clean option
    if args.clean:
        perform_cleanup()
        print("\nCleanup completed. Starting fresh installation...\n")

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
