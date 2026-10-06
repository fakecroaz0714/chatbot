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

if [ -n "$JAVA_HOME" ]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi

KEYSTORE_PATH="${1:-halalchat-release.keystore}"
KEY_ALIAS="${2:-halalchat}"

echo "Generating release keystore at: $KEYSTORE_PATH (alias: $KEY_ALIAS)"
echo "Using Java at: $(which keytool)"
echo ""

keytool -genkey -v -keystore "$KEYSTORE_PATH" -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000

echo ""
echo "✅ Keystore successfully created at: $KEYSTORE_PATH"
echo "You can now sign your release APK by running:"
echo "  ./scripts/sign-release-apk.sh $KEYSTORE_PATH $KEY_ALIAS"
