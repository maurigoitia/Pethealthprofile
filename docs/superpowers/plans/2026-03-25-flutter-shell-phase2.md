# Flutter Shell (Phase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap pessy.app in a Flutter WebView shell so it can be published on App Store and Play Store, with native push notifications, deep links, and splash screen.

**Architecture:** New Flutter project (`pessy_flutter/`) loads pessy.app in `webview_flutter`. A JS↔Dart bridge via `JavaScriptChannel` enables native FCM push notifications. Deep links via `app_links` package route to the WebView. The existing React app is untouched — Flutter is just a native frame around it.

**Tech Stack:** Flutter 3.x, webview_flutter 4.x, firebase_messaging, app_links, flutter_native_splash, flutter_launcher_icons

**Compatibility:**
- iOS: 14.0+ (covers iPhone 6s and newer — ~99% active devices)
- Android: API 21+ (Android 5.0 Lollipop — ~99% active devices)

---

## File Structure

```
/Users/mauriciogoitia/Downloads/03_PESSY_APP/pessy_flutter/
├── pubspec.yaml                    # Dependencies + config
├── lib/
│   ├── main.dart                   # App entry, MaterialApp, routing
│   ├── screens/
│   │   └── webview_screen.dart     # WebView that loads pessy.app
│   ├── services/
│   │   ├── push_service.dart       # FCM setup + token forwarding
│   │   └── deep_link_service.dart  # Handle app links → WebView navigation
│   └── config.dart                 # URLs, colors, constants
├── android/
│   └── app/src/main/
│       ├── AndroidManifest.xml     # Deep links intent filter
│       └── res/                    # Icons (auto-generated)
├── ios/
│   └── Runner/
│       ├── Info.plist              # Universal links + config
│       └── Assets.xcassets/        # Icons (auto-generated)
├── assets/
│   └── pessy-logo.png             # Logo for splash screen
├── flutter_launcher_icons.yaml     # Icon generation config
└── flutter_native_splash.yaml      # Splash generation config
```

**What changes in PESSY_PRODUCCION:** NOTHING. Zero changes to the React app.

---

## Task 0: Install Flutter SDK

**Files:** None (system install)

- [ ] **Step 1: Install Flutter via Homebrew**

```bash
brew install --cask flutter
```

- [ ] **Step 2: Accept Android licenses**

```bash
flutter doctor --android-licenses
```

- [ ] **Step 3: Verify everything works**

```bash
flutter doctor
```

Expected: checkmarks for Flutter, Android toolchain, Xcode, Chrome. CocoaPods should also pass.

- [ ] **Step 4: Verify minimum versions**

```bash
flutter --version
```

Expected: Flutter 3.x with Dart 3.x

---

## Task 1: Create Flutter Project + Config

**Files:**
- Create: `pessy_flutter/pubspec.yaml`
- Create: `pessy_flutter/lib/config.dart`
- Create: `pessy_flutter/assets/pessy-logo.png`

- [ ] **Step 1: Create Flutter project**

```bash
cd /Users/mauriciogoitia/Downloads/03_PESSY_APP
flutter create --org app.pessy --project-name pessy pessy_flutter
cd pessy_flutter
```

- [ ] **Step 2: Set minimum platform versions**

Edit `pessy_flutter/android/app/build.gradle`:
```groovy
// Find minSdkVersion and change to:
minSdkVersion 21    // Android 5.0 Lollipop
targetSdkVersion 34 // Latest stable
```

Edit `pessy_flutter/ios/Podfile`:
```ruby
# First line — change to:
platform :ios, '14.0'
```

- [ ] **Step 3: Add dependencies to pubspec.yaml**

Replace the `dependencies` and `dev_dependencies` sections:

```yaml
dependencies:
  flutter:
    sdk: flutter
  webview_flutter: ^4.10.0
  firebase_core: ^3.8.0
  firebase_messaging: ^15.1.0
  app_links: ^6.3.2
  flutter_local_notifications: ^18.0.1
  permission_handler: ^11.3.1

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_launcher_icons: ^0.14.2
  flutter_native_splash: ^2.4.3

flutter:
  uses-material-design: true
  assets:
    - assets/
```

- [ ] **Step 4: Create config.dart**

```dart
// lib/config.dart
class PessyConfig {
  static const String appUrl = 'https://pessy.app';
  static const String homeUrl = 'https://pessy.app/inicio';
  static const String deepLinkHost = 'pessy.app';

  // Brand colors
  static const int primaryColor = 0xFF074738;
  static const int accentColor = 0xFF1A9B7D;
  static const int backgroundColor = 0xFFF0FAF9;
}
```

- [ ] **Step 5: Copy logo asset**

```bash
cp /Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/public/pwa-512x512.png pessy_flutter/assets/pessy-logo.png
```

- [ ] **Step 6: Run flutter pub get**

```bash
cd pessy_flutter && flutter pub get
```

- [ ] **Step 7: Commit**

```bash
cd pessy_flutter && git init && git add -A
git commit -m "feat: init Flutter shell project with deps and config"
```

---

## Task 2: WebView Screen

**Files:**
- Create: `pessy_flutter/lib/screens/webview_screen.dart`
- Modify: `pessy_flutter/lib/main.dart`

- [ ] **Step 1: Create WebView screen**

```dart
// lib/screens/webview_screen.dart
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../config.dart';

class WebViewScreen extends StatefulWidget {
  final String? initialUrl;
  const WebViewScreen({super.key, this.initialUrl});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  double _progress = 0;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Color(PessyConfig.backgroundColor))
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (progress) {
          setState(() => _progress = progress / 100);
        },
        onPageStarted: (_) => setState(() => _isLoading = true),
        onPageFinished: (_) => setState(() => _isLoading = false),
        onNavigationRequest: (request) {
          // Allow pessy.app navigation, block external
          if (request.url.contains('pessy.app') ||
              request.url.contains('accounts.google.com') ||
              request.url.contains('firebaseapp.com')) {
            return NavigationDecision.navigate;
          }
          // Open external links in system browser
          return NavigationDecision.prevent;
        },
      ))
      ..addJavaScriptChannel(
        'PessyNative',
        onMessageReceived: (message) {
          _handleBridgeMessage(message.message);
        },
      )
      ..loadRequest(Uri.parse(widget.initialUrl ?? PessyConfig.homeUrl));
  }

  void _handleBridgeMessage(String message) {
    // Will be expanded in Task 3 (push notifications)
    debugPrint('[PessyBridge] $message');
  }

  void navigateTo(String url) {
    _controller.loadRequest(Uri.parse(url));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _controller.canGoBack()) {
          await _controller.goBack();
        }
      },
      child: Scaffold(
        backgroundColor: Color(PessyConfig.backgroundColor),
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_isLoading)
                LinearProgressIndicator(
                  value: _progress,
                  color: Color(PessyConfig.accentColor),
                  backgroundColor: Colors.transparent,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Update main.dart**

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'config.dart';
import 'screens/webview_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Status bar style
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
  ));

  runApp(const PessyApp());
}

class PessyApp extends StatelessWidget {
  const PessyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Pessy',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: Color(PessyConfig.primaryColor),
        useMaterial3: true,
      ),
      home: const WebViewScreen(),
    );
  }
}
```

- [ ] **Step 3: Test on iOS simulator**

```bash
cd pessy_flutter
flutter run -d "iPhone 16"
```

Expected: App opens, loads pessy.app in WebView, progress bar shows while loading.

- [ ] **Step 4: Test on Android emulator**

```bash
flutter run -d "emulator"
```

- [ ] **Step 5: Test back button (Android)**

Press system back button → should go back in WebView history, not exit app.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: WebView screen loading pessy.app with back nav"
```

---

## Task 3: Push Notifications (FCM)

**Files:**
- Create: `pessy_flutter/lib/services/push_service.dart`
- Modify: `pessy_flutter/lib/main.dart` (init Firebase)
- Modify: `pessy_flutter/lib/screens/webview_screen.dart` (bridge)

- [ ] **Step 1: Download Firebase config files**

From Firebase Console (project polar-scene-488615-i0):
- **iOS:** Download `GoogleService-Info.plist` → place in `ios/Runner/`
- **Android:** Download `google-services.json` → place in `android/app/`

- [ ] **Step 2: Configure Android build for Firebase**

Edit `android/build.gradle` — add classpath:
```groovy
dependencies {
    classpath 'com.google.gms:google-services:4.4.2'
}
```

Edit `android/app/build.gradle` — add plugin:
```groovy
apply plugin: 'com.google.gms.google-services'
```

- [ ] **Step 3: Create push_service.dart**

```dart
// lib/services/push_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class PushService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();

  static Future<void> init() async {
    // Request permission (iOS)
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Setup local notifications (for foreground)
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    await _local.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
    );

    // Get FCM token
    final token = await _messaging.getToken();
    if (token != null) {
      // Will be sent to WebView via bridge
      _currentToken = token;
    }

    // Listen for token refresh
    _messaging.onTokenRefresh.listen((newToken) {
      _currentToken = newToken;
    });

    // Foreground messages → show local notification
    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
  }

  static String? _currentToken;
  static String? get fcmToken => _currentToken;

  static Future<void> _showForegroundNotification(RemoteMessage msg) async {
    final notification = msg.notification;
    if (notification == null) return;

    await _local.show(
      msg.hashCode,
      notification.title ?? 'Pessy',
      notification.body ?? '',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'pessy_default',
          'Notificaciones Pessy',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }
}
```

- [ ] **Step 4: Init Firebase in main.dart**

Add to the top of `main()`:
```dart
import 'package:firebase_core/firebase_core.dart';
import 'services/push_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  await PushService.init();
  // ... rest of main
}
```

- [ ] **Step 5: Forward FCM token to WebView**

In `webview_screen.dart`, after page loads, inject token:
```dart
onPageFinished: (url) {
  setState(() => _isLoading = false);
  // Forward FCM token to React app
  final token = PushService.fcmToken;
  if (token != null) {
    _controller.runJavaScript(
      'window.__PESSY_NATIVE_FCM_TOKEN__ = "$token";'
    );
  }
},
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: FCM push notifications with local foreground display"
```

---

## Task 4: Deep Links

**Files:**
- Create: `pessy_flutter/lib/services/deep_link_service.dart`
- Modify: `pessy_flutter/android/app/src/main/AndroidManifest.xml`
- Modify: `pessy_flutter/ios/Runner/Info.plist`
- Modify: `pessy_flutter/lib/main.dart`

- [ ] **Step 1: Create deep_link_service.dart**

```dart
// lib/services/deep_link_service.dart
import 'package:app_links/app_links.dart';

class DeepLinkService {
  static final _appLinks = AppLinks();
  static Function(String)? _onLink;

  static void init({required Function(String) onLink}) {
    _onLink = onLink;

    // Handle link that opened the app
    _appLinks.getInitialLink().then((uri) {
      if (uri != null) _onLink?.call(uri.toString());
    });

    // Handle links while app is running
    _appLinks.uriLinkStream.listen((uri) {
      _onLink?.call(uri.toString());
    });
  }
}
```

- [ ] **Step 2: Android intent filter**

Add inside `<activity>` in `AndroidManifest.xml`:
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="pessy.app" />
</intent-filter>
```

- [ ] **Step 3: iOS universal links**

Add to `Info.plist` inside the top `<dict>`:
```xml
<key>FlutterDeepLinkingEnabled</key>
<true/>
```

Create `ios/Runner/Runner.entitlements`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>applinks:pessy.app</string>
    </array>
</dict>
</plist>
```

- [ ] **Step 4: Wire deep links to WebView in main.dart**

```dart
// In PessyApp, make it stateful to hold a GlobalKey for WebViewScreen
final _webViewKey = GlobalKey<WebViewScreenState>();

// After building WebViewScreen:
DeepLinkService.init(onLink: (url) {
  _webViewKey.currentState?.navigateTo(url);
});
```

Note: Expose WebViewScreen state by making `navigateTo` public and adding a `GlobalKey`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: deep links routing pessy.app URLs to WebView"
```

---

## Task 5: App Icon + Splash Screen

**Files:**
- Create: `pessy_flutter/flutter_launcher_icons.yaml`
- Create: `pessy_flutter/flutter_native_splash.yaml`

- [ ] **Step 1: Create icon config**

```yaml
# flutter_launcher_icons.yaml
flutter_launcher_icons:
  android: true
  ios: true
  image_path: "assets/pessy-logo.png"
  min_sdk_android: 21
  adaptive_icon_background: "#F0FAF9"
  adaptive_icon_foreground: "assets/pessy-logo.png"
  web:
    generate: false
```

- [ ] **Step 2: Create splash config**

```yaml
# flutter_native_splash.yaml
flutter_native_splash:
  color: "#F0FAF9"
  image: "assets/pessy-logo.png"
  color_dark: "#074738"
  image_dark: "assets/pessy-logo.png"
  android_12:
    color: "#F0FAF9"
    icon_background_color: "#F0FAF9"
    image: "assets/pessy-logo.png"
    color_dark: "#074738"
    icon_background_color_dark: "#074738"
    image_dark: "assets/pessy-logo.png"
  ios: true
  android: true
```

- [ ] **Step 3: Generate icons**

```bash
cd pessy_flutter
dart run flutter_launcher_icons
```

- [ ] **Step 4: Generate splash**

```bash
dart run flutter_native_splash:create
```

- [ ] **Step 5: Test on both platforms**

```bash
flutter run -d "iPhone 16"
# App should show Pessy splash → WebView loads
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: native app icon and splash screen with Pessy branding"
```

---

## Task 6: Build Release + Prepare for Stores

**Files:**
- Modify: `pessy_flutter/android/app/build.gradle` (signing)
- Modify: `pessy_flutter/ios/Runner.xcodeproj` (signing)

- [ ] **Step 1: Build Android APK**

```bash
cd pessy_flutter
flutter build apk --release
```

Output: `build/app/outputs/flutter-apk/app-release.apk`

- [ ] **Step 2: Build Android App Bundle (for Play Store)**

```bash
flutter build appbundle --release
```

Output: `build/app/outputs/bundle/release/app-release.aab`

- [ ] **Step 3: Build iOS (requires Apple Developer account)**

```bash
flutter build ios --release
```

If no Apple Developer account yet, build for simulator:
```bash
flutter build ios --debug --simulator
```

- [ ] **Step 4: Archive iOS for TestFlight (when account ready)**

```bash
# Open Xcode
open ios/Runner.xcworkspace
# In Xcode: Product → Archive → Distribute to App Store Connect
```

- [ ] **Step 5: Commit final release configs**

```bash
git add -A && git commit -m "chore: release build configs for iOS and Android"
```

---

## Prerequisite Checklist (for store publishing)

| Item | Status | Action |
|------|--------|--------|
| Apple Developer Account ($99/yr) | ❓ | Mauri needs to sign up at developer.apple.com |
| Google Play Console ($25 one-time) | ❓ | Mauri needs to sign up at play.google.com/console |
| App name reserved: "Pessy" | ❓ | Check availability in both stores |
| Privacy Policy URL | ✅ | pessy.app/privacidad |
| Terms URL | ✅ | pessy.app/terminos |
| Firebase config files | ❓ | Download from Firebase Console |
| App screenshots (6.5" + 5.5" iPhone) | ❓ | Need to capture from production |
| App description (Spanish) | ❓ | Can reuse landing copy |
| Upload signing key (Android) | ❓ | Generated during first build |

---

## Execution Order

Tasks are **sequential** (each depends on the previous):

```
Task 0 (install Flutter) → Task 1 (project) → Task 2 (WebView) → Task 3 (push) → Task 4 (deep links) → Task 5 (icon/splash) → Task 6 (build)
```

Tasks 0-2 can run today. Tasks 3-4 need Firebase config files. Tasks 5-6 are polish + store prep.
