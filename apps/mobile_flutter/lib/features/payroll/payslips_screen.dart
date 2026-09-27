import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';

class PayslipsScreen extends StatefulWidget {
  final ApiClient apiClient;

  const PayslipsScreen({super.key, required this.apiClient});

  @override
  State<PayslipsScreen> createState() => _PayslipsScreenState();
}

class _PayslipsScreenState extends State<PayslipsScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _slips = [];

  static const List<String> monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  @override
  void initState() {
    super.initState();
    _fetchPayslips();
  }

  Future<void> _fetchPayslips() async {
    setState(() => _isLoading = true);
    try {
      final res = await widget.apiClient.get('/payroll/runs/my-payslips');
      if (res != null && res is List) {
        _slips = res.map((e) => Map<String, dynamic>.from(e)).toList();
      }
    } catch (_) {
      // Demo mock fallback if offline
      _slips = [
        {
          'id': 'slip-sep-2026',
          'year': 2026,
          'month': 9,
          'totalWorkingDays': 22,
          'presentDays': 22,
          'lopDays': 0,
          'grossPay': 45000,
          'totalDeductions': 2900,
          'netPay': 42100,
          'paymentStatus': 'APPROVED',
          'earnings': [
            {'name': 'Basic Salary', 'amount': 22500},
            {'name': 'House Rent Allowance', 'amount': 11250},
            {'name': 'Conveyance Allowance', 'amount': 4500},
            {'name': 'Special Allowance', 'amount': 6750},
          ],
          'deductions': [
            {'name': 'Provident Fund (Employee)', 'amount': 2700},
            {'name': 'Professional Tax', 'amount': 200},
          ],
        },
      ];
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSlipDetail(Map<String, dynamic> slip) {
    final earnings = (slip['earnings'] as List? ?? []).map((e) => Map<String, dynamic>.from(e)).toList();
    final deductions = (slip['deductions'] as List? ?? []).map((d) => Map<String, dynamic>.from(d)).toList();

    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.darkCard,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.8,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (ctx, scrollController) => Padding(
          padding: const EdgeInsets.all(20),
          child: ListView(
            controller: scrollController,
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Salary Slip',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        '${monthNames[(slip['month'] ?? 1) - 1]} ${slip['year']}',
                        style: const TextStyle(fontSize: 13, color: Color(0xFFA1A1AA)),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.emerald.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      slip['paymentStatus'] ?? 'PAID',
                      style: const TextStyle(color: AppTheme.emerald, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const Divider(color: AppTheme.darkBorder, height: 28),

              // Attendance & Days
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _metric('Working Days', '${slip['totalWorkingDays'] ?? 22}'),
                  _metric('Paid Days', '${slip['presentDays'] ?? 22}'),
                  _metric('LOP Days', '${slip['lopDays'] ?? 0}'),
                ],
              ),
              const Divider(color: AppTheme.darkBorder, height: 28),

              // Earnings Breakdown
              const Text('Earnings', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.primary)),
              const SizedBox(height: 8),
              ...earnings.map((e) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(e['name'] ?? '', style: const TextStyle(fontSize: 13, color: Color(0xFFA1A1AA))),
                        Text('₹${(e['amount'] ?? 0)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  )),
              const Divider(color: AppTheme.darkBorder, height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total Gross Pay', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  Text('₹${(slip['grossPay'] ?? 0)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                ],
              ),
              const SizedBox(height: 20),

              // Deductions Breakdown
              const Text('Deductions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.rose)),
              const SizedBox(height: 8),
              ...deductions.map((d) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(d['name'] ?? '', style: const TextStyle(fontSize: 13, color: Color(0xFFA1A1AA))),
                        Text('-₹${(d['amount'] ?? 0)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.rose)),
                      ],
                    ),
                  )),
              const Divider(color: AppTheme.darkBorder, height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total Deductions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  Text('-₹${(slip['totalDeductions'] ?? 0)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.rose)),
                ],
              ),
              const SizedBox(height: 24),

              // Net Take-Home Salary Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('NET TAKE-HOME SALARY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.primary)),
                        SizedBox(height: 4),
                        Text('Official disbursement', style: TextStyle(fontSize: 11, color: Color(0xFFA1A1AA))),
                      ],
                    ),
                    Text(
                      '₹${slip['netPay'] ?? 0}',
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _metric(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFFA1A1AA))),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Payslips'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchPayslips,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _slips.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (ctx, idx) {
                  final slip = _slips[idx];
                  final monthIdx = (slip['month'] ?? 1) - 1;
                  final monthName = monthIdx >= 0 && monthIdx < monthNames.length ? monthNames[monthIdx] : 'Month';

                  return Card(
                    child: InkWell(
                      onTap: () => _showSlipDetail(slip),
                      borderRadius: BorderRadius.circular(16),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppTheme.primary.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.receipt_long, color: AppTheme.primary, size: 24),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '$monthName ${slip['year']}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${slip['presentDays'] ?? 0} Working Days • Net: ₹${slip['netPay'] ?? 0}',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFFA1A1AA)),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: Color(0xFFA1A1AA)),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
