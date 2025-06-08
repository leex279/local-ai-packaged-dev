# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocalAI UI Configurator is a React-based web application that provides a user-friendly interface for configuring and managing local AI services. It serves as a visual configurator that generates Docker Compose configurations and integrates with the parent `start_services.py` orchestration system through `custom_services.json` persistence.

## Architecture

### Two-Tab Application Structure
1. **Service Orchestrator** - Visual service management with `custom_services.json` integration
2. **Environment Variables** - Configuration management for `.env` files

### Key Components Architecture
- **Frontend**: React + TypeScript + Tailwind CSS (port 3000)
- **Backend**: Express.js API server (port 3001)
- **Integration**: Persists to `../shared/custom_services.json` for parent startup script consumption

### Service Orchestration Flow
```
User configures services → ServiceOrchestrator component → Backend API → custom_services.json → start_services.py reads config
```

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
- `src/App.tsx` - Main application with tab routing and state management
- `src/components/ServiceOrchestrator.tsx` - Primary service configuration interface
- `src/utils/serviceOrchestration.ts` - Service management utilities and API client
- `backend/server.js` - Express API server with file operations

### Configuration Management
- `src/types/index.ts` - TypeScript interfaces for `CustomServicesJson` and service definitions
- `src/data/services.ts` - Service definitions and default configuration
- `input/docker-compose.yml` - Reference template for service definitions
- `output/` - Generated configurations (compose files, env files)
- `../shared/custom_services.json` - Persisted service configuration for parent orchestration

### API Integration
Backend provides REST endpoints:
- `GET/POST /api/custom-services` - Service configuration persistence
- `GET /api/service-status` - Service monitoring (extensible for Docker integration)
- `POST /api/start-services` - Service orchestration (placeholder for script integration)

## Development Workflow

### Service Configuration Architecture
The application uses a single unified approach:
- **Orchestrator Mode**: `custom_services.json` persistence for integration with parent `start_services.py`

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
- **core**: Infrastructure services (localai-ui, caddy)
- **ai_platforms**: AI workflow tools (n8n, flowise, open-webui)
- **llm_services**: Language model hosting (ollama with profile variants)
- **databases**: Data storage (supabase, qdrant, postgres, redis, etc.)
- **monitoring**: Observability tools (langfuse)
- **utilities**: Supporting services (searxng, minio)

Each service configuration includes:
- Dependency declarations
- Profile-specific variants
- External compose file handling
- Pull service definitions for model downloads