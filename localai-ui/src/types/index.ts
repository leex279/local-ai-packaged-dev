
// Custom services configuration structure
export interface CustomServiceConfig {
  enabled: boolean;
  required: boolean;
  description: string;
  category: string;
  dependencies: string[];
  profiles?: {
    [profile: string]: string;
  };
  pull_services?: {
    [profile: string]: string;
  };
  external_compose?: boolean;
  compose_path?: string;
}

export interface CustomServicesJson {
  version: string;
  description: string;
  services: {
    [category: string]: {
      [serviceId: string]: CustomServiceConfig;
    };
  };
  profiles: {
    [profile: string]: {
      description: string;
      default: boolean;
    };
  };
  environments: {
    [environment: string]: {
      description: string;
      default: boolean;
    };
  };
  userPreferences?: {
    selectedProfile?: string;
    selectedEnvironment?: string;
  };
}


export interface EnvVariable {
  key: string;
  value: string;
  description?: string;
  required?: boolean;
  category?: string;
  type?: 'text' | 'password' | 'secret' | 'number' | 'boolean' | 'url' | 'email';
  commented?: boolean; // Whether the variable is commented out (disabled)
}

export interface EnvConfig {
  variables: EnvVariable[];
}


export interface ServiceStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  health?: 'healthy' | 'unhealthy' | 'starting';
}

export interface ServiceOrchestrationAPI {
  getCustomServices(): Promise<CustomServicesJson>;
  updateCustomServices(config: CustomServicesJson): Promise<void>;
  getServiceStatus(): Promise<ServiceStatus[]>;
  startServices(serviceIds: string[], profile: string, environment: string): Promise<void>;
  stopServices(serviceIds: string[]): Promise<void>;
}