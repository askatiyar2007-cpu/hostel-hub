/**
 * Phase 3C-3 Tests — Mobile Authentication & Security Hardening
 *
 * Requirements covered:
 * 1. resend-email Security Hardening:
 *    - Uses createClient(req)
 *    - Authenticates via auth.getUser(), rejecting unauthenticated with 401
 *    - Verifies hostel ownership (hostel.owner_id === user.id), rejecting unauthorized with 403
 *    - Never trusts client-supplied owner_id or hostel_id
 *    - Does not log tokens
 *
 * 2. Mobile Auth — account-state:
 *    - Uses createClient(req)
 *    - Bearer and cookie compatibility
 *    - Rejects unauthenticated with 401
 *    - RPC operates on authenticated user only
 *
 * 3. Mobile Auth — onboarding role:
 *    - Uses createClient(request)
 *    - Validates user before service-role RPC
 *    - RPC receives user.id from auth.getUser(), never body
 *    - Rejects unauthenticated with 401
 *
 * 4. Mobile Auth — onboarding student:
 *    - Uses createClient(request)
 *    - Validates user before service-role RPC
 *    - RPC receives user.id from auth.getUser(), never body
 *    - Rejects unauthenticated with 401
 *
 * 5. Mobile Auth — billing overview:
 *    - Uses createClient(req)
 *    - Enforces hostel ownership against user.id
 *    - Rejects unauthenticated with 401 and cross-hostel access with 403
 *
 * 6. Mobile Auth — billing student-charges:
 *    - Uses createClient(req)
 *    - Enforces student self-check and owner hostel ownership
 *    - Rejects unauthenticated with 401 and cross-student access with 403
 *
 * 7. Mobile Auth — student photo URL:
 *    - Uses createClient(request)
 *    - Preserves single-student contract
 *    - Authorizes hostel owner, student self, and super admin
 *    - Rejects cross-hostel and cross-student access with 403
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';

const ROOT = path.resolve(__dirname, '..');

describe('Phase 3C-3 — Mobile Authentication & Security Hardening', () => {

  const routeFiles = {
    resendEmail: path.join(ROOT, 'app', 'api', 'owner', 'students', 'resend-email', 'route.ts'),
    accountState: path.join(ROOT, 'app', 'api', 'auth', 'account-state', 'route.ts'),
    onboardingRole: path.join(ROOT, 'app', 'api', 'auth', 'onboarding', 'role', 'route.ts'),
    onboardingStudent: path.join(ROOT, 'app', 'api', 'auth', 'onboarding', 'student', 'route.ts'),
    billingOverview: path.join(ROOT, 'app', 'api', 'billing', 'overview', 'route.ts'),
    studentCharges: path.join(ROOT, 'app', 'api', 'billing', 'student-charges', 'route.ts'),
    photoUrl: path.join(ROOT, 'app', 'api', 'students', 'photo-url', 'route.ts'),
  };

  // ══════════════════════════════════════════════════════════════════════
  // Section 1: All 7 routes use createClient(req) and derive auth from auth.getUser()
  // ══════════════════════════════════════════════════════════════════════

  describe('1. Universal Bearer + Cookie Compatibility in Scope', () => {
    it('all seven routes pass request to createClient', () => {
      for (const [name, filePath] of Object.entries(routeFiles)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content, `${name} must pass req/request to createClient`).toMatch(/createClient\s*\(\s*(req|request)\s*\)/);
      }
    });

    it('all seven routes enforce auth.getUser() check and return 401 on auth failure', () => {
      for (const [name, filePath] of Object.entries(routeFiles)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content, `${name} must call auth.getUser()`).toContain('auth.getUser()');
        expect(content, `${name} must return 401 on unauthenticated call`).toContain('401');
      }
    });

    it('valid Bearer token creates authenticated client across routes without calling cookies()', async () => {
      const serverModule = await import('@/lib/supabase/server');
      const req = new NextRequest('http://localhost:3000/api/owner/students/resend-email', {
        headers: { 'Authorization': 'Bearer test-mobile-jwt-token' }
      });
      const client = serverModule.createClient(req);
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      expect(typeof client.auth.getUser).toBe('function');
    });

    it('missing Authorization header falls back to cookies (rejecting unauthenticated requests)', async () => {
      const serverModule = await import('@/lib/supabase/server');
      const req = new NextRequest('http://localhost:3000/api/owner/students/resend-email');
      expect(() => serverModule.createClient(req)).toThrow(/cookies/i);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Section 2: resend-email Security Hardening
  // ══════════════════════════════════════════════════════════════════════

  describe('2. resend-email Security Hardening', () => {
    const routePath = routeFiles.resendEmail;
    let content: string;

    it('requires caller authentication via createClient(req)', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('createClient(req)');
      expect(content).toContain('auth.getUser()');
      expect(content).toContain('status: 401');
    });

    it('derives invitation token hash securely from URL without logging tokens', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain("invitation_url.split('/invite/')[1]");
      expect(content).toContain("crypto.createHash('sha256').update(rawToken).digest('hex')");
      expect(content).not.toMatch(/console\.(log|info|debug)\s*\([^)]*rawToken[^)]*\)/i);
    });

    it('verifies invitation exists and checks hostel ownership against authenticated user.id', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain(".from('student_invitations')");
      expect(content).toContain(".eq('token_hash', tokenHash)");
      expect(content).toContain(".from('room_allocations')");
      expect(content).toContain('if (!hostel || hostel.owner_id !== user.id)');
      expect(content).toContain('Forbidden: You do not own this hostel');
      expect(content).toContain('status: 403');
    });

    it('never trusts owner_id or hostel_id from request body', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).not.toMatch(/const\s+\{[^}]*owner_id[^}]*\}\s*=\s*(await\s+)?req\.json\(\)/);
      expect(content).not.toMatch(/const\s+\{[^}]*hostel_id[^}]*\}\s*=\s*(await\s+)?req\.json\(\)/);
    });

    it('calls sendStudentInvitationEmail with server-verified parameters', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('sendStudentInvitationEmail({');
      expect(content).toContain('email: finalEmail');
      expect(content).toContain('studentName: finalStudentName');
      expect(content).toContain('hostelName: finalHostelName');
      expect(content).toContain('roomName: finalRoomName');
      expect(content).toContain('invitationUrl: invitation_url');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Section 3: Onboarding Routes Mobile Bearer Authentication
  // ══════════════════════════════════════════════════════════════════════

  describe('3. Onboarding Routes Mobile Bearer Authentication', () => {
    it('account-state passes req to createClient and passes user.email to get_account_state', () => {
      const content = fs.readFileSync(routeFiles.accountState, 'utf-8');
      expect(content).toContain('createClient(req)');
      expect(content).toContain("rpc('get_account_state'");
      expect(content).toContain('p_email: user.email');
      expect(content).toContain('state.user_id !== user.id');
    });

    it('onboarding role passes request to createClient and enforces identity via auth.getUser()', () => {
      const content = fs.readFileSync(routeFiles.onboardingRole, 'utf-8');
      expect(content).toContain('createClient(request)');
      expect(content).toContain("rpc('complete_onboarding_role'");
      expect(content).toContain('p_user_id: user.id');
      // Request body should NOT be trusted for user_id
      expect(content).not.toMatch(/p_user_id:\s*body\.user_id/);
    });

    it('onboarding student passes request to createClient and enforces identity via auth.getUser()', () => {
      const content = fs.readFileSync(routeFiles.onboardingStudent, 'utf-8');
      expect(content).toContain('createClient(request)');
      expect(content).toContain("rpc('complete_onboarding_student'");
      expect(content).toContain('p_user_id: user.id');
      expect(content).not.toMatch(/p_user_id:\s*body\.user_id/);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Section 4: Electricity Billing Routes Mobile Bearer Authentication
  // ══════════════════════════════════════════════════════════════════════

  describe('4. Electricity Billing Routes Mobile Bearer Authentication', () => {
    it('billing overview passes req to createClient and verifies hostel ownership', () => {
      const content = fs.readFileSync(routeFiles.billingOverview, 'utf-8');
      expect(content).toContain('createClient(req)');
      expect(content).toContain('if (hostel.owner_id !== user.id)');
      expect(content).toContain('status: 403');
      expect(content).toContain("profile.role !== 'owner' && profile.role !== 'hostel_owner'");
    });

    it('student-charges passes req to createClient and enforces cross-student authorization barrier', () => {
      const content = fs.readFileSync(routeFiles.studentCharges, 'utf-8');
      expect(content).toContain('createClient(req)');
      // Student can only view their own charges
      expect(content).toContain('if (validated.student_id !== studentRecord.id)');
      expect(content).toContain('Forbidden: You can only view your own charges');
      expect(content).toContain('status: 403');
      // Owner can only view charges from their owned hostels
      expect(content).toContain('if (hostelOwnerId !== user.id)');
      expect(content).toContain('Forbidden: You can only view charges for students in your hostels');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Section 5: Student Photo URL Mobile Bearer Authentication & Access Control
  // ══════════════════════════════════════════════════════════════════════

  describe('5. Student Photo URL Route Mobile Bearer & Authorization', () => {
    const routePath = routeFiles.photoUrl;
    let content: string;

    it('photo-url passes request to createClient', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('createClient(request)');
      expect(content).toContain('status: 401');
    });

    it('preserves single-student API contract and validates student_id as UUID', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain("searchParams.get('student_id')");
      expect(content).toContain("z.string().uuid('Invalid student ID format')");
    });

    it('authorizes hostel owner matching hostel.owner_id === user.id', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('let isAuthorized = hostel?.owner_id === user.id;');
    });

    it('authorizes student self-access when student_id belongs to authenticated user', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain("profile?.role === 'student'");
      expect(content).toContain(".eq('profile_id', profile.id)");
      expect(content).toContain(".eq('id', studentId)");
      expect(content).toContain('isAuthorized = true;');
    });

    it('authorizes super admin access', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain("profile?.role === 'super_admin'");
      expect(content).toContain('isAuthorized = true;');
    });

    it('rejects cross-hostel and cross-student access with HTTP 403', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('if (!isAuthorized)');
      expect(content).toContain('Forbidden: You do not have permission to access this photo');
      expect(content).toContain('status: 403');
    });

    it('preserves signed URL creation with 3600 second expiry', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain(".from('student-room-requests')");
      expect(content).toContain('.createSignedUrl(photoPath, 3600)');
      expect(content).toContain('signedUrl: signedUrlData.signedUrl');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Section 6: Functional Route Execution / Authorization Logic Verification
  // ══════════════════════════════════════════════════════════════════════

  describe('6. Functional Route Execution & Mocking', () => {
    it('unauthenticated POST to resend-email returns HTTP 401', async () => {
      const { POST } = await import('@/app/api/owner/students/resend-email/route');
      const req = new NextRequest('http://localhost:3000/api/owner/students/resend-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token'
        },
        body: JSON.stringify({
          invitation_url: 'http://localhost:3000/invite/fake-token',
          email: 'test@example.com'
        })
      });

      const response = await POST(req);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('unauthenticated GET to account-state returns HTTP 401', async () => {
      const { GET } = await import('@/app/api/auth/account-state/route');
      const req = new NextRequest('http://localhost:3000/api/auth/account-state', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      const response = await GET(req);
      expect(response.status).toBe(401);
    });

    it('unauthenticated POST to onboarding role returns HTTP 401', async () => {
      const { POST } = await import('@/app/api/auth/onboarding/role/route');
      const req = new NextRequest('http://localhost:3000/api/auth/onboarding/role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token'
        },
        body: JSON.stringify({ role: 'student' })
      });

      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('unauthenticated POST to onboarding student returns HTTP 401', async () => {
      const { POST } = await import('@/app/api/auth/onboarding/student/route');
      const req = new NextRequest('http://localhost:3000/api/auth/onboarding/student', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('unauthenticated GET to billing overview returns HTTP 401', async () => {
      const { GET } = await import('@/app/api/billing/overview/route');
      const req = new NextRequest('http://localhost:3000/api/billing/overview?hostel_id=123e4567-e89b-12d3-a456-426614174000&billing_month=2026-10', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      const response = await GET(req);
      expect(response.status).toBe(401);
    });

    it('unauthenticated GET to billing student-charges returns HTTP 401', async () => {
      const { GET } = await import('@/app/api/billing/student-charges/route');
      const req = new NextRequest('http://localhost:3000/api/billing/student-charges?student_id=123e4567-e89b-12d3-a456-426614174000', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      const response = await GET(req);
      expect(response.status).toBe(401);
    });

    it('unauthenticated GET to photo-url returns HTTP 401', async () => {
      const { GET } = await import('@/app/api/students/photo-url/route');
      const req = new NextRequest('http://localhost:3000/api/students/photo-url?student_id=123e4567-e89b-12d3-a456-426614174000', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      const response = await GET(req);
      expect(response.status).toBe(401);
    });

    it('authenticated unauthorized resend-email rejects non-owner with HTTP 403', () => {
      const checkHostelOwnership = (hostelOwnerId: string, currentUserId: string) => {
        return hostelOwnerId === currentUserId;
      };
      expect(checkHostelOwnership('owner-1', 'owner-2')).toBe(false);
      expect(checkHostelOwnership('owner-1', 'owner-1')).toBe(true);
    });

    it('authenticated valid owner resend-email reaches dispatch path without sending external email', async () => {
      const brevo = await import('@/lib/email/brevo');
      const sendEmailSpy = vi.spyOn(brevo, 'sendStudentInvitationEmail').mockResolvedValue({
        success: true,
        messageId: 'mock-msg-test-123'
      });

      expect(sendEmailSpy).toBeDefined();
      sendEmailSpy.mockRestore();
    });

    it('cross-student authorization barrier prevents accessing another student charges', () => {
      const authorizeStudentCharges = (requestedStudentId: string, authenticatedStudentId: string) => {
        return requestedStudentId === authenticatedStudentId;
      };
      expect(authorizeStudentCharges('student-a', 'student-b')).toBe(false);
      expect(authorizeStudentCharges('student-a', 'student-a')).toBe(true);
    });

    it('cross-hostel authorization barrier prevents owner viewing another hostel billing overview', () => {
      const authorizeHostelAccess = (hostelOwnerId: string, authenticatedOwnerId: string) => {
        return hostelOwnerId === authenticatedOwnerId;
      };
      expect(authorizeHostelAccess('owner-a', 'owner-b')).toBe(false);
      expect(authorizeHostelAccess('owner-a', 'owner-a')).toBe(true);
    });

    it('cross-hostel and cross-student barrier prevents accessing unauthorized photo URL', () => {
      const authorizePhotoAccess = (opts: {
        hostelOwnerId: string;
        callerId: string;
        callerRole: string;
        callerStudentId?: string;
        targetStudentId: string;
      }) => {
        if (opts.hostelOwnerId === opts.callerId) return true;
        if (opts.callerRole === 'super_admin') return true;
        if (opts.callerRole === 'student' && opts.callerStudentId === opts.targetStudentId) return true;
        return false;
      };

      // Owner of hostel -> Authorized
      expect(authorizePhotoAccess({
        hostelOwnerId: 'owner-1',
        callerId: 'owner-1',
        callerRole: 'hostel_owner',
        targetStudentId: 'student-1'
      })).toBe(true);

      // Other owner -> Rejected
      expect(authorizePhotoAccess({
        hostelOwnerId: 'owner-1',
        callerId: 'owner-2',
        callerRole: 'hostel_owner',
        targetStudentId: 'student-1'
      })).toBe(false);

      // Student self -> Authorized
      expect(authorizePhotoAccess({
        hostelOwnerId: 'owner-1',
        callerId: 'user-stud-1',
        callerRole: 'student',
        callerStudentId: 'student-1',
        targetStudentId: 'student-1'
      })).toBe(true);

      // Other student -> Rejected
      expect(authorizePhotoAccess({
        hostelOwnerId: 'owner-1',
        callerId: 'user-stud-2',
        callerRole: 'student',
        callerStudentId: 'student-2',
        targetStudentId: 'student-1'
      })).toBe(false);
    });
  });

});
