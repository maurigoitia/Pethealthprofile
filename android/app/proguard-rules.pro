# ── Capacitor / WebView JS Bridge ──────────────────────────
# Keep all classes exposed to JavaScript via @JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor plugin classes (they're loaded by reflection)
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }

# ── Firebase Cloud Messaging ──────────────────────────────
-keep class com.google.firebase.messaging.** { *; }
-dontwarn com.google.firebase.messaging.**

# ── AndroidX ──────────────────────────────────────────────
-keep class androidx.** { *; }
-dontwarn androidx.**

# ── Crash reports: preserve line numbers ──────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
