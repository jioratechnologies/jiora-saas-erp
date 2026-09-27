import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../network/api_client.dart';

class TenantBranding {
  final String id;
  final String slug;
  final String name;
  final Color primaryColor;
  final String? logoUrl;
  final bool showPoweredBy;

  const TenantBranding({
    required this.id,
    required this.slug,
    required this.name,
    required this.primaryColor,
    this.logoUrl,
    this.showPoweredBy = true,
  });

  static const defaultBranding = TenantBranding(
    id: 'default',
    slug: 'default',
    name: 'SaaS ERP Mobile',
    primaryColor: Color(0xFFE11D48), // HeroUI Rose
    logoUrl: null,
    showPoweredBy: true,
  );

  factory TenantBranding.fromJson(Map<String, dynamic> json) {
    return TenantBranding(
      id: json['id']?.toString() ?? 'unknown',
      slug: json['slug']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Enterprise ERP',
      primaryColor: parseHexColor(json['primaryColor']?.toString() ?? '#E11D48'),
      logoUrl: json['logoUrl']?.toString(),
      showPoweredBy: json['showPoweredBy'] != false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'slug': slug,
      'name': name,
      'primaryColor': '#${primaryColor.value.toRadixString(16).padLeft(8, '0').substring(2)}',
      'logoUrl': logoUrl,
      'showPoweredBy': showPoweredBy,
    };
  }

  static Color parseHexColor(String hex) {
    String cleanHex = hex.replaceAll('#', '').trim();
    if (cleanHex.length == 6) {
      cleanHex = 'FF$cleanHex';
    }
    try {
      return Color(int.parse(cleanHex, radix: 16));
    } catch (_) {
      return const Color(0xFFE11D48);
    }
  }

  /// Renders company logo: handles Base64 data URIs, network URLs, or fallback brand initials
  Widget buildLogo({double size = 48, double borderRadius = 14}) {
    if (logoUrl != null && logoUrl!.isNotEmpty) {
      // Check for base64 data URI: data:image/webp;base64,....
      if (logoUrl!.startsWith('data:image/')) {
        try {
          final commaIndex = logoUrl!.indexOf(',');
          if (commaIndex != -1) {
            final base64Str = logoUrl!.substring(commaIndex + 1);
            final bytes = base64Decode(base64Str);
            return ClipRRect(
              borderRadius: BorderRadius.circular(borderRadius),
              child: Image.memory(
                bytes,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _fallbackLogo(size, borderRadius),
              ),
            );
          }
        } catch (_) {}
      } else if (logoUrl!.startsWith('http://') || logoUrl!.startsWith('https://')) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(borderRadius),
          child: Image.network(
            logoUrl!,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _fallbackLogo(size, borderRadius),
          ),
        );
      }
    }
    return _fallbackLogo(size, borderRadius);
  }

  Widget _fallbackLogo(double size, double borderRadius) {
    final initials = name.trim().split(' ').map((e) => e.isNotEmpty ? e[0].toUpperCase() : '').take(2).join();
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [primaryColor, primaryColor.withOpacity(0.8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: [
          BoxShadow(
            color: primaryColor.withOpacity(0.35),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Center(
        child: Text(
          initials.isNotEmpty ? initials : 'ERP',
          style: TextStyle(
            fontSize: size * 0.42,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class BrandingService {
  final ApiClient apiClient;
  final ValueNotifier<TenantBranding> brandingNotifier =
      ValueNotifier(TenantBranding.defaultBranding);

  BrandingService({required this.apiClient});

  TenantBranding get current => brandingNotifier.value;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final savedJson = prefs.getString('tenant_branding');
    if (savedJson != null) {
      try {
        final data = jsonDecode(savedJson) as Map<String, dynamic>;
        brandingNotifier.value = TenantBranding.fromJson(data);
      } catch (e) {
        debugPrint('Error restoring saved branding: $e');
      }
    }

    // Try fetching the default / pilot tenant branding
    await fetchAndApplyBranding(current.slug == 'default' ? 'jiorasacchisahelitest1' : current.slug);
  }

  Future<void> setBranding(TenantBranding branding) async {
    brandingNotifier.value = branding;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('tenant_branding', jsonEncode(branding.toJson()));
  }

  Future<TenantBranding?> fetchAndApplyBranding(String slug) async {
    try {
      final res = await apiClient.get('/public/tenants/$slug');
      if (res is Map) {
        final branding = TenantBranding.fromJson(Map<String, dynamic>.from(res));
        await setBranding(branding);
        return branding;
      }
    } catch (e) {
      debugPrint('Failed to load branding for slug $slug: $e');
    }
    return null;
  }

  Future<void> syncFromLoggedInOrg() async {
    if (apiClient.token == null) return;
    try {
      final res = await apiClient.get('/admin/org');
      if (res is Map) {
        final branding = TenantBranding.fromJson(Map<String, dynamic>.from(res));
        await setBranding(branding);
      }
    } catch (e) {
      debugPrint('Failed to sync tenant branding from /admin/org: $e');
    }
  }

  Future<List<TenantBranding>> fetchAvailableTenants() async {
    try {
      final res = await apiClient.get('/public/tenants');
      if (res is List) {
        return res
            .whereType<Map>()
            .map((item) => TenantBranding.fromJson(Map<String, dynamic>.from(item)))
            .toList();
      }
    } catch (e) {
      debugPrint('Failed to fetch public tenants list: $e');
    }
    return [current];
  }
}
