import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// @atlas/contracts is installed directly from GitHub (no npm release yet).
// The package's dist/ directory is gitignored so it is not present after
// `npm install`.  We therefore alias the package name to the TypeScript
// source entry-point so that both Vite and Vitest can resolve it.
// If the contracts package ever moves its source entry-point, this alias
// and the corresponding tsconfig.app.json `paths` entry must be updated too.

// ── Capacitor mode ────────────────────────────────────────────────────────────
// When building for iOS (`--mode capacitor`) the Cloudflare Pages/Workers
// plugin must NOT be loaded — Cloudflare Workers bindings (D1, KV, R2) are
// server-only and cannot be bundled into the native WebView build.
const isCapacitor = process.env.VITE_MODE === 'capacitor' ||
  (() => {
    const idx = process.argv.indexOf('--mode');
    return idx !== -1 && idx + 1 < process.argv.length && process.argv[idx + 1] === 'capacitor';
  })();

const cloudflarePlugin = isCapacitor
  ? []
  : (() => {
      try {
        // Dynamically import so the file can be parsed in Capacitor builds
        // even if @cloudflare/vite-plugin is unavailable.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { cloudflare } = require('@cloudflare/vite-plugin');
        return [cloudflare()];
      } catch {
        return [];
      }
    })();

export default defineConfig({
  plugins: [react(), ...cloudflarePlugin],
  define: {
    // Firebase web API keys are intentionally client-visible (public identifier).
    // This maps existing Cloudflare Pages `firebase_api_key` config into a
    // single explicit client fallback without exposing additional env names.
    'import.meta.env.FIREBASE_API_KEY_FALLBACK': JSON.stringify(process.env.firebase_api_key ?? ''),
  },
  resolve: {
    alias: {
      '@atlas/contracts': path.resolve(
        __dirname,
        'node_modules/@atlas/contracts/src/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
