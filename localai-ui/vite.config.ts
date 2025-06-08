import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import 'dotenv/config';

// Filter and prepare environment variables
const envVariables = {};
Object.keys(process.env).forEach(key => {
  envVariables[key] = JSON.stringify(process.env[key]);
});

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  define: {
    'process.env': envVariables
  },
  server: {
    fs: {
      strict: false,
      allow: [
        'src',
        'input',
        '.env',
        '/'  // Allow root access for Docker volume mounts
      ]
    }
  },
  preview: {
    port: 3000,
    host: true
  },
  cacheDir: '/tmp/vite-cache' // Store Vite cache in /tmp where we have write permissions
});