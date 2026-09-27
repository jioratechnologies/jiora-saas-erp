import 'package:flutter/material.dart';
import '../../core/auth/zitadel_auth_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/branding_service.dart';

class LoginScreen extends StatefulWidget {
  final ZitadelAuthService authService;
  final BrandingService brandingService;
  final VoidCallback onLoginSuccess;

  const LoginScreen({
    super.key,
    required this.authService,
    required this.brandingService,
    required this.onLoginSuccess,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _errorMessage = widget.authService.lastAuthError;
    if (widget.authService.apiClient.token != null &&
        widget.authService.apiClient.token!.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.onLoginSuccess();
      });
    }
  }

  Future<void> _handleZitadelSignIn() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await widget.authService.signInWithZitadel();
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to open Zitadel login: $e';
        });
      }
    }
  }

  void _showWorkspaceSwitcher(BuildContext context) async {
    final tenants = await widget.brandingService.fetchAvailableTenants();
    if (!mounted) return;

    final controller = TextEditingController();

    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.darkCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppTheme.darkBorder,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Switch Company Workspace',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Select your organization or enter your company workspace slug to apply custom brand colors, logo, and identity.',
                style: TextStyle(fontSize: 13, color: AppTheme.darkMutedText),
              ),
              const SizedBox(height: 20),

              // Available Tenants List
              if (tenants.isNotEmpty) ...[
                const Text(
                  'AVAILABLE ORGANISATIONS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                    color: AppTheme.darkMutedText,
                  ),
                ),
                const SizedBox(height: 10),
                ...tenants.map((t) {
                  final isCurrent = t.slug == widget.brandingService.current.slug;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: isCurrent ? t.primaryColor.withOpacity(0.12) : AppTheme.darkBg,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isCurrent ? t.primaryColor : AppTheme.darkBorder,
                        width: isCurrent ? 1.5 : 1,
                      ),
                    ),
                    child: ListTile(
                      leading: t.buildLogo(size: 36, borderRadius: 10),
                      title: Text(
                        t.name,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      subtitle: Text(
                        'slug: ${t.slug}',
                        style: const TextStyle(fontSize: 11, color: AppTheme.darkMutedText),
                      ),
                      trailing: isCurrent
                          ? Icon(Icons.check_circle_rounded, color: t.primaryColor, size: 20)
                          : const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppTheme.darkMutedText),
                      onTap: () {
                        widget.brandingService.setBranding(t);
                        Navigator.pop(ctx);
                        setState(() {});
                      },
                    ),
                  );
                }),
                const SizedBox(height: 16),
              ],

              // Custom Slug Input
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: controller,
                      decoration: InputDecoration(
                        hintText: 'Enter custom slug (e.g. acme)',
                        hintStyle: const TextStyle(fontSize: 13, color: AppTheme.darkMutedText),
                        filled: true,
                        fillColor: AppTheme.darkBg,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.darkBorder),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.darkBorder),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  ElevatedButton(
                    onPressed: () async {
                      final slug = controller.text.trim();
                      if (slug.isNotEmpty) {
                        await widget.brandingService.fetchAndApplyBranding(slug);
                        if (mounted) Navigator.pop(ctx);
                        setState(() {});
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Apply'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TenantBranding>(
      valueListenable: widget.brandingService.brandingNotifier,
      builder: (context, branding, _) {
        return Scaffold(
          backgroundColor: AppTheme.darkBackground,
          body: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Dynamic Brand Header & Logo
                    Center(
                      child: branding.buildLogo(size: 76, borderRadius: 22),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      branding.name,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.5,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Cross-platform attendance, leaves, payslips & employee self-service',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: AppTheme.darkMutedText,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Workspace Switcher Pill
                    Center(
                      child: InkWell(
                        onTap: () => _showWorkspaceSwitcher(context),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppTheme.darkCard,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppTheme.darkBorder),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.business_rounded, size: 14, color: branding.primaryColor),
                              const SizedBox(width: 6),
                              Text(
                                branding.slug.isNotEmpty && branding.slug != 'default'
                                    ? 'Workspace: ${branding.slug}'
                                    : 'Switch Workspace',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white70),
                              ),
                              const SizedBox(width: 4),
                              const Icon(Icons.swap_horiz_rounded, size: 14, color: AppTheme.darkMutedText),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Main Auth Card
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: AppTheme.darkCard,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.darkBorder, width: 1),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.3),
                            blurRadius: 24,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Zitadel Identity status pill
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: AppTheme.emerald.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppTheme.emerald.withOpacity(0.3)),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.shield_outlined, size: 14, color: AppTheme.emerald),
                                SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Zitadel Identity Provider (Port 8081)',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: AppTheme.emerald,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 18),

                          if (_errorMessage != null) ...[
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppTheme.rose.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppTheme.rose.withOpacity(0.3)),
                              ),
                              child: Text(
                                _errorMessage!,
                                style: const TextStyle(fontSize: 12, color: AppTheme.rose),
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],

                          Text(
                            'Authenticate to access your personal workspace at ${branding.name}, record attendance, and view payroll.',
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppTheme.darkMutedText,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 24),

                          // Dynamic Brand-Colored Login Button
                          SizedBox(
                            height: 48,
                            child: ElevatedButton.icon(
                              onPressed: _isLoading ? null : _handleZitadelSignIn,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: branding.primaryColor,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              icon: _isLoading
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor: AlwaysStoppedAnimation(Colors.white),
                                      ),
                                    )
                                  : const Icon(Icons.lock_outline_rounded, size: 20),
                              label: Text(
                                _isLoading ? 'Redirecting to Zitadel...' : 'Sign in with Zitadel',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Environment Specs
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.darkCard.withOpacity(0.5),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppTheme.darkBorder.withOpacity(0.5)),
                      ),
                      child: Column(
                        children: [
                          _buildEnvRow('Company Brand', branding.name),
                          _buildEnvRow('Primary Color', '#${branding.primaryColor.value.toRadixString(16).substring(2).toUpperCase()}'),
                          _buildEnvRow('Authority Issuer', widget.authService.issuer),
                          _buildEnvRow('Backend API', widget.authService.apiClient.baseUrl),
                        ],
                      ),
                    ),

                    if (branding.showPoweredBy) ...[
                      const SizedBox(height: 20),
                      const Center(
                        child: Text(
                          'Powered by SaaS ERP Multi-Tenant Cloud',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppTheme.darkMutedText,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildEnvRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: AppTheme.darkMutedText),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Colors.white70,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
