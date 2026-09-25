/**
 * The resolved identity + authorization context for one request, attached
 * to `request.authContext` by ZitadelAuthGuard. This is what every
 * controller/service works with — nobody reads the raw JWT after the guard.
 */
export interface AuthContext {
  userId: string;
  tenantId: string | null; // null = platform user
  isPlatformContext: boolean; // true if any of the user's roles is a platform role
  /** Flattened set of every permission key granted by any of the user's roles. */
  permissionKeys: Set<string>;
}
