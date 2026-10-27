import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'lucide-react': path.resolve(__dirname, 'src/components/ui/Icons.tsx'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});

