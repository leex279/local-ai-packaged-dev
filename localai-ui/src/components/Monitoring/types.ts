export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'paused' | 'restarting' | 'dead' | 'created';
  state: string;
  ports: PortMapping[];
  created: number;
  uptime: number;
  restartCount: number;
  labels: Record<string, string>;
}

export interface PortMapping {
  privatePort: number;
  publicPort?: number;
  type: 'tcp' | 'udp';
  ip?: string;
}

export interface ContainerStats {
  cpu: number;          // CPU usage percentage
  memory: number;       // Memory usage in bytes
  memoryLimit: number;  // Memory limit in bytes
  memoryPercent: number; // Memory usage percentage
  network: {
    rx: number;         // Bytes received
    tx: number;         // Bytes transmitted
  };
  diskIO: {
    read: number;       // Bytes read
    write: number;      // Bytes written
  };
  timestamp: number;    // Timestamp of stats
}

export interface ContainerAction {
  type: 'start' | 'stop' | 'restart' | 'pause' | 'unpause';
  containerId: string;
}

export interface ContainerLogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  source: 'stdout' | 'stderr';
}

export interface ContainerHealthCheck {
  status: 'healthy' | 'unhealthy' | 'starting' | 'none';
  failingStreak: number;
  log: string[];
}

export interface MonitoringState {
  containers: DockerContainer[];
  selectedContainer: string | null;
  containerStats: Record<string, ContainerStats>;
  containerLogs: Record<string, ContainerLogEntry[]>;
  loading: boolean;
  error: string | null;
  autoRefresh: boolean;
  refreshInterval: number;
}

export interface ServiceHealth {
  containerId: string;
  httpChecks: Array<{
    url: string;
    status: number;
    responseTime: number;
    healthy: boolean;
  }>;
  portChecks: Array<{
    port: number;
    accessible: boolean;
  }>;
  overallHealth: 'healthy' | 'unhealthy' | 'unknown';
}