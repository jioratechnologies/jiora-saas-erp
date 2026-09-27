import 'package:flutter_test/flutter_test.dart';
import 'package:saas_erp_mobile/core/network/api_client.dart';
import 'package:saas_erp_mobile/main.dart';

void main() {
  testWidgets('SaaS ERP Mobile app smoke test', (WidgetTester tester) async {
    final client = ApiClient();
    await tester.pumpWidget(SaaSErpApp(apiClient: client));
    expect(find.byType(SaaSErpApp), findsOneWidget);
  });
}
