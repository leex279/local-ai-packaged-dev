// Service definitions - single source of truth for what services exist
// This file defines all available services, their dependencies, descriptions, etc.
// The configuration file (custom_services.json) only stores enabled/disabled state

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  category: 'infrastructure' | 'ai' | 'database' | 'monitoring' | 'utility';
  dependencies: string[];
  required: boolean;
  profiles?: {
    [key: string]: string;
  };
  pull_services?: {
    [key: string]: string;
  };
  external_compose?: boolean;
  compose_path?: string;
}

export interface ServiceCategory {
  [serviceId: string]: Omit<ServiceDefinition, 'id'>;
}

export interface ServiceDefinitions {
  core: ServiceCategory;
  ai_platforms: ServiceCategory;
  llm_services: ServiceCategory;
  databases: ServiceCategory;
  monitoring: ServiceCategory;
  utilities: ServiceCategory;
}

// Complete service definitions based on real Docker Compose analysis
export const serviceDefinitions: ServiceDefinitions = {
  core: {
    caddy: {
      name: "Caddy",
      description: "Reverse proxy with automatic HTTPS",
      category: "infrastructure",
      dependencies: [],
      required: false
    }
  },
  
  ai_platforms: {
    "n8n": {
      name: "n8n",
      description: "Workflow automation platform",
      category: "ai", 
      dependencies: ["supabase"],
      required: false
    },
    "n8n-import": {
      name: "n8n Import",
      description: "N8N workflow and credential importer",
      category: "ai",
      dependencies: ["n8n"],
      required: false
    },
    "open-webui": {
      name: "Open WebUI",
      description: "ChatGPT-like interface for local models",
      category: "ai",
      dependencies: [],
      required: false
    },
    flowise: {
      name: "Flowise", 
      description: "No-code AI agent builder",
      category: "ai",
      dependencies: [],
      required: false
    }
  },

  llm_services: {
    ollama: {
      name: "Ollama",
      description: "Local LLM hosting service", 
      category: "ai",
      dependencies: [],
      required: false,
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
      name: "Supabase",
      description: "Complete backend with Postgres, auth, real-time",
      category: "database",
      dependencies: [],
      required: false,
      external_compose: true,
      compose_path: "./supabase/docker/docker-compose.yml"
    },
    postgres: {
      name: "PostgreSQL",
      description: "PostgreSQL database for Langfuse and N8N",
      category: "database", 
      dependencies: [],
      required: false
    },
    clickhouse: {
      name: "ClickHouse",
      description: "Analytics database for Langfuse",
      category: "database",
      dependencies: [],
      required: false
    },
    redis: {
      name: "Redis", 
      description: "Caching and session storage",
      category: "database",
      dependencies: [],
      required: false
    },
    qdrant: {
      name: "Qdrant",
      description: "Vector database for RAG operations",
      category: "database",
      dependencies: [],
      required: false
    },
    neo4j: {
      name: "Neo4j",
      description: "Graph database for knowledge graphs", 
      category: "database",
      dependencies: [],
      required: false
    },
    minio: {
      name: "MinIO",
      description: "S3-compatible object storage",
      category: "database",
      dependencies: [],
      required: false
    }
  },

  monitoring: {
    "langfuse-web": {
      name: "Langfuse Web",
      description: "LLM observability web interface",
      category: "monitoring",
      dependencies: ["langfuse-worker", "postgres", "clickhouse", "redis", "minio"],
      required: false
    },
    "langfuse-worker": {
      name: "Langfuse Worker", 
      description: "Langfuse background worker",
      category: "monitoring",
      dependencies: ["postgres", "clickhouse", "redis", "minio"],
      required: false
    }
  },

  utilities: {
    searxng: {
      name: "SearXNG",
      description: "Privacy-focused metasearch engine", 
      category: "utility",
      dependencies: [],
      required: false
    }
  }
};

// Helper function to get all services as flat array
export function getAllServiceDefinitions(): ServiceDefinition[] {
  const allServices: ServiceDefinition[] = [];
  
  Object.entries(serviceDefinitions).forEach(([categoryId, category]) => {
    Object.entries(category).forEach(([serviceId, service]) => {
      allServices.push({
        id: serviceId,
        ...service
      });
    });
  });
  
  return allServices;
}

// Helper function to get service by ID
export function getServiceDefinition(serviceId: string): ServiceDefinition | undefined {
  return getAllServiceDefinitions().find(service => service.id === serviceId);
}

// Helper function to get services by category
export function getServicesByCategory(): Record<string, ServiceDefinition[]> {
  const servicesByCategory: Record<string, ServiceDefinition[]> = {};
  
  Object.entries(serviceDefinitions).forEach(([categoryId, category]) => {
    servicesByCategory[categoryId] = Object.entries(category).map(([serviceId, service]) => ({
      id: serviceId,
      ...service
    }));
  });
  
  return servicesByCategory;
}

// Profile and environment definitions
export const profileDefinitions = {
  cpu: {
    description: "CPU-only mode for Ollama",
    default: true
  },
  "gpu-nvidia": {
    description: "NVIDIA GPU support for Ollama", 
    default: false
  },
  "gpu-amd": {
    description: "AMD GPU support for Ollama with ROCm",
    default: false
  },
  none: {
    description: "No local Ollama (for external instances)",
    default: false
  }
};

export const environmentDefinitions = {
  private: {
    description: "Development mode with all ports exposed",
    default: true
  },
  public: {
    description: "Production mode with only ports 80/443 exposed", 
    default: false
  }
};