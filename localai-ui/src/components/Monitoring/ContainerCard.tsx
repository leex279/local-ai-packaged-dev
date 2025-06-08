import React from 'react';
import { DockerContainer, ContainerStats } from './types';
import { Play, Square, RotateCcw, ExternalLink } from 'lucide-react';

interface ContainerCardProps {
  container: DockerContainer;
  stats?: ContainerStats;
  isSelected: boolean;
  onSelect: () => void;
  onAction: (id: string, action: 'start' | 'stop' | 'restart') => Promise<void>;
}

export default function ContainerCard({
  container,
  stats,
  isSelected,
  onSelect,
  onAction
}: ContainerCardProps) {
  
  const getStatusColor = (status: DockerContainer['status']) => {
    switch (status) {
      case 'running':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'stopped':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'paused':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'restarting':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'dead':
        return 'border-gray-500 bg-gray-50 dark:bg-gray-900/20';
      default:
        return 'border-gray-300 bg-white dark:bg-gray-800';
    }
  };

  const getStatusIcon = (status: DockerContainer['status']) => {
    switch (status) {
      case 'running':
        return <div className="w-3 h-3 bg-green-500 rounded-full"></div>;
      case 'stopped':
        return <div className="w-3 h-3 bg-red-500 rounded-full"></div>;
      case 'paused':
        return <div className="w-3 h-3 bg-blue-500 rounded-full"></div>;
      case 'restarting':
        return <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>;
      default:
        return <div className="w-3 h-3 bg-gray-500 rounded-full"></div>;
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

  return (
    <div
      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
        isSelected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : getStatusColor(container.status)
      } hover:shadow-md`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getStatusIcon(container.status)}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {container.name}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {container.image}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
          container.status === 'running' 
            ? 'text-green-800 bg-green-100 dark:bg-green-900/30 dark:text-green-300'
            : container.status === 'stopped'
            ? 'text-red-800 bg-red-100 dark:bg-red-900/30 dark:text-red-300'
            : 'text-gray-800 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-300'
        }`}>
          {container.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Uptime</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatUptime(container.uptime)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Resources</p>
          {stats ? (
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              <div>CPU: {stats.cpu.toFixed(1)}%</div>
              <div>RAM: {formatBytes(stats.memory)}</div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">-</p>
          )}
        </div>
      </div>

      {/* Ports */}
      {container.ports.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ports</p>
          <div className="flex flex-wrap gap-1">
            {container.ports.slice(0, 3).map((port, idx) => (
              <span
                key={idx}
                className="inline-flex items-center text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
              >
                {port.publicPort ? (
                  <a
                    href={`http://localhost:${port.publicPort}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    :{port.publicPort}→{port.privatePort}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                ) : (
                  <span>:{port.privatePort}</span>
                )}
              </span>
            ))}
            {container.ports.length > 3 && (
              <span className="text-xs text-gray-500">
                +{container.ports.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
        {container.status === 'stopped' && (
          <button
            onClick={() => onAction(container.id, 'start')}
            className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 transition-colors"
          >
            <Play className="w-3 h-3 mr-1" />
            Start
          </button>
        )}
        {container.status === 'running' && (
          <button
            onClick={() => onAction(container.id, 'stop')}
            className="flex items-center px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 transition-colors"
          >
            <Square className="w-3 h-3 mr-1" />
            Stop
          </button>
        )}
        {(container.status === 'running' || container.status === 'stopped') && (
          <button
            onClick={() => onAction(container.id, 'restart')}
            className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 transition-colors"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Restart
          </button>
        )}
      </div>
    </div>
  );
}