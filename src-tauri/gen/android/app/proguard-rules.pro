# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep WebView JavascriptInterface bridge for status bar theme sync
-keepclassmembers class com.guideme.ramadan.StatusBarBridge {
   public *;
}

# Keep Tauri activity and its inner classes
-keep class com.guideme.ramadan.MainActivity { *; }

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
