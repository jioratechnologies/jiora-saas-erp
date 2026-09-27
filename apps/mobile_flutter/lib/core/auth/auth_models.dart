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
    required dynamic meRaw,
    dynamic profileRaw,
  }) {
    final meData = meRaw is Map ? Map<String, dynamic>.from(meRaw) : <String, dynamic>{};
    final profileData = profileRaw is Map ? Map<String, dynamic>.from(profileRaw) : null;

    final userMap = profileData?['user'] is Map ? Map<String, dynamic>.from(profileData!['user']) : null;
    final personMap = profileData?['person'] is Map ? Map<String, dynamic>.from(profileData!['person']) : null;

    // Department can be a String in userMap or a Map in personMap
    String? deptName;
    if (personMap?['department'] is Map) {
      deptName = personMap!['department']['name']?.toString();
    } else if (userMap?['department'] != null) {
      deptName = userMap!['department'].toString();
    }

    // Designation can be a String in userMap or a Map in personMap
    String? desigName;
    if (personMap?['designation'] is Map) {
      desigName = personMap!['designation']['name']?.toString();
    } else if (userMap?['designation'] != null) {
      desigName = userMap!['designation'].toString();
    }

    final rolesRaw = meData['roles'] is List ? (meData['roles'] as List) : [];
    final permissionsRaw = meData['permissionKeys'] is List ? (meData['permissionKeys'] as List) : [];

    String name = userMap?['displayName']?.toString() ?? '';
    if (name.isEmpty && personMap != null) {
      final fName = personMap['firstName']?.toString() ?? '';
      final lName = personMap['lastName']?.toString() ?? '';
      name = '$fName $lName'.trim();
    }
    if (name.isEmpty) {
      name = userMap?['email']?.toString() ?? meData['userId']?.toString() ?? 'User';
    }

    return UserProfile(
      userId: meData['userId']?.toString() ?? '',
      tenantId: meData['tenantId']?.toString(),
      isPlatformContext: meData['isPlatformContext'] == true,
      roles: rolesRaw.map((e) => e.toString()).toList(),
      permissions: permissionsRaw.map((e) => e.toString()).toList(),
      email: userMap?['email']?.toString() ?? 'user@saas-erp.local',
      displayName: name,
      employeeId: personMap?['employeeId']?.toString(),
      departmentName: deptName,
      designationName: desigName,
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
