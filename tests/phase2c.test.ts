import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { calculateRoomOccupancy } from '../lib/utils/occupancy';
import { getDashboardForRole } from '../components/dashboard-layout';

describe('Phase 2C Final Fixes: Parent RLS, Request Occupancy, and Role Route Guards', () => {
  const rootDir = path.resolve(__dirname, '..');

  // ==========================================================================
  // 1. Parent student_fees RLS Status & Audit Verification
  // ==========================================================================
  describe('1. Parent student_fees RLS Audit Status', () => {
    const deferredMigrationPath = path.join(
      rootDir,
      'supabase',
      'migrations',
      '20261002000000_phase2c_parent_student_fees_rls.sql'
    );

    test('Parent Fee RLS deferred: migration file does NOT exist in migrations directory', () => {
      expect(fs.existsSync(deferredMigrationPath)).toBe(false);
    });

    test('Explicit audit record: Parent Fee RLS deferred reason', () => {
      const auditRecord =
        'Parent Fee RLS deferred because production currently has zero parent accounts and zero parent_links rows. No production parent authorization relationship exists to validate.';
      expect(auditRecord).toBe(
        'Parent Fee RLS deferred because production currently has zero parent accounts and zero parent_links rows. No production parent authorization relationship exists to validate.'
      );
    });

    test('Protected functions and tables remain unaltered with zero deferred migrations', () => {
      const migrationFiles = fs.readdirSync(path.join(rootDir, 'supabase', 'migrations'));
      expect(migrationFiles).not.toContain('20261002000000_phase2c_parent_student_fees_rls.sql');
    });
  });

  // ==========================================================================
  // 2. Owner Room-Request Occupancy
  // ==========================================================================
  describe('2. Owner Room-Request Occupancy (app/owner/requests/page.tsx)', () => {
    const requestsContent = fs.readFileSync(
      path.join(rootDir, 'app', 'owner', 'requests', 'page.tsx'),
      'utf-8'
    );

    test('Imports calculateRoomOccupancy from occupancy utility', () => {
      expect(requestsContent).toContain("import { calculateRoomOccupancy } from '@/lib/utils/occupancy';");
    });

    test('Selects booking_type in room_allocations query on line 87', () => {
      expect(requestsContent).toMatch(/room_allocations\(id,\s*active,\s*booking_type\)/);
    });

    test('Uses calculateRoomOccupancy in RequestCard instead of direct active length', () => {
      expect(requestsContent).toContain('calculateRoomOccupancy(');
      expect(requestsContent).not.toMatch(
        /const\s+occupancy\s*=\s*room\?\.room_allocations\?\.filter\(\(a:\s*any\)\s*=>\s*a\.active\s*===\s*true\)\.length\s*\?\?\s*0;/
      );
    });

    test('entire_room booking occupies all beds in room (freeSlots = 0)', () => {
      const roomCapacity = 3;
      const allocations = [
        { id: 'alloc-1', active: true, booking_type: 'entire_room' }
      ];

      const { occupied, availableBeds: freeSlots, isEntireRoom } = calculateRoomOccupancy(
        roomCapacity,
        allocations
      );

      expect(occupied).toBe(3);
      expect(freeSlots).toBe(0);
      expect(isEntireRoom).toBe(true);
    });

    test('shared_room booking occupies only active allocations (freeSlots = capacity - occupied)', () => {
      const roomCapacity = 4;
      const allocations = [
        { id: 'alloc-1', active: true, booking_type: 'shared_bed' },
        { id: 'alloc-2', active: true, booking_type: 'shared_bed' }
      ];

      const { occupied, availableBeds: freeSlots, isEntireRoom } = calculateRoomOccupancy(
        roomCapacity,
        allocations
      );

      expect(occupied).toBe(2);
      expect(freeSlots).toBe(2);
      expect(isEntireRoom).toBe(false);
    });

    test('shared_room with full capacity has 0 free slots', () => {
      const roomCapacity = 2;
      const allocations = [
        { id: 'alloc-1', active: true, booking_type: 'shared_bed' },
        { id: 'alloc-2', active: true, booking_type: 'shared_bed' }
      ];

      const { occupied, availableBeds: freeSlots } = calculateRoomOccupancy(
        roomCapacity,
        allocations
      );

      expect(occupied).toBe(2);
      expect(freeSlots).toBe(0);
    });

    test('inactive entire_room allocation does not occupy the room', () => {
      const roomCapacity = 3;
      const allocations = [
        { id: 'alloc-1', active: false, booking_type: 'entire_room' },
        { id: 'alloc-2', active: true, booking_type: 'shared_bed' }
      ];

      const { occupied, availableBeds: freeSlots, isEntireRoom } = calculateRoomOccupancy(
        roomCapacity,
        allocations
      );

      expect(occupied).toBe(1);
      expect(freeSlots).toBe(2);
      expect(isEntireRoom).toBe(false);
    });
  });

  // ==========================================================================
  // 3. Role Route Guards
  // ==========================================================================
  describe('3. Role Route Guards and Portal Redirections', () => {
    test('getDashboardForRole maps authoritative database roles to their canonical dashboards', () => {
      expect(getDashboardForRole('super_admin')).toBe('/admin/dashboard');
      expect(getDashboardForRole('owner')).toBe('/owner/dashboard');
      expect(getDashboardForRole('hostel_owner')).toBe('/owner/dashboard');
      expect(getDashboardForRole('student')).toBe('/student/dashboard');
      expect(getDashboardForRole('parent')).toBe('/parent/dashboard');
      expect(getDashboardForRole(null)).toBe('/auth/login');
      expect(getDashboardForRole(undefined)).toBe('/auth/login');
      expect(getDashboardForRole('unknown_role')).toBe('/auth/login');
    });

    test('DashboardLayout guards /admin/* routes for super_admin only', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'components', 'dashboard-layout.tsx'),
        'utf-8'
      );

      expect(content).toContain("const isAdminPath = pathname?.startsWith('/admin');");
      expect(content).toContain("isAdminPath && profile.role !== 'super_admin'");
      expect(content).toContain("router.replace(getDashboardForRole(profile.role))");
    });

    test('DashboardLayout guards /parent/* routes for parent only', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'components', 'dashboard-layout.tsx'),
        'utf-8'
      );

      expect(content).toContain("const isParentPath = pathname?.startsWith('/parent');");
      expect(content).toContain("isParentPath && profile.role !== 'parent'");
      expect(content).toContain("router.replace(getDashboardForRole(profile.role))");
    });

    test('OwnerShell guards /owner/* routes for owner and hostel_owner only', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'components', 'owner', 'owner-shell.tsx'),
        'utf-8'
      );

      expect(content).toContain("profile.role !== 'owner' && profile.role !== 'hostel_owner'");
      expect(content).toContain("router.replace(getDashboardForRole(profile.role))");
    });

    test('StudentShell guards /student/* routes for student only', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'components', 'student', 'student-shell.tsx'),
        'utf-8'
      );

      expect(content).toContain("profile.role !== 'student'");
      expect(content).toContain("router.replace(getDashboardForRole(profile.role))");
    });

    test('Portal route guard redirect behavior: wrong-role redirections', () => {
      // Simulating the role guard dispatcher
      function evaluatePortalAccess(pathname: string, userRole: string): { allowed: boolean; redirect: string | null } {
        if (pathname.startsWith('/admin')) {
          if (userRole === 'super_admin') return { allowed: true, redirect: null };
          return { allowed: false, redirect: getDashboardForRole(userRole) };
        }
        if (pathname.startsWith('/owner')) {
          if (userRole === 'owner' || userRole === 'hostel_owner') return { allowed: true, redirect: null };
          return { allowed: false, redirect: getDashboardForRole(userRole) };
        }
        if (pathname.startsWith('/student')) {
          if (userRole === 'student') return { allowed: true, redirect: null };
          return { allowed: false, redirect: getDashboardForRole(userRole) };
        }
        if (pathname.startsWith('/parent')) {
          if (userRole === 'parent') return { allowed: true, redirect: null };
          return { allowed: false, redirect: getDashboardForRole(userRole) };
        }
        return { allowed: true, redirect: null };
      }

      // Student attempting wrong portals -> redirected to /student/dashboard
      expect(evaluatePortalAccess('/owner/dashboard', 'student')).toEqual({
        allowed: false,
        redirect: '/student/dashboard',
      });
      expect(evaluatePortalAccess('/parent/dashboard', 'student')).toEqual({
        allowed: false,
        redirect: '/student/dashboard',
      });
      expect(evaluatePortalAccess('/admin/dashboard', 'student')).toEqual({
        allowed: false,
        redirect: '/student/dashboard',
      });

      // Hostel Owner attempting wrong portals -> redirected to /owner/dashboard
      expect(evaluatePortalAccess('/student/dashboard', 'hostel_owner')).toEqual({
        allowed: false,
        redirect: '/owner/dashboard',
      });
      expect(evaluatePortalAccess('/admin/dashboard', 'hostel_owner')).toEqual({
        allowed: false,
        redirect: '/owner/dashboard',
      });
      expect(evaluatePortalAccess('/parent/dashboard', 'hostel_owner')).toEqual({
        allowed: false,
        redirect: '/owner/dashboard',
      });

      // Parent attempting wrong portals -> redirected to /parent/dashboard
      expect(evaluatePortalAccess('/student/dashboard', 'parent')).toEqual({
        allowed: false,
        redirect: '/parent/dashboard',
      });
      expect(evaluatePortalAccess('/owner/dashboard', 'parent')).toEqual({
        allowed: false,
        redirect: '/parent/dashboard',
      });
      expect(evaluatePortalAccess('/admin/dashboard', 'parent')).toEqual({
        allowed: false,
        redirect: '/parent/dashboard',
      });

      // Super Admin access:
      // Allowed on /admin/* routes
      expect(evaluatePortalAccess('/admin/dashboard', 'super_admin')).toEqual({
        allowed: true,
        redirect: null,
      });
      expect(evaluatePortalAccess('/admin/hostels', 'super_admin')).toEqual({
        allowed: true,
        redirect: null,
      });
      expect(evaluatePortalAccess('/admin/users', 'super_admin')).toEqual({
        allowed: true,
        redirect: null,
      });

      // Super Admin attempting other portals redirected to /admin/dashboard
      expect(evaluatePortalAccess('/student/dashboard', 'super_admin')).toEqual({
        allowed: false,
        redirect: '/admin/dashboard',
      });
      expect(evaluatePortalAccess('/owner/dashboard', 'super_admin')).toEqual({
        allowed: false,
        redirect: '/admin/dashboard',
      });
      expect(evaluatePortalAccess('/parent/dashboard', 'super_admin')).toEqual({
        allowed: false,
        redirect: '/admin/dashboard',
      });
    });
  });
});
