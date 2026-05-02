import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Atlas Scan iOS app.
 *
 * Bundle ID : uk.atlas-phm.scan
 * App Store : Atlas Scan
 * Min iOS   : 16.0
 *
 * The web layer is the standard Vite build output (dist/).
 * When running inside the native shell, Atlas-scans-ios communicates via
 * deep-link URL scheme (atlasapp://) rather than the Web Share Target POST
 * API (which is browser-only).  The App plugin listens for appUrlOpen events
 * and routes incoming scan payloads through nativeBridge.ts.
 *
 * To scaffold the Xcode project for the first time:
 *   1. npx cap add ios          # generates ios/ native project
 *   2. npm run build:ios        # builds web layer and syncs to Xcode project
 *   3. npx cap open ios         # opens Xcode — select signing team and archive
 *
 * For subsequent builds:
 *   npm run build:ios           # rebuild + sync, then archive in Xcode
 *
 * See docs/testflight-checklist.md for the full TestFlight readiness checklist.
 */
const config: CapacitorConfig = {
  appId: 'uk.atlas-phm.scan',
  appName: 'Atlas Scan',
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
    // Minimum deployment target — must match the Xcode project setting.
    minVersion: '16.0',

    // ── Info.plist privacy usage strings ────────────────────────────────────
    // Capacitor merges these into ios/App/App/Info.plist on `cap sync`.
    // Every key listed below maps to the corresponding NSXxx­UsageDescription
    // key required by App Store Review.  Absence of a key causes rejection if
    // the API is invoked at runtime.
    infoPlist: {
      // Camera — required for room/object photo capture
      NSCameraUsageDescription:
        'Atlas Scan uses the camera to photograph rooms, heating systems, and equipment during a property visit.',

      // Microphone — required for in-app voice notes
      NSMicrophoneUsageDescription:
        'Atlas Scan uses the microphone to record voice notes during a property visit.',

      // Speech recognition — required if on-device transcription is used
      NSSpeechRecognitionUsageDescription:
        'Atlas Scan uses speech recognition to transcribe voice notes captured during a property visit.',

      // Photo library (write) — save captured images to the Photos app
      NSPhotoLibraryAddUsageDescription:
        'Atlas Scan can save visit photos to your photo library.',

      // Photo library (read) — attach existing images to a visit note
      NSPhotoLibraryUsageDescription:
        'Atlas Scan can read photos from your library to attach to a visit note.',

      // Local network — required if Multipeer Connectivity (room-mesh) is used
      NSLocalNetworkUsageDescription:
        'Atlas Scan uses the local network to transfer survey data between devices on the same Wi-Fi network.',

      // Motion / ARKit — required if ARKit or device motion is used for LiDAR scans
      NSMotionUsageDescription:
        'Atlas Scan uses device motion sensors to assist with room measurement.',

      // Bonjour services advertised on the local network (Multipeer)
      NSBonjourServices: ['_atlasScan._tcp'],
    },
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
