import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'config.dart';
import 'screens/webview_screen.dart';
import 'services/push_service.dart';
import 'services/deep_link_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase
  await Firebase.initializeApp();
  await PushService.init();

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
  ));

  runApp(const PessyApp());
}

class PessyApp extends StatefulWidget {
  const PessyApp({super.key});

  @override
  State<PessyApp> createState() => _PessyAppState();
}

class _PessyAppState extends State<PessyApp> {
  final _webViewKey = GlobalKey<WebViewScreenState>();

  @override
  void initState() {
    super.initState();
    // Deep links → navigate WebView
    DeepLinkService.init(onLink: (url) {
      _webViewKey.currentState?.navigateTo(url);
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Pessy',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: Color(PessyConfig.primaryColor),
        useMaterial3: true,
      ),
      home: WebViewScreen(key: _webViewKey),
    );
  }
}
