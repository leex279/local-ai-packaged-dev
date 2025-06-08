import { CustomServicesJson, ServiceStatus, ServiceOrchestrationAPI } from '../types';

class ServiceOrchestrationClient implements ServiceOrchestrationAPI {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:5001/api') {
    this.baseUrl = baseUrl;
  }

  async getCustomServices(): Promise<CustomServicesJson> {
    const response = await fetch(`${this.baseUrl}/custom-services`);
    if (!response.ok) {
      throw new Error(`Failed to fetch custom services: ${response.statusText}`);
    }
    return response.json();
  }

  async updateCustomServices(config: CustomServicesJson): Promise<void> {
    const response = await fetch(`${this.baseUrl}/custom-services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ config }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update custom services: ${response.statusText}`);
    }
  }

  async getServiceStatus(): Promise<ServiceStatus[]> {
    const response = await fetch(`${this.baseUrl}/service-status`);
    if (!response.ok) {
      throw new Error(`Failed to fetch service status: ${response.statusText}`);
    }
    return response.json();
  }

  async startServices(serviceIds: string[], profile: string, environment: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/start-services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ serviceIds, profile, environment }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to start services: ${response.statusText}`);
    }
  }

  async stopServices(serviceIds: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/stop-services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ serviceIds }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to stop services: ${response.statusText}`);
    }
  }
}

// Create and export a singleton instance
export const serviceOrchestration = new ServiceOrchestrationClient();

// Helper functions for working with custom services configuration
export function flattenCustomServices(customServices: CustomServicesJson): Array<{
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  required: boolean;
  dependencies: string[];
  profiles?: { [key: string]: string };
}> {
  const flattened: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    enabled: boolean;
    required: boolean;
    dependencies: string[];
    profiles?: { [key: string]: string };
  }> = [];

  Object.entries(customServices.services).forEach(([category, services]) => {
    Object.entries(services).forEach(([serviceId, config]) => {
      flattened.push({
        id: serviceId,
        name: serviceId.charAt(0).toUpperCase() + serviceId.slice(1).replace(/-/g, ' '),
        description: config.description,
        category,
        enabled: config.enabled,
        required: config.required,
        dependencies: config.dependencies,
        profiles: config.profiles,
      });
    });
  });

  return flattened;
}

export function updateServiceInCustomConfig(
  customServices: CustomServicesJson,
  serviceId: string,
  updates: Partial<{ enabled: boolean; required: boolean; dependencies: string[] }>
): CustomServicesJson {
  const updatedConfig = JSON.parse(JSON.stringify(customServices)) as CustomServicesJson;

  // Find the service in the configuration
  for (const [category, services] of Object.entries(updatedConfig.services)) {
    if (services[serviceId]) {
      Object.assign(services[serviceId], updates);
      break;
    }
  }

  return updatedConfig;
}

export function getServicesByCategory(customServices: CustomServicesJson): Record<string, any[]> {
  const servicesByCategory: Record<string, any[]> = {};

  Object.entries(customServices.services).forEach(([category, services]) => {
    servicesByCategory[category] = Object.entries(services).map(([serviceId, config]) => ({
      id: serviceId,
      name: serviceId.charAt(0).toUpperCase() + serviceId.slice(1).replace(/-/g, ' '),
      description: config.description,
      enabled: config.enabled,
      required: config.required,
      dependencies: config.dependencies,
      profiles: config.profiles,
    }));
  });

  return servicesByCategory;
}

export function getEnabledServices(customServices: CustomServicesJson, profile: string = 'cpu'): string[] {
  const enabledServices: string[] = [];

  Object.entries(customServices.services).forEach(([category, services]) => {
    Object.entries(services).forEach(([serviceId, config]) => {
      if (config.enabled) {
        // Handle profile-specific services (e.g., ollama variants)
        const actualServiceId = config.profiles?.[profile] || serviceId;
        enabledServices.push(actualServiceId);
        
        // Add pull services if they exist
        if (config.pull_services?.[profile]) {
          enabledServices.push(config.pull_services[profile]);
        }
      }
    });
  });

  return enabledServices;
}

export function resolveDependencies(
  customServices: CustomServicesJson,
  requestedServices: string[]
): string[] {
  const resolved = new Set<string>();
  const visited = new Set<string>();

  function resolveDependency(serviceId: string) {
    if (visited.has(serviceId)) {
      return; // Prevent infinite loops
    }
    visited.add(serviceId);

    // Find the service in the configuration
    for (const [category, services] of Object.entries(customServices.services)) {
      if (services[serviceId]) {
        const config = services[serviceId];
        
        // First resolve dependencies
        config.dependencies.forEach(dep => resolveDependency(dep));
        
        // Then add the service itself if enabled
        if (config.enabled) {
          resolved.add(serviceId);
        }
        break;
      }
    }
  }

  requestedServices.forEach(serviceId => resolveDependency(serviceId));
  return Array.from(resolved);
}