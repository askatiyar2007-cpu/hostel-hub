import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 1B Billing UI Verification', () => {
  const rootDir = path.resolve(__dirname, '..');

  test('Student dashboard no longer queries the obsolete bills table', () => {
    const filePath = path.join(rootDir, 'app', 'student', 'dashboard', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must not query from('bills') or from("bills")
    expect(content).not.toMatch(/from\(['"]bills['"]\)/);

    // Must query from('student_fees')
    expect(content).toMatch(/from\(['"]student_fees['"]\)/);

    // Must use real deposit_status
    expect(content).toContain('deposit_status');
    expect(content).toContain('monthlyRentStatus');
  });

  test('Owner billing page queries student_fees and uses owner auth ID', () => {
    const filePath = path.join(rootDir, 'app', 'owner', 'billing', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must not query from('bills')
    expect(content).not.toMatch(/from\(['"]bills['"]\)/);

    // Must query student_fees
    expect(content).toMatch(/from\(['"]student_fees['"]\)/);

    // Must not filter on broken profile.id directly
    expect(content).not.toContain(".eq('hostels.owner_id', profile.id)");

    // Must use ownerId resolved from user.id or profile.user_id
    expect(content).toMatch(/user\?\.id\s*\|\|\s*profile\?\.user_id/);
  });

  test('Owner new bill page generates fee schedule via create_student_fees RPC', () => {
    const filePath = path.join(rootDir, 'app', 'owner', 'billing', 'new', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must not insert into bills
    expect(content).not.toMatch(/from\(['"]bills['"]\)\.insert/);

    // Must call create_student_fees RPC
    expect(content).toContain("supabase.rpc('create_student_fees'");

    // Must use ownerId resolved from user.id or profile.user_id
    expect(content).toMatch(/user\?\.id\s*\|\|\s*profile\?\.user_id/);
  });

  test('Student bills page displays formatted month_year and uses real deposit check', () => {
    const filePath = path.join(rootDir, 'app', 'student', 'bills', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must query student_fees
    expect(content).toMatch(/from\(['"]student_fees['"]\)/);

    // Must check deposit_status on allocation
    expect(content).toContain('deposit_status');

    // Must include month_year handling
    expect(content).toContain('month_year');
    expect(content).toContain('formatBillingMonth');

    // Copy button should use Copy icon instead of Calendar icon
    expect(content).toContain('<Copy size={14} />');
  });

  test('Parent dashboard queries student_fees and maps profiles via user_id', () => {
    const filePath = path.join(rootDir, 'app', 'parent', 'dashboard', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must not query from('bills')
    expect(content).not.toMatch(/from\(['"]bills['"]\)/);

    // Must query student_fees
    expect(content).toMatch(/from\(['"]student_fees['"]\)/);

    // Must query profiles using user_id, not surrogate id
    expect(content).toMatch(/from\(['"]profiles['"]\)[\s\S]*?\.in\(['"]user_id['"]/);
  });

  test('lib/utils/api.ts has feeAPI on student_fees and analyticsAPI uses student_fees', () => {
    const filePath = path.join(rootDir, 'lib', 'utils', 'api.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must define feeAPI
    expect(content).toContain('export const feeAPI');
    expect(content).not.toContain('export const billAPI');

    // analyticsAPI must read student_fees
    expect(content).toMatch(/from\(['"]student_fees['"]\)/);
  });

  test('types/database.ts defines StudentFee interface and expands Payment', () => {
    const filePath = path.join(rootDir, 'types', 'database.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('export interface StudentFee');
    expect(content).toContain('month_year: string;');
    expect(content).toContain('amount_due: number;');
    expect(content).toContain('fee_id?: string;');
  });
});

describe('Phase 1B Security Fix — create_student_fees Authorization Hardening', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../supabase/migrations/20261001010000_phase1b_create_student_fees_authorization.sql'
  );
  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

  test('Migration revokes execution from anon and public', () => {
    expect(migrationContent).toContain(
      'REVOKE ALL ON FUNCTION public.create_student_fees(UUID) FROM anon, public;'
    );
  });

  test('Migration grants execution exclusively to authenticated and service_role', () => {
    expect(migrationContent).toContain(
      'GRANT EXECUTE ON FUNCTION public.create_student_fees(UUID) TO authenticated, service_role;'
    );
  });

  test('create_student_fees requires authentication and rejects unauthenticated callers', () => {
    expect(migrationContent).toContain('v_caller_id := auth.uid();');
    expect(migrationContent).toContain(
      "RAISE EXCEPTION 'Authentication required to create student fees'"
    );
  });

  test('create_student_fees enforces canonical authorization chain and rejects unauthorized callers', () => {
    // Verifies hostel owner via hostels.owner_id = auth.uid()
    expect(migrationContent).toContain('v_hostel_owner_id = v_caller_id');

    // Verifies super_admin via profiles.user_id = auth.uid() and has_role
    expect(migrationContent).toContain('p.user_id = v_caller_id');
    expect(migrationContent).toContain("p.role = 'super_admin'");
    expect(migrationContent).toContain("public.has_role(v_caller_id, 'super_admin'::public.app_role)");

    // Must NOT use profiles.id as authenticated identity
    expect(migrationContent).not.toMatch(/p\.id\s*=\s*v_caller_id/);

    // Rejects unauthorized callers before any fee creation
    expect(migrationContent).toContain(
      "RAISE EXCEPTION 'Forbidden: You are not authorized to create fees for this allocation'"
    );
  });

  test('create_student_fees preserves exact function signature, return table, idempotency, and missing allocation handling', () => {
    // Signature
    expect(migrationContent).toContain(
      'CREATE OR REPLACE FUNCTION public.create_student_fees(p_allocation_id UUID)'
    );

    // Return columns
    expect(migrationContent).toContain(
      'RETURNS TABLE(fee_id UUID, month_year TEXT, amount_due NUMERIC, due_date DATE)'
    );

    // Security Definer & search_path
    expect(migrationContent).toContain('SECURITY DEFINER');
    expect(migrationContent).toContain('SET search_path = public');

    // Missing allocation handling
    expect(migrationContent).toContain(
      "RAISE EXCEPTION 'Allocation not found for ID %', p_allocation_id;"
    );

    // Idempotency constraint target
    expect(migrationContent).toContain(
      'ON CONFLICT (allocation_id, month_year) DO NOTHING'
    );
  });

  test('Authorization decision logic unit simulation', () => {
    // Pure function simulating the PL/pgSQL authorization decision
    function checkAuthorization(
      callerId: string | null,
      roleClaim: string | null,
      hostelOwnerId: string,
      userProfiles: { userId: string; role: string }[],
      userRoles: { userId: string; role: string }[]
    ): { authorized: boolean; error?: string } {
      if (!callerId) {
        if (roleClaim === 'service_role') {
          return { authorized: true };
        }
        return { authorized: false, error: 'Authentication required' };
      }

      const isHostelOwner = hostelOwnerId === callerId;
      const isSuperAdminProfile = userProfiles.some(
        (p) => p.userId === callerId && p.role === 'super_admin'
      );
      const isSuperAdminRole = userRoles.some(
        (r) => r.userId === callerId && r.role === 'super_admin'
      );

      const isAuthorized = isHostelOwner || isSuperAdminProfile || isSuperAdminRole;
      if (!isAuthorized) {
        return { authorized: false, error: 'Forbidden' };
      }
      return { authorized: true };
    }

    const OWNER_ID = 'owner-uuid-111';
    const OTHER_USER_ID = 'student-uuid-222';
    const ADMIN_ID = 'admin-uuid-333';

    // 1. Anon / unauthenticated -> REJECTED
    expect(
      checkAuthorization(null, 'anon', OWNER_ID, [], [])
    ).toEqual({ authorized: false, error: 'Authentication required' });

    // 2. Unauthorized authenticated user -> REJECTED
    expect(
      checkAuthorization(OTHER_USER_ID, 'authenticated', OWNER_ID, [], [])
    ).toEqual({ authorized: false, error: 'Forbidden' });

    // 3. Authorized hostel owner -> ACCEPTED
    expect(
      checkAuthorization(OWNER_ID, 'authenticated', OWNER_ID, [], [])
    ).toEqual({ authorized: true });

    // 4. Authorized super_admin via profile -> ACCEPTED
    expect(
      checkAuthorization(
        ADMIN_ID,
        'authenticated',
        OWNER_ID,
        [{ userId: ADMIN_ID, role: 'super_admin' }],
        []
      )
    ).toEqual({ authorized: true });

    // 5. Authorized service_role -> ACCEPTED
    expect(
      checkAuthorization(null, 'service_role', OWNER_ID, [], [])
    ).toEqual({ authorized: true });
  });
});
