# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /sdk/tools/proguard/proguard-android.txt

# Keep JNI methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep Compose
-keep class androidx.compose.** { *; }

# Keep audio bridge
-keep class com.tonetxo.fantagal.audio.** { *; }
