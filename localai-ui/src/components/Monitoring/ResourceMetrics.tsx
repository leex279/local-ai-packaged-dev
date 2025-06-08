import React from 'react';
import { ContainerStats } from './types';
import { Cpu, HardDrive, Network, MemoryStick } from 'lucide-react';

interface ResourceMetricsProps {
  containerId: string;
  stats?: ContainerStats;
}

export default function ResourceMetrics({ containerId, stats }: ResourceMetricsProps) {
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNetworkBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1000; // Network uses decimal not binary
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 80) {
      return 'bg-red-500';
    } else if (percentage >= 50) {
      return 'bg-yellow-500';
    } else {
      return 'bg-green-500';
    }
  };

  const ProgressBar = ({ percentage, label, value }: { percentage: number; label: string; value: string }) => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium text-gray-900 dark:text-white">{value}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(percentage)}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
        {percentage.toFixed(1)}%
      </div>
    </div>
  );

  if (!stats) {
    return (
      <div className="p-4">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Resource Usage
        </h4>
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
            <p>Loading resource metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
        Resource Usage
      </h4>
      
      <div className="space-y-6">
        {/* CPU Usage */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h5 className="font-medium text-gray-900 dark:text-white">CPU Usage</h5>
          </div>
          <ProgressBar
            percentage={stats.cpu}
            label="Processor"
            value={`${stats.cpu.toFixed(2)}%`}
          />
        </div>

        {/* Memory Usage */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <MemoryStick className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-2" />
            <h5 className="font-medium text-gray-900 dark:text-white">Memory Usage</h5>
          </div>
          <ProgressBar
            percentage={stats.memoryPercent}
            label="RAM"
            value={`${formatBytes(stats.memory)} / ${formatBytes(stats.memoryLimit)}`}
          />
        </div>

        {/* Network I/O */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Network className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
            <h5 className="font-medium text-gray-900 dark:text-white">Network I/O</h5>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Received</div>
              <div className="text-lg font-mono text-gray-900 dark:text-white">
                {formatNetworkBytes(stats.network.rx)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transmitted</div>
              <div className="text-lg font-mono text-gray-900 dark:text-white">
                {formatNetworkBytes(stats.network.tx)}
              </div>
            </div>
          </div>
        </div>

        {/* Disk I/O */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <HardDrive className="w-5 h-5 text-orange-600 dark:text-orange-400 mr-2" />
            <h5 className="font-medium text-gray-900 dark:text-white">Disk I/O</h5>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Read</div>
              <div className="text-lg font-mono text-gray-900 dark:text-white">
                {formatBytes(stats.diskIO.read)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Write</div>
              <div className="text-lg font-mono text-gray-900 dark:text-white">
                {formatBytes(stats.diskIO.write)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
        Last updated: {new Date(stats.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}