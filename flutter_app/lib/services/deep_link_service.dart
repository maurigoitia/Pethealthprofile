import 'package:app_links/app_links.dart';

class DeepLinkService {
  static final _appLinks = AppLinks();
  static Function(String)? _onLink;

  static void init({required Function(String) onLink}) {
    _onLink = onLink;

    // Handle link that opened the app (cold start)
    _appLinks.getInitialLink().then((uri) {
      if (uri != null) _onLink?.call(uri.toString());
    });

    // Handle links while app is running (warm start)
    _appLinks.uriLinkStream.listen((uri) {
      _onLink?.call(uri.toString());
    });
  }
}
