# Atlas Scan — App Icon & Splash Assets

Place the source artwork files in this directory.  
`@capacitor/assets` reads them and generates all platform-specific sizes.

## Required files

| File | Size | Notes |
|------|------|-------|
| `icon.png` | 1024 × 1024 px | No alpha channel, no pre-rounded corners — iOS masks automatically |
| `splash.png` | 2732 × 2732 px | Centred logo on plain background colour |
| `icon-foreground.png` | 1024 × 1024 px | (Optional) Adaptive icon foreground layer for Android |
| `icon-background.png` | 1024 × 1024 px | (Optional) Adaptive icon background layer for Android |

## Generating sizes

```bash
# Install once
npm install --save-dev @capacitor/assets

# Generate all sizes and copy into ios/ and android/
npx capacitor-assets generate
```

After generation, run `npm run build:ios` to sync assets into the Xcode project.

## Xcode

After the first `npx cap add ios`, verify:

- **Xcode → Targets → General → App Icons Source** is set to `AppIcon`.
- **LaunchScreen.storyboard** is present at
  `ios/App/App/Base.lproj/LaunchScreen.storyboard`.

See `docs/testflight-checklist.md` for the full TestFlight readiness checklist.
