
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
    
    // Adjust API URL to use current host
    const finalConfig = { ...defaultConfig, ...config };
    const currentOrigin = window.location.origin;
    const apiPort = finalConfig.apiBaseUrl.split(':').pop(); // Extract port from URL
    finalConfig.apiBaseUrl = `${currentOrigin.replace(':5000', `:${apiPort}`)}`;
    console.log(`[DEBUG] Adjusted API URL to use current host: ${finalConfig.apiBaseUrl}`);
    
    return finalConfig;
  } catch (error) {
    console.warn('[WARN] Failed to load config.json, using default configuration:', error);
    console.log('[DEBUG] Default config:', defaultConfig);
    
    // Still adjust API URL to use current host in default config
    const finalConfig = { ...defaultConfig };
    const currentOrigin = window.location.origin;
    const apiPort = finalConfig.apiBaseUrl.split(':').pop(); // Extract port from URL
    finalConfig.apiBaseUrl = `${currentOrigin.replace(':5000', `:${apiPort}`)}`;
    console.log(`[DEBUG] Adjusted default API URL to use current host: ${finalConfig.apiBaseUrl}`);
    
    return finalConfig;
  }
}

