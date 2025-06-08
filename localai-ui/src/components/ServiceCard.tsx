import React from 'react';
import { ServiceDefinition, ServicesState } from '../types';
import { CheckIcon, HardDriveIcon, ServerIcon, BrainCircuitIcon, PackageIcon } from 'lucide-react';

interface ServiceCardProps {
  service: ServiceDefinition;
  state: ServicesState;
  onToggle: (id: string, selected: boolean) => void;
}

export default function ServiceCard({ service, state, onToggle }: ServiceCardProps) {
  const isSelected = state[service.id]?.selected;
  const isDependency = state[service.id]?.dependencyOf.length > 0;
  const isRequired = state[service.id]?.required;
  
  // Determine if this service is disabled (can't be deselected because it's a dependency)
  const isDisabled = isDependency || isRequired;

  // Get the appropriate icon based on service category
  const getIcon = () => {
    switch (service.category) {
      case 'ai':
        return <BrainCircuitIcon className="h-5 w-5 text-purple-500" />;
      case 'database':
        return <HardDriveIcon className="h-5 w-5 text-blue-500" />;
      case 'infrastructure':
        return <ServerIcon className="h-5 w-5 text-green-500" />;
      case 'utility':
      default:
        return <PackageIcon className="h-5 w-5 text-amber-500" />;
    }
  };

  return (
    <div 
      className={`border rounded-lg p-4 transition-all duration-200 ${
        isSelected 
          ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700' 
          : 'border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700'
      } hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div className="mr-3">
            {getIcon()}
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{service.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{service.description}</p>
          </div>
        </div>
        
        <button
          onClick={() => onToggle(service.id, !isSelected)}
          disabled={isDisabled && isSelected}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isSelected ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
          } ${isDisabled && isSelected ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          role="switch"
          aria-checked={isSelected}
        >
          <span
            className={`${
              isSelected ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
          >
            {isSelected && <CheckIcon className="h-3 w-3 text-blue-600" />}
          </span>
        </button>
      </div>
      
      {isDependency && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Required by: {state[service.id]?.dependencyOf.join(', ')}
        </div>
      )}
      
      {isRequired && (
        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
          Required service (cannot be disabled)
        </div>
      )}
      
      {service.ports && service.ports.length > 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Ports: {service.ports.join(', ')}
        </div>
      )}
    </div>
  );
}