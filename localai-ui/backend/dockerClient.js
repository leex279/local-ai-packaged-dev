import Docker from 'dockerode';

class DockerClientWrapper {
  constructor() {
    try {
      // Try to connect to Docker socket
      this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
      this.connected = true;
      console.log('[INFO] Docker client initialized with socket path');
    } catch (error) {
      console.error('[ERROR] Failed to initialize Docker client:', error.message);
      this.connected = false;
      this.docker = null;
    }
  }

  isConnected() {
    return this.connected;
  }

  async testConnection() {
    if (!this.docker) {
      console.log('[DEBUG] Docker client not initialized');
      return false;
    }
    
    try {
      await this.docker.ping();
      console.log('[DEBUG] Docker ping successful');
      return true;
    } catch (error) {
      console.error('[ERROR] Docker ping failed:', error.message);
      if (error.code === 'EACCES') {
        console.error('[ERROR] Permission denied accessing Docker socket. Check Docker group permissions.');
      } else if (error.code === 'ENOENT') {
        console.error('[ERROR] Docker socket not found. Is Docker running?');
      } else if (error.code === 'ECONNREFUSED') {
        console.error('[ERROR] Connection refused to Docker daemon. Is Docker running?');
      }
      return false;
    }
  }

  async listContainers(all = true) {
    if (!this.docker) {
      throw new Error('Docker client not connected');
    }

    try {
      const containers = await this.docker.listContainers({ all });
      
      return containers.map(container => ({
        id: container.Id,
        name: container.Names[0]?.replace('/', '') || 'unknown',
        image: container.Image,
        status: this.normalizeStatus(container.State),
        state: container.Status,
        ports: this.normalizePorts(container.Ports || []),
        created: container.Created,
        uptime: container.State === 'running' ? Date.now() - (container.Created * 1000) : 0,
        restartCount: 0, // This would need to be fetched from inspect
        labels: container.Labels || {}
      }));
    } catch (error) {
      console.error('Failed to list containers:', error);
      throw error;
    }
  }

  async getContainerStats(containerId) {
    if (!this.docker) {
      throw new Error('Docker client not connected');
    }

    try {
      const container = this.docker.getContainer(containerId);
      const stream = await container.stats({ stream: false });

      // Parse CPU usage
      const cpuDelta = stream.cpu_stats.cpu_usage.total_usage - stream.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stream.cpu_stats.system_cpu_usage - stream.precpu_stats.system_cpu_usage;
      const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stream.cpu_stats.online_cpus * 100 : 0;

      // Parse memory usage
      const memoryUsage = stream.memory_stats.usage || 0;
      const memoryLimit = stream.memory_stats.limit || 0;
      const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

      // Parse network I/O
      let networkRx = 0;
      let networkTx = 0;
      if (stream.networks) {
        Object.values(stream.networks).forEach(network => {
          networkRx += network.rx_bytes || 0;
          networkTx += network.tx_bytes || 0;
        });
      }

      // Parse disk I/O
      let diskRead = 0;
      let diskWrite = 0;
      if (stream.blkio_stats?.io_service_bytes_recursive) {
        stream.blkio_stats.io_service_bytes_recursive.forEach(stat => {
          if (stat.op === 'Read') diskRead += stat.value;
          if (stat.op === 'Write') diskWrite += stat.value;
        });
      }

      return {
        cpu: Math.round(cpuPercent * 100) / 100,
        memory: memoryUsage,
        memoryLimit: memoryLimit,
        memoryPercent: Math.round(memoryPercent * 100) / 100,
        network: {
          rx: networkRx,
          tx: networkTx
        },
        diskIO: {
          read: diskRead,
          write: diskWrite
        },
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Failed to get stats for container ${containerId}:`, error);
      throw error;
    }
  }

  async getContainerLogs(containerId, options = {}) {
    if (!this.docker) {
      throw new Error('Docker client not connected');
    }

    try {
      const container = this.docker.getContainer(containerId);
      const logOptions = {
        stdout: true,
        stderr: true,
        timestamps: true,
        tail: options.tail || 100,
        since: options.since || 0,
        ...options
      };

      const stream = await container.logs(logOptions);
      const logs = stream.toString('utf8');
      
      return this.parseLogs(logs);
    } catch (error) {
      console.error(`Failed to get logs for container ${containerId}:`, error);
      throw error;
    }
  }

  async performContainerAction(containerId, action) {
    if (!this.docker) {
      throw new Error('Docker client not connected');
    }

    try {
      const container = this.docker.getContainer(containerId);
      
      switch (action) {
        case 'start':
          await container.start();
          break;
        case 'stop':
          await container.stop();
          break;
        case 'restart':
          await container.restart();
          break;
        case 'pause':
          await container.pause();
          break;
        case 'unpause':
          await container.unpause();
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return { success: true, action, containerId };
    } catch (error) {
      console.error(`Failed to ${action} container ${containerId}:`, error);
      throw error;
    }
  }

  // Helper methods
  normalizeStatus(dockerState) {
    const stateMap = {
      'running': 'running',
      'exited': 'stopped',
      'paused': 'paused',
      'restarting': 'restarting',
      'dead': 'dead',
      'created': 'created'
    };
    
    return stateMap[dockerState] || 'unknown';
  }

  normalizePorts(dockerPorts) {
    return dockerPorts.map(port => ({
      privatePort: port.PrivatePort,
      publicPort: port.PublicPort,
      type: port.Type,
      ip: port.IP
    }));
  }

  parseLogs(logString) {
    const lines = logString.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      // Remove Docker log header (8 bytes) if present
      const cleanLine = line.replace(/^.{8}/, '');
      
      // Try to parse timestamp
      const timestampMatch = cleanLine.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
      
      if (timestampMatch) {
        const [, timestamp, message] = timestampMatch;
        return {
          timestamp: timestamp,
          level: this.detectLogLevel(message),
          message: message.trim(),
          source: 'stdout' // Docker doesn't easily distinguish in combined logs
        };
      }
      
      return {
        timestamp: new Date().toISOString(),
        level: this.detectLogLevel(cleanLine),
        message: cleanLine.trim(),
        source: 'stdout'
      };
    });
  }

  detectLogLevel(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('error') || lowerMessage.includes('fatal')) {
      return 'error';
    } else if (lowerMessage.includes('warn')) {
      return 'warn';
    } else if (lowerMessage.includes('debug')) {
      return 'debug';
    } else {
      return 'info';
    }
  }
}

export default new DockerClientWrapper();