# HalalChat Android APKs

This directory contains the built Android packages for **HalalChat**:

- **`HalalChat-debug.apk`** (`4.3 MB`):
  - **Type**: Debug APK (Signed with Android debug keystore).
  - **Usage**: Ready to install immediately on any Android device or emulator for testing and sharing. Enable "Install Unknown Apps" in Android settings.
  - **Application ID**: `com.halalchat.app`

- **`HalalChat-release-unsigned.apk`** (`3.3 MB`):
  - **Type**: Unsigned Release APK.
  - **Usage**: Optimized production build (R8/shrink-ready, minified release configuration). Requires signing with your production keystore before installation or distribution on the Google Play Store / private channels.

---

### Backend API Configuration

In a native Android Capacitor app, the WebView does not run from `window.location.origin`. HalalChat automatically resolves backend URLs as follows:

1. **Environment Variable (`VITE_API_URL`)**: Set during client build time:
   ```bash
   VITE_API_URL="https://your-production-domain.com" npm --prefix client run build
   ```
2. **Runtime Configuration**: You can change the backend URL at runtime inside the app without rebuilding by opening DevTools or setting localStorage:
   ```javascript
   localStorage.setItem('halalchat_server_url', 'https://your-production-domain.com');
   ```
3. **Android Emulator Default**: If running in an Android Emulator with no URL set, HalalChat defaults to `http://10.0.2.2:5001`.

---

### How to Sign the Release APK

To produce a signed release APK (`HalalChat-release.apk`):

1. If you do not already have a release keystore, generate one using the included helper:
   ```bash
   ./scripts/create-keystore.sh halalchat-release.keystore halalchat
   ```
   *(Or if running `keytool` manually, ensure `export JAVA_HOME="$HOME/.jdk/jdk-21/Contents/Home"` is set).*
   *(Keep your keystore file and passwords private. Do not commit `.keystore` or `.jks` files to git).*

2. Run the included signing script:
   ```bash
   ./scripts/sign-release-apk.sh halalchat-release.keystore halalchat apk/HalalChat-release.apk
   ```

3. The verified, signed release APK will be generated at `apk/HalalChat-release.apk`.
