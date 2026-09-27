import 'package:flutter/material.dart';
import 'core/network/api_client.dart';
import 'core/theme/app_theme.dart';
import 'features/attendance/attendance_screen.dart';
import 'features/leave/leave_screen.dart';
import 'features/payroll/payslips_screen.dart';
import 'features/claims/claims_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final apiClient = await ApiClient.create();
  runApp(SaaSErpApp(apiClient: apiClient));
}

class SaaSErpApp extends StatelessWidget {
  final ApiClient apiClient;

  const SaaSErpApp({super.key, required this.apiClient});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SaaS ERP Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: AppShell(apiClient: apiClient),
    );
  }
}

class AppShell extends StatefulWidget {
  final ApiClient apiClient;

  const AppShell({super.key, required this.apiClient});

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
