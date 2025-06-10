# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive self-hosted AI development environment that combines multiple AI and automation tools into a unified Docker-based stack. The project allows developers to build and run AI workflows entirely on their own infrastructure, featuring n8n for workflow automation, Ollama for local LLM hosting, Supabase for backend services, and various supporting AI tools.

## Architecture

The system uses Docker Compose with profiles for different deployment scenarios:

### Core Services
- **n8n** (port 5678) - Main workflow automation platform and orchestrator
- **Ollama** (port 11434) - Local LLM hosting with GPU/CPU support  
- **Open WebUI** (port 3000) - ChatGPT-like interface for local models
- **LocalAI UI** (port 5001, backend 5002) - Web-based configurator with Docker monitoring, service selection, and environment management
- **Supabase** (ports 54321-54326) - Complete backend with Postgres, auth, real-time
- **Qdrant** (port 6333) - Vector database for RAG operations
- **Flowise** (port 3001) - No-code AI agent builder
- **SearXNG** (port 4000) - Privacy-focused metasearch engine
- **Caddy** (ports 80/443) - Reverse proxy with automatic HTTPS

### GPU Profiles
- `gpu-nvidia` - NVIDIA GPU support
- `gpu-amd` - AMD GPU support with ROCm
- `cpu` - CPU-only mode
- `none` - No local Ollama (for external instances)

### Environment Profiles  
- `private` (default) - All ports exposed for local development
- `public` - Only ports 80/443 exposed for production

## Common Commands

### Service Management
```bash
# Start all services (specify GPU type)
python start_services.py --profile gpu-nvidia    # NVIDIA GPU
python start_services.py --profile gpu-amd       # AMD GPU  
python start_services.py --profile cpu           # CPU only
python start_services.py --profile none          # No Ollama

# Stop all services
docker-compose down

# View service logs
docker-compose logs [service-name]

# Restart specific service
docker-compose restart [service-name]
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables (required before first run)
# Set POSTGRES_PASSWORD, JWT_SECRET, etc.
```

## Key Files and Configuration

### Main Orchestration
- `start_services.py` - Main startup script that handles Supabase setup, SearXNG initialization, and service orchestration
- `docker-compose.yml` - Core service definitions with GPU/environment profiles
- `Caddyfile` - Reverse proxy configuration with automatic HTTPS

### Environment Overrides
- `docker-compose.override.private.yml` - Development port mappings (default)
- `docker-compose.override.public.yml` - Production security configuration
- `docker-compose.override.public.supabase.yml` - Supabase production overrides

### Service Configuration
- `searxng/settings-base.yml` - Search engine configuration template
- `.env` - Environment variables for secrets and service configuration

## Development Workflow

### Initial Setup
1. Configure `.env` with required secrets (POSTGRES_PASSWORD, JWT_SECRET, etc.)
2. **Option A - Custom Configuration**:
   - Run `python start_services.py --profile [gpu-type]` to start all services including LocalAI UI
   - Access LocalAI UI at http://localhost:5001 to select desired services
   - Save configuration (creates `shared/custom_services.json`)
   - Restart with `python start_services.py --profile [gpu-type]` (now uses custom config)
3. **Option B - Default All Services**:
   - Run `python start_services.py --profile [gpu-type]` (starts all services)
4. Access n8n at http://localhost:5678 and configure credentials
5. Access Open WebUI at http://localhost:3000 and install n8n pipe function

### Service Configuration with LocalAI UI
- **Purpose**: Web interface for customizing which services to start without manual file editing
- **Access**: http://localhost:5001 (frontend) with backend API on port 5002
- **Architecture**: Service definitions in code + user preferences in JSON (separation of concerns)
- **Output**: Generates `custom_services.json` configuration file that controls service startup

### Platform-Specific Notes

#### macOS Compatibility
- **Port Configuration**: Uses ports 5001/5002 to avoid conflict with AirPlay receiver on port 5000
- **Docker Desktop**: Ensure Docker Desktop is running and has proper permissions
- **Socket Access**: May require Docker Desktop settings adjustment for socket access
- **Troubleshooting**: Check Docker group permissions if container monitoring doesn't work

#### LocalAI UI Configurator Features
1. **Service Orchestrator Tab**:
   - Visual service selection with modern toggle switches
   - Collapsible categories with individual and global "select all" functionality
   - Real-time dependency resolution (enabling N8N automatically enables PostgreSQL)
   - Profile selection (CPU/GPU variants)
   - Environment selection (development/production)
   - Service status monitoring integration

2. **Environment Variables Tab**:
   - Loads `.env.example` and parses commented/uncommented variables
   - Toggle switches to enable/disable optional environment variables
   - Automatic secret generation for passwords, JWT tokens, and encryption keys
   - Category-based organization of environment variables
   - Direct file save/load functionality

3. **Docker Monitoring Tab**:
   - Real-time container status (running/stopped/error)
   - Container logs viewing with live updates
   - Resource metrics (CPU, memory, network)
   - Container actions (start/stop/restart)
   - Service health checks and diagnostics

4. **Export/Import Tab** (Coming Soon):
   - Configuration export for sharing setups
   - Import configurations from files
   - Template management for common configurations

#### How Configuration Persistence Works
```javascript
// 1. Service definitions live in code (always current)
const serviceDefinitions = {
  ai_platforms: {
    n8n: {
      required: false,
      description: "Workflow automation platform",
      dependencies: ["n8n-import", "postgres"],
      category: "ai_platforms"
    }
  }
};

// 2. User preferences stored separately (only enabled/disabled state)
const userPreferences = {
  services: {
    ai_platforms: {
      n8n: { enabled: true }
    }
  }
};

// 3. Merged at runtime to create complete configuration
const mergedConfig = mergeServiceDefinitionsWithState(serviceDefinitions, userPreferences);
```

#### Integration with start_services.py
- LocalAI UI writes only user preferences to `shared/custom_services.json`
- `start_services.py` reads this file and applies service selection logic
- Dependency resolution ensures required services start automatically
- Profile selection determines which Ollama variant to start
- Environment selection applies appropriate Docker Compose overrides

### Configuration-Driven Startup
The system uses a sophisticated configuration management approach with `custom_services.json`:

#### How the Configurator Works
1. **Service Definitions**: Hard-coded in `localai-ui/src/data/serviceDefinitions.ts` as single source of truth
2. **User Preferences**: Stored in `shared/custom_services.json` with only enabled/disabled state
3. **Merging Logic**: LocalAI UI merges definitions with preferences to create complete configuration
4. **Persistence**: Only user preferences are saved, ensuring service definitions stay current

#### Custom Services JSON Structure
```json
{
  "version": "1.0",
  "description": "Configuration file for customizing which services to start",
  "services": {
    "ai_platforms": {
      "n8n": {
        "enabled": true,
        "required": false,
        "description": "Workflow automation platform",
        "category": "ai_platforms",
        "dependencies": ["n8n-import", "postgres"]
      },
      "flowise": {
        "enabled": false,
        "required": false,
        "description": "No-code AI agent builder",
        "category": "ai_platforms", 
        "dependencies": []
      }
    },
    "llm_services": {
      "ollama": {
        "enabled": true,
        "profiles": {
          "cpu": "ollama-cpu",
          "gpu-nvidia": "ollama-gpu",
          "gpu-amd": "ollama-rocm"
        },
        "dependencies": []
      }
    },
    "databases": {
      "supabase": {
        "enabled": true,
        "external_compose": true,
        "compose_path": "supabase/docker/docker-compose.yml",
        "dependencies": ["postgres", "redis", "minio"]
      }
    }
  },
  "profiles": {
    "cpu": { "description": "CPU-only processing", "default": true },
    "gpu-nvidia": { "description": "NVIDIA GPU acceleration", "default": false },
    "gpu-amd": { "description": "AMD GPU acceleration", "default": false },
    "none": { "description": "No local Ollama", "default": false }
  },
  "environments": {
    "private": { "description": "Development with all ports exposed", "default": true },
    "public": { "description": "Production with only 80/443 exposed", "default": false }
  }
}
```

#### Configuration Processing Flow
1. **Startup Check**: `start_services.py` checks for `shared/custom_services.json`
2. **Fallback Behavior**: If no config exists, all services start (backward compatibility)
3. **Service Selection**: If config exists, only enabled services start
4. **Dependency Resolution**: Dependencies automatically included even if not explicitly enabled
5. **Profile Handling**: GPU/CPU variants selected based on `--profile` argument
6. **Environment Application**: Development vs production configurations applied

#### Key Configuration Features
- **Location**: `shared/custom_services.json` (created by LocalAI UI)
- **Fallback**: If no configuration exists, all services start (default behavior)
- **Dependencies**: Automatically includes required dependencies for selected services
- **Profiles**: Handles GPU-specific Ollama services based on `--profile` argument
- **Supabase**: Conditionally starts entire Supabase stack based on service selection
- **External Compose**: Supports services with separate Docker Compose files
- **Transitive Dependencies**: Resolves multi-level dependencies automatically

### Working with Workflows
- n8n workflows are auto-imported from `n8n/backup/workflows/`
- Flowise chatflows can be imported from `flowise/` directory
- Tool workflows for n8n are in `n8n-tool-workflows/`

### Manual Configuration Editing
For advanced users who prefer to edit configuration directly:

- **File**: `shared/custom_services.json`
- **Schema**: JSON object with service categories, dependencies, and profiles
- **Services**: Organized by category (core, ai_platforms, llm_services, databases, monitoring, utilities)
- **Dependencies**: Automatically resolved when services are enabled
- **Profiles**: GPU/CPU variants handled automatically for Ollama services

Example service configuration:
```json
{
  "services": {
    "ai_platforms": {
      "n8n": {
        "enabled": true,
        "dependencies": ["n8n-import"]
      }
    }
  }
}
```

### File Operations
- Use `/data/shared` mount point for file operations between services
- Shared directory is accessible across all containers

## Integration Points

### n8n Custom Tools
The project includes pre-built n8n workflows for:
- **Create_Google_Doc.json** - Google Workspace document creation
- **Get_Postgres_Tables.json** - Database table access
- **Post_Message_to_Slack.json** - Slack integration
- **Summarize_Slack_Conversation.json** - Slack conversation analysis

### Open WebUI Integration
- `n8n_pipe.py` - Custom function that bridges Open WebUI chat with n8n workflows
- Allows direct access to n8n AI agents from the chat interface

### Cross-Platform Compatibility
The `start_services.py` script handles platform-specific differences:
- Windows PowerShell commands
- macOS Docker Desktop considerations  
- Linux native Docker support

## Service Dependencies

Services must start in order:
1. **Supabase** (database and auth foundation)
2. **Supporting services** (Redis, ClickHouse, MinIO)
3. **AI services** (Ollama, n8n, Open WebUI, Flowise)

The startup script handles this orchestration automatically.