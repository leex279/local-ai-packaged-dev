import React from 'react';
import { DockerContainer, ContainerStats } from './types';
import ContainerCard from './ContainerCard';
import { Play, Square, RotateCcw, Pause } from 'lucide-react';

interface ContainerListProps {
  containers: DockerContainer[];
  containerStats: Record<string, ContainerStats>;
  selectedContainer: string | null;
  onSelectContainer: (id: string) => void;
  onContainerAction: (id: string, action: 'start' | 'stop' | 'restart') => Promise<void>;
  loading: boolean;
}

export default function ContainerList({
  containers,
  containerStats,
  selectedContainer,
  onSelectContainer,
  onContainerAction,
  loading
}: ContainerListProps) {
  
  const getStatusColor = (status: DockerContainer['status']) => {
    switch (status) {
      case 'running':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'stopped':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'paused':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'restarting':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'dead':
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getStatusIcon = (status: DockerContainer['status']) => {
    switch (status) {
      case 'running':
        return <div className="w-2 h-2 bg-green-500 rounded-full"></div>;
      case 'stopped':
        return <div className="w-2 h-2 bg-red-500 rounded-full"></div>;
      case 'paused':
        return <div className="w-2 h-2 bg-blue-500 rounded-full"></div>;
      case 'restarting':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>;
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full"></div>;
    }
  };

  const formatUptime = (uptime: number) => {
    if (uptime === 0) return '-';
    
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading && containers.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Loading containers...</p>
      </div>
    );
  }

  if (containers.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">No containers found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Containers ({containers.length})
      </h3>
      
      {/* Table view for larger screens */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Container
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Uptime
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Resources
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Ports
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {containers.map((container) => {
              const stats = containerStats[container.id];
              return (
                <tr
                  key={container.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                    selectedContainer === container.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                      : ''
                  }`}
                  onClick={() => onSelectContainer(container.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(container.status)}
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {container.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {container.image}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(container.status)}`}>
                      {container.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatUptime(container.uptime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {stats ? (
                      <div className="space-y-1">
                        <div>CPU: {stats.cpu.toFixed(1)}%</div>
                        <div>RAM: {formatBytes(stats.memory)}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {container.ports.length > 0 ? (
                      <div className="space-y-1">
                        {container.ports.slice(0, 2).map((port, idx) => (
                          <div key={idx} className="text-xs">
                            {port.publicPort ? (
                              <a
                                href={`http://localhost:${port.publicPort}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                onClick={(e) => e.stopPropagation()}
                              >
                                :{port.publicPort}→{port.privatePort}
                              </a>
                            ) : (
                              <span>:{port.privatePort}</span>
                            )}
                          </div>
                        ))}
                        {container.ports.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{container.ports.length - 2} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                      {container.status === 'stopped' && (
                        <button
                          onClick={() => onContainerAction(container.id, 'start')}
                          className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 transition-colors"
                          title="Start container"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {container.status === 'running' && (
                        <button
                          onClick={() => onContainerAction(container.id, 'stop')}
                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 transition-colors"
                          title="Stop container"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                      {(container.status === 'running' || container.status === 'stopped') && (
                        <button
                          onClick={() => onContainerAction(container.id, 'restart')}
                          className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 transition-colors"
                          title="Restart container"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Card view for mobile */}
      <div className="md:hidden space-y-4">
        {containers.map((container) => (
          <ContainerCard
            key={container.id}
            container={container}
            stats={containerStats[container.id]}
            isSelected={selectedContainer === container.id}
            onSelect={() => onSelectContainer(container.id)}
            onAction={onContainerAction}
          />
        ))}
      </div>
    </div>
  );
}