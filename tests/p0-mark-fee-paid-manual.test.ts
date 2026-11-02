import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('P0 Security Migration: mark_fee_paid_manual', () => {
  const migrationPath = path.resolve(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261030000000_secure_mark_fee_paid_manual.sql'
  );

  it('migration file exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const content = fs.readFileSync(migrationPath, 'utf-8');
    expect(content.length).toBeGreaterThan(500);
  });

  describe('Defect 1: Completed-Payment Detection & Default-Status Conflict', () => {
    it('requires consistent completed/verified status and rejects default-status conflict (status=pending, payment_status=completed)', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');

      // 1. Must NOT use naive OR condition that matches default payment_status='completed'
      expect(content).not.toMatch(/\(\s*status\s+IN\s*\('completed',\s*'verified'\)\s+OR\s+payment_status\s+IN\s*\('completed',\s*'verified'\)\s*\)/);

      // 2. Must require status IN ('completed', 'verified')
      expect(content).toMatch(/status\s+IN\s*\('completed',\s*'verified'\)/);

      // 3. Must require payment_status to be completed, verified, or NULL (legacy rows)
      expect(content).toMatch(/payment_status\s+IS\s+NULL\s+OR\s+payment_status\s+IN\s*\('completed',\s*'verified'\)/);

      // 4. Must explicitly reject rows indicating pending, failed, rejected, or partial
      expect(content).toMatch(/status\s+NOT\s+IN\s*\('pending',\s*'manual_pending',\s*'failed',\s*'rejected'\)/);
      expect(content).toMatch(/payment_status\s+NOT\s+IN\s*\('pending',\s*'pending_verification',\s*'manual_pending',\s*'failed',\s*'rejected',\s*'partial'\)/);

      // 5. Preserves pending proof inspection path for rows with status='pending'
      expect(content).toMatch(/SELECT\s+id\s+INTO\s+v_pending_payment_id/);
      expect(content).toMatch(/status\s+IN\s*\('pending',\s*'manual_pending'\)\s+OR\s+payment_status\s+IN\s*\('pending',\s*'pending_verification',\s*'manual_pending'\)/);
      expect(content).toMatch(/status\s+NOT\s+IN\s*\('failed',\s*'rejected'\)/);
    });

    it('defensively prevents superseding or voiding the completed payment record', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('id != v_existing_completed_id');
      expect(content).toContain('id != v_pending_payment_id');
    });
  });

  describe('Defect 2: Zero-Amount Settlement Rejection', () => {
    it('strictly rejects zero and negative amounts and requires amount > 0', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');

      // 1. Must reject p_amount <= 0 directly
      expect(content).toMatch(/IF\s+p_amount\s+IS\s+NOT\s+NULL\s+AND\s+p_amount\s*<=\s*0\s+THEN/);
      expect(content).toContain("RAISE EXCEPTION 'Invalid payment amount: amount must be greater than zero'");

      // 2. Must not allow non-negative (<=0) check that allowed 0
      expect(content).not.toContain("amount must be non-negative");

      // 3. Must reject resolved amount if <= 0
      expect(content).toMatch(/IF\s+v_payment_amount\s+IS\s+NULL\s+OR\s+v_payment_amount\s*<=\s*0\s+THEN/);
      expect(content).toContain("RAISE EXCEPTION 'Invalid payment amount: payment amount must be greater than zero'");

      // 4. Does not introduce waiver backdoor
      expect(content).not.toContain("payment_method := 'waiver'");
      expect(content).not.toContain("waiver");
    });
  });

  describe('Function Signature & Caller Compatibility', () => {
    it('preserves the exact 6-argument signature and RETURNS void', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');

      expect(content).toMatch(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.mark_fee_paid_manual\(\s*p_student_fees_id\s+UUID,\s*p_amount\s+NUMERIC,\s*p_payment_method\s+TEXT,\s*p_date\s+DATE,\s*p_notes\s+TEXT,\s*p_verified_by\s+UUID\s+DEFAULT\s+NULL\s*\)\s*RETURNS\s+void/
      );
    });
  });

  describe('Security, Authorization & Privilege Hardening', () => {
    it('enforces SECURITY DEFINER with hardened search_path', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('SECURITY DEFINER');
      expect(content).toMatch(/SET\s+search_path\s*=\s*public,\s*pg_temp/);
    });

    it('enforces authentication and authorization checks', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      // Authentication
      expect(content).toContain("RAISE EXCEPTION 'Authentication required to mark fee as paid'");

      // Ownership and Super Admin
      expect(content).toContain('v_hostel_owner_id = v_caller_id');
      expect(content).toContain("p.role = 'super_admin'");
      expect(content).toContain("public.has_role(v_caller_id, 'super_admin'::public.app_role)");
      expect(content).toContain("RAISE EXCEPTION 'Forbidden: You are not authorized to mark this fee as paid'");

      // Service role handling
      expect(content).toContain("current_setting('request.jwt.claim.role', true), '') = 'service_role'");
      expect(content).toContain('v_verifier_profile_id := NULL');
      expect(content).toContain('[Processed via service_role]');
    });

    it('enforces row locking and deterministic timestamps', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('FOR UPDATE OF sf');
      expect(content).toContain("timezone('UTC', p_date::timestamp)");
    });

    it('revokes dangerous execution permissions from anon and public', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.mark_fee_paid_manual\(UUID,\s*NUMERIC,\s*TEXT,\s*DATE,\s*TEXT,\s*UUID\)\s+FROM\s+anon,\s*public;/);
      expect(content).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.mark_fee_paid_manual\(UUID,\s*NUMERIC,\s*TEXT,\s*DATE,\s*TEXT,\s*UUID\)\s+TO\s+authenticated,\s*service_role;/);
    });
  });
});
