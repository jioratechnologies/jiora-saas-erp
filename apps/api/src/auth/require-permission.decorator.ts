import { SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = "requiredPermission";

/** Marks a controller method as needing a specific permission key from the catalog. */
export const RequirePermission = (permissionKey: string) => SetMetadata(PERMISSION_KEY, permissionKey);
