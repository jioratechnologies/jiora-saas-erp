import 'package:flutter_test/flutter_test.dart';
import 'package:saas_erp_mobile/core/auth/zitadel_auth_service.dart';
import 'package:saas_erp_mobile/core/network/api_client.dart';
import 'package:saas_erp_mobile/core/theme/branding_service.dart';
import 'package:saas_erp_mobile/main.dart';

void main() {
  testWidgets('SaaS ERP Mobile app smoke test', (WidgetTester tester) async {
    final client = ApiClient();
    final authService = ZitadelAuthService(apiClient: client);
    final brandingService = BrandingService(apiClient: client);
    await tester.pumpWidget(SaaSErpApp(
      apiClient: client,
      authService: authService,
      brandingService: brandingService,
      initialAuthenticated: false,
    ));
    expect(find.byType(SaaSErpApp), findsOneWidget);
  });
}
