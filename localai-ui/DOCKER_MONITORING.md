# Docker Container Monitoring

The LocalAI UI includes a built-in Docker container monitoring feature that allows you to view, manage, and monitor Docker containers directly from the web interface.

## Features

- **Real-time Container Monitoring**: View container status, uptime, and resource usage
- **Container Management**: Start, stop, and restart containers
- **Live Log Streaming**: View container logs with filtering and search
- **Resource Metrics**: Monitor CPU, memory, network, and disk I/O usage
- **Responsive UI**: Works on desktop and mobile devices

## Setup

### Prerequisites

1. Docker must be running on your system
2. The LocalAI UI container needs access to the Docker socket
3. Proper permissions must be configured for Docker socket access

### Quick Setup

Run the setup script to automatically configure Docker permissions:

```bash
cd localai-ui
./setup-docker-permissions.sh
```

Then start the service:

```bash
docker-compose up --build
```

### Manual Setup

1. **Get your Docker group ID:**
   ```bash
   stat -c '%g' /var/run/docker.sock
   ```

2. **Create or update `.env` file:**
   ```bash
   echo "DOCKER_GROUP_ID=999" > .env  # Replace 999 with your actual Docker group ID
   ```

3. **Start the service:**
   ```bash
   docker-compose up --build
   ```

## Troubleshooting

### Permission Denied (EACCES)

**Error:** `connect EACCES /var/run/docker.sock`

**Solutions:**

1. **Run the setup script:**
   ```bash
   ./setup-docker-permissions.sh
   ```

2. **Check Docker group ID:**
   ```bash
   stat -c '%g' /var/run/docker.sock
   ```
   Update the `DOCKER_GROUP_ID` in your `.env` file with this value.

3. **Add your user to docker group (Linux):**
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in, or restart your shell
   ```

4. **Verify Docker is running:**
   ```bash
   docker info
   ```

### Docker Socket Not Found

**Error:** `Docker socket not found`

**Solutions:**

1. **Start Docker:**
   - **Linux:** `sudo systemctl start docker`
   - **macOS/Windows:** Start Docker Desktop

2. **Verify socket exists:**
   ```bash
   ls -la /var/run/docker.sock
   ```

3. **Check Docker Compose volume mount:**
   ```yaml
   volumes:
     - /var/run/docker.sock:/var/run/docker.sock:ro
   ```

### Container Not Building

**Error:** Build failures or dependency issues

**Solutions:**

1. **Clean rebuild:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up
   ```

2. **Check logs:**
   ```bash
   docker-compose logs localai-ui
   ```

## Platform-Specific Notes

### Linux
- Standard Docker socket path: `/var/run/docker.sock`
- User must be in `docker` group or run with sudo

### macOS (Docker Desktop)
- Docker socket is automatically available
- May need to enable "Allow the default Docker socket to be used" in Docker Desktop settings

### Windows (Docker Desktop)
- When using WSL2, ensure Docker integration is enabled for your WSL distribution
- May need to use Docker Desktop's built-in permissions

### Windows (native)
- Use named pipe instead of socket (not currently supported)
- Recommended to use WSL2 + Docker Desktop

## Security Considerations

- The container runs with minimal privileges using the `node` user
- Only read-only access to Docker socket is granted
- Container actions are limited to basic lifecycle operations
- No access to Docker image management or system configuration

## API Endpoints

The monitoring feature exposes these API endpoints:

- `GET /api/docker/containers` - List all containers
- `GET /api/docker/containers/:id/stats` - Get container resource stats
- `GET /api/docker/containers/:id/logs` - Get container logs
- `POST /api/docker/containers/:id/action` - Perform container action (start/stop/restart)
- `GET /api/docker/status` - Check Docker daemon connectivity

## Configuration

The monitoring feature can be configured via environment variables:

```env
# Docker group ID for socket access (auto-detected by setup script)
DOCKER_GROUP_ID=999

# API endpoints (automatically configured)
VITE_API_URL=http://localhost:5001
PORT=5001
NODE_ENV=production
```

## Disabling Monitoring

If you don't want to use the monitoring feature:

1. Remove the Docker socket volume mount from `docker-compose.yml`
2. The monitoring tab will show an error message but won't affect other functionality
3. Alternatively, don't include the `DOCKER_GROUP_ID` environment variable

## Integration with Parent Project

When used as part of the larger LocalAI project, the monitoring feature can monitor all services in the stack including:

- n8n workflow automation
- Ollama LLM services  
- Open WebUI interface
- Supabase backend services
- Qdrant vector database
- And other configured services

This provides a centralized monitoring dashboard for the entire AI development environment.