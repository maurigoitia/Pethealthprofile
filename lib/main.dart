import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'config_qa.dart'; // DEV — switch to config.dart for production builds
import 'firebase_options.dart';
import 'screens/webview_screen.dart';
import 'services/deep_link_service.dart';

/// Background message handler — must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  debugPrint('[Pessy] Background message: ${message.messageId}');
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase with platform-specific options
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Set up push notification background handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

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
      home: const _PessyHome(),
    );
  }
}

/// Wraps WebViewScreen with push notification setup
class _PessyHome extends StatefulWidget {
  const _PessyHome();
  @override
  State<_PessyHome> createState() => _PessyHomeState();
}

class _PessyHomeState extends State<_PessyHome> {
  final _webViewKey = GlobalKey<WebViewScreenState>();

  @override
  void initState() {
    super.initState();
    _setupPushNotifications();
    _setupDeepLinks();
  }

  void _setupDeepLinks() {
    DeepLinkService.init(onLink: (url) {
      debugPrint('[Pessy] Deep link: $url');
      final uri = Uri.parse(url);
      // Convert pessy.app deep links to localhost for QA
      if (uri.host == 'pessy.app' || uri.host == PessyConfig.deepLinkHost) {
        final localUrl = '${PessyConfig.appUrl}${uri.path}';
        _webViewKey.currentState?.navigateTo(localUrl);
      }
    });
  }

  Future<void> _setupPushNotifications() async {
    final messaging = FirebaseMessaging.instance;

    // Request permission (iOS shows system dialog)
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    debugPrint('[Pessy] Push permission: ${settings.authorizationStatus}');

    // Get FCM token for this device
    final token = await messaging.getToken();
    debugPrint('[Pessy] FCM token: $token');

    // Listen for foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[Pessy] Foreground message: ${message.notification?.title}');
      // TODO: show in-app notification or pass to WebView via PessyNative channel
    });

    // Handle notification tap when app is in background
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('[Pessy] Notification opened: ${message.data}');
      // TODO: navigate to specific screen via deep link
    });
  }

  @override
  Widget build(BuildContext context) {
    return WebViewScreen(key: _webViewKey);
  }
}
