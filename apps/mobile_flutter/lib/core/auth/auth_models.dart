class UserProfile {
  final String userId;
  final String? tenantId;
  final bool isPlatformContext;
  final List<String> roles;
  final List<String> permissions;
  final String email;
  final String displayName;
  final String? employeeId;
  final String? departmentName;
  final String? designationName;

  UserProfile({
    required this.userId,
    this.tenantId,
    required this.isPlatformContext,
    required this.roles,
    required this.permissions,
    required this.email,
    required this.displayName,
    this.employeeId,
    this.departmentName,
    this.designationName,
  });

  factory UserProfile.fromApiData({
    required Map<String, dynamic> meData,
    Map<String, dynamic>? profileData,
  }) {
    final userMap = profileData?['user'] as Map<String, dynamic>?;
    final personMap = profileData?['person'] as Map<String, dynamic>?;
    final deptMap = personMap?['department'] as Map<String, dynamic>?;
    final desigMap = personMap?['designation'] as Map<String, dynamic>?;

    final rolesRaw = meData['roles'] as List<dynamic>? ?? [];
    final permissionsRaw = meData['permissionKeys'] as List<dynamic>? ?? [];

    String name = userMap?['displayName'] ?? '';
    if (name.isEmpty && personMap != null) {
      name = '${personMap['firstName'] ?? ''} ${personMap['lastName'] ?? ''}'.trim();
    }
    if (name.isEmpty) {
      name = meData['userId'] ?? 'User';
    }

    return UserProfile(
      userId: meData['userId'] ?? '',
      tenantId: meData['tenantId'],
      isPlatformContext: meData['isPlatformContext'] ?? false,
      roles: rolesRaw.map((e) => e.toString()).toList(),
      permissions: permissionsRaw.map((e) => e.toString()).toList(),
      email: userMap?['email'] ?? 'user@saas-erp.local',
      displayName: name,
      employeeId: personMap?['employeeId'],
      departmentName: deptMap?['name'],
      designationName: desigMap?['name'],
    );
  }

  bool hasPermission(String permission) {
    if (isPlatformContext) return true;
    if (permissions.contains('*')) return true;
    if (permissions.contains(permission)) return true;

    // Check wildcard prefix e.g. "attendance.*" matching "attendance.punch"
    final parts = permission.split('.');
    if (parts.length > 1) {
      final prefixWildcard = '${parts[0]}.*';
      if (permissions.contains(prefixWildcard)) return true;
    }
    return false;
  }
}
