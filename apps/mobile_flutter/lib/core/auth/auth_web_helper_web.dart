// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

void cleanUrlParams() {
  try {
    final uri = Uri.parse(html.window.location.href);
    final cleanUri = Uri(
      scheme: uri.scheme,
      host: uri.host,
      port: uri.hasPort ? uri.port : null,
      path: uri.path,
    );
    html.window.history.replaceState(null, 'SaaS ERP', cleanUri.toString());
  } catch (_) {}
}

String? getInitialQueryParam(String key) {
  try {
    final uri = Uri.parse(html.window.location.href);
    return uri.queryParameters[key];
  } catch (_) {
    return null;
  }
}
