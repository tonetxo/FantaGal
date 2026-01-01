#!/bin/bash
# Gradle wrapper script

GRADLE_USER_HOME="${GRADLE_USER_HOME:-${HOME}/.gradle}"
APP_HOME="$(cd "$(dirname "$0")" && pwd)"

# Determine Gradle version from properties
GRADLE_VERSION="8.4"

# Download Gradle if needed
GRADLE_DIST_URL="https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip"
GRADLE_HOME="${GRADLE_USER_HOME}/wrapper/dists/gradle-${GRADLE_VERSION}-bin"

if [ ! -d "$GRADLE_HOME/gradle-${GRADLE_VERSION}" ]; then
    echo "Downloading Gradle ${GRADLE_VERSION}..."
    mkdir -p "$GRADLE_HOME"
    curl -L -o "$GRADLE_HOME/gradle.zip" "$GRADLE_DIST_URL"
    unzip -q "$GRADLE_HOME/gradle.zip" -d "$GRADLE_HOME"
    rm "$GRADLE_HOME/gradle.zip"
fi

GRADLE_BIN="$GRADLE_HOME/gradle-${GRADLE_VERSION}/bin/gradle"

# Set JAVA_HOME if not set
if [ -z "$JAVA_HOME" ]; then
    if [ -d "/usr/lib/jvm/java-17-openjdk-amd64" ]; then
        export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
    fi
fi

# Run Gradle
exec "$GRADLE_BIN" "$@"
