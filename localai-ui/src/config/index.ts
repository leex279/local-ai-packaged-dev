
export interface Config {
  referenceEnvFile: string;
  outputPath: string;
  apiBaseUrl: string;
}

export const defaultConfig: Config = {
  referenceEnvFile: '/input/env',
  outputPath: '/app/output',
  apiBaseUrl: 'http://localhost:5001'
};

export async function loadConfig(): Promise<Config> {
  try {
    console.log('[DEBUG] Loading config.json from:', '/config.json');
    const response = await fetch('/config.json');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ERROR] Failed to load config.json (${response.status}): ${errorText}`);
      throw new Error(`Failed to load config.json: ${response.statusText}`);
    }
    
    const config = await response.json();
    console.log('[DEBUG] Loaded config:', config);
    
    // Adjust API URL for Docker
    const finalConfig = { ...defaultConfig, ...config };
    if (window.location.hostname !== 'localhost') {
      finalConfig.apiBaseUrl = finalConfig.apiBaseUrl.replace('localhost', window.location.hostname);
      console.log(`[DEBUG] Adjusted API URL for Docker: ${finalConfig.apiBaseUrl}`);
    }
    
    return finalConfig;
  } catch (error) {
    console.warn('[WARN] Failed to load config.json, using default configuration:', error);
    console.log('[DEBUG] Default config:', defaultConfig);
    
    // Still adjust API URL for Docker in default config
    const finalConfig = { ...defaultConfig };
    if (window.location.hostname !== 'localhost') {
      finalConfig.apiBaseUrl = finalConfig.apiBaseUrl.replace('localhost', window.location.hostname);
      console.log(`[DEBUG] Adjusted default API URL for Docker: ${finalConfig.apiBaseUrl}`);
    }
    
    return finalConfig;
  }
}

