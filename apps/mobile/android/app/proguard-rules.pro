# Capacitor WebView — keep JS interface classes
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor plugin classes
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }

# Keep Firebase Messaging (push notifications)
-keep class com.google.firebase.messaging.** { *; }

# Preserve line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Keep AndroidX classes used by Capacitor
-keep class androidx.core.** { *; }
-keep class androidx.appcompat.** { *; }
