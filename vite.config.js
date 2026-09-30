import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single self-contained dist/index.html (spec §12) that runs from file://.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4096,
  },
});
