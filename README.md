# Pessy Flutter Shell

Pessy mobile shell application — Flutter WebView wrapper for pessy.app with native Firebase messaging, deep linking, and push notifications.

## Project Setup

### Requirements
- Flutter 3.41.5+
- Dart 3.11.3+
- iOS 14.0+ / Android 5.0+ (API 21+)
- Firebase project: `gen-lang-client-0123805751`

### Configuration

**App Identity:**
- Package ID: `app.pessy.mobile`
- App Name: Pessy

**Brand Colors:**
- Primary: `#074738`
- Accent: `#1A9B7D`
- Background: `#F0FAF9`

**Typography:**
- Brand: Plus Jakarta Sans
- System: Manrope

### Firebase Setup

1. Ensure `google-services.json` is in `android/app/`
2. Ensure `GoogleService-Info.plist` is in `ios/Runner/`

### Build & Run

```bash
# Get dependencies
flutter pub get

# Run on iOS
flutter run -d <ios_device>

# Run on Android
flutter run -d <android_device>

# Build release APK
flutter build apk --release

# Build release IPA
flutter build ios --release
```

### Generate Icons & Splash

```bash
# Generate launcher icons
flutter pub run flutter_launcher_icons

# Generate native splash screens
flutter pub run flutter_native_splash:create
```

## Project Structure

```
lib/
├── main.dart              # App entry point & MaterialApp setup
├── config.dart            # App configuration (URLs, colors, constants)
├── screens/
│   └── webview_screen.dart   # Main WebView screen with progress bar
└── services/
    ├── push_service.dart      # Firebase Cloud Messaging integration
    └── deep_link_service.dart # Deep link handler for app:// URLs
```

## Key Features

- **WebView Shell**: Wraps pessy.app in native Flutter container
- **Push Notifications**: Firebase Cloud Messaging with local notification display
- **Deep Linking**: app_links package handles pessy.app:// protocol
- **JS Bridge**: PessyNative JavaScript channel for web↔️native communication
- **Native Splash**: Custom branded splash screen on app launch
- **Safe Area**: Properly handles iOS notch/Dynamic Island and Android system UI

## Development Notes

### Adding Dependencies

Edit `pubspec.yaml` and run:
```bash
flutter pub get
```

### Hot Reload

```bash
flutter run
# Then press 'r' to hot reload, 'R' for hot restart
```

### Code Analysis

```bash
flutter analyze
```

### Testing

```bash
flutter test
```

## Deployment

### iOS

1. Update `ios/Runner/Info.plist` with version
2. Run `flutter build ios --release`
3. Open `ios/Runner.xcworkspace` in Xcode
4. Archive and upload to App Store

### Android

1. Update `pubspec.yaml` version
2. Generate signed APK: `flutter build apk --release --split-per-abi`
3. Upload to Google Play Console

## Troubleshooting

**WebView blank:** Ensure pessy.app is accessible and check device network
**FCM token issues:** Verify Firebase project credentials in google-services.json
**Deep links not working:** Check Activity config in android/app/src/main/AndroidManifest.xml

## Resources

- [Flutter Documentation](https://flutter.dev/docs)
- [webview_flutter](https://pub.dev/packages/webview_flutter)
- [Firebase Messaging](https://firebase.flutter.dev/docs/messaging/overview)
- [App Links](https://pub.dev/packages/app_links)
