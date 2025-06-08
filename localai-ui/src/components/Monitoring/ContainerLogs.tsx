import React, { useState, useEffect, useRef } from 'react';
import { ContainerLogEntry } from './types';
import { Download, Search, RotateCcw, Pause, Play } from 'lucide-react';
import { loadConfig } from '../../config';

interface ContainerLogsProps {
  containerId: string;
  autoRefresh: boolean;
}

export default function ContainerLogs({ containerId, autoRefresh }: ContainerLogsProps) {
  const [logs, setLogs] = useState<ContainerLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

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

  const fetchLogs = async () => {
    if (isPaused || !apiBaseUrl) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${apiBaseUrl}/api/docker/containers/${containerId}/logs?tail=100`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch logs: ${response.status} - ${errorText}`);
      }
      
      const logEntries: ContainerLogEntry[] = await response.json();
      setLogs(logEntries);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (apiBaseUrl) {
      fetchLogs();

      if (autoRefresh && !isPaused) {
        const interval = setInterval(fetchLogs, 3000); // Refresh every 3 seconds
        return () => clearInterval(interval);
      }
    }
  }, [apiBaseUrl, containerId, autoRefresh, isPaused]);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesText = filterText === '' || 
      log.message.toLowerCase().includes(filterText.toLowerCase());
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    return matchesText && matchesLevel;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warn':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'debug':
        return 'text-gray-500 dark:text-gray-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  const downloadLogs = () => {
    const logText = logs.map(log => 
      `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  return (
    <div className="h-96 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
          Container Logs
        </h4>
        <div className="flex items-center space-x-2">
          <button
            onClick={togglePause}
            className={`p-2 rounded-md transition-colors ${
              isPaused
                ? 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}
            title={isPaused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 transition-colors disabled:opacity-50"
            title="Refresh logs"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={downloadLogs}
            className="p-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 transition-colors"
            title="Download logs"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filter logs..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All levels</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
        <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          <span>Auto-scroll</span>
        </label>
      </div>

      {/* Logs content */}
      <div 
        ref={logsContainerRef}
        className="flex-1 overflow-auto bg-gray-900 text-green-400 font-mono text-sm p-4"
      >
        {error ? (
          <div className="text-red-400 p-4 text-center">
            Error loading logs: {error}
          </div>
        ) : loading && logs.length === 0 ? (
          <div className="text-gray-400 p-4 text-center">
            Loading logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-gray-400 p-4 text-center">
            {logs.length === 0 ? 'No logs available' : 'No logs match the current filter'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log, index) => (
              <div key={index} className="flex space-x-3 hover:bg-gray-800 px-2 py-1 rounded">
                <span className="text-gray-500 text-xs flex-shrink-0 w-20">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`text-xs font-semibold flex-shrink-0 w-12 ${getLevelColor(log.level)}`}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className="flex-1 whitespace-pre-wrap break-words">
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
        <span>
          {filteredLogs.length} of {logs.length} logs
          {filterText || filterLevel !== 'all' ? ' (filtered)' : ''}
        </span>
        <span>
          {isPaused ? 'Paused' : autoRefresh ? 'Auto-refreshing' : 'Manual refresh'}
        </span>
      </div>
    </div>
  );
}