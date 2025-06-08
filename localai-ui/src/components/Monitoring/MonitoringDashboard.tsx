import React, { useState, useEffect } from 'react';
import { DockerContainer, ContainerStats, MonitoringState } from './types';
import ContainerList from './ContainerList';
import ContainerLogs from './ContainerLogs';
import ResourceMetrics from './ResourceMetrics';
import { AlertCircle, RefreshCw, Settings } from 'lucide-react';
import { loadConfig } from '../../config';

interface MonitoringDashboardProps {
  className?: string;
}

export default function MonitoringDashboard({ className }: MonitoringDashboardProps) {
  const [state, setState] = useState<MonitoringState>({
    containers: [],
    selectedContainer: null,
    containerStats: {},
    containerLogs: {},
    loading: true,
    error: null,
    autoRefresh: true,
    refreshInterval: 5000,
  });

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');

  // Load API configuration
  useEffect(() => {
    const initializeConfig = async () => {
      try {
        const config = await loadConfig();
        setApiBaseUrl(config.apiBaseUrl);
      } catch (error) {
        console.error('Failed to load config:', error);
        setApiBaseUrl('http://localhost:5001'); // fallback
      }
    };
    initializeConfig();
  }, []);

  // Fetch containers from backend
  const fetchContainers = async () => {
    if (!apiBaseUrl) return;
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/docker/containers`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch containers: ${response.status} - ${errorText}`);
      }
      const containers: DockerContainer[] = await response.json();
      setState(prev => ({ ...prev, containers, loading: false, error: null }));
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching containers:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to fetch containers',
        loading: false 
      }));
    }
  };

  // Fetch container stats
  const fetchContainerStats = async (containerId: string) => {
    if (!apiBaseUrl) return;
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/docker/containers/${containerId}/stats`);
      if (!response.ok) {
        throw new Error(`Failed to fetch stats for ${containerId}`);
      }
      const stats: ContainerStats = await response.json();
      setState(prev => ({
        ...prev,
        containerStats: {
          ...prev.containerStats,
          [containerId]: stats
        }
      }));
    } catch (error) {
      console.error(`Failed to fetch stats for ${containerId}:`, error);
    }
  };

  // Perform container action
  const performContainerAction = async (containerId: string, action: 'start' | 'stop' | 'restart') => {
    if (!apiBaseUrl) return;
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/docker/containers/${containerId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to ${action} container: ${response.status} - ${errorText}`);
      }

      // Refresh containers after action
      await fetchContainers();
    } catch (error) {
      console.error(`Error performing ${action} on container ${containerId}:`, error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : `Failed to ${action} container`
      }));
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (apiBaseUrl) {
      fetchContainers();

      if (state.autoRefresh) {
        const interval = setInterval(fetchContainers, state.refreshInterval);
        return () => clearInterval(interval);
      }
    }
  }, [apiBaseUrl, state.autoRefresh, state.refreshInterval]);

  // Fetch stats for running containers
  useEffect(() => {
    if (apiBaseUrl) {
      const runningContainers = state.containers.filter(c => c.status === 'running');
      runningContainers.forEach(container => {
        fetchContainerStats(container.id);
      });

      if (state.autoRefresh && runningContainers.length > 0) {
        const interval = setInterval(() => {
          runningContainers.forEach(container => {
            fetchContainerStats(container.id);
          });
        }, state.refreshInterval);
        return () => clearInterval(interval);
      }
    }
  }, [apiBaseUrl, state.containers, state.autoRefresh, state.refreshInterval]);

  const toggleAutoRefresh = () => {
    setState(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }));
  };

  const manualRefresh = () => {
    setState(prev => ({ ...prev, loading: true }));
    fetchContainers();
  };

  const runningCount = state.containers.filter(c => c.status === 'running').length;
  const stoppedCount = state.containers.filter(c => c.status === 'stopped').length;
  const issuesCount = state.containers.filter(c => 
    c.status === 'dead' || c.status === 'restarting'
  ).length;

  if (state.loading && state.containers.length === 0) {
    return (
      <div className={`${className} p-6`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
            <p className="text-gray-600 dark:text-gray-400">Loading containers...</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    const isDockerError = state.error.includes('Docker daemon not available') || 
                         state.error.includes('connect to Docker socket') ||
                         state.error.includes('503');
    
    return (
      <div className={`${className} p-6`}>
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <h3 className="text-red-800 dark:text-red-200 font-medium">
              {isDockerError ? 'Docker Not Available' : 'Error'}
            </h3>
          </div>
          <p className="text-red-700 dark:text-red-300 mt-2">{state.error}</p>
          {isDockerError && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
              <p className="mb-2">To enable Docker monitoring:</p>
              <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded border-l-4 border-red-500 mb-3">
                <p className="font-medium mb-2">Quick Fix:</p>
                <p className="font-mono text-xs bg-gray-800 text-green-400 p-2 rounded">
                  cd localai-ui && ./setup-docker-permissions.sh
                </p>
              </div>
              <p className="mb-2">Or manually configure:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Ensure Docker is running on your system</li>
                <li>Get Docker group ID: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">stat -c '%g' /var/run/docker.sock</code></li>
                <li>Set DOCKER_GROUP_ID in .env file</li>
                <li>Rebuild container: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">docker-compose up --build</code></li>
                <li>Verify Docker socket is mounted and accessible</li>
              </ol>
            </div>
          )}
          <button
            onClick={manualRefresh}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with stats and controls */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Docker Container Monitoring
          </h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleAutoRefresh}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                state.autoRefresh
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Auto-refresh {state.autoRefresh ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={manualRefresh}
              disabled={state.loading}
              className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-green-800 dark:text-green-300 font-medium">Running</span>
            </div>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
              {runningCount}
            </p>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span className="text-red-800 dark:text-red-300 font-medium">Stopped</span>
            </div>
            <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
              {stoppedCount}
            </p>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
              <span className="text-yellow-800 dark:text-yellow-300 font-medium">Issues</span>
            </div>
            <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">
              {issuesCount}
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      </div>

      {/* Container list */}
      <div className="p-6">
        <ContainerList
          containers={state.containers}
          containerStats={state.containerStats}
          selectedContainer={state.selectedContainer}
          onSelectContainer={(id) => setState(prev => ({ ...prev, selectedContainer: id }))}
          onContainerAction={performContainerAction}
          loading={state.loading}
        />
      </div>

      {/* Container details */}
      {state.selectedContainer && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <ContainerLogs
                containerId={state.selectedContainer}
                autoRefresh={state.autoRefresh}
              />
              <div className="space-y-4">
                <ResourceMetrics
                  containerId={state.selectedContainer}
                  stats={state.containerStats[state.selectedContainer]}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}