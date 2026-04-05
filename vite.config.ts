import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// @atlas/contracts is installed directly from GitHub (no npm release yet).
// The package's dist/ directory is gitignored so it is not present after
// `npm install`.  We therefore alias the package name to the TypeScript
// source entry-point so that both Vite and Vitest can resolve it.
// If the contracts package ever moves its source entry-point, this alias
// and the corresponding tsconfig.app.json `paths` entry must be updated too.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@atlas/contracts': path.resolve(
        __dirname,
        'node_modules/@atlas/contracts/src/scan/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})