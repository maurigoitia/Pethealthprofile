import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../config.dart';

class WebViewScreen extends StatefulWidget {
  final String? initialUrl;
  const WebViewScreen({super.key, this.initialUrl});

  @override
  State<WebViewScreen> createState() => WebViewScreenState();
}

class WebViewScreenState extends State<WebViewScreen> {
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
          // Allow pessy.app, Google Auth, Firebase
          if (request.url.contains('pessy.app') ||
              request.url.contains('accounts.google.com') ||
              request.url.contains('firebaseapp.com') ||
              request.url.contains('googleapis.com')) {
            return NavigationDecision.navigate;
          }
          // Block external navigation
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
    debugPrint('[PessyBridge] $message');
  }

  /// Navigate the WebView to a URL (used by deep links)
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
