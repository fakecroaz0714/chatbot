#!/usr/bin/env bash
set -e

# HalalChat Release APK Signing Helper
# Usage: ./scripts/sign-release-apk.sh <path_to_keystore> <key_alias> [output_signed_apk]

# Detect or default JAVA_HOME
if [ -z "$JAVA_HOME" ]; then
  if [ -d "$HOME/.jdk/jdk-21/Contents/Home" ]; then
    export JAVA_HOME="$HOME/.jdk/jdk-21/Contents/Home"
  elif [ -x "/usr/libexec/java_home" ]; then
    export JAVA_HOME=$(/usr/libexec/java_home -v 21 2>/dev/null || /usr/libexec/java_home 2>/dev/null || echo "")
  fi
fi

if [ -n "$JAVA_HOME" ]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi

# Detect or default ANDROID_HOME
if [ -z "$ANDROID_HOME" ]; then
  if [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  fi
fi

KEYSTORE="$1"
ALIAS="$2"
OUTPUT="${3:-apk/HalalChat-release.apk}"
UNSIGNED_APK="client/android/app/build/outputs/apk/release/app-release-unsigned.apk"

if [ -z "$KEYSTORE" ] || [ -z "$ALIAS" ]; then
  echo "Usage: ./scripts/sign-release-apk.sh <path_to_keystore> <key_alias> [output_signed_apk]"
  echo ""
  echo "Example:"
  echo "  1. Generate keystore (if you don't have one):"
  echo "     keytool -genkey -v -keystore my-release-key.keystore -alias halalchat -keyalg RSA -keysize 2048 -validity 10000"
  echo "  2. Sign the APK:"
  echo "     ./scripts/sign-release-apk.sh my-release-key.keystore halalchat"
  exit 1
fi

if [ ! -f "$UNSIGNED_APK" ]; then
  echo "Unsigned release APK not found at $UNSIGNED_APK. Building now..."
  ./scripts/build-android.sh release
fi

BUILD_TOOLS_DIR=$(ls -d /Users/sadiqb07/Library/Android/sdk/build-tools/* | sort -V | tail -n 1)
ZIPALIGN="$BUILD_TOOLS_DIR/zipalign"
APKSIGNER="$BUILD_TOOLS_DIR/apksigner"

mkdir -p "$(dirname "$OUTPUT")"
TMP_ALIGNED="client/android/app/build/outputs/apk/release/app-release-aligned.apk"

echo "==> Aligning APK with zipalign..."
rm -f "$TMP_ALIGNED"
"$ZIPALIGN" -v -p 4 "$UNSIGNED_APK" "$TMP_ALIGNED"

echo "==> Signing APK with apksigner..."
"$APKSIGNER" sign --ks "$KEYSTORE" --ks-key-alias "$ALIAS" --out "$OUTPUT" "$TMP_ALIGNED"
rm -f "$TMP_ALIGNED"

echo "==> Verifying signature..."
"$APKSIGNER" verify "$OUTPUT"

echo ""
echo "✅ Signed release APK successfully generated at: $OUTPUT"
