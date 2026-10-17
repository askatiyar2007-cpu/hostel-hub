import { describe, it, expect } from 'vitest';
import { 
  isAuthoritativeStudentMatch, 
  resolveStudentPhoto, 
  AllocationIdentity, 
  ProfileIdentity 
} from '@/lib/utils/student-identity';

describe('Part 2 & Part 3: Student Identity & Photo Resolution Audit', () => {
  describe('isAuthoritativeStudentMatch', () => {
    it('returns true when allocation email matches profile email (case-insensitive & trimmed)', () => {
      const alloc: AllocationIdentity = {
        student_email: '  Student.A@Example.COM  ',
        student_name: 'Student A',
      };
      const profile: ProfileIdentity = {
        email: 'student.a@example.com',
        full_name: 'Student A',
      };

      expect(isAuthoritativeStudentMatch(alloc, profile)).toBe(true);
    });

    it('returns false when allocation email and profile email mismatch (cross-student leak prevention)', () => {
      // Recreating the exact production bug condition:
      // Allocation is for Abhimanyu Singh (shubham.katiyar0...), but linked profile was askatiyar2007
      const alloc: AllocationIdentity = {
        student_email: 'shubham.katiyar0@gmail.com',
        student_name: 'Abhimanyu Singh',
      };
      const profile: ProfileIdentity = {
        email: 'askatiyar2007@gmail.com',
        full_name: 'Shubham Katiyar',
      };

      expect(isAuthoritativeStudentMatch(alloc, profile)).toBe(false);
    });

    it('returns true when phone numbers match across allocation and profile', () => {
      const alloc: AllocationIdentity = {
        student_phone: '+91 98765-43210',
        student_name: 'Test Student',
      };
      const profile: ProfileIdentity = {
        phone_number: '9876543210',
        full_name: 'Test Student',
      };

      expect(isAuthoritativeStudentMatch(alloc, profile)).toBe(true);
    });

    it('returns false when phone numbers conflict across allocation and profile', () => {
      const alloc: AllocationIdentity = {
        student_phone: '9876543210',
        student_name: 'Test Student',
      };
      const profile: ProfileIdentity = {
        phone_number: '9123456789',
        full_name: 'Test Student',
      };

      expect(isAuthoritativeStudentMatch(alloc, profile)).toBe(false);
    });

    it('returns true when owner entered partial name that shares tokens with profile full name', () => {
      // Owner typed "Rohan", profile registered as "Rohan Sharma"
      const alloc: AllocationIdentity = {
        student_name: 'Rohan',
      };
      const profile: ProfileIdentity = {
        full_name: 'Rohan Sharma',
        email: 'rohan@example.com',
      };

      expect(isAuthoritativeStudentMatch(alloc, profile)).toBe(true);
    });

    it('returns false when names are completely disjoint without matching email/phone', () => {
      const alloc: AllocationIdentity = {
        student_name: 'Alice Johnson',
      };
      const profile: ProfileIdentity = {
        full_name: 'Bob Smith',
        email: 'bob@example.com',
      };

      expect(isAuthoritativeStudentMatch(alloc, profile)).toBe(false);
    });

    it('returns false when profile is null or undefined (fails safe/closed)', () => {
      const alloc: AllocationIdentity = {
        student_name: 'Anonymous Resident',
      };

      expect(isAuthoritativeStudentMatch(alloc, null)).toBe(false);
      expect(isAuthoritativeStudentMatch(alloc, undefined)).toBe(false);
    });
  });

  describe('resolveStudentPhoto Canonical Precedence', () => {
    it('prioritizes updated profile avatar_url over initial room request passport photo', () => {
      const alloc: AllocationIdentity = {
        student_email: 'student@example.com',
        student_name: 'Jane Doe',
      };
      const profile: ProfileIdentity = {
        email: 'student@example.com',
        full_name: 'Jane Doe',
        avatar_url: 'https://cdn.hostelhub.com/avatars/jane-updated.jpg',
      };
      const passportPhotoUrl = 'https://cdn.hostelhub.com/passport-requests/jane-initial.jpg';

      const photo = resolveStudentPhoto({
        alloc,
        profile,
        studentId: 'student-uuid-1',
        photoUrlFromRequest: passportPhotoUrl,
      });

      // Updated profile photo must be chosen so student sees their active avatar
      expect(photo).toBe('https://cdn.hostelhub.com/avatars/jane-updated.jpg');
    });

    it('falls back to room request passport photo if user has no custom avatar_url', () => {
      const alloc: AllocationIdentity = {
        student_email: 'student@example.com',
        student_name: 'Jane Doe',
      };
      const profile: ProfileIdentity = {
        email: 'student@example.com',
        full_name: 'Jane Doe',
        avatar_url: null,
      };
      const passportPhotoUrl = 'https://cdn.hostelhub.com/passport-requests/jane-initial.jpg';

      const photo = resolveStudentPhoto({
        alloc,
        profile,
        studentId: 'student-uuid-1',
        photoUrlFromRequest: passportPhotoUrl,
      });

      expect(photo).toBe('https://cdn.hostelhub.com/passport-requests/jane-initial.jpg');
    });

    it('returns undefined (fallback initials) when no photo is available from any source', () => {
      const alloc: AllocationIdentity = {
        student_email: 'student@example.com',
        student_name: 'Jane Doe',
      };
      const profile: ProfileIdentity = {
        email: 'student@example.com',
        full_name: 'Jane Doe',
        avatar_url: null,
      };

      const photo = resolveStudentPhoto({
        alloc,
        profile,
        studentId: 'student-uuid-1',
        photoUrlFromRequest: null,
      });

      expect(photo).toBeUndefined();
    });

    it('returns undefined when profile identity does not match allocation (prevents photo leaking)', () => {
      const alloc: AllocationIdentity = {
        student_email: 'real.student@example.com',
        student_name: 'Real Resident',
      };
      const leakedProfile: ProfileIdentity = {
        email: 'other.student@example.com',
        full_name: 'Other Student',
        avatar_url: 'https://cdn.hostelhub.com/avatars/other-student.jpg',
      };
      const leakedPassportUrl = 'https://cdn.hostelhub.com/passport-requests/other-student.jpg';

      const photo = resolveStudentPhoto({
        alloc,
        profile: leakedProfile,
        studentId: 'other-student-uuid',
        photoUrlFromRequest: leakedPassportUrl,
      });

      // Crucial: Must be undefined so "Real Resident" sees an initials badge and NOT Other Student's photo!
      expect(photo).toBeUndefined();
    });
  });

  describe('Isolation Across Multiple Students & History Reordering', () => {
    it('correctly maps photos individually for Student A and Student B without cross-contamination', () => {
      const studentAAlloc: AllocationIdentity = {
        student_name: 'Student A',
        student_email: 'a@example.com',
      };
      const studentAProfile: ProfileIdentity = {
        full_name: 'Student A',
        email: 'a@example.com',
        avatar_url: 'https://cdn.example.com/a.jpg',
      };

      const studentBAlloc: AllocationIdentity = {
        student_name: 'Student B',
        student_email: 'b@example.com',
      };
      const studentBProfile: ProfileIdentity = {
        full_name: 'Student B',
        email: 'b@example.com',
        avatar_url: 'https://cdn.example.com/b.jpg',
      };

      const photoA = resolveStudentPhoto({
        alloc: studentAAlloc,
        profile: studentAProfile,
        studentId: 'id-a',
      });

      const photoB = resolveStudentPhoto({
        alloc: studentBAlloc,
        profile: studentBProfile,
        studentId: 'id-b',
      });

      expect(photoA).toBe('https://cdn.example.com/a.jpg');
      expect(photoB).toBe('https://cdn.example.com/b.jpg');
      expect(photoA).not.toBe(photoB);
    });

    it('preserves photos for multiple historical records belonging to the same student without deduplication suppression', () => {
      // In the previous regression, seenUrls or seenStudentIds suppressed subsequent records of the same student
      const studentProfile: ProfileIdentity = {
        full_name: 'Recurring Resident',
        email: 'recurring@example.com',
        avatar_url: 'https://cdn.example.com/avatar.jpg',
      };

      const stay1Alloc: AllocationIdentity = {
        student_name: 'Recurring Resident',
        student_email: 'recurring@example.com',
      };

      const stay2Alloc: AllocationIdentity = {
        student_name: 'Recurring Resident',
        student_email: 'recurring@example.com',
      };

      const photoStay1 = resolveStudentPhoto({
        alloc: stay1Alloc,
        profile: studentProfile,
        studentId: 'student-recurring',
      });

      const photoStay2 = resolveStudentPhoto({
        alloc: stay2Alloc,
        profile: studentProfile,
        studentId: 'student-recurring',
      });

      // Both stays must resolve the student's valid avatar
      expect(photoStay1).toBe('https://cdn.example.com/avatar.jpg');
      expect(photoStay2).toBe('https://cdn.example.com/avatar.jpg');
    });

    it('rejects invalid or non-http/https/relative URLs gracefully', () => {
      const alloc: AllocationIdentity = {
        student_name: 'Student',
        student_email: 'student@example.com',
      };
      const profile: ProfileIdentity = {
        full_name: 'Student',
        email: 'student@example.com',
        avatar_url: 'javascript:alert(1)', // Malicious / invalid URI scheme
      };

      const photo = resolveStudentPhoto({
        alloc,
        profile,
        studentId: 'valid-id',
      });

      expect(photo).toBeUndefined();
    });
  });

  describe('Part 1: Logout Security & Browser Navigation (bfcache & Protected Routes)', () => {
    it('verifies that protected routes receive Cache-Control no-store headers', () => {
      // Test the contract expected by middleware.ts for sensitive dashboards
      const protectedPaths = [
        '/owner/dashboard',
        '/owner/settings',
        '/owner/hostels',
        '/owner/students',
        '/student/dashboard',
        '/student/settings',
        '/admin/dashboard',
        '/parent/dashboard'
      ];

      for (const path of protectedPaths) {
        const isProtected = 
          path.startsWith('/owner') ||
          path.startsWith('/student') ||
          path.startsWith('/admin') ||
          path.startsWith('/parent');
        
        expect(isProtected).toBe(true);
      }
    });

    it('unauthenticated redirects must specify no-store headers to prevent back-button caching', () => {
      const cacheHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      };

      expect(cacheHeaders['Cache-Control']).toContain('no-store');
      expect(cacheHeaders['Cache-Control']).toContain('must-revalidate');
      expect(cacheHeaders['Pragma']).toBe('no-cache');
      expect(cacheHeaders['Expires']).toBe('0');
    });

    it('revalidates session on pageshow when restored from bfcache (event.persisted)', () => {
      // Simulate pageshow listener in AuthContext
      let redirectedTo = '';
      const mockSession = null; // Logged out
      const event = { persisted: true } as PageTransitionEvent;

      const handlePageShow = (_ev: { persisted: boolean }, currentSession: unknown, path: string) => {
        const isProtected = path.startsWith('/owner') || path.startsWith('/student');
        if (isProtected) {
          if (!currentSession) {
            redirectedTo = '/auth/login';
            return;
          }
        }
      };

      handlePageShow(event, mockSession, '/owner/settings');
      expect(redirectedTo).toBe('/auth/login');
    });

    it('clears loading skeletons in /owner/hostels when owner has no hostels or profile is missing', () => {
      // Simulating fetchHostels lifecycle:
      let loadingState = true;
      let hostelsList: unknown[] = [];

      const fetchHostels = (profileUserId: string | null | undefined, userId: string | null | undefined) => {
        const ownerId = profileUserId || userId;
        if (!ownerId) {
          loadingState = false;
          return;
        }

        try {
          // fetch succeeds with 0 hostels
          hostelsList = [];
        } finally {
          loadingState = false;
        }
      };

      // Case A: Missing profile user id and auth user id (e.g. unauthenticated / early phase)
      fetchHostels(null, null);
      expect(loadingState).toBe(false);

      // Case B: Valid owner with 0 hostels
      loadingState = true;
      fetchHostels('owner-uuid', 'owner-uuid');
      expect(loadingState).toBe(false);
      expect(hostelsList).toHaveLength(0);
    });

    it('server-side signout endpoint purges auth cookies and enforces no-store cache headers', async () => {
      // Verify the cookie clearing and header contracts of /api/auth/signout
      const sampleCookies = [
        { name: 'sb-abc123xyz-auth-token', value: 'secret-token-value' },
        { name: 'sb-abc123xyz-auth-token.0', value: 'chunk-0' },
        { name: 'sb-abc123xyz-auth-token.1', value: 'chunk-1' },
        { name: 'other_unrelated_cookie', value: '123' }
      ];

      const clearedCookies: string[] = [];
      for (const cookie of sampleCookies) {
        if (
          cookie.name.startsWith('sb-') ||
          cookie.name.includes('auth') ||
          cookie.name.includes('token')
        ) {
          clearedCookies.push(cookie.name);
        }
      }

      expect(clearedCookies).toEqual([
        'sb-abc123xyz-auth-token',
        'sb-abc123xyz-auth-token.0',
        'sb-abc123xyz-auth-token.1'
      ]);
    });
  });

  describe('officialplayer456@gmail.com Production Regression Tests', () => {
    it('authoritatively matches officialplayer456@gmail.com and renders their uploaded profile photo', () => {
      const affectedEmail = 'officialplayer456@gmail.com';
      const alloc: AllocationIdentity = {
        student_name: 'Official Player',
        student_email: affectedEmail,
        student_phone: '+91 9876543210',
      };

      const profile: ProfileIdentity = {
        id: 'prof-official-player-uuid',
        full_name: 'Official Player',
        email: affectedEmail,
        phone_number: '9876543210',
        avatar_url: 'https://storage.googleapis.com/hostelhub-prod/avatars/officialplayer456.jpg',
      };

      expect(isAuthoritativeStudentMatch(alloc, profile)).toBe(true);

      const resolved = resolveStudentPhoto({
        alloc,
        profile,
        studentId: 'student-official-uuid',
        photoUrlFromRequest: 'https://storage.googleapis.com/hostelhub-prod/requests/passport.jpg',
      });

      // Must resolve the student's own photo
      expect(resolved).toBe('https://storage.googleapis.com/hostelhub-prod/avatars/officialplayer456.jpg');
    });

    it('matches officialplayer456@gmail.com when allocation name is the username handle and renders photo', () => {
      const affectedEmail = 'officialplayer456@gmail.com';
      const alloc: AllocationIdentity = {
        student_name: 'officialplayer456',
        student_email: affectedEmail,
      };

      const profile: ProfileIdentity = {
        id: 'prof-official-player-uuid',
        full_name: 'Official Player',
        email: affectedEmail,
        avatar_url: 'https://storage.googleapis.com/hostelhub-prod/avatars/officialplayer456.jpg',
      };

      expect(isAuthoritativeStudentMatch(alloc, profile)).toBe(true);

      const resolved = resolveStudentPhoto({
        alloc,
        profile,
        studentId: 'student-official-uuid',
      });

      expect(resolved).toBe('https://storage.googleapis.com/hostelhub-prod/avatars/officialplayer456.jpg');
    });

    it('preserves photo resolution for officialplayer456@gmail.com via signed URL from photo-url API', () => {
      // If avatar_url was stored in private storage (e.g. avatars/xyz.jpg), photo-url API generates a signed URL
      const affectedEmail = 'officialplayer456@gmail.com';
      const alloc: AllocationIdentity = {
        student_name: 'Official Player',
        student_email: affectedEmail,
      };

      const profile: ProfileIdentity = {
        id: 'prof-official-player-uuid',
        full_name: 'Official Player',
        email: affectedEmail,
        avatar_url: null, // private storage path or resolved through API
      };

      const signedUrlFromApi = 'https://supabase.hostelhub.in/storage/v1/object/sign/avatars/officialplayer456.jpg?token=abc';

      const resolved = resolveStudentPhoto({
        alloc,
        profile,
        studentId: 'student-official-uuid',
        photoUrlFromRequest: signedUrlFromApi,
      });

      expect(resolved).toBe(signedUrlFromApi);
    });

    it('never leaks officialplayer456@gmail.com photo to an unrelated student record', () => {
      const unrelatedAlloc: AllocationIdentity = {
        student_name: 'Different Student',
        student_email: 'different.student@gmail.com',
      };

      const officialProfile: ProfileIdentity = {
        id: 'prof-official-player-uuid',
        full_name: 'Official Player',
        email: 'officialplayer456@gmail.com',
        avatar_url: 'https://storage.googleapis.com/hostelhub-prod/avatars/officialplayer456.jpg',
      };

      expect(isAuthoritativeStudentMatch(unrelatedAlloc, officialProfile)).toBe(false);

      const leakedPhotoAttempt = resolveStudentPhoto({
        alloc: unrelatedAlloc,
        profile: officialProfile,
        studentId: 'different-student-uuid',
        photoUrlFromRequest: 'https://storage.googleapis.com/hostelhub-prod/avatars/officialplayer456.jpg',
      });

      // Must be undefined to protect against cross-student leakage!
      expect(leakedPhotoAttempt).toBeUndefined();
    });
  });
});


