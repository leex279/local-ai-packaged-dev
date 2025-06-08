import React, { useState, useEffect } from 'react';
import { EnvVariable } from './types';
import { loadConfig } from './config';
import { loadEnvFile, saveEnvFile } from './utils/envFileHandler';
import EnvConfigurator from './components/EnvConfigurator';
import Header from './components/Header';
import Navigation from './components/Navigation';
import { ServiceOrchestrator } from './components/ServiceOrchestrator';
import MonitoringDashboard from './components/Monitoring/MonitoringDashboard';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'env' | 'orchestrator' | 'monitoring'>('orchestrator');
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>('Initializing...');
  
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setLoadingStatus('Loading configuration...');
        
        console.log('[DEBUG] App starting, window.location:', window.location.toString());
        
        const loadedConfig = await loadConfig();
        setConfig(loadedConfig);
        console.log('[DEBUG] Config loaded with API URL:', loadedConfig.apiBaseUrl);
        
        // Check server basic connectivity
        setLoadingStatus('Checking server connectivity...');
        try {
          const statusResponse = await fetch(`${loadedConfig.apiBaseUrl}/api/status`);
          if (statusResponse.ok) {
            const status = await statusResponse.json();
            console.log('[DEBUG] Server status:', status);
          } else {
            console.error('[ERROR] Server status check failed:', statusResponse.statusText);
          }
        } catch (statusError) {
          console.error('[ERROR] Error checking server status:', statusError);
        }
        
        // Load environment variables (auto-detects best source)
        setLoadingStatus('Loading environment variables...');
        try {
          const loadedEnvVars = await loadEnvFile();
          setEnvVariables(loadedEnvVars);
          console.log(`[DEBUG] Loaded ${loadedEnvVars.length} environment variables`);
        } catch (envError) {
          console.error('[ERROR] Failed to load env file, using default empty array:', envError);
          setEnvVariables([]);
        }
      } catch (err) {
        console.error('[ERROR] Failed to load configuration:', err);
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    }
    
    loadInitialData();
  }, []);

  // Handle saving env variables
  const handleSaveEnv = async (variables: EnvVariable[]) => {
    try {
      setEnvVariables(variables);
      // Save to project root by default (where start_services.py expects it)
      await saveEnvFile(variables);
    } catch (error) {
      console.error('[ERROR] Failed to save env file:', error);
    }
  };
  
  // Manual retry loading
  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if the config loads properly
      const loadedConfig = await loadConfig();
      console.log('[DEBUG] Retry: Checking server status...');
      
      const statusResponse = await fetch(`${loadedConfig.apiBaseUrl}/api/status`);
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        console.log('[DEBUG] Retry: Server status:', status);
      }
      
      // Try to load environment variables again
      console.log('[DEBUG] Retry: Loading environment variables...');
      const loadedEnvVars = await loadEnvFile();
      setEnvVariables(loadedEnvVars);
    } catch (err) {
      console.error('[ERROR] Retry failed:', err);
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400 flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
          <div className="text-lg">{loadingStatus}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-red-600 dark:text-red-400 max-w-md text-center">
          <h2 className="text-xl font-bold mb-4">Error Loading Configuration</h2>
          <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-lg">
            {error}
          </div>
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Please check that the Docker container has proper access to the mounted files.
          </div>
          <button 
            onClick={handleRetry}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <Header />
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-lg text-gray-700 dark:text-gray-300">
            {activeTab === 'orchestrator'
              ? 'Manage your local AI services with intelligent configuration and real-time orchestration. Configure which services to run and control them directly from this interface.'
              : activeTab === 'monitoring'
              ? 'Monitor and manage your Docker containers in real-time. View container status, logs, resource usage, and perform basic lifecycle operations.'
              : 'Configure your environment variables. These settings will be saved to your .env file.'}
          </p>
        </div>

        {activeTab === 'orchestrator' ? (
          <ServiceOrchestrator className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm" />
        ) : activeTab === 'monitoring' ? (
          <MonitoringDashboard className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm" />
        ) : (
          <EnvConfigurator
            variables={envVariables}
            onSave={handleSaveEnv}
          />
        )}
      </main>
      
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>LocalAI UI Configurator - Manage your local AI services</p>
        </div>
      </footer>
    </div>
  );
}

export default App;