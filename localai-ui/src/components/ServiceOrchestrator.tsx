import React, { useState, useEffect } from 'react';
import { CustomServicesJson, ServiceStatus } from '../types';
import { 
  serviceOrchestration, 
  flattenCustomServices, 
  updateServiceInCustomConfig,
  getServicesByCategory,
  getEnabledServices,
  resolveDependencies
} from '../utils/serviceOrchestration';

interface ServiceOrchestratorProps {
  className?: string;
}

export const ServiceOrchestrator: React.FC<ServiceOrchestratorProps> = ({ className = '' }) => {
  const [customServices, setCustomServices] = useState<CustomServicesJson | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('cpu');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('private');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadCustomServices();
    loadServiceStatus();
  }, []);

  const loadCustomServices = async () => {
    try {
      setLoading(true);
      const config = await serviceOrchestration.getCustomServices();
      setCustomServices(config);
      
      // Set default profile and environment from config
      const defaultProfile = Object.entries(config.profiles || {}).find(([, p]) => p.default)?.[0] || 'cpu';
      const defaultEnvironment = Object.entries(config.environments || {}).find(([, e]) => e.default)?.[0] || 'private';
      setSelectedProfile(defaultProfile);
      setSelectedEnvironment(defaultEnvironment);
    } catch (err) {
      setError(`Failed to load services configuration: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const loadServiceStatus = async () => {
    try {
      const status = await serviceOrchestration.getServiceStatus();
      setServiceStatus(status);
    } catch (err) {
      console.warn('Failed to load service status:', err);
    }
  };

  const handleServiceToggle = (serviceId: string, enabled: boolean) => {
    if (!customServices) return;

    let updatedConfig = updateServiceInCustomConfig(customServices, serviceId, { enabled });
    
    // If enabling a service, automatically enable its dependencies
    if (enabled) {
      const serviceDependencies = getServiceDependencies(customServices, serviceId);
      const autoEnabledServices = [];
      
      for (const dep of serviceDependencies) {
        // Check if dependency was previously disabled
        const wasDisabled = !getServiceEnabled(customServices, dep);
        if (wasDisabled) {
          autoEnabledServices.push(dep);
        }
        updatedConfig = updateServiceInCustomConfig(updatedConfig, dep, { enabled: true });
      }
      
      // Show message about auto-enabled dependencies
      if (autoEnabledServices.length > 0) {
        setSaveMessage(`Enabled ${serviceId} and its dependencies: ${autoEnabledServices.join(', ')}`);
        setTimeout(() => setSaveMessage(null), 5000);
      }
    } 
    // If disabling a service, automatically disable services that depend on it
    else {
      const dependentServices = getServicesDependingOn(customServices, serviceId);
      const autoDisabledServices = [];
      
      for (const dependent of dependentServices) {
        // Check if dependent was previously enabled
        const wasEnabled = getServiceEnabled(customServices, dependent);
        if (wasEnabled) {
          autoDisabledServices.push(dependent);
        }
        updatedConfig = updateServiceInCustomConfig(updatedConfig, dependent, { enabled: false });
      }
      
      // Show message about auto-disabled dependents
      if (autoDisabledServices.length > 0) {
        setSaveMessage(`Disabled ${serviceId} and services that depend on it: ${autoDisabledServices.join(', ')}`);
        setTimeout(() => setSaveMessage(null), 5000);
      }
    }
    
    setCustomServices(updatedConfig);
  };

  // Helper function to check if a service is enabled
  const getServiceEnabled = (config: CustomServicesJson, serviceId: string): boolean => {
    for (const [category, services] of Object.entries(config.services)) {
      if (services[serviceId]) {
        return services[serviceId].enabled;
      }
    }
    return false;
  };

  // Helper function to recursively get all dependencies for a service
  const getServiceDependencies = (config: CustomServicesJson, serviceId: string, visited: Set<string> = new Set()): string[] => {
    if (visited.has(serviceId)) {
      return []; // Prevent infinite loops
    }
    visited.add(serviceId);

    for (const [category, services] of Object.entries(config.services)) {
      if (services[serviceId]) {
        const directDependencies = services[serviceId].dependencies || [];
        const allDependencies = [...directDependencies];
        
        // Recursively get dependencies of dependencies
        for (const dep of directDependencies) {
          const transitiveDeps = getServiceDependencies(config, dep, visited);
          for (const transitiveDep of transitiveDeps) {
            if (!allDependencies.includes(transitiveDep)) {
              allDependencies.push(transitiveDep);
            }
          }
        }
        
        return allDependencies;
      }
    }
    return [];
  };

  // Helper function to find all services that depend on a specific service
  const getServicesDependingOn = (config: CustomServicesJson, targetServiceId: string): string[] => {
    const dependentServices: string[] = [];
    
    for (const [category, services] of Object.entries(config.services)) {
      for (const [serviceId, serviceConfig] of Object.entries(services)) {
        const dependencies = serviceConfig.dependencies || [];
        // Check if this service directly depends on the target service
        if (dependencies.includes(targetServiceId)) {
          dependentServices.push(serviceId);
        }
      }
    }
    
    return dependentServices;
  };

  const handleSaveConfiguration = async () => {
    if (!customServices) return;

    try {
      setLoading(true);
      await serviceOrchestration.updateCustomServices(customServices);
      setSaveMessage('Configuration saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(`Failed to save configuration: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartServices = async () => {
    if (!customServices) return;

    try {
      setLoading(true);
      const enabledServices = getEnabledServices(customServices, selectedProfile);
      const resolvedServices = resolveDependencies(customServices, enabledServices);
      
      await serviceOrchestration.startServices(resolvedServices, selectedProfile, selectedEnvironment);
      setSaveMessage('Services start request sent!');
      setTimeout(() => setSaveMessage(null), 3000);
      
      // Refresh service status
      await loadServiceStatus();
    } catch (err) {
      setError(`Failed to start services: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStopServices = async () => {
    if (!customServices) return;

    try {
      setLoading(true);
      const enabledServices = getEnabledServices(customServices, selectedProfile);
      await serviceOrchestration.stopServices(enabledServices);
      setSaveMessage('Services stop request sent!');
      setTimeout(() => setSaveMessage(null), 3000);
      
      // Refresh service status
      await loadServiceStatus();
    } catch (err) {
      setError(`Failed to stop services: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !customServices) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!customServices) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-red-600">Failed to load services configuration</div>
      </div>
    );
  }

  const servicesByCategory = getServicesByCategory(customServices);
  const enabledServiceCount = flattenCustomServices(customServices).filter(s => s.enabled).length;

  return (
    <div className={`p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Service Orchestrator</h2>
        <p className="text-gray-700 dark:text-gray-300">
          Configure which services to start in your local AI stack. 
          Currently {enabledServiceCount} services are enabled.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded">
          {error}
          <button 
            onClick={() => setError(null)} 
            className="ml-2 text-red-900 dark:text-red-200 hover:text-red-700 dark:hover:text-red-400"
          >
            ×
          </button>
        </div>
      )}

      {saveMessage && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 rounded">
          {saveMessage}
        </div>
      )}

      {/* Profile and Environment Selection */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            GPU Profile
          </label>
          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {Object.entries(customServices.profiles || {}).map(([profile, config]) => (
              <option key={profile} value={profile}>
                {profile.toUpperCase()} - {config.description}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Environment
          </label>
          <select
            value={selectedEnvironment}
            onChange={(e) => setSelectedEnvironment(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {Object.entries(customServices.environments || {}).map(([env, config]) => (
              <option key={env} value={env}>
                {env.charAt(0).toUpperCase() + env.slice(1)} - {config.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Services by Category */}
      <div className="space-y-6">
        {Object.entries(servicesByCategory).map(([category, services]) => (
          <div key={category} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 capitalize">
              {category.replace('_', ' ')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {services.map((service) => {
                const status = serviceStatus.find(s => s.id === service.id);
                return (
                  <div key={service.id} className="border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={service.enabled}
                          onChange={(e) => handleServiceToggle(service.id, e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 rounded"
                        />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{service.name}</span>
                      </div>
                      {status && (
                        <span className={`px-2 py-1 text-xs rounded ${
                          status.status === 'running' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                          status.status === 'stopped' ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300' :
                          'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        }`}>
                          {status.status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{service.description}</p>
                    {service.dependencies.length > 0 && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Depends on: {service.dependencies.join(', ')}
                      </div>
                    )}
                    {(() => {
                      const dependentServices = getServicesDependingOn(customServices, service.id);
                      return dependentServices.length > 0 && (
                        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          Required by: {dependentServices.join(', ')}
                        </div>
                      );
                    })()}
                    {service.profiles && selectedProfile && service.profiles[selectedProfile] && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Using: {service.profiles[selectedProfile]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={handleSaveConfiguration}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
        
        <button
          onClick={handleStartServices}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Starting...' : 'Start Selected Services'}
        </button>
        
        <button
          onClick={handleStopServices}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Stopping...' : 'Stop Services'}
        </button>
        
        <button
          onClick={loadServiceStatus}
          disabled={loading}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Refresh Status
        </button>
      </div>

      {/* Service Count Summary */}
      <div className="mt-4 text-sm text-gray-700 dark:text-gray-300">
        {enabledServiceCount} of {flattenCustomServices(customServices).length} services enabled
      </div>
    </div>
  );
};