import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 1C Payment Methods Identity & RLS Verification', () => {
  const rootDir = path.resolve(__dirname, '..');
  const migrationPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20261001020000_phase1c_payment_methods_auth_user_id.sql'
  );

  // 1. Migration File Existence
  test('Scenario 1: Phase 1C migration file exists with correct timestamp name', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

  // 2. Pre-check Safety & Abort on Unmapped Rows
  test('Scenario 2: Migration performs pre-check on payment_methods.owner_id mapping and raises exception if unmapped', () => {
    expect(migrationContent).toContain('SELECT COUNT(*) INTO v_unmapped_count');
    expect(migrationContent).toMatch(/FROM\s+public\.payment_methods\s+pm\s+LEFT\s+JOIN\s+public\.profiles\s+p/i);
    expect(migrationContent).toContain('v_unmapped_count > 0');
    expect(migrationContent).toMatch(/RAISE\s+EXCEPTION\s+'Safety\s+check\s+failed/i);
  });

  // 3. Migrate Existing Rows to profiles.user_id (auth.users.id)
  test('Scenario 3: Migration migrates existing payment_methods.owner_id from profiles.id to profiles.user_id', () => {
    expect(migrationContent).toMatch(
      /UPDATE\s+public\.payment_methods\s+pm\s+SET\s+owner_id\s*=\s*p\.user_id\s+FROM\s+public\.profiles\s+p\s+WHERE\s+pm\.owner_id\s*=\s*p\.id/i
    );
  });

  // 4. Drop Old Foreign Key Constraint Before Update
  test('Scenario 4: Migration drops existing payment_methods_owner_id_fkey constraint before updating data', () => {
    expect(migrationContent).toMatch(
      /ALTER\s+TABLE\s+public\.payment_methods\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+payment_methods_owner_id_fkey/i
    );

    const dropIdx = migrationContent.indexOf('DROP CONSTRAINT IF EXISTS payment_methods_owner_id_fkey');
    const updateIdx = migrationContent.indexOf('UPDATE public.payment_methods pm');
    expect(dropIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeGreaterThan(-1);
    expect(dropIdx).toBeLessThan(updateIdx);
  });

  // 5. Add New Foreign Key Referencing auth.users(id)
  test('Scenario 5: Migration adds foreign key constraint referencing auth.users(id) ON DELETE CASCADE', () => {
    expect(migrationContent).toMatch(
      /ALTER\s+TABLE\s+public\.payment_methods\s+ADD\s+CONSTRAINT\s+payment_methods_owner_id_fkey\s+FOREIGN\s+KEY\s*\(\s*owner_id\s*\)\s*REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i
    );
  });

  // 6. Owner INSERT Policy checks owner_id = auth.uid()
  test('Scenario 6: Owner INSERT policy directly validates owner_id = auth.uid()', () => {
    expect(migrationContent).toContain('"Owners can add payment methods"');
    expect(migrationContent).toMatch(
      /CREATE\s+POLICY\s+"Owners can add payment methods"\s+ON\s+public\.payment_methods\s+FOR\s+INSERT\s+TO\s+authenticated\s+WITH\s+CHECK\s*\(\s*owner_id\s*=\s*auth\.uid\(\)\s*\)/i
    );
  });

  // 7. Owner SELECT Policy checks owner_id = auth.uid()
  test('Scenario 7: Owner SELECT policy directly validates owner_id = auth.uid()', () => {
    expect(migrationContent).toContain('"Owners can view their payment methods"');
    expect(migrationContent).toMatch(
      /CREATE\s+POLICY\s+"Owners can view their payment methods"\s+ON\s+public\.payment_methods\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s*\(\s*owner_id\s*=\s*auth\.uid\(\)\s*\)/i
    );
  });

  // 8. Owner UPDATE Policy checks owner_id = auth.uid()
  test('Scenario 8: Owner UPDATE policy directly validates owner_id = auth.uid()', () => {
    expect(migrationContent).toContain('"Owners can update payment methods"');
    expect(migrationContent).toMatch(
      /CREATE\s+POLICY\s+"Owners can update payment methods"\s+ON\s+public\.payment_methods\s+FOR\s+UPDATE\s+TO\s+authenticated\s+USING\s*\(\s*owner_id\s*=\s*auth\.uid\(\)\s*\)/i
    );
  });

  // 9. Owner DELETE Policy checks owner_id = auth.uid()
  test('Scenario 9: Owner DELETE policy is explicitly created and validates owner_id = auth.uid()', () => {
    expect(migrationContent).toContain('"Owners can delete payment methods"');
    expect(migrationContent).toMatch(
      /CREATE\s+POLICY\s+"Owners can delete payment methods"\s+ON\s+public\.payment_methods\s+FOR\s+DELETE\s+TO\s+authenticated\s+USING\s*\(\s*owner_id\s*=\s*auth\.uid\(\)\s*\)/i
    );
  });

  // 10. Student SELECT Policy checks is_active = true
  test('Scenario 10: Student SELECT policy strictly enforces is_active = true', () => {
    expect(migrationContent).toContain(
      '"Students can view active payment methods for allocated hostel"'
    );
    expect(migrationContent).toMatch(
      /is_active\s*=\s*true\s+AND\s+EXISTS/i
    );
  });

  // 11. Student SELECT Policy scopes to student active room allocation at the hostel
  test('Scenario 11: Student SELECT policy verifies active room allocation for auth.uid()', () => {
    expect(migrationContent).toMatch(
      /SELECT\s+1\s+FROM\s+public\.room_allocations\s+ra\s+JOIN\s+public\.students\s+s\s+ON\s+s\.id\s*=\s*ra\.student_id\s+JOIN\s+public\.profiles\s+p\s+ON\s+p\.id\s*=\s*s\.profile_id\s+WHERE\s+ra\.hostel_id\s*=\s*payment_methods\.hostel_id\s+AND\s+ra\.active\s*=\s*true\s+AND\s+p\.user_id\s*=\s*auth\.uid\(\)/i
    );
  });

  // 12. Owner UI Queries Using user.id (auth ID)
  test('Scenario 12: Owner payment methods page queries and caches by user?.id instead of profile.id', () => {
    const ownerPagePath = path.join(
      rootDir,
      'app',
      'owner',
      'settings',
      'payment-methods',
      'page.tsx'
    );
    const ownerPageContent = fs.readFileSync(ownerPagePath, 'utf-8');

    // Query key and enabled check must use user?.id
    expect(ownerPageContent).toContain("queryKey: ['owner-payment-methods', user?.id]");
    expect(ownerPageContent).toContain("enabled: !!user?.id");
    expect(ownerPageContent).toContain(".eq('owner_id', user!.id)");

    // Must not filter payment_methods on profile.id
    expect(ownerPageContent).not.toContain(".eq('owner_id', profile!.id)");
    expect(ownerPageContent).not.toContain("['owner-payment-methods', profile?.id]");
  });

  // 13. Owner UI Mutations and Subforms Pass user.id
  test('Scenario 13: Owner payment methods mutations and subforms use user?.id / auth.users.id', () => {
    const ownerPagePath = path.join(
      rootDir,
      'app',
      'owner',
      'settings',
      'payment-methods',
      'page.tsx'
    );
    const ownerPageContent = fs.readFileSync(ownerPagePath, 'utf-8');

    // setPrimaryMutation must filter by user!.id
    expect(ownerPageContent).toMatch(
      /\.update\(\{\s*is_primary:\s*false\s*\}\)\s*\.eq\('owner_id',\s*user!\.id\)/
    );

    // Subforms must receive user?.id
    expect(ownerPageContent).toContain('<AddUPIForm ownerId={user?.id}');
    expect(ownerPageContent).toContain('<AddBankDetailsForm ownerId={user?.id}');
    expect(ownerPageContent).toContain('<AddQRCodeForm ownerId={user?.id}');
    expect(ownerPageContent).toContain('ownerId={user?.id}');

    // No subforms should receive profile?.id
    expect(ownerPageContent).not.toContain('ownerId={profile?.id}');
  });

  // 14. Student Bills Scopes Query by hostel_id and owner_id
  test('Scenario 14: Student bills page queries payment_methods by hostel_id and owner_id and is_active', () => {
    const billsPagePath = path.join(
      rootDir,
      'app',
      'student',
      'bills',
      'page.tsx'
    );
    const billsPageContent = fs.readFileSync(billsPagePath, 'utf-8');

    expect(billsPageContent).toContain(".from('payment_methods')");
    expect(billsPageContent).toContain(".eq('hostel_id', alloc.hostel_id)");
    expect(billsPageContent).toContain(".eq('is_active', true)");
    expect(billsPageContent).toContain("methodsQuery.eq('owner_id', ownerId)");
  });

  // 15. Functional Contract Simulation of Owner CRUD and Student Access Rules
  test('Scenario 15: Contract simulation validates owner access and student visibility boundaries', () => {
    interface PaymentMethodRecord {
      id: string;
      owner_id: string;
      hostel_id: string;
      is_active: boolean;
      payment_type: string;
    }

    interface AllocationRecord {
      student_user_id: string;
      hostel_id: string;
      active: boolean;
    }

    const ownerAuthId = 'auth-owner-uuid-1';
    const otherOwnerAuthId = 'auth-owner-uuid-2';
    const studentAuthId = 'auth-student-uuid-1';
    const inactiveStudentAuthId = 'auth-student-uuid-2';
    const unrelatedStudentAuthId = 'auth-student-uuid-3';

    const testMethods: PaymentMethodRecord[] = [
      { id: 'pm-1', owner_id: ownerAuthId, hostel_id: 'hostel-A', is_active: true, payment_type: 'upi' },
      { id: 'pm-2', owner_id: ownerAuthId, hostel_id: 'hostel-A', is_active: false, payment_type: 'bank' },
      { id: 'pm-3', owner_id: otherOwnerAuthId, hostel_id: 'hostel-B', is_active: true, payment_type: 'upi' },
    ];

    const allocations: AllocationRecord[] = [
      { student_user_id: studentAuthId, hostel_id: 'hostel-A', active: true },
      { student_user_id: inactiveStudentAuthId, hostel_id: 'hostel-A', active: false },
      { student_user_id: unrelatedStudentAuthId, hostel_id: 'hostel-C', active: true },
    ];

    // Simulate Owner SELECT Policy: owner_id = auth.uid()
    const canOwnerSelect = (pm: PaymentMethodRecord, uid: string) => pm.owner_id === uid;

    // Simulate Student SELECT Policy:
    // is_active = true AND EXISTS active allocation for user at pm.hostel_id
    const canStudentSelect = (pm: PaymentMethodRecord, uid: string) => {
      if (!pm.is_active) return false;
      return allocations.some(
        (a) => a.student_user_id === uid && a.hostel_id === pm.hostel_id && a.active
      );
    };

    // Owner 1 can see both active and inactive methods of their own
    const owner1Visible = testMethods.filter((pm) => canOwnerSelect(pm, ownerAuthId));
    expect(owner1Visible.map((m) => m.id)).toEqual(['pm-1', 'pm-2']);

    // Owner 1 cannot see Owner 2 methods
    expect(owner1Visible.some((m) => m.id === 'pm-3')).toBe(false);

    // Active student allocated to Hostel A can only see active methods for Hostel A
    const student1Visible = testMethods.filter((pm) => canStudentSelect(pm, studentAuthId));
    expect(student1Visible.map((m) => m.id)).toEqual(['pm-1']);

    // Inactive student cannot see any payment methods
    const inactiveStudentVisible = testMethods.filter((pm) => canStudentSelect(pm, inactiveStudentAuthId));
    expect(inactiveStudentVisible).toHaveLength(0);

    // Student allocated to another hostel cannot see Hostel A payment methods
    const unrelatedStudentVisible = testMethods.filter((pm) => canStudentSelect(pm, unrelatedStudentAuthId));
    expect(unrelatedStudentVisible).toHaveLength(0);

    // Simulate Owner DELETE Policy: owner_id = auth.uid()
    const canOwnerDelete = (pm: PaymentMethodRecord, uid: string) => pm.owner_id === uid;
    expect(canOwnerDelete(testMethods[0], ownerAuthId)).toBe(true);
    expect(canOwnerDelete(testMethods[0], otherOwnerAuthId)).toBe(false);
    expect(canOwnerDelete(testMethods[0], studentAuthId)).toBe(false);
  });

  // 16. Anonymous Access Privilege Hardening Migration
  test('Scenario 16: Phase 1C follow-up migration revokes all privileges from anon role on payment_methods', () => {
    const anonRevokePath = path.join(
      rootDir,
      'supabase',
      'migrations',
      '20261001030000_phase1c_payment_methods_anon_revoke.sql'
    );
    expect(fs.existsSync(anonRevokePath)).toBe(true);

    const anonRevokeContent = fs.readFileSync(anonRevokePath, 'utf-8');

    // Must revoke all table privileges from anon
    expect(anonRevokeContent).toMatch(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.payment_methods\s+FROM\s+anon;/i);

    // Must maintain authenticated privileges
    expect(anonRevokeContent).toMatch(
      /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+TABLE\s+public\.payment_methods\s+TO\s+authenticated;/i
    );

    // Must maintain service_role privileges
    expect(anonRevokeContent).toMatch(
      /GRANT\s+ALL\s+ON\s+TABLE\s+public\.payment_methods\s+TO\s+service_role;/i
    );

    // Must NOT alter RLS policies, table schema, or data
    expect(anonRevokeContent).not.toMatch(/DROP\s+POLICY/i);
    expect(anonRevokeContent).not.toMatch(/CREATE\s+POLICY/i);
    expect(anonRevokeContent).not.toMatch(/UPDATE\s+public\.payment_methods/i);
    expect(anonRevokeContent).not.toMatch(/ALTER\s+TABLE.*CONSTRAINT/i);
  });
});

