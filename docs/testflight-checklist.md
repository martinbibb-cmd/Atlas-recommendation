# Atlas Scan — TestFlight Readiness Checklist

**Bundle ID:** `uk.atlas-phm.scan`  
**App name:** Atlas Scan  
**Version:** 1.0.0 (build 1)  
**Minimum iOS:** 16.0  
**Apple Developer Team:** Atlas PHM Ltd  

---

## 1. App Purpose

Atlas Scan is a property-survey companion app for heating engineers and assessors.
During a property visit the engineer uses Atlas Scan to:

- Photograph rooms, heating appliances, and equipment.
- Record voice notes and text observations.
- Annotate objects and structural features.
- Complete a visit and hand the captured data off to **Atlas Mind** for
  recommendation generation.

No account is required to test Atlas Scan. All captured data is stored locally
on device and is not transmitted until the engineer taps **Continue in Atlas Mind**.

---

## 2. Pre-submission Checklist

### 2.1 Bundle & signing

- [ ] Bundle ID set to `uk.atlas-phm.scan` in Xcode → Targets → General → Identity.
- [ ] Team set to *Atlas PHM Ltd* in Xcode → Targets → Signing & Capabilities.
- [ ] "Automatically manage signing" enabled (or manual provisioning profile
      created in App Store Connect for `uk.atlas-phm.scan`).
- [ ] Provisioning profile includes all test device UDIDs **or** uses a
      Distribution profile for TestFlight Ad Hoc/App Store.

### 2.2 Version & build number

- [ ] **Version** (`CFBundleShortVersionString`): `1.0.0`
- [ ] **Build** (`CFBundleVersion`): increment for every TestFlight upload
      (Xcode → Targets → General → Identity, or via `agvtool`).

### 2.3 Info.plist privacy strings

All strings are managed via `capacitor.config.ts` and merged into
`ios/App/App/Info.plist` on every `cap sync`. Verify after sync:

| Key | Purpose |
|---|---|
| `NSCameraUsageDescription` | Room / appliance photo capture |
| `NSMicrophoneUsageDescription` | Voice note recording |
| `NSSpeechRecognitionUsageDescription` | Voice-note transcription |
| `NSPhotoLibraryAddUsageDescription` | Save visit photos to Photos app |
| `NSPhotoLibraryUsageDescription` | Attach existing photos to a note |
| `NSLocalNetworkUsageDescription` | Multipeer device-to-device transfer |
| `NSMotionUsageDescription` | ARKit / room-measurement sensors |
| `NSBonjourServices` | `_atlasScan._tcp` |

> **Important:** Remove any key whose API is _not yet called_ in this build.
> App Store Review flags unreferenced usage-description keys as misleading.

### 2.4 App icon & launch screen

Capacitor reads icon/splash assets from the `Assets/` folder root.
Generate all required sizes with `@capacitor/assets`:

```bash
npm install --save-dev @capacitor/assets   # one-time
# Place a 1024×1024 PNG at Assets/icon.png
# Place a 2732×2732 PNG at Assets/splash.png
npx capacitor-assets generate
npm run build:ios   # syncs generated assets into ios/
```

- [ ] `Assets/icon.png` (1024 × 1024 px, no alpha channel, no rounded corners —
      iOS applies its own mask).
- [ ] `Assets/splash.png` (2732 × 2732 px, centred logo on plain background).
- [ ] Xcode → Targets → General → App Icons Source set to `AppIcon`.
- [ ] Launch screen storyboard present (`ios/App/App/Base.lproj/LaunchScreen.storyboard`).

---

## 3. Required Device Permissions

| Permission | When triggered |
|---|---|
| Camera | Tapping the camera icon in a room or object card |
| Microphone | Starting a voice note |
| Speech Recognition | Voice note transcription (if enabled) |
| Photo Library (read) | Attaching a photo from the camera roll |
| Photo Library (write) | Saving a captured photo |
| Local Network | (Future) Multipeer handoff to a second device |
| Motion | (Future) ARKit room measurement |

Testers should grant all permissions when prompted. Denying camera or microphone
will prevent capture but must not crash the app.

---

## 4. Known Limitations (Build 1)

- Voice transcription requires an on-device model; first-run may download silently.
- Multipeer transfer is UI-only in this build; data transfer not yet wired.
- ARKit / LiDAR room measurement is stubbed; camera overlay placeholder only.
- "Continue in Atlas Mind" deep-links to the web app — requires Atlas Mind to be
  installed or accessible in a browser.

---

## 5. Test Script

The following end-to-end journey should complete without error on a physical device
running iOS 16+.

### 5.1 Start a visit

1. Launch **Atlas Scan**.
2. Tap **Start new visit**.
3. Enter an address or select from recent addresses.
4. Confirm visit details → tap **Begin**.

Expected: visit screen opens with empty room list.

### 5.2 Capture a room

1. Tap **+ Add room**.
2. Select room type (e.g. *Living room*).
3. Tap the **camera** icon → grant camera permission if prompted.
4. Photograph the room → tap **Use photo**.

Expected: photo thumbnail appears in the room card.

### 5.3 Add a voice / text note

1. Inside the room card, tap **+ Note**.
2. Choose **Voice note** → grant microphone permission if prompted.
3. Record a brief note → tap **Stop**.
4. Optionally add a text note via the keyboard icon.

Expected: note entry appears with timestamp.

### 5.4 Capture an object

1. Tap **+ Object** inside a room.
2. Select type (e.g. *Boiler*, *Radiator*).
3. Take a photo of the object.
4. Add any observations.

Expected: object card added to the room.

### 5.5 Review and complete

1. Tap **Review visit** (top-right).
2. Check the summary: address, rooms, photos, notes, and objects all appear.
3. Tap **Complete visit**.

Expected: visit marked complete; a **Continue in Atlas Mind** button appears.

### 5.6 Hand off to Atlas Mind

1. Tap **Continue in Atlas Mind**.
2. Atlas Mind should open (browser or installed PWA) with the scan data
   pre-loaded in the recommendation engine.

Expected: Atlas Mind loads and the visit data is visible in the survey panel.

---

## 6. Local Xcode Archive & Upload Steps

```bash
# 1. Install dependencies (once per machine)
npm install

# 2. Build the web layer and sync to the native project
npm run build:ios          # runs: tsc -b && vite build --mode capacitor && cap sync ios

# 3. Open Xcode
npx cap open ios

# In Xcode:
# 4. Select the "App" target → Signing & Capabilities → select Atlas PHM Ltd team
# 5. Set scheme to "App" and destination to "Any iOS Device (arm64)"
# 6. Product → Archive
# 7. In the Organizer window: Distribute App → App Store Connect
# 8. Upload — App Store Connect will process the build for TestFlight (~10 min)
```

### CI note

A GitHub Actions workflow can automate steps 1–2 on push to `main`. Steps 4–8
require a macOS runner with Xcode installed and an Apple Distribution certificate
plus provisioning profile stored as repository secrets. This is a future improvement;
for now, archive locally and upload via Xcode Organizer.

---

## 7. TestFlight Distribution

1. Log in to [App Store Connect](https://appstoreconnect.apple.com).
2. Select **Atlas Scan** → **TestFlight**.
3. Once the build finishes processing, add it to the *Internal Testing* group.
4. Add testers by Apple ID email → they receive a TestFlight invite.
5. For external testing (up to 10,000 users), submit for Beta App Review first.

### What to tell testers

> **Atlas Scan** is a property-survey tool. You do not need a test account.
> The app stores all data locally. Please test the full journey described in
> the test script above and report any crashes or unexpected permission dialogs.
