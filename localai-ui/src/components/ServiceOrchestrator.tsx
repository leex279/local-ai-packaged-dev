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
import { 
  serviceDefinitions, 
  getAllServiceDefinitions, 
  getServicesByCategory as getDefinitionsByCategory,
  profileDefinitions,
  environmentDefinitions,
  ServiceDefinition
} from '../data/serviceDefinitions';
import { CheckSquare, Square, ToggleLeft, ToggleRight, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [selectAllStates, setSelectAllStates] = useState<{[category: string]: boolean}>({});

  useEffect(() => {
    loadServicesConfiguration();
    loadServiceStatus();
  }, []);

  const loadServicesConfiguration = async () => {
    try {
      setLoading(true);
      
      // Load service state from API (enabled/disabled preferences)
      const serviceState = await serviceOrchestration.getCustomServices();
      
      // Merge service definitions with state to create complete configuration
      const mergedConfig = mergeServiceDefinitionsWithState(serviceState);
      setCustomServices(mergedConfig);
      
      // Set profile and environment from saved preferences or defaults
      const savedProfile = mergedConfig.userPreferences?.selectedProfile;
      const savedEnvironment = mergedConfig.userPreferences?.selectedEnvironment;
      const defaultProfile = Object.entries(profileDefinitions).find(([, p]) => p.default)?.[0] || 'cpu';
      const defaultEnvironment = Object.entries(environmentDefinitions).find(([, e]) => e.default)?.[0] || 'private';
      
      setSelectedProfile(savedProfile || defaultProfile);
      setSelectedEnvironment(savedEnvironment || defaultEnvironment);
    } catch (err) {
      setError(`Failed to load services configuration: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Merge service definitions from code with state from API
  const mergeServiceDefinitionsWithState = (serviceState: any): CustomServicesJson => {
    const mergedServices: any = {};
    
    // Start with service definitions from code
    Object.entries(serviceDefinitions).forEach(([categoryId, categoryServices]) => {
      mergedServices[categoryId] = {};
      
      Object.entries(categoryServices).forEach(([serviceId, serviceDef]) => {
        // Get state from API or default to false
        const stateFromApi = serviceState?.services?.[categoryId]?.[serviceId];
        const enabled = stateFromApi?.enabled || false;
        
        mergedServices[categoryId][serviceId] = {
          enabled,
          required: serviceDef.required,
          description: serviceDef.description,
          category: serviceDef.category,
          dependencies: serviceDef.dependencies,
          ...(serviceDef.profiles && { profiles: serviceDef.profiles }),
          ...(serviceDef.pull_services && { pull_services: serviceDef.pull_services }),
          ...(serviceDef.external_compose && { external_compose: serviceDef.external_compose }),
          ...(serviceDef.compose_path && { compose_path: serviceDef.compose_path })
        };
      });
    });

    return {
      version: "1.0",
      description: "Configuration file for customizing which services to start in the local AI stack",
      services: mergedServices,
      profiles: profileDefinitions,
      environments: environmentDefinitions,
      userPreferences: {
        selectedProfile: serviceState?.userPreferences?.selectedProfile,
        selectedEnvironment: serviceState?.userPreferences?.selectedEnvironment
      }
    };
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
      
      // Update the configuration with current profile and environment selections
      const updatedConfig = {
        ...customServices,
        userPreferences: {
          selectedProfile,
          selectedEnvironment
        }
      };
      
      await serviceOrchestration.updateCustomServices(updatedConfig);
      setCustomServices(updatedConfig);
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

  // Helper functions for new UI
  const toggleCategory = (category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  const handleSelectAllCategory = (category: string, enabled: boolean) => {
    if (!customServices) return;

    const updatedServices = { ...customServices };
    const categoryServices = updatedServices.services[category];

    if (categoryServices) {
      Object.keys(categoryServices).forEach(serviceId => {
        categoryServices[serviceId] = { ...categoryServices[serviceId], enabled };
      });

      setCustomServices(updatedServices);
      setSelectAllStates({ ...selectAllStates, [category]: enabled });
    }
  };

  const handleSelectAllGlobal = (enabled: boolean) => {
    if (!customServices) return;

    const updatedServices = { ...customServices };
    const newSelectAllStates: {[category: string]: boolean} = {};

    Object.keys(updatedServices.services).forEach(category => {
      Object.keys(updatedServices.services[category]).forEach(serviceId => {
        updatedServices.services[category][serviceId] = { 
          ...updatedServices.services[category][serviceId], 
          enabled 
        };
      });
      newSelectAllStates[category] = enabled;
    });

    setCustomServices(updatedServices);
    setSelectAllStates(newSelectAllStates);
  };

  const getCategoryStats = (category: string) => {
    if (!customServices?.services[category]) return { enabled: 0, total: 0 };
    
    const services = Object.values(customServices.services[category]);
    const enabled = services.filter(s => s.enabled).length;
    const total = services.length;
    
    return { enabled, total };
  };

  const getGlobalStats = () => {
    if (!customServices) return { enabled: 0, total: 0 };
    
    let enabled = 0;
    let total = 0;
    
    Object.values(customServices.services).forEach(category => {
      Object.values(category).forEach(service => {
        total++;
        if (service.enabled) enabled++;
      });
    });
    
    return { enabled, total };
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
  const globalStats = getGlobalStats();

  return (
    <div className={`p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Service Orchestrator</h2>
        <p className="text-gray-700 dark:text-gray-300">
          Configure which services to start in your local AI stack. 
          Currently {globalStats.enabled} of {globalStats.total} services are enabled.
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

      {/* Global Controls */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Global Controls</h3>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {globalStats.enabled} of {globalStats.total} services enabled
            </span>
            <button
              onClick={() => handleSelectAllGlobal(globalStats.enabled < globalStats.total)}
              className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            >
              {globalStats.enabled === globalStats.total ? (
                <ToggleRight className="w-4 h-4" />
              ) : (
                <ToggleLeft className="w-4 h-4" />
              )}
              {globalStats.enabled === globalStats.total ? 'Disable All' : 'Enable All'}
            </button>
          </div>
        </div>

        {/* Profile and Environment Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      {/* Services by Category */}
      <div className="space-y-4">
        {Object.entries(servicesByCategory).map(([category, services]) => {
          const categoryStats = getCategoryStats(category);
          const isCollapsed = collapsedCategories.has(category);
          
          return (
            <div key={category} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              {/* Category Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                      <h3 className="text-lg font-semibold capitalize">
                        {category.replace('_', ' ')}
                      </h3>
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                      {categoryStats.enabled}/{categoryStats.total}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handleSelectAllCategory(category, categoryStats.enabled < categoryStats.total)}
                    className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  >
                    {categoryStats.enabled === categoryStats.total ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    {categoryStats.enabled === categoryStats.total ? 'Disable All' : 'Enable All'}
                  </button>
                </div>
              </div>

              {/* Category Services */}
              {!isCollapsed && (
                <div className="p-4">
                  <div className="space-y-3">
                    {services.map((service) => {
                      const status = serviceStatus.find(s => s.id === service.id);
                      const dependentServices = getServicesDependingOn(customServices, service.id);
                      
                      return (
                        <div key={service.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <div className="flex items-center gap-3 flex-1">
                            {/* Service Toggle */}
                            <button
                              onClick={() => handleServiceToggle(service.id, !service.enabled)}
                              className={`flex items-center transition-colors ${
                                service.enabled 
                                  ? 'text-blue-600 dark:text-blue-400' 
                                  : 'text-gray-400 dark:text-gray-500'
                              }`}
                              title={service.enabled ? 'Click to disable' : 'Click to enable'}
                            >
                              {service.enabled ? (
                                <ToggleRight className="w-5 h-5" />
                              ) : (
                                <ToggleLeft className="w-5 h-5" />
                              )}
                            </button>
                            
                            {/* Service Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {service.name}
                                </span>
                                {status && (
                                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                                    status.status === 'running' 
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                                      : status.status === 'stopped' 
                                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' 
                                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                  }`}>
                                    {status.status}
                                  </span>
                                )}
                                {service.required && (
                                  <span className="px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">
                                    Required
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                {service.description}
                              </p>
                              
                              {/* Dependencies and Requirements */}
                              <div className="flex flex-wrap gap-2 text-xs">
                                {service.dependencies.length > 0 && (
                                  <span className="text-gray-500 dark:text-gray-400">
                                    Dependencies: {service.dependencies.join(', ')}
                                  </span>
                                )}
                                {dependentServices.length > 0 && (
                                  <span className="text-orange-600 dark:text-orange-400">
                                    Required by: {dependentServices.join(', ')}
                                  </span>
                                )}
                                {service.profiles && selectedProfile && service.profiles[selectedProfile] && (
                                  <span className="text-blue-600 dark:text-blue-400">
                                    Profile: {service.profiles[selectedProfile]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
        {globalStats.enabled} of {globalStats.total} services enabled
      </div>
    </div>
  );
};