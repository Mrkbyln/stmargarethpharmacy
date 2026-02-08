import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Serve assets from root when deploying to Vercel (avoid wrong asset paths)
      base: '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:80',
            changeOrigin: true,
            rewrite: (path) => '/stmargareth' + path
          }
        }
      },
      plugins: [react()],
      build: {
        // Increase chunk size warning limit to reduce noisy warnings for large vendor chunks.
        // Adjust this value if you still want to be warned for very large bundles.
        chunkSizeWarningLimit: 1600,
        // Enable sourcemaps for production builds to help debugging runtime errors.
        sourcemap: true,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
                if (id.includes('recharts')) return 'vendor-recharts';
                return 'vendor';
              }
            }
          }
        }
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // Ensure bundler resolves to the single React installation in this repo
          'react': path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
        }
      }
    };
});
