import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Atlas iOS wrapper.
 *
 * The web layer is the standard Vite build output (dist/).
 * When running inside the native shell, Atlas-scans-ios communicates via
 * deep-link URL scheme (atlasapp://) rather than the Web Share Target POST
 * API (which is browser-only).  The App plugin listens for appUrlOpen events
 * and routes incoming scan payloads through nativeBridge.ts.
 *
 * To scaffold the Xcode project:
 *   1. npm run build:ios
 *   2. npx cap open ios
 */
const config: CapacitorConfig = {
  appId: 'com.atlas.mind',
  appName: 'Atlas Mind',
  webDir: 'dist',

  // ── Server ────────────────────────────────────────────────────────────────
  // In development you can point to the Vite dev server so hot-reload works
  // inside the simulator.  Comment out for production builds.
  // server: {
  //   url: 'http://localhost:5173',
  //   cleartext: true,
  // },

  // ── iOS-specific ──────────────────────────────────────────────────────────
  ios: {
    // Allow Atlas-scans-ios to open the app via atlasapp:// deep-link.
    // Also register this scheme in Xcode: Targets → Info → URL Types.
    scheme: 'atlasapp',
    // Prevent the WebView from adjusting for the safe-area inset itself —
    // Atlas's CSS already accounts for env(safe-area-inset-*).
    contentInset: 'automatic',
  },

  plugins: {
    // SplashScreen is bundled with @capacitor/ios; hide it as soon as the
    // React app mounts (handled in main.tsx via SplashScreen.hide()).
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
