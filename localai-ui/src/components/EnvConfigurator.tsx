import React, { useState, useEffect } from 'react';
import { SaveIcon, AlertCircleIcon, EyeIcon, EyeOffIcon, UploadIcon, Download, ClipboardCopy, Check, RefreshCw, Key, Wand2 } from 'lucide-react';
import { loadConfig } from '../config';
import { generateAllSecrets, generateRandomString, generateSecurePassword, generateJWTSecret, generateHexKey } from '../utils/envFileHandler';

export interface EnvVariable {
  key: string;
  value: string;
  description?: string;
  required?: boolean;
}

interface EnvConfiguratorProps {
  variables?: EnvVariable[];
  onSave: (variables: EnvVariable[]) => void;
}

function parseEnvFile(envText: string): EnvVariable[] {
  const lines = envText.split('\n');
  let description = '';
  let required = false;
  const variables: EnvVariable[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith('#')) {
      // Skip decorative comment lines (only # symbols or short decorative text)
      if (trimmed.match(/^#+\s*$/) || 
          trimmed.match(/^#+\s*[\-\=\*\+\~\#\s]*$/) ||
          trimmed.length < 4) {
        continue;
      }
      
      // Skip section headers that are just decorative
      if (trimmed.match(/^#\s*[\-\=\*\+\~\#]{3,}/) ||
          trimmed.match(/^#\s*Everything below this point/) ||
          trimmed.match(/^#\s*\[.*\]\s*$/) ||
          trimmed.match(/^#\s*#{3,}/)) {
        continue;
      }

      // Check for required marker
      if (trimmed.toLowerCase().includes('[required]')) {
        required = true;
      }
      
      // Only use meaningful comments as descriptions
      const commentText = trimmed.substring(1).trim();
      
      // Skip if it's just a category marker or decorative text
      if (!commentText.match(/^[\-\=\*\+\~\#\s]*$/) && 
          !commentText.match(/^[A-Z][a-z\s\-]*$/) && // Skip simple category headers
          commentText.length > 10) { // Must be substantial text
        description = commentText.replace(/\[required\]/gi, '').trim();
      }
      continue;
    }

    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      variables.push({
        key: key.trim(),
        value: rest.join('=').trim(),
        description: description || undefined,
        required,
      });
      description = '';
      required = false;
    }
  }
  return variables;
}

function generateEnvContent(variables: EnvVariable[]): string {
  return variables
    .map(variable => {
      const lines = [];
      if (variable.description) {
        lines.push(`# ${variable.description}`);
      }
      lines.push(`${variable.key}=${variable.value}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

export default function EnvConfigurator({ variables: initialVariables = [], onSave }: EnvConfiguratorProps) {
  const [variables, setVariables] = useState<EnvVariable[]>(initialVariables);
  const [fileName, setFileName] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<{[key: string]: boolean}>({});
  const [generating, setGenerating] = useState(false);

  // Update variables when initialVariables prop changes
  useEffect(() => {
    if (initialVariables.length > 0 && variables.length === 0) {
      setVariables(initialVariables);
    }
  }, [initialVariables, variables.length]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setVariables(parseEnvFile(text));
    };
    reader.readAsText(file);
  };

  const handleVariableChange = (index: number, field: keyof EnvVariable, value: string | boolean) => {
    const updatedVariables = [...variables];
    updatedVariables[index] = { ...updatedVariables[index], [field]: value };
    setVariables(updatedVariables);
  };

  const handleCopyToClipboard = async () => {
    const content = generateEnvContent(variables);
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const content = generateEnvContent(variables);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateAllSecrets = async () => {
    setGenerating(true);
    try {
      const updatedVariables = generateAllSecrets(variables);
      setVariables(updatedVariables);
      setTimeout(() => setGenerating(false), 500);
    } catch (error) {
      console.error('Error generating secrets:', error);
      setGenerating(false);
    }
  };

  const handleGenerateSecret = (index: number, type: 'random' | 'password' | 'jwt' | 'hex') => {
    const updatedVariables = [...variables];
    let newValue = '';
    
    switch (type) {
      case 'random':
        newValue = generateRandomString(32);
        break;
      case 'password':
        newValue = generateSecurePassword(24);
        break;
      case 'jwt':
        newValue = generateJWTSecret(64);
        break;
      case 'hex':
        newValue = generateHexKey(32);
        break;
    }
    
    updatedVariables[index] = { ...updatedVariables[index], value: newValue };
    setVariables(updatedVariables);
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isSecretField = (variable: EnvVariable) => {
    return variable.key.toLowerCase().includes('secret') ||
           variable.key.toLowerCase().includes('key') ||
           variable.key.toLowerCase().includes('password') ||
           variable.key.toLowerCase().includes('token');
  };

  const getSecretType = (variable: EnvVariable): 'random' | 'password' | 'jwt' | 'hex' => {
    if (variable.key.includes('JWT') || variable.key.includes('jwt')) return 'jwt';
    if (variable.key.includes('PASSWORD') || variable.key.includes('password')) return 'password';
    if (variable.key === 'ENCRYPTION_KEY') return 'hex';
    return 'random';
  };

  const handleSaveToFile = async () => {
    try {
      setSaveStatus('saving');
      setSaveError(null);
      
      const content = generateEnvContent(variables);
      const config = await loadConfig();
      const apiUrl = `${config.apiBaseUrl}/api/save-env`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save env file');
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving env file:', error);
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Unknown error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Group variables by category based on description
  const groupedVariables = variables.reduce((acc, variable) => {
    const category = variable.description?.match(/\[(.*?)\]/)
      ? variable.description.match(/\[(.*?)\]/)![1]
      : 'Other';

    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(variable);
    return acc;
  }, {} as Record<string, EnvVariable[]>);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Environment Variables</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateAllSecrets}
              disabled={generating}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white rounded transition-colors ${
                generating
                  ? 'bg-purple-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {generating ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {generating ? 'Generating...' : 'Generate All Secrets'}
            </button>
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {copySuccess ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
              {copySuccess ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={handleSaveToFile}
              disabled={saveStatus === 'saving'}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white rounded transition-colors ${
                saveStatus === 'saving'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {saveStatus === 'saving' ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : saveStatus === 'success' ? (
                <Check className="w-4 h-4" />
              ) : (
                <SaveIcon className="w-4 h-4" />
              )}
              {saveStatus === 'saving' ? 'Saving...' : 
               saveStatus === 'success' ? 'Saved!' : 'Save to Disk'}
            </button>
            <label className="flex items-center cursor-pointer gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <UploadIcon className="w-4 h-4" />
              <span className="text-sm">Load .env File</span>
              <input
                type="file"
                accept=".env,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
        {fileName && (
          <div className="mt-2 text-xs text-gray-400">Loaded: {fileName}</div>
        )}
      </div>

      <div className="p-4 space-y-8">
        {variables.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <Key className="w-12 h-12 mx-auto mb-2" />
              <p className="text-lg font-medium">No environment variables loaded</p>
              <p className="text-sm">Upload a .env file or check your configuration</p>
            </div>
          </div>
        ) : (
          Object.entries(groupedVariables).map(([category, categoryVariables]) => (
            <div key={category} className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center gap-2">
                {category}
                <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                  ({categoryVariables.length} variables)
                </span>
              </h3>
              <div className="space-y-4">
                {categoryVariables.map((variable, idx) => {
                  const originalIndex = variables.findIndex(v => v.key === variable.key);
                  const isSecret = isSecretField(variable);
                  const showValue = !isSecret || showSecrets[variable.key];
                  const hasValue = variable.value && variable.value.trim() !== '';
                  const isPlaceholder = variable.value && (
                    variable.value.includes('super-secret') ||
                    variable.value.includes('your-') ||
                    variable.value.includes('generate-with') ||
                    variable.value === 'password' ||
                    variable.value === 'even-more-secret'
                  );
                  
                  return (
                    <div key={variable.key} className="grid grid-cols-12 gap-4 items-start p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="col-span-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {variable.key}
                          {variable.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        {variable.required && (
                          <div className="flex items-center text-amber-600 dark:text-amber-400 text-xs">
                            <AlertCircleIcon className="w-3 h-3 mr-1" />
                            <span>Required</span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-5">
                        <div className="relative">
                          <input
                            type={showValue ? "text" : "password"}
                            value={variable.value}
                            onChange={(e) => handleVariableChange(originalIndex, 'value', e.target.value)}
                            placeholder={variable.required ? "Required value" : "Optional"}
                            className={`w-full px-3 py-2 pr-20 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${
                              variable.required && (!hasValue || isPlaceholder)
                                ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                                : variable.required
                                ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          />
                          <div className="absolute right-2 top-2 flex items-center gap-1">
                            {isSecret && (
                              <button
                                type="button"
                                onClick={() => toggleSecretVisibility(variable.key)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                              >
                                {showValue ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                              </button>
                            )}
                            {isSecret && (
                              <button
                                type="button"
                                onClick={() => handleGenerateSecret(originalIndex, getSecretType(variable))}
                                className="p-1 text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                                title="Generate new secret"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {isPlaceholder && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            ⚠ Placeholder value - generate a secure secret
                          </p>
                        )}
                      </div>
                      <div className="col-span-4">
                        {variable.description && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {variable.description.replace(/\[.*?\]\s*/, '')}
                          </span>
                        )}
                        {isSecret && (
                          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
                            <Key className="w-3 h-3" />
                            Secret field
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}