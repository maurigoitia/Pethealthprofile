import 'package:app_links/app_links.dart';

class DeepLinkService {
  static final _appLinks = AppLinks();

  static void init({required Function(String) onLink}) {
    _appLinks.getInitialLink().then((uri) {
      if (uri != null) onLink(uri.toString());
    });
    _appLinks.uriLinkStream.listen((uri) => onLink(uri.toString()));
  }
}
