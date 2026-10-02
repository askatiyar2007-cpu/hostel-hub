import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 2B-1: Security RLS Fixes (Notifications & Admin Fees)', () => {
  const rootDir = path.resolve(__dirname, '..');
  const migrationPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20261001050000_phase2b1_notifications_and_admin_fees_rls.sql'
  );

  test('Migration file exists with timestamp naming convention', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

  test('Migration runs within a transaction block', () => {
    expect(migrationContent).toMatch(/^\s*BEGIN;/m);
    expect(migrationContent).toMatch(/COMMIT;\s*$/m);
  });

  test('Notifications table has RLS enabled', () => {
    expect(migrationContent).toMatch(
      /ALTER\s+TABLE\s+public\.notifications\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\s*;/i
    );
  });

  test('Notifications table access is revoked from anon and public', () => {
    expect(migrationContent).toMatch(
      /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.notifications\s+FROM\s+anon,\s*public\s*;/i
    );
  });

  test('Notifications table privileges granted to authenticated and service_role', () => {
    expect(migrationContent).toMatch(
      /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+TABLE\s+public\.notifications\s+TO\s+authenticated\s*;/i
    );
    expect(migrationContent).toMatch(
      /GRANT\s+ALL\s+ON\s+TABLE\s+public\.notifications\s+TO\s+service_role\s*;/i
    );
  });

  test('Notifications SELECT policy restricts authenticated users to auth.uid() = user_id', () => {
    expect(migrationContent).toMatch(
      /CREATE\s+POLICY\s+"Users can view own notifications"\s+ON\s+public\.notifications\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i
    );
  });

  test('Notifications INSERT policy enforces auth.uid() = user_id in WITH CHECK', () => {
    expect(migrationContent).toMatch(
      /CREATE\s+POLICY\s+"Users can insert own notifications"\s+ON\s+public\.notifications\s+FOR\s+INSERT\s+TO\s+authenticated\s+WITH\s+CHECK\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i
    );
  });

  test('Notifications UPDATE policy enforces auth.uid() = user_id in USING and WITH CHECK', () => {
    expect(migrationContent).toMatch(
      /CREATE\s+POLICY\s+"Users can update own notifications"\s+ON\s+public\.notifications\s+FOR\s+UPDATE\s+TO\s+authenticated\s+USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)\s+WITH\s+CHECK\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i
    );
  });

  test('Notifications DELETE policy restricts authenticated users to auth.uid() = user_id', () => {
    expect(migrationContent).toMatch(
      /CREATE\s+POLICY\s+"Users can delete own notifications"\s+ON\s+public\.notifications\s+FOR\s+DELETE\s+TO\s+authenticated\s+USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i
    );
  });

  test('Student fees has additive super_admin SELECT policy using public.has_role', () => {
    expect(migrationContent).toMatch(
      /CREATE\s+POLICY\s+"Super admins can read all student fees"\s+ON\s+public\.student_fees\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s*\(\s*public\.has_role\(\s*auth\.uid\(\)\s*,\s*'super_admin'::public\.app_role\s*\)\s*\)/i
    );
  });

  test('Migration does NOT drop or replace existing student or owner policies on student_fees', () => {
    expect(migrationContent).not.toMatch(/DROP\s+POLICY[^\n;]*Students can read their own fees/i);
    expect(migrationContent).not.toMatch(/DROP\s+POLICY[^\n;]*Owners can read\/write fees/i);
  });

  test('Migration strictly avoids touching protected subsystems', () => {
    expect(migrationContent).not.toContain('mark_payment_paid');
    expect(migrationContent).not.toContain('parent_links');
    expect(migrationContent).not.toContain('is_parent_of');
    expect(migrationContent).not.toContain('payment_methods');
    expect(migrationContent).not.toContain('electricity');
  });
});
