#!/usr/bin/env bash
set -e

# Detect or default JAVA_HOME
if [ -z "$JAVA_HOME" ]; then
  if [ -d "$HOME/.jdk/jdk-21/Contents/Home" ]; then
    export JAVA_HOME="$HOME/.jdk/jdk-21/Contents/Home"
  elif [ -x "/usr/libexec/java_home" ]; then
    export JAVA_HOME=$(/usr/libexec/java_home -v 21 2>/dev/null || /usr/libexec/java_home 2>/dev/null || echo "")
  fi
fi

# Detect or default ANDROID_HOME
if [ -z "$ANDROID_HOME" ]; then
  if [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  fi
fi

MODE="${1:-debug}"

echo "========================================="
echo "Building HalalChat Android App ($MODE)"
echo "JAVA_HOME: $JAVA_HOME"
echo "ANDROID_HOME: $ANDROID_HOME"
echo "========================================="

# Build client web bundle and sync to native Android
npm --prefix client run build
npm --prefix client run android:sync

if [ "$MODE" = "release" ]; then
  (cd client/android && ./gradlew assembleRelease)
  echo ""
  echo "✅ Release build finished!"
  echo "APK path: client/android/app/build/outputs/apk/release/app-release-unsigned.apk"
else
  (cd client/android && ./gradlew assembleDebug)
  echo ""
  echo "✅ Debug build finished!"
  echo "APK path: client/android/app/build/outputs/apk/debug/app-debug.apk"
fi
