import { defineConfig } from 'vite';

export default defineConfig({
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