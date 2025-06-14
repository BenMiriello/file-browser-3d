import { defineConfig } from 'vite';
import { filesystemApiPlugin } from './server/filesystem-api.js';

export default defineConfig({
  plugins: [filesystemApiPlugin()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'FileBrowser3D',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format === 'es' ? 'esm' : format}.js`
    },
    rollupOptions: {
      external: ['three', 'gsap', 'cannon-es'],
      output: {
        globals: {
          three: 'THREE',
          gsap: 'gsap',
          'cannon-es': 'CANNON'
        }
      }
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: true,
    allowedHosts: 'all'
  }
});