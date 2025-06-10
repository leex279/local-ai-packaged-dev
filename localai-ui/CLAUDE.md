# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocalAI UI Configurator is a React-based web application that provides a user-friendly interface for configuring and managing local AI services. It serves as a visual configurator that generates Docker Compose configurations and integrates with the parent `start_services.py` orchestration system through `custom_services.json` persistence.

## Architecture

### Four-Tab Application Structure
1. **Service Orchestrator** - Visual service management with intelligent dependency resolution
2. **Environment Variables** - Configuration management for `.env` files
3. **Monitoring** - Real-time Docker container monitoring and management
4. **Export/Import** - Configuration export/import functionality (coming soon)

### Key Components Architecture
- **Frontend**: React + TypeScript + Tailwind CSS (port 3000)
- **Backend**: Express.js API server (port 3001)
- **Integration**: Persists to `../shared/custom_services.json` for parent startup script consumption

### Service Orchestration Flow
```
Service definitions (serviceDefinitions.ts) + User preferences (custom_services.json)
↓
ServiceOrchestrator component merges definitions with state
↓  
Backend API persists only user preferences
↓
start_services.py reads config and starts selected services
```

### Architectural Separation
- **Service Definitions**: Stored in code (`src/data/serviceDefinitions.ts`) - single source of truth
- **User Preferences**: Stored in configuration files (enabled/disabled state only)
- **Dependency Resolution**: Automatic based on real Docker Compose requirements

## Common Commands

### Development Setup
```bash
# Quick start (recommended)
python start_configurator.py

# Manual development setup
npm install && cd backend && npm install && cd ..
npm run dev                    # Frontend dev server
cd backend && npm start        # Backend API server

# Production build
npm run build
npm run preview               # Preview production build
```

### Linting and Code Quality
```bash
npm run lint                  # ESLint with TypeScript rules
```

### Backend Development
```bash
cd backend
npm start                     # Start Express server on port 3001
```

## Key Files and Configuration

### Core Architecture Files
- `src/App.tsx` - Main application with four-tab routing and state management
- `src/components/ServiceOrchestrator.tsx` - Primary service configuration interface
- `src/components/Monitoring/MonitoringDashboard.tsx` - Docker container monitoring interface
- `src/utils/serviceOrchestration.ts` - Service management utilities and API client
- `backend/server.js` - Express API server with file operations and Docker integration

### Configuration Management
- `src/types/index.ts` - TypeScript interfaces for `CustomServicesJson` and service definitions
- `src/data/serviceDefinitions.ts` - **NEW**: Single source of truth for service definitions
- `src/data/services.ts` - Legacy service definitions (being phased out)
- `input/docker-compose.yml` - Reference template for service definitions
- `output/` - Generated configurations (compose files, env files)
- `../shared/custom_services.json` - Persisted user preferences for parent orchestration

### API Integration
Backend provides REST endpoints:
- `GET/POST /api/custom-services` - Legacy service configuration persistence  
- `GET/POST /api/service-state` - **NEW**: User preference persistence (enabled/disabled state only)
- `GET /api/service-status` - Service monitoring (extensible for Docker integration)
- `POST /api/start-services` - Service orchestration (placeholder for script integration)
- `GET /api/docker/*` - **NEW**: Docker container monitoring, logs, stats, and actions

## Development Workflow

### Service Configuration Architecture
The application uses a **separation of concerns** approach:
- **Service Definitions**: Hard-coded in `serviceDefinitions.ts` with accurate dependencies from Docker analysis
- **User Preferences**: Stored in `custom_services.json` with only enabled/disabled state
- **Dependency Resolution**: Automatic based on real container requirements (N8N → PostgreSQL, Langfuse → multiple databases)

### Custom Services JSON Schema
Services are organized hierarchically:
```json
{
  "services": {
    "ai_platforms": { "n8n": { "enabled": true, "dependencies": ["n8n-import"] } },
    "llm_services": { "ollama": { "profiles": { "cpu": "ollama-cpu", "gpu-nvidia": "ollama-gpu" } } },
    "databases": { "supabase": { "external_compose": true } }
  },
  "profiles": { "cpu": { "default": true }, "gpu-nvidia": { "default": false } },
  "environments": { "private": { "default": true }, "public": { "default": false } }
}
```

### Profile and Environment Handling
- **Profiles**: Handle GPU variants (cpu, gpu-nvidia, gpu-amd, none)
- **Environments**: Development (private) vs production (public) configurations
- **Service Variants**: Profile-specific service IDs (e.g., ollama-cpu vs ollama-gpu)

### Dependency Resolution
The system automatically resolves service dependencies:
- Transitive dependency inclusion
- Circular dependency prevention
- Profile-aware dependency mapping
- Required vs optional service handling

## Integration Points

### Parent Project Integration
- Saves configuration to `../shared/custom_services.json`
- Compatible with parent `start_services.py` service selection logic
- Provides beginner-friendly interface for advanced orchestration system

### File System Integration
- **Input templates**: `input/env`
- **Generated outputs**: `output/.env`
- **Shared configuration**: `../shared/custom_services.json`

### API Extension Points
Backend API is designed for future Docker integration:
- Service status monitoring endpoints ready for Docker API integration
- Service start/stop endpoints prepared for `start_services.py` subprocess calls
- Real-time status updates architecture in place

## Service Categories and Types

Services are categorized for UI organization:
- **core**: Infrastructure services (caddy) - localai-ui removed as it runs independently
- **ai_platforms**: AI workflow tools (n8n, flowise, open-webui) with proper dependencies
- **llm_services**: Language model hosting (ollama with profile variants)
- **databases**: Data storage (supabase, qdrant, postgres, redis, etc.)
- **monitoring**: Observability tools (langfuse with full dependency chain)
- **utilities**: Supporting services (searxng, minio)

Each service configuration includes:
- **Accurate dependency declarations** based on real Docker Compose analysis
- Profile-specific variants (CPU/GPU alternatives)
- External compose file handling (Supabase)
- Pull service definitions for model downloads

## Troubleshooting

### Docker Socket Permission Issues (macOS/Linux)

If you encounter Docker socket permission errors:

**macOS:**
1. Make sure Docker Desktop is running
2. Try restarting Docker Desktop
3. Check Docker Desktop settings → Advanced → Allow the default Docker socket to be used
4. If running in container, the LocalAI UI may need specific Docker group permissions

**Linux:**
1. Add your user to the docker group: `sudo usermod -aG docker $USER`
2. Restart your terminal session or run: `newgrp docker`
3. Start Docker daemon if not running: `sudo systemctl start docker`
4. Check Docker socket permissions: `ls -la /var/run/docker.sock`

**Cross-platform Docker Socket Configuration:**
- Set `DOCKER_SOCKET_PATH` environment variable if using non-standard socket location
- Set `DOCKER_HOST` for remote Docker connections
- Set `DOCKER_GROUP_ID` to match your system's docker group ID

### Port Conflicts

**macOS Port 5000 Conflict:**
- Port 5000 is used by AirPlay receiver on macOS by default
- LocalAI UI is configured to use ports 5001/5002 to avoid this conflict
- Access the UI at http://localhost:5001 instead of 5000

### Profile Selection Persistence

**GPU Profile Not Saving:**
- Ensure you click "Save Configuration" after selecting your GPU profile
- Profile selection is now persisted in `custom_services.json`
- Check the configuration file in `shared/custom_services.json` for saved preferences

## Recent Major Changes

### Architecture Refactoring (v2024.12)
- **Separation of Concerns**: Service definitions now live in code, not configuration files
- **Accurate Dependencies**: Dependencies reflect real Docker requirements (N8N → Supabase)
- **Future-Proof**: New services automatically appear when added to `serviceDefinitions.ts`
- **Docker Monitoring**: Full container lifecycle management added
- **Cross-platform Compatibility**: Improved Docker socket detection and platform-specific error handling
- **Export/Import Planning**: Framework for configuration portability

### Key Improvements
- ✅ **Fixed Dependency Issues**: N8N now correctly depends on Supabase (not Postgres)
- ✅ **Auto-disable Dependencies**: n8n-import automatically disables when n8n is disabled
- ✅ **Profile Persistence**: GPU profile selection now saves and restores properly
- ✅ **Cross-platform File Paths**: Fixed Windows path separator issues in startup scripts
- ✅ **Enhanced Docker Support**: Better socket detection, error messages, and Mac compatibility
- ✅ **Removed LocalAI UI Self-Reference**: Service no longer appears in its own interface
- ✅ **Real-time Monitoring**: Docker container status, logs, metrics, and actions
- ✅ **Environment Variable Toggles**: Optional settings with enable/disable functionality
- ✅ **Backward Compatibility**: Legacy endpoints maintained during transition