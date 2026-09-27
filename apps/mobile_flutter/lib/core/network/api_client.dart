import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static String get defaultBaseUrl =>
      kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000';

  String baseUrl;
  String? token;

  ApiClient({String? baseUrl, this.token})
      : baseUrl = baseUrl ?? defaultBaseUrl;

  static Future<ApiClient> create() async {
    final prefs = await SharedPreferences.getInstance();
    final savedBase = prefs.getString('api_base_url') ?? defaultBaseUrl;
    final savedToken = prefs.getString('auth_token');
    return ApiClient(baseUrl: savedBase, token: savedToken);
  }

  Future<void> saveToken(String newToken) async {
    token = newToken;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', newToken);
  }

  Future<void> clearToken() async {
    token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  }

  Future<void> saveBaseUrl(String newUrl) async {
    baseUrl = newUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_base_url', newUrl);
  }

  Map<String, String> _headers() {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null && token!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<dynamic> get(String path) async {
    final url = Uri.parse('$baseUrl$path');
    try {
      final res = await http.get(url, headers: _headers());
      return _processResponse(res);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  Future<dynamic> post(String path, dynamic body) async {
    final url = Uri.parse('$baseUrl$path');
    try {
      final res = await http.post(
        url,
        headers: _headers(),
        body: jsonEncode(body),
      );
      return _processResponse(res);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  dynamic _processResponse(http.Response res) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (res.body.isEmpty) return null;
      return jsonDecode(res.body);
    } else {
      try {
        final err = jsonDecode(res.body);
        final msg = err['message'] ?? 'Request failed (${res.statusCode})';
        throw Exception(msg is List ? msg.join(', ') : msg);
      } catch (_) {
        throw Exception('Request failed with HTTP status ${res.statusCode}');
      }
    }
  }
}
