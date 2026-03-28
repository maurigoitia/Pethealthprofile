import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Generated manually from GoogleService-Info.plist and google-services.json
/// Firebase project: polar-scene-488615-i0
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('Web platform not configured for Flutter');
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('Platform not supported');
    }
  }

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyDTTLhn3z30RUBOHYrjOyizOD5s2jN3gHY',
    appId: '1:842879609097:ios:b11aa045c1abd9f0b68bd8',
    messagingSenderId: '842879609097',
    projectId: 'polar-scene-488615-i0',
    storageBucket: 'polar-scene-488615-i0.firebasestorage.app',
    iosBundleId: 'app.pessy.pessy',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyD95pvWX46P9nimudDNHt6mCjZn2wPbvV4',
    appId: '1:842879609097:android:363465a4ca5afe6db68bd8',
    messagingSenderId: '842879609097',
    projectId: 'polar-scene-488615-i0',
    storageBucket: 'polar-scene-488615-i0.firebasestorage.app',
  );
}
