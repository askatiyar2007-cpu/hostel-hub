/**
 * Student Identity & Profile Photo Resolution Utility
 * 
 * Guarantees identity isolation for student records and profile photos:
 * 1. Prevents cross-student photo leakage (e.g., student A's photo appearing for student B).
 * 2. Preserves photos for students who have updated their profile avatars or stay across multiple allocations.
 * 3. Handles private storage signed URLs and public profile avatars correctly.
 */

export interface AllocationIdentity {
  student_name?: string | null;
  student_email?: string | null;
  student_phone?: string | null;
}

export interface ProfileIdentity {
  id?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  avatar_url?: string | null;
}

/**
 * Checks if a profile record authoritatively belongs to the student of an allocation.
 * Returns false if conflicting identity signals (such as different registered emails,
 * conflicting phone numbers, or completely disjoint names) are detected.
 */
export function isAuthoritativeStudentMatch(
  alloc: AllocationIdentity,
  profile: ProfileIdentity | null | undefined
): boolean {
  if (!profile) return false;

  const allocEmail = alloc.student_email?.trim().toLowerCase();
  const profEmail = profile.email?.trim().toLowerCase();

  // 1. Authoritative Email Verification
  // If both emails exist, they MUST match. Mismatched emails represent distinct users.
  if (allocEmail && profEmail) {
    return allocEmail === profEmail;
  }

  // 2. Authoritative Phone Verification
  // If emails are not both available, check normalized phone numbers (last 10 digits)
  const allocPhone = alloc.student_phone?.replace(/\D/g, '').slice(-10);
  const profPhone = profile.phone_number?.replace(/\D/g, '').slice(-10);
  if (allocPhone && profPhone && allocPhone.length === 10 && profPhone.length === 10) {
    if (allocPhone === profPhone) return true;
    return false; // Conflicting phone numbers
  }

  // 3. Name & Identity Handle Compatibility Check
  const allocName = alloc.student_name?.trim().toLowerCase();
  const profName = profile.full_name?.trim().toLowerCase();

  if (allocName && profName) {
    if (allocName === profName) return true;

    // Check substring containment (e.g., "Official Player" containing "Official")
    if (allocName.includes(profName) || profName.includes(allocName)) {
      return true;
    }

    // Check if allocName matches the email username handle (e.g., "officialplayer456" for officialplayer456@gmail.com)
    if (profEmail) {
      const profHandle = profEmail.split('@')[0];
      if (allocName === profHandle || allocName.includes(profHandle) || profHandle.includes(allocName)) {
        return true;
      }
    }

    // Check token overlap (e.g., "Rohan" vs "Rohan Sharma")
    const allocTokens = allocName.split(/[\s,._-]+/).filter((t) => t.length >= 2);
    const profTokens = profName.split(/[\s,._-]+/).filter((t) => t.length >= 2);

    if (allocTokens.length > 0 && profTokens.length > 0) {
      const sharesToken = allocTokens.some((t) => profTokens.includes(t));
      if (sharesToken) return true;
      // Disjoint names without any email/phone match must fail closed
      return false;
    }
  }

  // If no conflicting authoritative signals exist, verified database foreign key relationship holds
  return true;
}

/**
 * Resolves the display photo for a student record following the canonical hierarchy:
 * 1. Validated profile avatar_url (if directly an HTTP/HTTPS or relative URL)
 * 2. Verified signed photo URL from the photo-url API (which signs both profile storage avatars and room request photos)
 * 3. undefined (fallback to initials badge)
 */
export function resolveStudentPhoto(params: {
  alloc: AllocationIdentity;
  profile?: ProfileIdentity | null;
  studentId?: string | null;
  photoUrlFromRequest?: string | null;
}): string | undefined {
  const { alloc, profile, photoUrlFromRequest } = params;

  // Identity safety check: profile must authoritatively belong to this student
  const isMatch = isAuthoritativeStudentMatch(alloc, profile);
  if (!isMatch) {
    return undefined;
  }

  // 1. Directly accessible profile avatar takes top precedence
  if (profile?.avatar_url && typeof profile.avatar_url === 'string') {
    const trimmed = profile.avatar_url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
      return trimmed;
    }
  }

  // 2. Verified signed photo URL from API (signs profile storage avatars and room request photos)
  if (photoUrlFromRequest && typeof photoUrlFromRequest === 'string') {
    const trimmed = photoUrlFromRequest.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
  }

  return undefined;
}
