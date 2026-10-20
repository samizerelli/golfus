import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = Number(env.API_PORT || 8787);
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // Tunnels https pour tester sur téléphone (voir README)
      allowedHosts: ['.trycloudflare.com', '.lhr.life', '.localhost.run', '.ngrok-free.app', '.ngrok.app'],
      proxy: { '/api': `http://localhost:${apiPort}` },
      // La base locale (PGlite) et le code serveur ne doivent pas recharger la page à chaque écriture
      watch: { ignored: ['**/data/**', '**/server/**', '**/netlify/**', '**/scripts/**'] },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
            map: ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
  };
});
