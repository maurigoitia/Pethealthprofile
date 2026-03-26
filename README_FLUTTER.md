# Pessy Flutter Native App

This branch contains the Flutter native application wrapper for Pessy, providing iOS and Android implementations.

## Contents

- `lib/` - Flutter Dart source code
- `pubspec.yaml` - Flutter dependencies
- `pubspec.lock` - Locked dependency versions
- `android/` - Android native configuration and build
- `ios/` - iOS native configuration and build
- `linux/` - Linux desktop build configuration
- `macos/` - macOS desktop build configuration
- `windows/` - Windows desktop build configuration
- `web/` - Web build configuration
- `assets/` - App assets (logo, splash screens, etc.)
- `analysis_options.yaml` - Dart linting rules

## Note

Build artifacts (`build/` and `.dart_tool/`) have been excluded from this repository to save space. They will be regenerated when running `flutter pub get` and building the app.

## Getting Started

Install Flutter (if not already installed):
```bash
git clone https://github.com/flutter/flutter.git
export PATH="$PATH:$(pwd)/flutter/bin"
```

Install dependencies:
```bash
flutter pub get
```

Run on device/emulator:
```bash
flutter run
```

Build for production:
```bash
# iOS
flutter build ios

# Android
flutter build apk
# or for App Bundle
flutter build appbundle
```

## Architecture

- **Language**: Dart
- **Framework**: Flutter
- **Platforms**: iOS, Android, macOS, Windows, Linux, Web
- **Backend**: Firebase (Firestore, Authentication)
- **Package Management**: pub.dev

## Key Packages

- `firebase_core` - Firebase initialization
- `cloud_firestore` - Database access
- `firebase_auth` - User authentication
- `app_links` - Deep linking support
- `permission_handler` - Permission management
- And more (see `pubspec.yaml`)

## Debugging

Enable verbose logging:
```bash
flutter run -v
```

Run tests:
```bash
flutter test
```

## IDE Setup

Recommended: Visual Studio Code with Flutter extension or Android Studio with Flutter plugin.
