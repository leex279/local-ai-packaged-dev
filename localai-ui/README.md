# LocalAI UI Configurator

A user-friendly web interface for configuring and managing your local AI services. This tool provides an intuitive way to select services, manage dependencies, and orchestrate your local AI stack through an integrated configuration system.

## Features

### 🎯 **Service Orchestrator (New!)**
- **Visual Service Management**: Configure which services to start with an intuitive interface
- **Profile Selection**: Easy switching between CPU, GPU-NVIDIA, and GPU-AMD configurations
- **Environment Management**: Choose between development (private) and production (public) modes
- **Dependency Resolution**: Automatic handling of service dependencies
- **Real-time Status**: Monitor service health and status (extensible)
- **Persistent Configuration**: Saves to `custom_services.json` for integration with startup scripts


### ⚙️ **Environment Configuration**
- **Environment Variable Management**: Configure your `.env` file through a user-friendly interface
- **Validation**: Ensure required variables are set correctly
- **Template Support**: Load from existing environment files

## Quick Start

### Prerequisites
- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Python 3** (for the start script)

### Easy Start (Recommended)
```bash
# Navigate to the localai-ui directory
cd localai-ui

# Run the start script (auto-installs dependencies and opens browser)
python start_configurator.py
```

The script will:
1. ✅ Check and install dependencies automatically
2. 🏗️ Set up required directories
3. 🔧 Start the backend server (port 3001)
4. 🎨 Start the frontend server (port 3000)
5. 🌐 Automatically open your browser

### Manual Start
If you prefer to start services manually:

```bash
# Install dependencies
npm install
cd backend && npm install && cd ..

# Start backend (terminal 1)
cd backend
npm start

# Start frontend (terminal 2)
npm run dev
```

Then open http://localhost:3000 in your browser.

## Usage Guide

### 1. Service Orchestrator Tab
- **Select Services**: Check the services you want to include in your stack
- **Choose Profile**: Select CPU, GPU-NVIDIA, or GPU-AMD based on your hardware
- **Set Environment**: Choose between private (development) or public (production)
- **Save Configuration**: Click "Save Configuration" to persist your choices
- **Start Services**: Use "Start Selected Services" to launch your stack (requires integration)

### 2. Environment Variables Tab
- **Configure Variables**: Set required environment variables
- **Load Templates**: Import from existing `.env` files
- **Save Configuration**: Export your environment configuration

## Service Categories

### 🤖 **AI Platforms**
- **n8n**: Workflow automation platform
- **Flowise**: No-code AI agent builder
- **Open WebUI**: ChatGPT-like interface for local models

### 🧠 **LLM Services**
- **Ollama**: Local LLM hosting (CPU/GPU variants)

### 🗄️ **Databases**
- **Supabase**: Complete backend with Postgres, auth, real-time
- **Qdrant**: Vector database for RAG operations
- **Neo4j**: Graph database for knowledge graphs
- **PostgreSQL**: Traditional relational database
- **Redis**: Caching and session storage
- **ClickHouse**: Analytics database

### 📊 **Monitoring**
- **Langfuse**: LLM observability and analytics

### 🔧 **Infrastructure**
- **Caddy**: Reverse proxy with automatic HTTPS

### 🛠️ **Utilities**
- **SearXNG**: Privacy-focused metasearch engine
- **MinIO**: S3-compatible object storage

## Configuration Files

### Input Files
- `input/env`: Template environment variables

### Output Files
- `output/.env`: Generated environment configuration
- `../shared/custom_services.json`: Service orchestration configuration

## Integration with start_services.py

The Service Orchestrator creates a `custom_services.json` file that can be used with the main `start_services.py` script:

```bash
# After configuring services in the UI
cd ..
python start_services.py --profile gpu-nvidia --environment private
```

The startup script will read your saved configuration and start only the selected services.

## API Endpoints

The backend provides several REST API endpoints:

- `GET /api/custom-services`: Load service configuration
- `POST /api/custom-services`: Save service configuration  
- `GET /api/service-status`: Get current service status
- `POST /api/start-services`: Start selected services
- `POST /api/stop-services`: Stop services
- `GET /api/status`: Check backend health

## Development

### Project Structure
```
localai-ui/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript type definitions
│   └── data/               # Service definitions
├── backend/                # Backend API server
├── input/                  # Template/reference files
├── output/                 # Generated configurations
└── start_configurator.py  # Launch script
```

### Building for Production
```bash
npm run build
```

### Running Tests
```bash
npm test
```

## Troubleshooting

### Common Issues

**"Module not found" errors**
```bash
# Reinstall dependencies
rm -rf node_modules backend/node_modules
npm install
cd backend && npm install
```

**Port conflicts**
```bash
# Check if ports 3000 or 3001 are in use
lsof -i :3000
lsof -i :3001
```

**Permission errors on Windows**
```bash
# Run as administrator or use PowerShell
python start_configurator.py
```

**Services not starting**
- Check that Docker is running
- Verify volume mounts in the parent docker-compose.yml
- Check backend logs for detailed error messages

### Getting Help

1. Check the browser console for frontend errors
2. Check the terminal output for backend logs
3. Verify your `input/` directory has the required template files
4. Ensure Docker is running if testing service orchestration

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the local-ai-packaged ecosystem. Please refer to the main project license.