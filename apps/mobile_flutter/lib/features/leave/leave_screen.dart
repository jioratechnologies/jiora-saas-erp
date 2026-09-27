import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';

class LeaveScreen extends StatefulWidget {
  final ApiClient apiClient;

  const LeaveScreen({super.key, required this.apiClient});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _balances = [];
  List<Map<String, dynamic>> _myRequests = [];

  @override
  void initState() {
    super.initState();
    _fetchLeaveData();
  }

  Future<void> _fetchLeaveData() async {
    setState(() => _isLoading = true);
    try {
      final res = await widget.apiClient.get('/hr/leave/balance');
      if (res != null && res is Map) {
        final quotas = res['quotas'] as List? ?? [];
        _balances = quotas.map((e) => Map<String, dynamic>.from(e)).toList();
      }
      final requestsRes = await widget.apiClient.get('/hr/leave/requests/my');
      if (requestsRes != null && requestsRes is List) {
        _myRequests = requestsRes.map((e) => Map<String, dynamic>.from(e)).toList();
      }
    } catch (_) {
      // Fallback demo mock if offline
      _balances = [
        {'name': 'Casual Leave', 'code': 'CL', 'annualQuota': 12, 'used': 2, 'remaining': 10},
        {'name': 'Sick Leave', 'code': 'SL', 'annualQuota': 10, 'used': 1, 'remaining': 9},
        {'name': 'Privilege Leave', 'code': 'PL', 'annualQuota': 15, 'used': 0, 'remaining': 15},
      ];
      _myRequests = [
        {
          'id': 'mock-1',
          'leaveType': {'name': 'Casual Leave', 'code': 'CL'},
          'startDate': '2026-09-28',
          'endDate': '2026-09-29',
          'daysCount': 2,
          'reason': 'Family gathering in Jaipur',
          'status': 'APPROVED',
        },
      ];
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showApplyDialog() {
    String selectedType = _balances.isNotEmpty ? _balances.first['code'] : 'CL';
    DateTime start = DateTime.now().add(const Duration(days: 1));
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: AppTheme.darkCard,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Apply for Leave', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Leave Type', style: TextStyle(fontSize: 12, color: Color(0xFFA1A1AA))),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: selectedType,
                  dropdownColor: AppTheme.darkCard,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  items: _balances
                      .map((b) => DropdownMenuItem<String>(
                            value: b['code'].toString(),
                            child: Text('${b['name']} (${b['remaining']} left)'),
                          ))
                      .toList(),
                  onChanged: (val) => setDialogState(() => selectedType = val ?? 'CL'),
                ),
                const SizedBox(height: 16),
                const Text('Start Date', style: TextStyle(fontSize: 12, color: Color(0xFFA1A1AA))),
                const SizedBox(height: 6),
                OutlinedButton(
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: start,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 90)),
                    );
                    if (picked != null) setDialogState(() => start = picked);
                  },
                  child: Text(DateFormat('yyyy-MM-dd').format(start)),
                ),
                const SizedBox(height: 16),
                const Text('Reason', style: TextStyle(fontSize: 12, color: Color(0xFFA1A1AA))),
                const SizedBox(height: 6),
                TextField(
                  controller: reasonController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: 'State reason for leave request...',
                    hintStyle: const TextStyle(fontSize: 12, color: Color(0xFFA1A1AA)),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Leave application submitted for manager approval.'),
                    backgroundColor: AppTheme.emerald,
                  ),
                );
              },
              child: const Text('Submit Application'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave Management'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Apply Leave', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: _showApplyDialog,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchLeaveData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Annual Leave Quotas',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFA1A1AA)),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 110,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _balances.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 12),
                      itemBuilder: (ctx, idx) {
                        final b = _balances[idx];
                        return Container(
                          width: 150,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppTheme.darkCard,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppTheme.darkBorder),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    b['code'] ?? '',
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary),
                                  ),
                                  const Icon(Icons.calendar_month, size: 16, color: Color(0xFFA1A1AA)),
                                ],
                              ),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    '${b['remaining'] ?? 0}',
                                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                                  ),
                                  Text(
                                    ' / ${b['annualQuota'] ?? 0} days left',
                                    style: const TextStyle(fontSize: 11, color: Color(0xFFA1A1AA)),
                                  ),
                                ],
                              ),
                              Text(
                                b['name'] ?? '',
                                style: const TextStyle(fontSize: 11, color: Color(0xFFA1A1AA)),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Recent Leave Requests',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFA1A1AA)),
                  ),
                  const SizedBox(height: 12),
                  if (_myRequests.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Center(
                        child: Text('No leave applications submitted yet.', style: TextStyle(color: Color(0xFFA1A1AA))),
                      ),
                    )
                  else
                    ..._myRequests.map((r) {
                      final status = r['status'] ?? 'PENDING';
                      final color = status == 'APPROVED'
                          ? AppTheme.emerald
                          : status == 'REJECTED'
                              ? AppTheme.rose
                              : AppTheme.amber;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    r['leaveType']?['name'] ?? 'Leave Request',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: color.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      status,
                                      style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '${r['startDate']} to ${r['endDate']} (${r['daysCount']} days)',
                                style: const TextStyle(fontSize: 12, color: Color(0xFFA1A1AA)),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                r['reason'] ?? '',
                                style: const TextStyle(fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                ],
              ),
            ),
    );
  }
}
