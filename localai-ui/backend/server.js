import express from 'express/index.js';
import { writeFile, mkdir, readFile, access, constants } from 'fs/promises';
import { dirname, join } from 'path';
import cors from 'cors/lib/index.js';
import dockerClient from './dockerClient.js';

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Create directories if they don't exist
async function ensureDirectoryExists(filePath) {
  const dir = dirname(filePath);
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// Check if file exists and is readable
async function checkFileAccess(filePath) {
  try {
    await access(filePath, constants.F_OK | constants.R_OK);
    return true;
  } catch (error) {
    console.error(`File access check failed for ${filePath}:`, error.code);
    return false;
  }
}




// Load env file (prioritize shared/.env, then parent .env, then input template)
app.get('/api/load-env', async (req, res) => {
  try {
    console.log('[DEBUG] Load env file request received');
    
    const basePath = process.env.NODE_ENV === 'production' ? '/app' : process.cwd();
    
    // Try multiple locations in priority order
    const envPaths = [
      `${basePath}/shared/.env`,           // Shared volume (saved configs)
      `${basePath}/../.env`,               // Parent project directory
      `${basePath}/input/env`              // Template file
    ];
    
    let content = '';
    let sourcePath = '';
    
    for (const envPath of envPaths) {
      try {
        const fileExists = await checkFileAccess(envPath);
        if (fileExists) {
          content = await readFile(envPath, 'utf8');
          sourcePath = envPath;
          console.log(`[DEBUG] Loaded env file from: ${sourcePath}`);
          break;
        }
      } catch (error) {
        console.log(`[DEBUG] Failed to load from ${envPath}: ${error.message}`);
        continue;
      }
    }
    
    if (!content) {
      console.error('[ERROR] No env file found in any location');
      return res.status(404).json({ 
        error: 'No environment file found',
        searchedPaths: envPaths
      });
    }
    
    console.log(`[DEBUG] Env file content length: ${content.length} bytes`);
    res.json({ 
      content, 
      sourcePath: sourcePath.replace(basePath, ''),
      success: true 
    });
  } catch (error) {
    console.error('[ERROR] Error loading env file:', error);
    res.status(500).json({ 
      error: 'Failed to load env file', 
      details: error.message,
      code: error.code
    });
  }
});

// Save env file
app.post('/api/save-env', async (req, res) => {
  try {
    const { content, path } = req.body;
    console.log(`[DEBUG] Save env request received. Content length: ${content ? content.length : 0} bytes`);
    
    if (!content) {
      console.error(`[ERROR] No content provided for save env`);
      return res.status(400).json({ error: 'No content provided' });
    }
    
    const basePath = process.env.NODE_ENV === 'production' ? '/app' : process.cwd();
    
    // Save to shared volume (.env) - this is accessible and where start_services.py expects it
    // Also save backup to output directory for reference
    const sharedEnvPath = `${basePath}/shared/.env`;
    const outputBackupPath = `${basePath}/output/.env`;
    
    const envPath = path || sharedEnvPath;
    console.log(`[DEBUG] Saving env file to shared volume: ${envPath}`);
    console.log(`[DEBUG] Also saving backup to: ${outputBackupPath}`);
    
    // Save to shared volume (main file that start_services.py can access)
    await writeFile(envPath, content, 'utf8');
    
    // Also save backup to output directory
    await ensureDirectoryExists(outputBackupPath);
    await writeFile(outputBackupPath, content, 'utf8');
    
    console.log(`[DEBUG] Env file saved successfully to shared volume: ${envPath}`);
    console.log(`[DEBUG] Backup saved to: ${outputBackupPath}`);
    res.json({ 
      success: true, 
      path: envPath,
      backupPath: outputBackupPath,
      message: 'Environment file saved to project root and backup created'
    });
  } catch (error) {
    console.error('[ERROR] Error saving env file:', error);
    res.status(500).json({ 
      error: 'Failed to save env file', 
      details: error.message,
      code: error.code
    });
  }
});

// Get custom services configuration
app.get('/api/custom-services', async (req, res) => {
  try {
    console.log(`[DEBUG] Get custom services config request received`);
    
    const basePath = process.env.NODE_ENV === 'production' ? '/app' : process.cwd();
    const sharedPath = `${basePath}/shared/custom_services.json`;
    
    // Check if custom services file exists
    const fileExists = await checkFileAccess(sharedPath);
    if (!fileExists) {
      console.log(`[DEBUG] Custom services file not found, returning default config`);
      // Return a default configuration if file doesn't exist
      const defaultConfig = {
        version: "1.0",
        description: "Configuration file for customizing which services to start in the local AI stack",
        services: {
          core: {
            "localai-ui": {
              enabled: false,
              required: false,
              description: "Web-based service configurator",
              category: "infrastructure",
              dependencies: []
            },
            caddy: {
              enabled: false,
              required: false,
              description: "Reverse proxy with automatic HTTPS",
              category: "infrastructure",
              dependencies: []
            }
          },
          ai_platforms: {
            n8n: {
              enabled: false,
              required: false,
              description: "Workflow automation platform",
              category: "ai",
              dependencies: ["n8n-import"]
            },
            "n8n-import": {
              enabled: false,
              required: false,
              description: "N8N workflow and credential importer",
              category: "ai",
              dependencies: []
            },
            "open-webui": {
              enabled: false,
              required: false,
              description: "ChatGPT-like interface for local models",
              category: "ai",
              dependencies: []
            },
            flowise: {
              enabled: false,
              required: false,
              description: "No-code AI agent builder",
              category: "ai",
              dependencies: []
            }
          },
          llm_services: {
            ollama: {
              enabled: false,
              required: false,
              description: "Local LLM hosting service",
              category: "ai",
              dependencies: [],
              profiles: {
                cpu: "ollama-cpu",
                "gpu-nvidia": "ollama-gpu",
                "gpu-amd": "ollama-gpu-amd"
              },
              pull_services: {
                cpu: "ollama-pull-llama-cpu",
                "gpu-nvidia": "ollama-pull-llama-gpu",
                "gpu-amd": "ollama-pull-llama-gpu-amd"
              }
            }
          },
          databases: {
            supabase: {
              enabled: false,
              required: false,
              description: "Complete backend with Postgres, auth, real-time",
              category: "database",
              dependencies: [],
              external_compose: true,
              compose_path: "./supabase/docker/docker-compose.yml"
            },
            qdrant: {
              enabled: false,
              required: false,
              description: "Vector database for RAG operations",
              category: "database",
              dependencies: []
            },
            neo4j: {
              enabled: false,
              required: false,
              description: "Graph database for knowledge graphs",
              category: "database",
              dependencies: []
            },
            postgres: {
              enabled: false,
              required: false,
              description: "PostgreSQL database for Langfuse",
              category: "database",
              dependencies: []
            },
            clickhouse: {
              enabled: false,
              required: false,
              description: "Analytics database for Langfuse",
              category: "database",
              dependencies: []
            },
            redis: {
              enabled: false,
              required: false,
              description: "Caching and session storage",
              category: "database",
              dependencies: []
            }
          },
          monitoring: {
            "langfuse-web": {
              enabled: false,
              required: false,
              description: "LLM observability web interface",
              category: "monitoring",
              dependencies: ["langfuse-worker", "postgres", "clickhouse", "redis", "minio"]
            },
            "langfuse-worker": {
              enabled: false,
              required: false,
              description: "Langfuse background worker",
              category: "monitoring",
              dependencies: ["postgres", "clickhouse", "redis", "minio"]
            }
          },
          utilities: {
            searxng: {
              enabled: false,
              required: false,
              description: "Privacy-focused metasearch engine",
              category: "utility",
              dependencies: []
            },
            minio: {
              enabled: false,
              required: false,
              description: "S3-compatible object storage",
              category: "utility",
              dependencies: []
            }
          }
        },
        profiles: {
          cpu: { description: "CPU-only mode for Ollama", default: true },
          "gpu-nvidia": { description: "NVIDIA GPU support for Ollama", default: false },
          "gpu-amd": { description: "AMD GPU support for Ollama with ROCm", default: false },
          none: { description: "No local Ollama (for external instances)", default: false }
        },
        environments: {
          private: { description: "Development mode with all ports exposed", default: true },
          public: { description: "Production mode with only ports 80/443 exposed", default: false }
        }
      };
      return res.json(defaultConfig);
    }
    
    const content = await readFile(sharedPath, 'utf8');
    const config = JSON.parse(content);
    
    console.log(`[DEBUG] Custom services config loaded successfully`);
    res.json(config);
  } catch (error) {
    console.error('[ERROR] Error loading custom services config:', error);
    res.status(500).json({ 
      error: 'Failed to load custom services config', 
      details: error.message,
      code: error.code
    });
  }
});

// Save custom services configuration
app.post('/api/custom-services', async (req, res) => {
  try {
    const { config } = req.body;
    console.log(`[DEBUG] Save services config request received`);
    
    if (!config) {
      console.error(`[ERROR] No config provided for save services config`);
      return res.status(400).json({ error: 'No config provided' });
    }
    
    // Save to both output directory and shared directory (where start_services.py expects it)
    const basePath = process.env.NODE_ENV === 'production' ? '/app' : process.cwd();
    const outputPath = `${basePath}/output/custom_services.json`;
    const sharedPath = `${basePath}/shared/custom_services.json`;
    
    console.log(`[DEBUG] Saving services config to: ${outputPath} and ${sharedPath}`);
    
    const configJson = JSON.stringify(config, null, 2);
    
    await ensureDirectoryExists(outputPath);
    await writeFile(outputPath, configJson, 'utf8');
    
    // Also save to shared directory so start_services.py can access it
    await ensureDirectoryExists(sharedPath);
    await writeFile(sharedPath, configJson, 'utf8');
    
    console.log(`[DEBUG] Services config saved successfully`);
    res.json({ success: true, paths: [outputPath, sharedPath] });
  } catch (error) {
    console.error('[ERROR] Error saving services config:', error);
    res.status(500).json({ 
      error: 'Failed to save services config', 
      details: error.message,
      code: error.code
    });
  }
});

// Get service status (placeholder for future Docker integration)
app.get('/api/service-status', async (req, res) => {
  try {
    console.log(`[DEBUG] Service status request received`);
    
    // For now, return mock data. In the future, this would integrate with Docker API
    const mockStatus = [
      { id: 'n8n', name: 'n8n', status: 'stopped', health: 'unknown' },
      { id: 'ollama-cpu', name: 'Ollama (CPU)', status: 'stopped', health: 'unknown' },
      { id: 'open-webui', name: 'Open WebUI', status: 'stopped', health: 'unknown' },
      { id: 'flowise', name: 'Flowise', status: 'stopped', health: 'unknown' }
    ];
    
    res.json(mockStatus);
  } catch (error) {
    console.error('[ERROR] Error getting service status:', error);
    res.status(500).json({ 
      error: 'Failed to get service status', 
      details: error.message
    });
  }
});

// Start services (placeholder for future integration with start_services.py)
app.post('/api/start-services', async (req, res) => {
  try {
    const { serviceIds, profile, environment } = req.body;
    console.log(`[DEBUG] Start services request: ${JSON.stringify({ serviceIds, profile, environment })}`);
    
    // For now, just acknowledge the request
    // In the future, this would call start_services.py with the --services flag
    res.json({ 
      success: true, 
      message: 'Service start request received (not implemented yet)',
      serviceIds,
      profile,
      environment
    });
  } catch (error) {
    console.error('[ERROR] Error starting services:', error);
    res.status(500).json({ 
      error: 'Failed to start services', 
      details: error.message
    });
  }
});

// Stop services (placeholder for future integration)
app.post('/api/stop-services', async (req, res) => {
  try {
    const { serviceIds } = req.body;
    console.log(`[DEBUG] Stop services request: ${JSON.stringify({ serviceIds })}`);
    
    // For now, just acknowledge the request
    res.json({ 
      success: true, 
      message: 'Service stop request received (not implemented yet)',
      serviceIds
    });
  } catch (error) {
    console.error('[ERROR] Error stopping services:', error);
    res.status(500).json({ 
      error: 'Failed to stop services', 
      details: error.message
    });
  }
});

// ======================
// Docker Monitoring APIs
// ======================

// Get all containers
app.get('/api/docker/containers', async (req, res) => {
  try {
    console.log('[DEBUG] Docker containers list request received');
    
    if (!dockerClient.isConnected()) {
      const connected = await dockerClient.testConnection();
      if (!connected) {
        return res.status(503).json({
          error: 'Docker daemon not available',
          message: 'Could not connect to Docker socket. Ensure Docker is running and socket is mounted.'
        });
      }
    }
    
    const containers = await dockerClient.listContainers(true);
    console.log(`[DEBUG] Found ${containers.length} containers`);
    
    res.json(containers);
  } catch (error) {
    console.error('[ERROR] Failed to list containers:', error);
    res.status(500).json({
      error: 'Failed to list containers',
      details: error.message
    });
  }
});

// Get container stats
app.get('/api/docker/containers/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] Container stats request for: ${id}`);
    
    if (!dockerClient.isConnected()) {
      return res.status(503).json({
        error: 'Docker daemon not available'
      });
    }
    
    const stats = await dockerClient.getContainerStats(id);
    res.json(stats);
  } catch (error) {
    console.error(`[ERROR] Failed to get stats for container ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to get container stats',
      details: error.message
    });
  }
});

// Get container logs
app.get('/api/docker/containers/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { tail = 100, since = 0 } = req.query;
    
    console.log(`[DEBUG] Container logs request for: ${id}, tail: ${tail}, since: ${since}`);
    
    if (!dockerClient.isConnected()) {
      return res.status(503).json({
        error: 'Docker daemon not available'
      });
    }
    
    const logs = await dockerClient.getContainerLogs(id, {
      tail: parseInt(tail),
      since: parseInt(since)
    });
    
    res.json(logs);
  } catch (error) {
    console.error(`[ERROR] Failed to get logs for container ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to get container logs',
      details: error.message
    });
  }
});

// Perform container action (start/stop/restart)
app.post('/api/docker/containers/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    
    console.log(`[DEBUG] Container action request: ${action} for ${id}`);
    
    if (!dockerClient.isConnected()) {
      return res.status(503).json({
        error: 'Docker daemon not available'
      });
    }
    
    if (!['start', 'stop', 'restart', 'pause', 'unpause'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action',
        validActions: ['start', 'stop', 'restart', 'pause', 'unpause']
      });
    }
    
    const result = await dockerClient.performContainerAction(id, action);
    console.log(`[DEBUG] Container action ${action} completed for ${id}`);
    
    res.json(result);
  } catch (error) {
    console.error(`[ERROR] Failed to perform action ${req.body.action} on container ${req.params.id}:`, error);
    res.status(500).json({
      error: `Failed to ${req.body.action} container`,
      details: error.message
    });
  }
});

// Docker connection status
app.get('/api/docker/status', async (req, res) => {
  try {
    console.log('[DEBUG] Docker status check requested');
    
    const connected = await dockerClient.testConnection();
    
    res.json({
      connected,
      message: connected ? 'Docker daemon accessible' : 'Docker daemon not available'
    });
  } catch (error) {
    console.error('[ERROR] Docker status check failed:', error);
    res.status(500).json({
      connected: false,
      error: 'Failed to check Docker status',
      details: error.message
    });
  }
});

// Add a route to check server status and volume mounts
app.get('/api/status', async (req, res) => {
  try {
    console.log(`[DEBUG] Status check requested`);
    
    const basePath = process.env.NODE_ENV === 'production' ? '/app' : process.cwd();
    
    // Check output directory
    const outputPath = `${basePath}/output`;
    let outputStatus;
    try {
      await access(outputPath, constants.F_OK | constants.R_OK | constants.W_OK);
      outputStatus = { 
        accessible: true,
        writable: true
      };
      console.log(`[DEBUG] Output directory accessible and writable`);
    } catch (error) {
      outputStatus = {
        accessible: false,
        error: error.message,
        code: error.code
      };
      console.error(`[ERROR] Output directory not accessible:`, error);
    }

    // Check Docker connection
    let dockerStatus;
    try {
      const dockerConnected = await dockerClient.testConnection();
      dockerStatus = {
        connected: dockerConnected,
        available: dockerClient.isConnected()
      };
      console.log(`[DEBUG] Docker status: connected=${dockerConnected}, available=${dockerClient.isConnected()}`);
    } catch (error) {
      dockerStatus = {
        connected: false,
        available: false,
        error: error.message
      };
      console.error(`[ERROR] Docker status check failed:`, error);
    }
    
    res.json({
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        API_URL: process.env.VITE_API_URL
      },
      volumes: {
        output: outputStatus
      },
      docker: dockerStatus
    });
  } catch (error) {
    console.error('[ERROR] Status check failed:', error);
    res.status(500).json({ error: 'Status check failed', details: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[INFO] Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`[INFO] Serving files from /app/input and saving to /app/output`);
  
  // Log all environment variables for debugging
  console.log('[DEBUG] Environment variables:');
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('VITE_') || key === 'PORT' || key === 'NODE_ENV') {
      console.log(`[DEBUG] ${key}: ${value}`);
    }
  }
});