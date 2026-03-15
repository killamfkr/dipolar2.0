# Building an Android APK (Dipolar)

This project uses **Capacitor** to wrap the web app in a native Android shell so you can build an APK.

## Prerequisites

- **Node.js** (already used for the app)
- **Android Studio** – [download](https://developer.android.com/studio) and install. During setup, install the **Android SDK** and accept the licenses.
- **Java 17** – Android Studio usually bundles this; otherwise install a JDK 17.

## One-time setup

1. **Install dependencies** (including Capacitor):

   ```bash
   npm install
   ```

2. **Add the Android platform** (creates the `android/` folder):

   ```bash
   npx cap add android
   ```

   If the command says Capacitor is not installed, run `npm install` again.

## Building the APK

1. **Build the web app** and copy it into the Android project:

   ```bash
   npm run build:android
   ```

   Or step by step:

   ```bash
   npm run build
   npx cap sync android
   ```

2. **Open the Android project** in Android Studio:

   ```bash
   npm run open:android
   ```

   Or open Android Studio → **File → Open** → select the `android` folder in this project.

3. **Build the APK in Android Studio**:

   - **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
     - Output: `android/app/build/outputs/apk/debug/app-debug.apk`  
     - Installable on any device (debug signing).
   - For a **release APK** (e.g. for Play Store or sharing):  
     **Build → Generate Signed Bundle / APK** → follow the wizard to create a keystore and build a release APK.

4. **Optional: build from the command line** (no Android Studio UI):

   ```bash
   cd android
   ./gradlew assembleDebug
   ```

   APK path: `android/app/build/outputs/apk/debug/app-debug.apk`.

## After changing the web app

Whenever you change the React/Vite app and want to update the APK:

```bash
npm run build:android
```

Then rebuild the APK in Android Studio (or run `./gradlew assembleDebug` in the `android` folder).

## Notes

- The app runs in a WebView; your existing URLs (M3U, HLS, etc.) should work. **Cleartext (HTTP)** is allowed so M3U, EPG, and Xtream Codes over HTTP work on Android (`usesCleartextTraffic` in `AndroidManifest.xml`).
- **HashRouter** is used (instead of BrowserRouter) so that Settings, Live TV, VOD, and Library routes work correctly when the app is loaded from the native WebView. URLs look like `#/settings`, `#/vod`, etc.
- Admin and user login, plus M3U/EPG/Xtream settings, are all in **Settings** (tap the gear in the sidebar). Set an admin password first, then log in as admin to see the IPTV sources.
- To change app name or package ID, edit `capacitor.config.ts` (`appName`, `appId`), then run `npx cap sync android` again.
- The first time you open the Android project, Android Studio may download SDK components and index the project; this can take a few minutes.
