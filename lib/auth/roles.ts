export type Role = 'creator' | 'user';

export const CHAT_PATH = '/chat';

export function isValidRole(role: unknown): role is Role {
  return role === 'creator' || role === 'user';
}

export function getRoleDashboard(role: Role | null | undefined): string {
  // All authenticated users (creator or user role) go to /chat
  return CHAT_PATH;
}

/**
 * Checks if a destination path is permitted for a given role.
 * Used to validate ?next= redirects.
 */
export function isAllowedPathForRole(role: Role, path: string): boolean {
  if (!path || !path.startsWith('/')) return false;
  return true;
}

/**
 * Extract authoritative role from Supabase user session object.
 * CRITICAL SECURITY RULE: NEVER read from user_metadata.
 */
export function extractAuthoritativeRole(user: { app_metadata?: Record<string, any>; user_metadata?: Record<string, any> } | null): Role | null {
  if (!user) return null;

  const appRole = user.app_metadata?.role;
  if (isValidRole(appRole)) {
    return appRole;
  }

  return null;
}
