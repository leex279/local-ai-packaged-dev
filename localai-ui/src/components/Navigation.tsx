import React from 'react';
import { Settings2Icon, FileTextIcon, PlayIcon, ActivityIcon, DownloadIcon, BrainIcon } from 'lucide-react';

interface NavigationProps {
  activeTab: 'env' | 'orchestrator' | 'monitoring' | 'export' | 'ollama';
  onTabChange: (tab: 'env' | 'orchestrator' | 'monitoring' | 'export' | 'ollama') => void;
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex space-x-4">
          <button
            onClick={() => onTabChange('orchestrator')}
            className={`flex items-center px-4 py-3 text-sm font-medium ${
              activeTab === 'orchestrator'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <PlayIcon className="w-4 h-4 mr-2" />
            Service Orchestrator
          </button>
          <button
            onClick={() => onTabChange('env')}
            className={`flex items-center px-4 py-3 text-sm font-medium ${
              activeTab === 'env'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <FileTextIcon className="w-4 h-4 mr-2" />
            Environment Variables
          </button>
          <button
            onClick={() => onTabChange('monitoring')}
            className={`flex items-center px-4 py-3 text-sm font-medium ${
              activeTab === 'monitoring'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <ActivityIcon className="w-4 h-4 mr-2" />
            Monitoring
          </button>
          <div
            className="flex items-center px-4 py-3 text-sm font-medium text-gray-400 dark:text-gray-500 cursor-not-allowed"
            title="Feature coming soon"
          >
            <BrainIcon className="w-4 h-4 mr-2" />
            Ollama Manager (coming soon...)
          </div>
          <div
            className="flex items-center px-4 py-3 text-sm font-medium text-gray-400 dark:text-gray-500 cursor-not-allowed"
            title="Feature coming soon"
          >
            <DownloadIcon className="w-4 h-4 mr-2" />
            Export/Import (coming soon...)
          </div>
        </div>
      </div>
    </nav>
  );
}