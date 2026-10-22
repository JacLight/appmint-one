import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../config/environment.dart';
import '../../config/stowbo_theme.dart';

/// Runs Google OAuth in a WebView and returns the authorization `code` by
/// intercepting the redirect to the (authorized) callback URL — the host is
/// never actually loaded, so it need not serve anything. Pops with the code
/// String on success, or null on cancel/error.
class GoogleAuthWebView extends StatefulWidget {
  const GoogleAuthWebView({super.key});
  @override
  State<GoogleAuthWebView> createState() => _GoogleAuthWebViewState();
}

class _GoogleAuthWebViewState extends State<GoogleAuthWebView> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _done = false;

  String get _authUrl {
    final params = {
      'client_id': EnvironmentConfig.googleWebClientId,
      'redirect_uri': EnvironmentConfig.googleRedirectUri,
      'response_type': 'code',
      'scope': 'email profile',
      'prompt': 'select_account',
      'access_type': 'offline',
    };
    final q = params.entries
        .map((e) =>
            '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}')
        .join('&');
    return 'https://accounts.google.com/o/oauth2/v2/auth?$q';
  }

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: (req) => _intercept(req.url),
        onPageStarted: (url) {
          _intercept(url);
          if (mounted) setState(() => _loading = true);
        },
        onPageFinished: (_) {
          if (mounted) setState(() => _loading = false);
        },
      ))
      ..loadRequest(Uri.parse(_authUrl));
  }

  NavigationDecision _intercept(String url) {
    if (_done) return NavigationDecision.prevent;
    if (url.startsWith(EnvironmentConfig.googleRedirectUri)) {
      _done = true;
      final uri = Uri.parse(url);
      final code = uri.queryParameters['code'];
      final error = uri.queryParameters['error'];
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.pop(context, error != null ? null : code);
      });
      return NavigationDecision.prevent;
    }
    return NavigationDecision.navigate;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        title: const Text('Sign in with Google'),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: () => Navigator.pop(context, null),
        ),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading)
            const LinearProgressIndicator(
                color: SColors.clay, backgroundColor: SColors.paper2),
        ],
      ),
    );
  }
}
