import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'config_qa.dart';
import 'screens/webview_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
