/// QA config — points to localhost dev server instead of production.
/// To use: change the import in main.dart from 'config.dart' to 'config_qa.dart'
/// Then run: flutter run -d <device>
/// When done testing, switch back to config.dart

class PessyConfig {
  // QA: local dev server (change IP if testing on physical device)
  static const String appUrl = 'http://localhost:3001';
  static const String homeUrl = 'http://localhost:3001/inicio';
  static const String deepLinkHost = 'localhost';
  static const int primaryColor = 0xFF074738;
  static const int accentColor = 0xFF1A9B7D;
  static const int backgroundColor = 0xFFF0FAF9;
}
