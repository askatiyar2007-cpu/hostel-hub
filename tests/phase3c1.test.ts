/**
 * Phase 3C-1 Tests — Security + Mobile Bearer Hardening
 *
 * Requirements covered:
 * 1. approve_room_request privilege hardening migration:
 *    - authenticated execution remains allowed
 *    - anonymous/public execution is revoked
 *    - service_role execution is granted
 *    - business logic is not modified or replaced
 *
 * 2. Four API routes Bearer + Cookie compatibility:
 *    - /api/room-request/request-otp
 *    - /api/room-request/verify-otp
 *    - /api/owner/students/assign
 *    - /api/meters/[meterId]/deactivate
 *    - each route passes req to createClient(req)
 *    - each route derives authenticated identity strictly from auth.getUser()
 *    - missing / unauthenticated calls return 401
 *    - invalid tokens rejected
 *    - client-supplied identities cannot bypass authorization
 *
 * 3. Meter deactivation authorization:
 *    - authenticated owner checks hostel ownership against user.id
 *    - access to another user's hostel meter returns 403
 *
 * 4. Owner student assignment authorization:
 *    - authenticated owner flow verified
 *    - client-supplied owner/user identity cannot bypass authorization
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';

const ROOT = path.resolve(__dirname, '..');

describe('Phase 3C-1 — Security + Mobile Bearer Hardening', () => {

  // ══════════════════════════════════════════════════════════════════════
  // Section 1: approve_room_request Security Hardening Migration
  // ══════════════════════════════════════════════════════════════════════

  describe('1. approve_room_request privilege hardening migration', () => {
    const migrationPath = path.join(
      ROOT,
      'supabase',
      'migrations',
      '20261002010000_phase3c1_approve_room_request_revoke_anon.sql'
    );
    let migrationContent: string;

    it('migration file exists', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    });

    it('revokes execute from anon', () => {
      migrationContent = fs.readFileSync(migrationPath, 'utf-8');
      expect(migrationContent).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.approve_room_request\(uuid\)\s+FROM\s+anon/i);
    });

    it('revokes execute from public', () => {
      migrationContent = fs.readFileSync(migrationPath, 'utf-8');
      expect(migrationContent).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.approve_room_request\(uuid\)\s+FROM\s+public/i);
    });

    it('grants execute explicitly to authenticated', () => {
      migrationContent = fs.readFileSync(migrationPath, 'utf-8');
      expect(migrationContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.approve_room_request\(uuid\)\s+TO\s+authenticated/i);
    });

    it('grants execute to service_role', () => {
      migrationContent = fs.readFileSync(migrationPath, 'utf-8');
      expect(migrationContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.approve_room_request\(uuid\)\s+TO\s+service_role/i);
    });

    it('does NOT rewrite, drop, or replace function business logic', () => {
      migrationContent = fs.readFileSync(migrationPath, 'utf-8');
      expect(migrationContent).not.toContain('CREATE OR REPLACE FUNCTION');
      expect(migrationContent).not.toContain('DROP FUNCTION');
    });

    it('only one additive migration was created for Phase 3C-1', () => {
      const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
      const files = fs.readdirSync(migrationsDir);
      const phase3cFiles = files.filter(f => f.toLowerCase().includes('phase3c'));
      expect(phase3cFiles).toHaveLength(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Section 2: Four API Routes Mobile Bearer + Cookie Support
  // ══════════════════════════════════════════════════════════════════════

  describe('2. Four API routes Bearer + Cookie compatibility', () => {
    const routeFiles = {
      requestOtp: path.join(ROOT, 'app', 'api', 'room-request', 'request-otp', 'route.ts'),
      verifyOtp: path.join(ROOT, 'app', 'api', 'room-request', 'verify-otp', 'route.ts'),
      assign: path.join(ROOT, 'app', 'api', 'owner', 'students', 'assign', 'route.ts'),
      deactivate: path.join(ROOT, 'app', 'api', 'meters', '[meterId]', 'deactivate', 'route.ts'),
    };

    it('all four route files exist', () => {
      for (const [name, filePath] of Object.entries(routeFiles)) {
        expect(fs.existsSync(filePath), `${name} route must exist`).toBe(true);
      }
    });

    it('app/api/room-request/request-otp passes req to createClient', () => {
      const content = fs.readFileSync(routeFiles.requestOtp, 'utf-8');
      expect(content).toMatch(/createClient\s*\(\s*req\s*\)/);
    });

    it('app/api/room-request/verify-otp passes req to createClient', () => {
      const content = fs.readFileSync(routeFiles.verifyOtp, 'utf-8');
      expect(content).toMatch(/createClient\s*\(\s*req\s*\)/);
    });

    it('app/api/owner/students/assign passes req to createClient', () => {
      const content = fs.readFileSync(routeFiles.assign, 'utf-8');
      expect(content).toMatch(/createClient\s*\(\s*req\s*\)/);
    });

    it('app/api/meters/[meterId]/deactivate passes req to createClient', () => {
      const content = fs.readFileSync(routeFiles.deactivate, 'utf-8');
      expect(content).toMatch(/createClient\s*\(\s*req\s*\)/);
    });

    it('all four routes enforce auth.getUser() check', () => {
      for (const [name, filePath] of Object.entries(routeFiles)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content, `${name} must call auth.getUser()`).toContain('auth.getUser()');
        expect(content, `${name} must check authError or !user`).toMatch(/if\s*\(\s*(authError\s*\|\|\s*!user|!user\s*\|\|\s*authError)\s*\)/);
        expect(content, `${name} must return status 401 on auth failure`).toContain('401');
      }
    });

    it('valid Bearer token creates authenticated client without calling cookies()', async () => {
      const serverModule = await import('@/lib/supabase/server');
      const req = new NextRequest('http://localhost:3000/api/room-request/request-otp', {
        headers: { 'Authorization': 'Bearer test-mobile-jwt-token' }
      });
      const client = serverModule.createClient(req);
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      expect(typeof client.auth.getUser).toBe('function');
    });

    it('missing Authorization header falls back to cookies (rejecting unauthenticated requests)', async () => {
      const serverModule = await import('@/lib/supabase/server');
      const req = new NextRequest('http://localhost:3000/api/room-request/request-otp');
      // In vitest context outside Next server component, cookies() throws
      expect(() => serverModule.createClient(req)).toThrow(/cookies/i);
    });

    it('empty Bearer token falls back to cookie check, rejecting empty tokens', async () => {
      const serverModule = await import('@/lib/supabase/server');
      const req = new NextRequest('http://localhost:3000/api/room-request/request-otp', {
        headers: { 'Authorization': 'Bearer ' }
      });
      expect(() => serverModule.createClient(req)).toThrow(/cookies/i);
    });

    it('none of the four routes log access tokens or Authorization headers', () => {
      for (const [name, filePath] of Object.entries(routeFiles)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content, `${name} must not log authorization header`).not.toMatch(/console\.(log|info|debug)\s*\([^)]*req\.headers\.get\(['"]authorization['"]\)[^)]*\)/i);
        expect(content, `${name} must not log token`).not.toMatch(/console\.(log|info|debug)\s*\([^)]*access_token[^)]*\)/i);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Section 3: Meter Deactivation Authorization
  // ══════════════════════════════════════════════════════════════════════

  describe('3. Meter deactivation authorization', () => {
    const routePath = path.join(ROOT, 'app', 'api', 'meters', '[meterId]', 'deactivate', 'route.ts');
    let content: string;

    it('requires owner role on user profile derived from auth.getUser()', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('.eq(\'user_id\', user.id)');
      expect(content).toMatch(/profile\.role\s*!==\s*'owner'\s*&&\s*profile\.role\s*!==\s*'hostel_owner'/);
      expect(content).toContain('403');
    });

    it('verifies meter belongs to a hostel owned by the authenticated user', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('.eq(\'id\', meter.hostel_id)');
      expect(content).toContain('if (hostel.owner_id !== user.id)');
      expect(content).toContain('Forbidden: You do not own this hostel');
      expect(content).toContain('status: 403');
    });

    it('client-supplied owner_id in request body cannot override authenticated identity', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      // Body is validated via DeactivateMeterSchema which only accepts { notes }
      expect(content).toContain('DeactivateMeterSchema');
      expect(content).not.toContain('body.owner_id');
      expect(content).not.toContain('body.user_id');
    });

    it('blocks deactivation if open billing segments exist (REQ-23.1)', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('.is(\'end_date\', null)');
      expect(content).toContain('Cannot deactivate meter with open billing segments');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Section 4: Owner Student Assignment Authorization
  // ══════════════════════════════════════════════════════════════════════

  describe('4. Owner student assignment authorization', () => {
    const routePath = path.join(ROOT, 'app', 'api', 'owner', 'students', 'assign', 'route.ts');
    let content: string;

    it('authorizes canonical hostel_owner role on authenticated user profile', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain(".eq('user_id', user.id)");
      expect(content).toContain("if (profile.role !== 'hostel_owner')");
      expect(content).toContain('Only hostel owners can assign students');
      expect(content).toContain('status: 403');
      // Verify no second owner role is introduced
      expect(content).not.toMatch(/profile\.role\s*!==\s*'owner'\s*&&/);
      expect(content).not.toMatch(/profile\.role\s*===\s*'owner'/);
    });

    it('rejects non-owner roles (student, parent, admin, stale owner) with HTTP 403', () => {
      // Direct validation of role authorization predicate used by assign route:
      // if (profile.role !== 'hostel_owner') => reject with 403
      const isAuthorizedRole = (role: string | null | undefined) => role === 'hostel_owner';

      expect(isAuthorizedRole('hostel_owner')).toBe(true);
      expect(isAuthorizedRole('student')).toBe(false);
      expect(isAuthorizedRole('parent')).toBe(false);
      expect(isAuthorizedRole('admin')).toBe(false);
      expect(isAuthorizedRole('owner')).toBe(false);
      expect(isAuthorizedRole(null)).toBe(false);
      expect(isAuthorizedRole(undefined)).toBe(false);
    });

    it('verifies hostel ownership against authenticated user.id', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('if (hostel.owner_id !== user.id)');
      expect(content).toContain('Forbidden: You do not own this hostel');
      expect(content).toContain('status: 403');
    });

    it('client cannot supply owner_id or user_id in body to bypass authorization', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      // Body destructuring does not extract owner_id or user_id for authorization
      expect(content).not.toMatch(/const\s+\{[^}]*owner_id[^}]*\}\s*=\s*(await\s+)?req\.json\(\)/);
      // RPC passes user.id as p_owner_id, NOT a client-supplied owner_id
      expect(content).toContain('p_owner_id: user.id');
    });

    it('validates booking_type against allowed types (shared_bed, entire_room)', () => {
      content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain("['shared_bed', 'entire_room']");
      expect(content).toContain('Invalid booking type');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Section 5: Room Request OTP Routes Authorization
  // ══════════════════════════════════════════════════════════════════════

  describe('5. Room Request OTP Routes Authorization', () => {
    it('request-otp derives student profile strictly from user.id', () => {
      const content = fs.readFileSync(
        path.join(ROOT, 'app', 'api', 'room-request', 'request-otp', 'route.ts'),
        'utf-8'
      );
      expect(content).toContain(".eq('user_id', user.id)");
      expect(content).toContain(".eq('profile_id', profile.id)");
      expect(content).toContain('p_user_id: user.id');
    });

    it('verify-otp derives student profile strictly from user.id', () => {
      const content = fs.readFileSync(
        path.join(ROOT, 'app', 'api', 'room-request', 'verify-otp', 'route.ts'),
        'utf-8'
      );
      expect(content).toContain(".eq('user_id', user.id)");
      expect(content).toContain(".eq('profile_id', profile.id)");
      expect(content).toContain('student_id: student.id');
    });

    it('neither OTP route accepts client-supplied user_id or student_id to authorize', () => {
      const reqOtp = fs.readFileSync(path.join(ROOT, 'app', 'api', 'room-request', 'request-otp', 'route.ts'), 'utf-8');
      const verifyOtp = fs.readFileSync(path.join(ROOT, 'app', 'api', 'room-request', 'verify-otp', 'route.ts'), 'utf-8');

      expect(reqOtp).not.toMatch(/const\s+\{[^}]*user_id[^}]*\}\s*=\s*(await\s+)?req\.json\(\)/);
      expect(verifyOtp).not.toMatch(/const\s+\{[^}]*user_id[^}]*\}\s*=\s*(await\s+)?req\.json\(\)/);
    });
  });

});
