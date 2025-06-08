import { EnvVariable } from '../types';
import { loadConfig } from '../config';

// Secret generation utilities
export function generateRandomString(length: number = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

export function generateSecurePassword(length: number = 24): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

export function generateJWTSecret(length: number = 64): string {
  // JWT secrets should be base64-compatible
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

export function generateHexKey(bytes: number = 32): string {
  // Generate random bytes and convert to hex (similar to openssl rand -hex 32)
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function generateAllSecrets(variables: EnvVariable[]): EnvVariable[] {
  return variables.map(variable => {
    // Skip if variable already has a value and it's not a placeholder
    if (variable.value && 
        !variable.value.includes('super-secret') && 
        !variable.value.includes('password') && 
        !variable.value.includes('generate-with') &&
        !variable.value.includes('your-') &&
        variable.value !== 'even-more-secret') {
      return variable;
    }

    let newValue = variable.value;

    // Generate based on variable name patterns
    switch (variable.key) {
      case 'N8N_ENCRYPTION_KEY':
      case 'NEXTAUTH_SECRET':
      case 'LANGFUSE_SALT':
        newValue = generateRandomString(32);
        break;
      
      case 'N8N_USER_MANAGEMENT_JWT_SECRET':
      case 'JWT_SECRET':
        newValue = generateJWTSecret(64);
        break;
      
      case 'POSTGRES_PASSWORD':
      case 'DASHBOARD_PASSWORD':
      case 'CLICKHOUSE_PASSWORD':
      case 'MINIO_ROOT_PASSWORD':
        newValue = generateSecurePassword(24);
        break;
      
      case 'ENCRYPTION_KEY':
        newValue = generateHexKey(32);
        break;
      
      case 'SECRET_KEY_BASE':
        newValue = generateRandomString(64);
        break;
      
      case 'VAULT_ENC_KEY':
        newValue = generateRandomString(32);
        break;
      
      case 'LOGFLARE_LOGGER_BACKEND_API_KEY':
      case 'LOGFLARE_API_KEY':
        newValue = generateRandomString(48);
        break;
      
      case 'POOLER_TENANT_ID':
        newValue = Math.floor(Math.random() * 9000 + 1000).toString();
        break;
      
      default:
        // Check if it contains secret-like patterns
        if (variable.key.toLowerCase().includes('secret') ||
            variable.key.toLowerCase().includes('key') ||
            variable.key.toLowerCase().includes('password')) {
          newValue = generateRandomString(32);
        }
        break;
    }

    return { ...variable, value: newValue };
  });
}

export async function loadEnvFile(path?: string): Promise<EnvVariable[]> {
  try {
    console.log(`[DEBUG] Loading env file (path parameter ignored, using smart detection)`);
    
    // Get the API base URL from config
    const config = await loadConfig();
    
    // Use the new backend endpoint that handles multiple locations
    const apiUrl = `${config.apiBaseUrl}/api/load-env`;
    
    console.log(`[DEBUG] Actual env file fetch URL: ${apiUrl}`);
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ERROR] Failed to load .env file (${response.status}): ${errorText}`);
      throw new Error(`Failed to load .env file: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[DEBUG] Loaded env file content length: ${data.content.length} bytes from: ${data.sourcePath}`);
    console.log(`[DEBUG] First 100 chars: ${data.content.substring(0, 100)}...`);
    return parseEnvFile(data.content);
  } catch (error) {
    console.error('[ERROR] Failed to load .env file:', error);
    throw error;
  }
}

export function parseEnvFile(content: string): EnvVariable[] {
  const lines = content.split('\n');
  const variables: EnvVariable[] = [];
  let description = '';
  let required = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Handle comments
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
          !commentText.match(/^[A-Z][a-z\s\-]*$/) && // Skip simple category headers like "Database"
          commentText.length > 10) { // Must be substantial text
        description = commentText.replace(/\[required\]/gi, '').trim();
      }
      continue;
    }

    // Parse variable declaration
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      
      variables.push({
        key,
        value,
        description: description || undefined,
        required
      });
      
      // Reset for next variable
      description = '';
      required = false;
    }
  }

  return variables;
}

export function generateEnvFile(variables: EnvVariable[]): string {
  let output = '';

  for (const variable of variables) {
    // Add description as comment if present
    if (variable.description) {
      output += `# ${variable.description}\n`;
    }

    // Add the variable declaration
    output += `${variable.key}=${variable.value}\n\n`;
  }

  return output.trim();
}

export async function saveEnvFile(variables: EnvVariable[], outputPath?: string): Promise<void> {
  const content = generateEnvFile(variables);
  
  try {
    console.log(`[DEBUG] Saving env file, length: ${content.length} bytes`);
    
    const config = await loadConfig();
    const apiUrl = `${config.apiBaseUrl}/api/save-env`;
    
    console.log(`[DEBUG] Using API URL for saving env: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        // Don't specify path to use default project root location
        ...(outputPath && { path: outputPath })
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ERROR] Failed to save .env file (${response.status}): ${errorText}`);
      throw new Error('Failed to save .env file');
    }
    
    const result = await response.json();
    console.log('[DEBUG] Env file saved successfully to:', result.path);
    if (result.backupPath) {
      console.log('[DEBUG] Backup saved to:', result.backupPath);
    }
  } catch (error) {
    console.error('[ERROR] Error saving .env file:', error);
    throw error;
  }
}