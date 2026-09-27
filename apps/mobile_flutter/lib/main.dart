import 'package:flutter/material.dart';
import 'core/auth/auth_models.dart';
import 'core/auth/zitadel_auth_service.dart';
import 'core/network/api_client.dart';
import 'core/theme/app_theme.dart';
import 'features/attendance/attendance_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/claims/claims_screen.dart';
import 'features/leave/leave_screen.dart';
import 'features/payroll/payslips_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final apiClient = await ApiClient.create();
  final authService = ZitadelAuthService(apiClient: apiClient);

  // Check for Zitadel OIDC callback code or existing saved session
  final isAuthenticated = await authService.handleAuthCallbackOrRestoreSession();

  runApp(SaaSErpApp(
    apiClient: apiClient,
    authService: authService,
    initialAuthenticated: isAuthenticated,
  ));
}

class SaaSErpApp extends StatefulWidget {
  final ApiClient apiClient;
  final ZitadelAuthService authService;
  final bool initialAuthenticated;

  const SaaSErpApp({
    super.key,
    required this.apiClient,
    required this.authService,
    this.initialAuthenticated = false,
  });

  @override
  State<SaaSErpApp> createState() => _SaaSErpAppState();
}

class _SaaSErpAppState extends State<SaaSErpApp> {
  late bool _isAuthenticated;

  @override
  void initState() {
    super.initState();
    _isAuthenticated = widget.initialAuthenticated || widget.authService.currentUser != null;
  }

  void _onLoginSuccess() {
    setState(() {
      _isAuthenticated = true;
    });
  }

  void _onSignOut() async {
    await widget.authService.signOut();
    setState(() {
      _isAuthenticated = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SaaS ERP Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: _isAuthenticated
          ? AppShell(
              apiClient: widget.apiClient,
              authService: widget.authService,
              onSignOut: _onSignOut,
            )
          : LoginScreen(
              authService: widget.authService,
              onLoginSuccess: _onLoginSuccess,
            ),
    );
  }
}

class AppShell extends StatefulWidget {
  final ApiClient apiClient;
  final ZitadelAuthService authService;
  final VoidCallback onSignOut;

  const AppShell({
    super.key,
    required this.apiClient,
    required this.authService,
    required this.onSignOut,
  });

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _currentIndex = 0;

  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _screens = [
      AttendanceScreen(apiClient: widget.apiClient),
      LeaveScreen(apiClient: widget.apiClient),
      PayslipsScreen(apiClient: widget.apiClient),
      ClaimsScreen(apiClient: widget.apiClient),
    ];
  }

  void _showUserProfileModal(BuildContext context, UserProfile? user) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.darkCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
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
              const SizedBox(height: 20),
              Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: const Color(0xFFE11D48),
                    child: Text(
                      user != null && user.displayName.isNotEmpty
                          ? user.displayName[0].toUpperCase()
                          : 'U',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.displayName ?? 'Authenticated User',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          user?.email ?? '',
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppTheme.darkMutedText,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const Divider(color: AppTheme.darkBorder),
              const SizedBox(height: 12),

              if (user != null) ...[
                if (user.designationName != null || user.departmentName != null)
                  _buildDetailRow(
                    'Position',
                    '${user.designationName ?? 'Staff'} • ${user.departmentName ?? 'General'}',
                  ),
                if (user.employeeId != null)
                  _buildDetailRow('Employee ID', user.employeeId!),
                _buildDetailRow(
                  'Roles',
                  user.roles.isNotEmpty ? user.roles.join(', ') : 'User',
                ),
                _buildDetailRow(
                  'Auth Provider',
                  'Zitadel OIDC (PKCE)',
                ),
              ],
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  widget.onSignOut();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.rose.withOpacity(0.15),
                  foregroundColor: AppTheme.rose,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: AppTheme.rose.withOpacity(0.3)),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                icon: const Icon(Icons.logout_rounded, size: 20),
                label: const Text(
                  'Sign Out from Zitadel',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 13, color: AppTheme.darkMutedText),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Colors.white70,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.authService.currentUser;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppTheme.darkCard,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFE11D48),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.shield_rounded, size: 16, color: Colors.white),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'SaaS ERP',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                Text(
                  user?.displayName ?? 'Online',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppTheme.darkMutedText,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Zitadel OIDC status chip
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: AppTheme.emerald.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppTheme.emerald.withOpacity(0.3)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.lock_outline, size: 12, color: AppTheme.emerald),
                SizedBox(width: 4),
                Text(
                  'Zitadel',
                  style: TextStyle(fontSize: 11, color: AppTheme.emerald, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: CircleAvatar(
              radius: 15,
              backgroundColor: const Color(0xFFE11D48).withOpacity(0.3),
              child: Text(
                user != null && user.displayName.isNotEmpty
                    ? user.displayName[0].toUpperCase()
                    : 'U',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
            onPressed: () => _showUserProfileModal(context, user),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(
            top: BorderSide(color: AppTheme.darkBorder, width: 1),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.access_time_rounded),
              activeIcon: Icon(Icons.access_time_filled_rounded),
              label: 'Clock',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.event_note_outlined),
              activeIcon: Icon(Icons.event_note_rounded),
              label: 'Leaves',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.receipt_long_outlined),
              activeIcon: Icon(Icons.receipt_long_rounded),
              label: 'Payslips',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.credit_card_outlined),
              activeIcon: Icon(Icons.credit_card_rounded),
              label: 'Claims',
            ),
          ],
        ),
      ),
    );
  }
}
