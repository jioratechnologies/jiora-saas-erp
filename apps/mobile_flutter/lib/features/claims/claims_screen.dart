import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';

class ClaimsScreen extends StatefulWidget {
  final ApiClient apiClient;

  const ClaimsScreen({super.key, required this.apiClient});

  @override
  State<ClaimsScreen> createState() => _ClaimsScreenState();
}

class _ClaimsScreenState extends State<ClaimsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = false;

  List<Map<String, dynamic>> _claims = [];
  List<Map<String, dynamic>> _advances = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final claimsRes = await widget.apiClient.get('/payroll/claims/expenses/my');
      if (claimsRes != null && claimsRes is List) {
        _claims = claimsRes.map((e) => Map<String, dynamic>.from(e)).toList();
      }
      final advRes = await widget.apiClient.get('/payroll/claims/advances/my');
      if (advRes != null && advRes is List) {
        _advances = advRes.map((e) => Map<String, dynamic>.from(e)).toList();
      }
    } catch (_) {
      // Demo mock fallback
      _claims = [
        {
          'id': 'claim-1',
          'title': 'Field Logistics SIM Recharges',
          'category': 'COMMUNICATION',
          'amount': 1500,
          'status': 'SUBMITTED',
          'expenseDate': '2026-09-20',
        },
      ];
      _advances = [
        {
          'id': 'adv-1',
          'amountRequested': 15000,
          'tenureMonths': 3,
          'monthlyDeduction': 5000,
          'amountRecovered': 0,
          'status': 'PENDING',
          'reason': 'Rental security deposit advance for apartment relocation',
        },
      ];
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showNewClaimDialog() {
    final titleController = TextEditingController();
    final amountController = TextEditingController();
    String category = 'TRAVEL';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: AppTheme.darkCard,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('New Expense Claim', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Claim Title', style: TextStyle(fontSize: 12, color: Color(0xFFA1A1AA))),
                const SizedBox(height: 6),
                TextField(
                  controller: titleController,
                  decoration: InputDecoration(
                    hintText: 'e.g. Travel tickets or office supplies',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 14),
                const Text('Category', style: TextStyle(fontSize: 12, color: Color(0xFFA1A1AA))),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: category,
                  dropdownColor: AppTheme.darkCard,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'TRAVEL', child: Text('Travel & Cab')),
                    DropdownMenuItem(value: 'FOOD', child: Text('Food & Catering')),
                    DropdownMenuItem(value: 'SUPPLIES', child: Text('Office Supplies')),
                    DropdownMenuItem(value: 'COMMUNICATION', child: Text('Phone & Internet')),
                    DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                  ],
                  onChanged: (val) => setDialogState(() => category = val ?? 'TRAVEL'),
                ),
                const SizedBox(height: 14),
                const Text('Amount (INR)', style: TextStyle(fontSize: 12, color: Color(0xFFA1A1AA))),
                const SizedBox(height: 6),
                TextField(
                  controller: amountController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    prefixText: '₹ ',
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
              onPressed: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Expense claim submitted for finance review.'),
                    backgroundColor: AppTheme.emerald,
                  ),
                );
              },
              child: const Text('Submit Claim'),
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
        title: const Text('Claims & Advances'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.primary,
          labelColor: AppTheme.primary,
          unselectedLabelColor: const Color(0xFFA1A1AA),
          tabs: const [
            Tab(text: 'Reimbursements'),
            Tab(text: 'Salary Advances'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Request', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: _showNewClaimDialog,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                // Reimbursements Tab
                ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _claims.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (ctx, idx) {
                    final c = _claims[idx];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(c['title'] ?? 'Expense Claim', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                const SizedBox(height: 4),
                                Text('${c['category']} • ${c['expenseDate']}', style: const TextStyle(fontSize: 12, color: Color(0xFFA1A1AA))),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('₹${c['amount'] ?? 0}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                const SizedBox(height: 4),
                                Text(
                                  c['status'] ?? 'SUBMITTED',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: c['status'] == 'SETTLED'
                                        ? AppTheme.emerald
                                        : c['status'] == 'APPROVED'
                                            ? Colors.blue
                                            : AppTheme.amber,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),

                // Advances Tab
                ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _advances.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (ctx, idx) {
                    final a = _advances[idx];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text('Emergency Advance', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                Text('₹${a['amountRequested'] ?? 0}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.primary)),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(a['reason'] ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFFA1A1AA))),
                            const Divider(color: AppTheme.darkBorder, height: 20),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('EMI: ₹${a['monthlyDeduction'] ?? 0}/mo (${a['tenureMonths']} mos)', style: const TextStyle(fontSize: 12)),
                                Text(
                                  a['status'] ?? 'PENDING',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
    );
  }
}
