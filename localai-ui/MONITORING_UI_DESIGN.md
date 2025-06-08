# Docker Container Monitoring UI Design

## Overview

This document outlines the design and architecture for a new "Monitoring" tab within the LocalAI UI that provides basic Docker container monitoring and management capabilities. The goal is to create a lightweight alternative to Portainer or Docker Desktop with essential features focused on the LocalAI project's Docker services.

## Architecture

### Integration with Existing LocalAI UI

#### Tab Structure Extension
```typescript
// App.tsx - Extended tab management
type TabType = 'env' | 'orchestrator' | 'monitoring';
const [activeTab, setActiveTab] = useState<TabType>('orchestrator');
```

#### Navigation Enhancement
```typescript
// Navigation.tsx - Add monitoring tab
<button onClick={() => onTabChange('monitoring')}>
  <ActivityIcon className="w-4 h-4 mr-2" />
  Monitoring
</button>
```

### Backend API Extensions

#### Docker Integration Endpoints
```javascript
// backend/server.js - New Docker monitoring endpoints
app.get('/api/docker/containers', async (req, res) => {
  // List all containers with status
});

app.get('/api/docker/containers/:id/logs', async (req, res) => {
  // Stream container logs
});

app.post('/api/docker/containers/:id/action', async (req, res) => {
  // Start/stop/restart container actions
});

app.get('/api/docker/containers/:id/stats', async (req, res) => {
  // Real-time container resource usage
});
```

#### Docker API Client
```javascript
// backend/dockerClient.js - Docker API wrapper
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
```

## Component Architecture

### Main Monitoring Component
```
src/components/Monitoring/
├── MonitoringDashboard.tsx    # Main container for monitoring view
├── ContainerList.tsx          # Table/grid of containers
├── ContainerCard.tsx          # Individual container status card
├── ContainerLogs.tsx          # Log viewer component
├── ResourceMetrics.tsx        # CPU/Memory usage charts
├── ServiceActions.tsx         # Start/stop/restart controls
└── types.ts                   # TypeScript interfaces
```

### Core Types and Interfaces

```typescript
// src/components/Monitoring/types.ts
interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'paused' | 'restarting' | 'dead';
  state: string;
  ports: PortMapping[];
  created: number;
  uptime: number;
  restartCount: number;
  labels: Record<string, string>;
}

interface PortMapping {
  privatePort: number;
  publicPort?: number;
  type: 'tcp' | 'udp';
}

interface ContainerStats {
  cpu: number;          // CPU usage percentage
  memory: number;       // Memory usage in bytes
  memoryLimit: number;  // Memory limit in bytes
  network: {
    rx: number;         // Bytes received
    tx: number;         // Bytes transmitted
  };
  diskIO: {
    read: number;       // Bytes read
    write: number;      // Bytes written
  };
}

interface ContainerAction {
  type: 'start' | 'stop' | 'restart' | 'pause' | 'unpause';
  containerId: string;
}
```

## Feature Set (Essential Features Only)

### 1. Container Overview Dashboard
- **Container Grid/List View**: Display all containers with status indicators
- **Quick Status**: Running (green), Stopped (red), Restarting (yellow)
- **Basic Info**: Name, image, uptime, restart count
- **Port Mappings**: Show exposed ports with click-to-open functionality

### 2. Container Actions
- **Start/Stop/Restart**: Basic lifecycle management
- **Bulk Actions**: Select multiple containers for batch operations
- **Auto-refresh**: Real-time status updates (configurable interval)

### 3. Log Viewer
- **Real-time Logs**: Stream container logs with auto-scroll
- **Log Filtering**: Search/filter logs by text or log level
- **Download Logs**: Export logs to file
- **Log Levels**: Color-coded log levels (error, warn, info, debug)

### 4. Resource Monitoring
- **CPU Usage**: Simple percentage display with small charts
- **Memory Usage**: Current usage vs limit with progress bars
- **Network I/O**: Basic RX/TX counters
- **Disk I/O**: Read/write statistics

### 5. Service Health Checks
- **HTTP Health Checks**: For web services, ping configured endpoints
- **Port Connectivity**: Check if exposed ports are accessible
- **Service Dependencies**: Show which services depend on others

## UI/UX Design

### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│ Header: LocalAI UI                                      │
├─────────────────────────────────────────────────────────┤
│ Navigation: [Orchestrator] [Environment] [Monitoring]   │
├─────────────────────────────────────────────────────────┤
│ Monitoring Dashboard                                    │
│                                                         │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐ │
│ │ Running: 8      │ │ Stopped: 2      │ │ Issues: 1   │ │
│ └─────────────────┘ └─────────────────┘ └─────────────┘ │
│                                                         │
│ Container List/Grid:                                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [●] n8n          │ Running │ 2h 34m │ CPU: 15%     │ │
│ │ [●] ollama       │ Running │ 2h 34m │ CPU: 45%     │ │
│ │ [○] postgres     │ Stopped │   -    │   -          │ │
│ │ [●] open-webui   │ Running │ 2h 33m │ CPU: 8%      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Selected Container Details:                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Logs [●Live] │ Stats │ Actions │                    │ │
│ │ [Log stream area with auto-scroll]                  │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Visual Design Principles
- **Consistent with LocalAI UI**: Use existing Tailwind classes and dark/light theme
- **Status Indicators**: Clear color coding (green/red/yellow dots)
- **Responsive Design**: Mobile-friendly grid layout
- **Minimal UI**: Focus on essential information, avoid clutter
- **Real-time Updates**: Live status with WebSocket or polling

### Color Scheme
```css
/* Status Colors */
.status-running { @apply text-green-500 bg-green-100 dark:bg-green-900/30; }
.status-stopped { @apply text-red-500 bg-red-100 dark:bg-red-900/30; }
.status-restarting { @apply text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30; }
.status-paused { @apply text-blue-500 bg-blue-100 dark:bg-blue-900/30; }

/* Resource Usage */
.usage-low { @apply text-green-600; }      /* 0-50% */
.usage-medium { @apply text-yellow-600; }  /* 50-80% */
.usage-high { @apply text-red-600; }       /* 80-100% */
```

## Implementation Plan

### Phase 1: Basic Container Listing
1. Add monitoring tab to navigation
2. Create basic MonitoringDashboard component
3. Implement Docker API client in backend
4. Display container list with status and basic info
5. Add start/stop/restart actions

### Phase 2: Log Viewing
1. Implement log streaming endpoint
2. Create ContainerLogs component with real-time updates
3. Add log filtering and search capabilities
4. Implement log export functionality

### Phase 3: Resource Monitoring
1. Add container stats endpoint
2. Create ResourceMetrics component with charts
3. Implement real-time resource usage updates
4. Add resource usage alerts/warnings

### Phase 4: Enhanced Features
1. Bulk container actions
2. Service health checks
3. Dependency visualization
4. Advanced filtering and sorting

## Technical Implementation Details

### Docker Socket Access
```yaml
# docker-compose.yml - Mount Docker socket
services:
  localai-ui:
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

### Real-time Updates
```typescript
// Use polling or WebSocket for live updates
const useContainerStatus = () => {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch('/api/docker/containers');
      const data = await response.json();
      setContainers(data);
    }, 5000); // 5-second updates
    
    return () => clearInterval(interval);
  }, []);
  
  return containers;
};
```

### Error Handling
- Graceful fallback when Docker socket unavailable
- User-friendly error messages for permission issues
- Retry mechanisms for failed API calls
- Loading states for async operations

### Security Considerations
- Read-only Docker socket access
- Container action permissions
- Log access restrictions
- Rate limiting for API endpoints

## Integration with Existing LocalAI Features

### Service Orchestrator Integration
- Link monitoring view with service orchestrator configuration
- Show which services are selected in orchestrator vs actually running
- One-click service restart from monitoring view

### Environment Configuration
- Display environment variables for running containers
- Show configuration mismatches
- Link to environment editor for quick fixes

### Compose File Integration
- Show which docker-compose services are running
- Display service dependencies from compose files
- Health check status from compose configurations

## Future Enhancements (Out of Scope for Initial Version)

### Advanced Features (Not Implemented Initially)
- **Container Shell Access**: Terminal/exec into containers
- **Image Management**: Pull/build/remove images
- **Network Inspection**: Docker network topology
- **Volume Management**: Volume usage and cleanup
- **Container Compose**: Multi-container application management
- **Alerts/Notifications**: Email/Slack notifications for issues
- **Historical Metrics**: Time-series data storage and charts
- **Container Scaling**: Replica management

### Why These Are Excluded
- Focus on essential monitoring features first
- Avoid feature bloat and complexity
- Maintain lightweight nature of LocalAI UI
- Security concerns with shell access
- Additional dependencies for advanced features

## Conclusion

This monitoring UI design provides a balanced approach between functionality and simplicity. It integrates seamlessly with the existing LocalAI UI architecture while providing essential Docker container monitoring capabilities. The modular component design allows for future enhancements while maintaining a clean, focused user experience.

The implementation leverages existing patterns in the LocalAI UI codebase and follows established conventions for consistent user experience across the application.