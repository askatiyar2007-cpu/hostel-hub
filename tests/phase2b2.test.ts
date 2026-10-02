import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 2B-2: Web Application Bug Fixes', () => {
  const rootDir = path.resolve(__dirname, '..');

  describe('1. Student Complaint Submission (app/student/complaints/page.tsx)', () => {
    const studentComplaintsPath = path.join(
      rootDir,
      'app',
      'student',
      'complaints',
      'page.tsx'
    );
    const content = fs.readFileSync(studentComplaintsPath, 'utf-8');

    test('Queries active room allocation before inserting complaint', () => {
      expect(content).toContain(".from('room_allocations')");
      expect(content).toContain(".eq('active', true)");
    });

    test('Resolves student record to link with room allocations', () => {
      expect(content).toContain(".from('students')");
      expect(content).toContain(".eq('profile_id', profile.id)");
    });

    test('Fails safely with user error if no active allocation/hostel found', () => {
      expect(content).toContain('!allocation?.hostel_id');
      expect(content).toMatch(/toast\.error\(.*(?:active room allocation|hostel)/i);
    });

    test('Inserts complaint with resolved hostel_id', () => {
      expect(content).toMatch(/hostel_id:\s*allocation\.hostel_id/);
    });

    test("Uses initial status 'open' instead of legacy 'pending'", () => {
      expect(content).toMatch(/status:\s*['"]open['"]/);
      expect(content).not.toMatch(/status:\s*['"]pending['"]/);
    });

    test('UI status badges support production enum values: open, assigned, in_progress, resolved, closed', () => {
      expect(content).toMatch(/case\s+['"]open['"]:/);
      expect(content).toMatch(/case\s+['"]assigned['"]:/);
      expect(content).toMatch(/case\s+['"]in_progress['"]:/);
      expect(content).toMatch(/case\s+['"]resolved['"]:/);
      expect(content).toMatch(/case\s+['"]closed['"]:/);
    });
  });

  describe('2. Owner Room Details & Edit Identity Fix', () => {
    const viewRoomPath = path.join(
      rootDir,
      'app',
      'owner',
      'rooms',
      '[id]',
      'page.tsx'
    );
    const editRoomPath = path.join(
      rootDir,
      'app',
      'owner',
      'rooms',
      'edit',
      '[id]',
      'page.tsx'
    );

    const viewContent = fs.readFileSync(viewRoomPath, 'utf-8');
    const editContent = fs.readFileSync(editRoomPath, 'utf-8');

    test('ViewRoomPage resolves owner auth identity using user?.id or profile?.user_id', () => {
      expect(viewContent).toMatch(/ownerId\s*=\s*user\?\.id\s*\|\|\s*profile\?\.user_id/);
      expect(viewContent).toContain(".eq('owner_id', ownerId)");
    });

    test('ViewRoomPage never queries hostels with profile.id', () => {
      expect(viewContent).not.toMatch(/\.eq\(['"]owner_id['"],\s*profile\.id\)/);
    });

    test('EditRoomPage resolves owner auth identity using user?.id or profile?.user_id', () => {
      expect(editContent).toMatch(/ownerId\s*=\s*user\?\.id\s*\|\|\s*profile\?\.user_id/);
      expect(editContent).toContain(".eq('owner_id', ownerId)");
    });

    test('EditRoomPage never queries hostels with profile.id', () => {
      expect(editContent).not.toMatch(/\.eq\(['"]owner_id['"],\s*profile\.id\)/);
    });
  });

  describe('3. Owner Payments Identity Fallback', () => {
    const ownerPaymentsPath = path.join(
      rootDir,
      'app',
      'owner',
      'payments',
      'page.tsx'
    );
    const paymentsContent = fs.readFileSync(ownerPaymentsPath, 'utf-8');

    test('OwnerPaymentsDashboard uses profile.user_id fallback instead of profile.id', () => {
      expect(paymentsContent).toMatch(/ownerId\s*=\s*user\?\.id\s*\|\|\s*profile\?\.user_id/);
    });

    test('OwnerPaymentsDashboard never falls back to profile.id for ownerId', () => {
      expect(paymentsContent).not.toMatch(/ownerId\s*=\s*user\?\.id\s*\|\|\s*profile\?\.id/);
    });

    test('OwnerPaymentsDashboard dependency array uses profile?.user_id instead of profile?.id', () => {
      expect(paymentsContent).toMatch(/\[profile\?\.user_id,\s*user\?\.id\]/);
      expect(paymentsContent).not.toMatch(/\[profile\?\.id,\s*user\?\.id\]/);
    });
  });
});
