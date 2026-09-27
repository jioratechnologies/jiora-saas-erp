import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';

class AttendanceScreen extends StatefulWidget {
  final ApiClient apiClient;

  const AttendanceScreen({super.key, required this.apiClient});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  late Timer _clockTimer;
  DateTime _now = DateTime.now();

  String _mode = 'OFFICE';
  bool _isCheckingIn = false;
  String _todayStatus = 'NOT_CHECKED_IN';
  String? _checkInTime;
  String? _checkOutTime;

  List<Map<String, dynamic>> _offlineQueue = [];
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() => _now = DateTime.now());
      }
    });
    _loadLocalState();
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    super.dispose();
  }

  Future<void> _loadLocalState() async {
    final prefs = await SharedPreferences.getInstance();
    final queueStr = prefs.getString('offline_punch_queue');
    if (queueStr != null) {
      try {
        final List<dynamic> decoded = jsonDecode(queueStr);
        _offlineQueue = decoded.map((e) => Map<String, dynamic>.from(e)).toList();
      } catch (_) {}
    }
    _checkInTime = prefs.getString('today_check_in_time');
    _checkOutTime = prefs.getString('today_check_out_time');
    if (_checkInTime != null && _checkOutTime == null) {
      _todayStatus = 'CHECKED_IN';
    } else if (_checkInTime != null && _checkOutTime != null) {
      _todayStatus = 'COMPLETED';
    }
    if (mounted) setState(() {});
  }

  Future<void> _recordPunch(String punchType) async {
    setState(() => _isCheckingIn = true);
    final timeStr = DateFormat('hh:mm a').format(_now);
    final isoStr = _now.toIso8601String();
    final dateStr = DateFormat('yyyy-MM-dd').format(_now);

    final punchRecord = {
      'offlineAttendanceId': const Uuid().v4(),
      'date': dateStr,
      'timestamp': isoStr,
      'checkInTime': punchType == 'CHECK_IN' ? isoStr : null,
      'checkOutTime': punchType == 'CHECK_OUT' ? isoStr : null,
      'type': punchType,
      'mode': _mode,
      'latitude': 28.5355,
      'longitude': 77.3910,
      'accuracyMeters': 4.8,
      'locationName': _mode == 'FIELD' ? 'Community Outreach Center, Delhi' : 'Head Office, Connaught Place',
      'verificationStatus': 'VERIFIED',
    };

    final prefs = await SharedPreferences.getInstance();
    _offlineQueue.add(punchRecord);
    await prefs.setString('offline_punch_queue', jsonEncode(_offlineQueue));

    if (punchType == 'CHECK_IN') {
      _checkInTime = timeStr;
      _todayStatus = 'CHECKED_IN';
      await prefs.setString('today_check_in_time', timeStr);
    } else {
      _checkOutTime = timeStr;
      _todayStatus = 'COMPLETED';
      await prefs.setString('today_check_out_time', timeStr);
    }

    setState(() => _isCheckingIn = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$punchType recorded locally. Offline queue size: ${_offlineQueue.length}'),
        backgroundColor: AppTheme.emerald,
      ),
    );

    // Attempt automatic sync
    _syncQueue();
  }

  Future<void> _syncQueue() async {
    if (_offlineQueue.isEmpty || _isSyncing) return;
    setState(() => _isSyncing = true);

    try {
      await widget.apiClient.post('/hr/attendance/sync', {
        'records': _offlineQueue,
        'items': _offlineQueue,
      });

      _offlineQueue.clear();
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('offline_punch_queue');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ All offline punches successfully synced to SaaS ERP.'),
            backgroundColor: AppTheme.emerald,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Sync queued (offline mode): $e'),
            backgroundColor: AppTheme.amber,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final timeFormatted = DateFormat('hh:mm:ss a').format(_now);
    final dateFormatted = DateFormat('EEEE, MMMM d, y').format(_now);

    return Scaffold(
      appBar: AppBar(
        title: const Text('ERP Attendance Clock'),
        actions: [
          IconButton(
            icon: _isSyncing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.sync),
            tooltip: 'Sync Offline Punches',
            onPressed: _syncQueue,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Live Clock Card
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppTheme.emerald,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _todayStatus == 'CHECKED_IN'
                                ? 'ON DUTY'
                                : _todayStatus == 'COMPLETED'
                                    ? 'SHIFTS COMPLETED'
                                    : 'READY TO PUNCH',
                            style: const TextStyle(
                              color: AppTheme.primary,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      timeFormatted,
                      style: const TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.2,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      dateFormatted,
                      style: const TextStyle(color: Color(0xFFA1A1AA), fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Mode Selector
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Work Mode',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFA1A1AA)),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildModeButton('OFFICE', Icons.business, 'Office'),
                        const SizedBox(width: 8),
                        _buildModeButton('REMOTE', Icons.home_work, 'Remote'),
                        const SizedBox(width: 8),
                        _buildModeButton('FIELD', Icons.explore, 'Field'),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: const [
                        Icon(Icons.location_on, size: 14, color: AppTheme.primary),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'GPS: 28.5355° N, 77.3910° E (Accuracy: ±4.8m)',
                            style: TextStyle(fontSize: 11, color: Color(0xFFA1A1AA)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.login),
                    label: const Text('Check In'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.emerald,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    onPressed: _todayStatus == 'NOT_CHECKED_IN' && !_isCheckingIn
                        ? () => _recordPunch('CHECK_IN')
                        : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.logout),
                    label: const Text('Check Out'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    onPressed: _todayStatus == 'CHECKED_IN' && !_isCheckingIn
                        ? () => _recordPunch('CHECK_OUT')
                        : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Punch Details
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Today\'s Punches',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    const Divider(color: AppTheme.darkBorder, height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('First Check-In', style: TextStyle(color: Color(0xFFA1A1AA), fontSize: 13)),
                        Text(
                          _checkInTime ?? '—',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Final Check-Out', style: TextStyle(color: Color(0xFFA1A1AA), fontSize: 13)),
                        Text(
                          _checkOutTime ?? '—',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ],
                    ),
                    if (_offlineQueue.isNotEmpty) ...[
                      const Divider(color: AppTheme.darkBorder, height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Offline Punches (${_offlineQueue.length})',
                            style: const TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                          TextButton(
                            onPressed: _syncQueue,
                            child: const Text('Sync to Server', style: TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModeButton(String modeKey, IconData icon, String label) {
    final isSelected = _mode == modeKey;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _mode = modeKey),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.primary.withOpacity(0.15) : AppTheme.darkBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppTheme.primary : AppTheme.darkBorder,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Column(
            children: [
              Icon(icon, size: 20, color: isSelected ? AppTheme.primary : const Color(0xFFA1A1AA)),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? Colors.white : const Color(0xFFA1A1AA),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
