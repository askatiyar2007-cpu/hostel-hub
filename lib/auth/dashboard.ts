/**
 * Resolves persisted application roles to their dashboard destinations.
 * `hostel_owner` is the database enum value and intentionally shares the
 * existing owner experience with the legacy application alias `owner`.
 */
export function dashboardPathForRole(role: unknown): string | undefined {
  switch (role) {
    case 'owner':
    case 'hostel_owner':
      return '/owner/dashboard';
    case 'student':
      return '/student/dashboard';
    case 'parent':
      return '/parent/dashboard';
    case 'super_admin':
      return '/admin/dashboard';
    default:
      return undefined;
  }
}
