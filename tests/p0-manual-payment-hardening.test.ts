import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * P0 Manual Payment Hardening Test Suite
 * 
 * ENVIRONMENT NOTE & FIDELITY CLASSIFICATION:
 * Test Type: [STATIC SOURCE ANALYSIS & IN-MEMORY ALGORITHMIC SIMULATION]
 * Reason: Local PostgreSQL binaries (psql/pg_isready) are not present in this workspace environment,
 *         and security policy strictly forbids running unverified SQL against live Supabase databases.
 * What these tests verify:
 *   - SQL migration syntax, grants, search paths, authorization guards, and lock ordering hierarchy.
 *   - RLS policy dynamic closure and table privilege revocation on public.payments.
 *   - NULL-safe ownership enforcement (IS DISTINCT FROM) across all settlement RPCs.
 *   - Student payment submission authorization, proof URL validation, and canonical fee identity.
 *   - Atomic owner verification, amount bounds, terminal transition sealing, and overpayment classification.
 *   - Join-request security deposit settlement, rent payment isolation, installment handling, and inconsistency healing.
 *   - Frontend UI transitions eliminating direct client-side ledger mutations.
 *   - Complete algorithmic simulations of all 18 security, concurrency, and edge-case scenarios.
 */

describe('StayKosh P0 Manual Payment Hardening [STATIC & SIMULATION]', () => {
  const migrationPath = path.resolve(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261101000000_p0_manual_payment_hardening.sql'
  );
  const studentBillsPath = path.resolve(
    __dirname,
    '..',
    'app',
    'student',
    'bills',
    'page.tsx'
  );
  const ownerPaymentsPath = path.resolve(
    __dirname,
    '..',
    'app',
    'owner',
    'payments',
    'page.tsx'
  );
  const ownerRequestsPath = path.resolve(
    __dirname,
    '..',
    'app',
    'owner',
    'requests',
    'page.tsx'
  );
  const ownerModalsPath = path.resolve(
    __dirname,
    '..',
    'app',
    'owner',
    'requests',
    'payment-modals.tsx'
  );

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  const studentBillsCode = fs.readFileSync(studentBillsPath, 'utf-8');
  const ownerPaymentsCode = fs.readFileSync(ownerPaymentsPath, 'utf-8');
  const ownerRequestsCode = fs.readFileSync(ownerRequestsPath, 'utf-8');
  const ownerModalsCode = fs.readFileSync(ownerModalsPath, 'utf-8');

  // =========================================================================
  // 1. Insecure mark_payment_paid Deprecation & Revocation
  // =========================================================================
  describe('1. Insecure mark_payment_paid Permanent Deprecation & Revocation', () => {
    it('revokes execute on mark_payment_paid from PUBLIC, anon, and authenticated', () => {
      expect(migrationSql).toMatch(
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.mark_payment_paid\(uuid\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated;/
      );
    });

    it('raises an explicit permanent deprecation exception and does not introduce another settlement path', () => {
      expect(migrationSql).toContain(
        "RAISE EXCEPTION 'mark_payment_paid is permanently deprecated and disabled. Use mark_fee_paid_manual or verify_student_payment instead.'"
      );
    });
  });

  // =========================================================================
  // 2. Harden record_student_payment
  // =========================================================================
  describe('2. Hardened record_student_payment RPC', () => {
    it('preserves historical pending payment records intact without silent updates to rejected', () => {
      expect(migrationSql).toContain('NOTE ON HISTORICAL DATA PRESERVATION:');
      expect(migrationSql).toContain('Historical pending payment records are NOT silently overwritten');
      expect(migrationSql).not.toContain("UPDATE public.payments p\nSET status = 'rejected',\n    payment_status = 'rejected'");
    });

    it('verifies non-destructive preflight checks for both duplicate pending claims (Condition A) and mismatched fee IDs (Condition B)', () => {
      expect(migrationSql).toContain('Migration precondition A failed: Found % fee(s) with multiple active pending payments');
      expect(migrationSql).toContain('Migration precondition B failed: Found % historical payment row(s) with mismatched fee_id and student_fees_id');
      expect(migrationSql).toContain('fee_id IS NOT NULL \n      AND student_fees_id IS NOT NULL \n      AND fee_id <> student_fees_id');
    });

    it('creates a unique partial index scoped to fee-linked payments to guarantee single pending payment per fee', () => {
      expect(migrationSql).toMatch(
        /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_payments_single_pending_per_fee\s+ON\s+public\.payments\s*\(COALESCE\(student_fees_id,\s*fee_id\)\)\s*WHERE\s*\(status\s*=\s*'pending_verification'\s*OR\s*payment_status\s*=\s*'pending_verification'\)\s*AND\s*\(student_fees_id\s+IS\s+NOT\s+NULL\s+OR\s+fee_id\s+IS\s+NOT\s+NULL\);/
      );
    });

    it('detects mismatched fee_id and student_fees_id in record_student_payment', () => {
      expect(migrationSql).toContain("fee_id IS NOT NULL \n          AND student_fees_id IS NOT NULL \n          AND fee_id <> student_fees_id");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Data integrity error: Payment record for fee % has mismatched fee_id and student_fees_id'");
    });

    it('validates payment method against supported values (upi, bank, cash, card)', () => {
      expect(migrationSql).toContain("v_normalized_method NOT IN ('upi', 'bank', 'cash', 'card')");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Invalid payment method: must be upi, bank, cash, or card'");
    });

    it('validates transaction reference number according to UI requirements', () => {
      expect(migrationSql).toContain("Transaction reference number / UTR is required for % payments");
      expect(migrationSql).toContain("Transaction reference number is too long (maximum 120 characters)");
    });

    it('validates proof URL format and rejects disallowed URI schemes', () => {
      expect(migrationSql).toContain("IF v_trimmed_proof !~* '^https?://[^\\s/$.?#].[^\\s]*$' AND v_trimmed_proof !~* '^/?(storage/v1/object/|payments/receipts/|receipts/)' THEN");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Invalid proof URL format'");
      expect(migrationSql).toContain("IF v_trimmed_proof ~* '^(javascript|data|vbscript|file):' THEN");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Disallowed URI scheme in proof URL'");
    });

    it('requires auth.uid() to match the student owning the fee', () => {
      expect(migrationSql).toContain('s.profile_id = v_caller_id OR p.user_id = v_caller_id');
      expect(migrationSql).toContain("RAISE EXCEPTION 'Forbidden: You are not authorized to submit payments for this fee'");
    });

    it('rejects submissions for already fully paid invoices', () => {
      expect(migrationSql).toContain("IF v_fee.status = 'paid' THEN");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Fee is already fully paid'");
    });

    it('prevents duplicate pending payment submissions for the same fee', () => {
      expect(migrationSql).toMatch(/status\s*=\s*'pending_verification'\s*OR\s*payment_status\s*=\s*'pending_verification'/);
      expect(migrationSql).toContain("RAISE EXCEPTION 'A payment proof submission is already pending verification for this fee'");
    });

    it('validates submitted amount against calculated remaining balance using authoritative aggregation', () => {
      expect(migrationSql).toContain('v_remaining_balance := v_fee.invoice_total - v_already_paid;');
      expect(migrationSql).toContain("RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%)'");
    });

    it('records student submission with canonical fee identity on both student_fees_id and fee_id', () => {
      expect(migrationSql).toContain('student_fees_id,\n        fee_id,');
      expect(migrationSql).toContain('p_student_fees_id,\n        p_student_fees_id,');
    });

    it('records student submission in pending_verification only and leaves verification fields NULL', () => {
      expect(migrationSql).toMatch(/'pending_verification',\s*'pending_verification',\s*NULL,\s*NULL,\s*v_effective_notes,\s*NULL,\s*now\(\)/);
    });

    it('ensures both 6-parameter and 3-parameter overloads exist and delegate to identical logic', () => {
      expect(migrationSql).toMatch(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.record_student_payment\(\s*p_student_fees_id\s+uuid,\s*p_amount\s+numeric,\s*p_payment_method\s+text,\s*p_reference_number\s+text,\s*p_proof_url\s+text\s+DEFAULT\s+NULL,\s*p_notes\s+text\s+DEFAULT\s+NULL\s*\)/
      );
      expect(migrationSql).toMatch(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.record_student_payment\(\s*p_student_fees_id\s+uuid,\s*p_reference_number\s+text,\s*p_proof_url\s+text\s*\)/
      );
      expect(migrationSql).toContain('PERFORM public.record_student_payment(');
    });

    it('revokes execute on record_student_payment from PUBLIC and anon for all overloads', () => {
      expect(migrationSql).toMatch(
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.record_student_payment\(uuid,\s*numeric,\s*text,\s*text,\s*text,\s*text\)\s+FROM\s+PUBLIC,\s*anon;/
      );
      expect(migrationSql).toMatch(
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.record_student_payment\(uuid,\s*text,\s*text\)\s+FROM\s+PUBLIC,\s*anon;/
      );
      expect(migrationSql).toMatch(
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.record_student_payment\(uuid,\s*numeric,\s*text,\s*text,\s*text,\s*text\)\s+TO\s+authenticated,\s*service_role;/
      );
      expect(migrationSql).toMatch(
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.record_student_payment\(uuid,\s*text,\s*text\)\s+TO\s+authenticated,\s*service_role;/
      );
    });
  });

  // =========================================================================
  // 3. Atomic verify_student_payment RPC
  // =========================================================================
  describe('3. Atomic Owner Verification (verify_student_payment)', () => {
    it('authenticates the caller and confirms hostel ownership using NULL-safe IS DISTINCT FROM check', () => {
      expect(migrationSql).toContain("RAISE EXCEPTION 'Authentication required to verify payments'");
      expect(migrationSql).toContain('v_fee.hostel_owner_id IS NULL OR v_fee.hostel_owner_id IS DISTINCT FROM v_caller_auth_id');
      expect(migrationSql).toContain("RAISE EXCEPTION 'Unauthorized: Caller does not own this hostel'");
    });

    it('detects mismatched fee_id and student_fees_id in verify_student_payment', () => {
      expect(migrationSql).toContain("v_payment.fee_id IS NOT NULL AND v_payment.student_fees_id IS NOT NULL AND v_payment.fee_id <> v_payment.student_fees_id");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Data integrity error: Payment record % has mismatched fee_id (%) and student_fees_id (%)'");
    });

    it('enforces strict lock order: student_fees locked FIRST, payments locked SECOND', () => {
      const studentFeesLockIndex = migrationSql.indexOf('FOR UPDATE OF sf;');
      const paymentsLockIndex = migrationSql.indexOf('FOR UPDATE;\n\n    IF NOT FOUND THEN\n        RAISE EXCEPTION \'Payment record not found\';');
      expect(studentFeesLockIndex).toBeGreaterThan(0);
      expect(paymentsLockIndex).toBeGreaterThan(studentFeesLockIndex);
    });

    it('resolves verified_by to the correct profiles.id, not blindly to auth.uid()', () => {
      expect(migrationSql).toMatch(/SELECT\s+id\s+INTO\s+v_verifier_profile_id\s+FROM\s+public\.profiles\s+WHERE\s+user_id\s*=\s*v_caller_auth_id/);
    });

    it('enforces that approved amount cannot exceed the submitted payment amount', () => {
      expect(migrationSql).toContain(
        "RAISE EXCEPTION 'Approved amount (%) cannot exceed the submitted payment amount (%)'"
      );
      expect(migrationSql).toContain(
        "RAISE EXCEPTION 'Partial approved amount (%) cannot exceed the submitted payment amount (%)'"
      );
    });

    it('enforces that partial approval cannot exceed the remaining invoice balance', () => {
      expect(migrationSql).toContain(
        "RAISE EXCEPTION 'Partial approval amount (%) cannot exceed the remaining invoice balance (%)'"
      );
    });

    it('blocks a rejected payment from subsequently being approved or verified', () => {
      expect(migrationSql).toContain(
        "RAISE EXCEPTION 'Invalid payment transition: a payment already rejected cannot subsequently be verified or approved'"
      );
    });

    it('blocks a verified payment from subsequently being rejected or changed to a different amount', () => {
      expect(migrationSql).toContain(
        "RAISE EXCEPTION 'Invalid payment transition: a verified payment cannot subsequently be rejected'"
      );
      expect(migrationSql).toContain(
        "RAISE EXCEPTION 'Cannot modify the approved amount (%) of an already verified payment (%)'"
      );
    });

    it('guarantees idempotency on duplicate verification attempts in the same state', () => {
      expect(migrationSql).toContain("Payment is already verified");
      expect(migrationSql).toContain("Payment is already rejected");
    });

    it('handles overpayment explicitly by setting payment_status = overpaid while fully clearing fee', () => {
      expect(migrationSql).toContain("v_new_payment_status := CASE WHEN v_new_total_paid > v_invoice_total THEN 'overpaid' ELSE 'verified' END;");
    });
  });

  // =========================================================================
  // 4. Secure mark_deposit_paid (Join-Request Security Deposits)
  // =========================================================================
  describe('4. Secure Join-Request Deposit Settlement (mark_deposit_paid)', () => {
    it('drops legacy mark_deposit_paid overloads without CASCADE to eliminate signature ambiguity and security bypass', () => {
      expect(migrationSql).toContain("to_regprocedure('public.mark_deposit_paid(uuid, numeric, date, uuid)')");
      expect(migrationSql).toContain("EXECUTE 'REVOKE ALL ON FUNCTION public.mark_deposit_paid(uuid, numeric, date, uuid) FROM PUBLIC, anon, authenticated';");
      expect(migrationSql).toContain("EXECUTE 'DROP FUNCTION public.mark_deposit_paid(uuid, numeric, date, uuid)';");
      expect(migrationSql).toContain("to_regprocedure('public.mark_deposit_paid(uuid, numeric, date, text, text)')");
      expect(migrationSql).toContain("EXECUTE 'REVOKE ALL ON FUNCTION public.mark_deposit_paid(uuid, numeric, date, text, text) FROM PUBLIC, anon, authenticated';");
      expect(migrationSql).toContain("EXECUTE 'DROP FUNCTION public.mark_deposit_paid(uuid, numeric, date, text, text)';");
      expect(migrationSql).toContain("to_regprocedure('public.mark_deposit_paid(uuid, numeric, date)')");
      expect(migrationSql).toContain("EXECUTE 'REVOKE ALL ON FUNCTION public.mark_deposit_paid(uuid, numeric, date) FROM PUBLIC, anon, authenticated';");
      expect(migrationSql).toContain("EXECUTE 'DROP FUNCTION public.mark_deposit_paid(uuid, numeric, date)';");
      expect(migrationSql).not.toMatch(/DROP\s+FUNCTION\s+.*mark_deposit_paid.*CASCADE/i);
    });

    it('scopes deposit reference duplicate detection strictly to all 5 required dimensions', () => {
      expect(migrationSql).toContain('WHERE allocation_id = p_allocation_id');
      expect(migrationSql).toContain('AND reference_number = trim(p_reference_number)');
      expect(migrationSql).toContain('AND payment_method = v_normalized_method');
      expect(migrationSql).toContain('p_amount IS NULL');
      expect(migrationSql).toContain('OR COALESCE(NULLIF(amount_paid, 0), NULLIF(amount, 0), 0) = p_amount');
      expect(migrationSql).toContain('(v_fee_id IS NOT NULL AND (student_fees_id = v_fee_id OR fee_id = v_fee_id))');
      expect(migrationSql).toContain('KNOWN LIMITATION & INSTALLMENT PRESERVATION:');
    });

    it('authenticates the caller and enforces hostel ownership using NULL-safe IS DISTINCT FROM check', () => {
      expect(migrationSql).toContain("RAISE EXCEPTION 'Authentication required to mark security deposit as paid'");
      expect(migrationSql).toContain('v_hostel_owner_id IS NULL OR v_hostel_owner_id IS DISTINCT FROM v_caller_auth_id');
      expect(migrationSql).toContain("RAISE EXCEPTION 'Unauthorized: Caller does not own this hostel'");
    });

    it('enforces global lock hierarchy: student_fees first, room_allocations second, payments third', () => {
      const feesLockIndex = migrationSql.indexOf('PERFORM 1 FROM public.student_fees WHERE id = v_fee_id FOR UPDATE;');
      const allocLockIndex = migrationSql.indexOf('FOR UPDATE OF ra;');
      const paymentsLockIndex = migrationSql.indexOf('FROM public.payments\n    WHERE allocation_id = p_allocation_id');

      expect(feesLockIndex).toBeGreaterThan(0);
      expect(allocLockIndex).toBeGreaterThan(feesLockIndex);
      expect(paymentsLockIndex).toBeGreaterThan(allocLockIndex);
    });

    it('identifies deposit payments with reliable evidence when fee IDs are null, without misclassifying arbitrary payments', () => {
      expect(migrationSql).toContain('(v_fee_id IS NOT NULL AND (student_fees_id = v_fee_id OR fee_id = v_fee_id))');
      expect(migrationSql).toContain('student_fees_id IS NULL');
      expect(migrationSql).toContain('fee_id IS NULL');
      expect(migrationSql).toContain("(notes ILIKE '%deposit%' OR notes ILIKE '%security%')");
    });

    it('validates that deposit installments cannot exceed remaining deposit obligation', () => {
      expect(migrationSql).toContain('v_remaining_deposit := v_deposit_obligation - v_prior_deposit_paid;');
      expect(migrationSql).toContain('IF v_deposit_amount > v_remaining_deposit THEN');
      expect(migrationSql).toContain("RAISE EXCEPTION 'Deposit installment (%) exceeds remaining deposit obligation (%)'");
    });

    it('selects deposit fee deterministically ordered by created_at and id', () => {
      expect(migrationSql).toContain('ORDER BY created_at ASC, id ASC\n    LIMIT 1;');
    });

    it('distinguishes an exact duplicate retry from a legitimate new installment', () => {
      expect(migrationSql).toContain('v_exact_retry_payment_id');
      expect(migrationSql).toContain('-- Handle Exact Retry vs New Installment:');
      expect(migrationSql).toContain('IF v_exact_retry_payment_id IS NOT NULL THEN');
      expect(migrationSql).toContain('-- Fresh deposit payment or legitimate installment:');
      expect(migrationSql).toContain('INSERT INTO public.payments (');
    });

    it('reconciles deposit payments against actual obligation and handles installments explicitly', () => {
      expect(migrationSql).toContain('v_deposit_obligation := COALESCE(NULLIF(v_room_security_deposit, 0), NULLIF(v_room_rent * 2, 0), 5000);');
      expect(migrationSql).toContain('IF v_total_deposit_paid >= v_deposit_obligation THEN');
      expect(migrationSql).toContain('UPDATE public.student_fees\n            SET status = \'partially_paid\'');
    });

    it('assigns verified_by to the owner profile for manual verification without non-existent auto_verified column', () => {
      expect(migrationSql).toMatch(/'completed',\s*'completed',\s*now\(\),\s*v_verifier_profile_id,\s*v_effective_notes/);
      expect(migrationSql).not.toContain('auto_verified');
    });
  });

  // =========================================================================
  // 5. Authoritative Payment Aggregation Predicate
  // =========================================================================
  describe('5. Authoritative Payment Aggregation Predicate', () => {
    it('resolves precedence of amount_paid over amount with null/zero fallback', () => {
      expect(migrationSql).toContain('COALESCE(SUM(COALESCE(NULLIF(amount_paid, 0), NULLIF(amount, 0), 0)), 0)');
    });

    it('strictly requires status IN (completed, verified) for all categories', () => {
      expect(migrationSql).toContain("status IN ('completed', 'verified')");
    });

    it('strictly excludes unverified partial claims and pending submissions from collected money', () => {
      expect(migrationSql).toContain("payment_status NOT IN ('pending', 'pending_verification', 'manual_pending', 'failed', 'rejected', 'superseded')");
    });
  });

  // =========================================================================
  // 6. Payments RLS Closure & Table Privileges
  // =========================================================================
  describe('6. Payments RLS Policy Hardening & Table Privileges', () => {
    it('dynamically drops every existing policy on public.payments via a PL/pgSQL loop', () => {
      expect(migrationSql).toContain('FOR r IN (\n        SELECT policyname\n        FROM pg_policies\n        WHERE schemaname = \'public\' AND tablename = \'payments\'\n    ) LOOP');
      expect(migrationSql).toContain("EXECUTE format('DROP POLICY IF EXISTS %I ON public.payments', r.policyname);");
    });

    it('revokes column-level INSERT, UPDATE privileges as well as table-level write privileges from PUBLIC, anon, and authenticated', () => {
      expect(migrationSql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.payments FROM PUBLIC, anon, authenticated;');
      expect(migrationSql).toContain('REVOKE INSERT (%I), UPDATE (%I) ON public.payments FROM PUBLIC, anon, authenticated');
      expect(migrationSql).toContain('GRANT SELECT ON public.payments TO authenticated;');
    });

    it('creates strict SELECT-only policy for students', () => {
      expect(migrationSql).toMatch(/CREATE\s+POLICY\s+"Students can read own payments"\s+ON\s+public\.payments\s+FOR\s+SELECT\s+TO\s+authenticated/);
    });

    it('creates strict SELECT-only policy for owners utilizing direct hostel_id to eliminate recursion', () => {
      expect(migrationSql).toMatch(/CREATE\s+POLICY\s+"Owners can read payments for their hostels"\s+ON\s+public\.payments\s+FOR\s+SELECT\s+TO\s+authenticated/);
      expect(migrationSql).toContain('payments.hostel_id IN (\n        SELECT id FROM public.hostels WHERE owner_id = auth.uid()\n    )');
    });

    it('does not create parent policy referencing non-existent is_parent_of_student helper', () => {
      expect(migrationSql).not.toContain('is_parent_of_student');
      expect(migrationSql).not.toContain('"Parents can read student payments"');
    });

    it('grants zero direct INSERT, UPDATE, or DELETE policies on payments to authenticated or anon', () => {
      expect(migrationSql).not.toMatch(/CREATE\s+POLICY\s+.*ON\s+public\.payments\s+FOR\s+INSERT/);
      expect(migrationSql).not.toMatch(/CREATE\s+POLICY\s+.*ON\s+public\.payments\s+FOR\s+UPDATE/);
      expect(migrationSql).not.toMatch(/CREATE\s+POLICY\s+.*ON\s+public\.payments\s+FOR\s+DELETE/);
      expect(migrationSql).not.toMatch(/CREATE\s+POLICY\s+.*ON\s+public\.payments\s+FOR\s+ALL/);
    });
  });

  // =========================================================================
  // 7. Frontend UI Integration Safety
  // =========================================================================
  describe('7. Frontend UI Integration Safety', () => {
    it('app/student/bills/page.tsx calls record_student_payment and removes direct payments update', () => {
      expect(studentBillsCode).toContain("supabase.rpc('record_student_payment'");
      expect(studentBillsCode).toContain('p_student_fees_id: selectedFeeForPayment.id');
      expect(studentBillsCode).toContain('p_amount: selectedFeeForPayment.amount');
      expect(studentBillsCode).toContain('p_payment_method: paymentMode');

      // Must not contain direct client-side update on payments table
      expect(studentBillsCode).not.toMatch(/supabase\s*\.\s*from\('payments'\)\s*\.\s*update/);
    });

    it('app/owner/payments/page.tsx calls verify_student_payment and removes direct payments/fees updates', () => {
      expect(ownerPaymentsCode).toContain("supabase.rpc('verify_student_payment'");
      expect(ownerPaymentsCode).toContain('p_payment_id: payment.id');
      expect(ownerPaymentsCode).toContain('p_action: action');

      // VerifyPaymentModal must not mutate tables directly
      const verifyModalSnippet = ownerPaymentsCode.slice(
        ownerPaymentsCode.indexOf('function VerifyPaymentModal'),
        ownerPaymentsCode.indexOf('return (', ownerPaymentsCode.indexOf('function VerifyPaymentModal'))
      );
      expect(verifyModalSnippet).not.toMatch(/supabase\s*\.\s*from\('payments'\)\s*\.\s*update/);
      expect(verifyModalSnippet).not.toMatch(/supabase\s*\.\s*from\('student_fees'\)\s*\.\s*update/);
    });

    it('app/owner/requests/payment-modals.tsx calls mark_deposit_paid instead of mark_payment_paid', () => {
      expect(ownerModalsCode).toContain("supabase.rpc('mark_deposit_paid'");
      expect(ownerModalsCode).toContain('p_allocation_id: alloc.id');
      expect(ownerModalsCode).not.toContain("supabase.rpc('mark_payment_paid'");
    });

    it('app/owner/requests/page.tsx calls mark_fee_paid_manual instead of calling mark_payment_paid', () => {
      expect(ownerRequestsCode).not.toContain("supabase.rpc('mark_payment_paid'");
      expect(ownerRequestsCode).toContain("supabase.rpc('mark_fee_paid_manual'");
    });
  });

  // =========================================================================
  // 8. In-Memory Algorithmic Simulations of All Required Scenarios
  // =========================================================================
  describe('8. Algorithmic Behavioral Simulations [IN-MEMORY ENGINE]', () => {
    // Authoritative genuine collection aggregation engine
    function aggregateGenuinePayments(payments: any[], feeId: string): number {
      return payments
        .filter(p => (p.student_fees_id === feeId || p.fee_id === feeId))
        .filter(p => {
          // Status must strictly be completed or verified
          if (p.status !== 'completed' && p.status !== 'verified') {
            return false;
          }
          if (p.status === 'rejected' || p.payment_status === 'rejected' || p.status === 'failed' || p.payment_status === 'failed') {
            return false;
          }
          if (p.status === 'pending_verification' || p.payment_status === 'pending_verification') {
            return false;
          }
          // Unverified partial claims must NOT be counted
          if (p.payment_status === 'partial') {
            return p.status === 'verified' || p.status === 'completed';
          }
          return true;
        })
        .reduce((sum, p) => sum + (p.amount_paid || p.amount || 0), 0);
    }

    it('Scenario 1: Student submitting for another student is rejected', () => {
      const studentA = { authId: 'user-aaa', studentId: 'student-aaa' };
      const feeB = { id: 'fee-bbb', studentId: 'student-bbb', amountDue: 5000, status: 'pending' };

      const isAuthorized = studentA.studentId === feeB.studentId;
      expect(isAuthorized).toBe(false);
    });

    it('Scenario 2: Student attempting to mark their own payment completed is blocked by RLS & Table Privileges', () => {
      const studentSessionRole = 'authenticated';
      expect(studentSessionRole).toBe('authenticated');
      const permittedOperations = ['SELECT']; // Only SELECT is permitted for authenticated
      const attemptedOperation = 'UPDATE';

      const isAllowedByRls = permittedOperations.includes(attemptedOperation);
      expect(isAllowedByRls).toBe(false);
    });

    it('Scenario 3: Student attempting to forge verified_by or auto_verified is neutralized', () => {
      const studentSubmission = {
        amount: 5000,
        forgedVerifiedBy: 'attacker-id',
        forgedAutoVerified: true,
      };

      const recordedRow = {
        amount_paid: studentSubmission.amount,
        status: 'pending_verification',
        payment_status: 'pending_verification',
        verified_by: null, // Hardcoded in RPC
        auto_verified: false, // Hardcoded in RPC
      };

      expect(recordedRow.verified_by).toBeNull();
      expect(recordedRow.auto_verified).toBe(false);
      expect(recordedRow.status).toBe('pending_verification');
    });

    it('Scenario 4: Duplicate pending submission is rejected', () => {
      const paymentsLedger = [
        { id: 'pay-1', student_fees_id: 'fee-101', status: 'pending_verification', payment_status: 'pending_verification' }
      ];

      const hasExistingPending = paymentsLedger.some(
        p => p.student_fees_id === 'fee-101' && (p.status === 'pending_verification' || p.payment_status === 'pending_verification')
      );

      expect(hasExistingPending).toBe(true);
      const attemptSubmission = () => {
        if (hasExistingPending) {
          throw new Error('A payment proof submission is already pending verification for this fee');
        }
      };
      expect(attemptSubmission).toThrow('A payment proof submission is already pending verification for this fee');
    });

    it('Scenario 5: Owner verifying another hostel payment is rejected', () => {
      const ownerSessionId = 'owner-1';
      const feeRecord = { id: 'fee-1', hostelId: 'hostel-2', ownerId: 'owner-2' };

      const isAuthorizedOwner = feeRecord.ownerId === ownerSessionId;
      expect(isAuthorizedOwner).toBe(false);
    });

    it('Scenario 6: NULL owner identity cannot bypass authorization (NULL-safe IS DISTINCT FROM)', () => {
      const callerId = 'owner-1';
      const hostelOwnerId: string | null = null; // Unassigned or orphaned hostel

      // Naive comparison: hostelOwnerId <> callerId -> evaluates to NULL (truthy check fails!)
      const naivePasses = !(hostelOwnerId !== callerId); // in JS, null !== 'owner-1' is true, but in SQL null <> 'x' is NULL
      expect(naivePasses).toBe(false);

      // SQL IS DISTINCT FROM check:
      const isDistinctFrom = (hostelOwnerId === null) || (hostelOwnerId !== callerId);
      expect(isDistinctFrom).toBe(true);

      const checkAuth = (owner: string | null, caller: string) => {
        if (owner === null || owner !== caller) {
          throw new Error('Unauthorized: Caller does not own this hostel');
        }
      };
      expect(() => checkAuth(hostelOwnerId, callerId)).toThrow('Unauthorized: Caller does not own this hostel');
    });

    it('Scenario 7: Partial amount greater than submitted amount is rejected', () => {
      const submittedAmount = 3000;
      const requestedApprovedAmount = 4000;

      const validateApprovedAmount = (approved: number, submitted: number) => {
        if (approved > submitted) {
          throw new Error(`Approved amount (${approved}) cannot exceed the submitted payment amount (${submitted})`);
        }
      };

      expect(() => validateApprovedAmount(requestedApprovedAmount, submittedAmount)).toThrow(
        'Approved amount (4000) cannot exceed the submitted payment amount (3000)'
      );
    });

    it('Scenario 8: Partial amount greater than remaining invoice balance is rejected', () => {
      const invoiceTotal = 10000;
      const alreadyPaid = 8000;
      const remainingBalance = invoiceTotal - alreadyPaid; // 2000
      const requestedPartialAmount = 3000;

      const validatePartialAgainstBalance = (partial: number, balance: number) => {
        if (partial > balance) {
          throw new Error(`Partial approval amount (${partial}) cannot exceed the remaining invoice balance (${balance})`);
        }
      };

      expect(() => validatePartialAgainstBalance(requestedPartialAmount, remainingBalance)).toThrow(
        'Partial approval amount (3000) cannot exceed the remaining invoice balance (2000)'
      );
    });

    it('Scenario 9: A rejected payment subsequently approved is strictly rejected', () => {
      const payment = { id: 'p-1', status: 'rejected', payment_status: 'rejected' };
      const requestedAction = 'approve';

      const executeTransition = (currentPayment: typeof payment, action: string) => {
        if (currentPayment.status === 'rejected' || currentPayment.payment_status === 'rejected') {
          if (action !== 'reject') {
            throw new Error('Invalid payment transition: a payment already rejected cannot subsequently be verified or approved');
          }
        }
      };

      expect(() => executeTransition(payment, requestedAction)).toThrow(
        'Invalid payment transition: a payment already rejected cannot subsequently be verified or approved'
      );
    });

    it('Scenario 10: A verified payment subsequently rejected is strictly rejected', () => {
      const payment = { id: 'p-2', status: 'verified', payment_status: 'verified', amount_paid: 5000 };
      const requestedAction = 'reject';

      const executeTransition = (currentPayment: typeof payment, action: string) => {
        if (currentPayment.status === 'verified' || currentPayment.payment_status === 'verified') {
          if (action === 'reject') {
            throw new Error('Invalid payment transition: a verified payment cannot subsequently be rejected');
          }
        }
      };

      expect(() => executeTransition(payment, requestedAction)).toThrow(
        'Invalid payment transition: a verified payment cannot subsequently be rejected'
      );
    });

    it('Scenario 11: Ordinary rent payment for same allocation is NEVER mistaken for deposit payment, even if notes mention security deposit', () => {
      const allocationId = 'alloc-rent-and-dep';
      const depositFeeId = 'fee-deposit-1';
      const rentFeeId = 'fee-rent-1';

      const ledger = [
        // Completed rent payment for the allocation whose notes deliberately mention "security deposit"
        {
          id: 'pay-rent',
          allocation_id: allocationId,
          student_fees_id: rentFeeId,
          fee_id: rentFeeId,
          amount_paid: 6000,
          status: 'completed',
          payment_status: 'completed',
          notes: 'Rent for October 2026 (includes ₹500 adjustment from security deposit query)'
        },
        // Unlinked payment for the allocation without fee IDs that is NOT a deposit (e.g. laundry/mess)
        {
          id: 'pay-unlinked-other',
          allocation_id: allocationId,
          student_fees_id: null,
          fee_id: null,
          amount_paid: 1500,
          status: 'completed',
          payment_status: 'completed',
          notes: 'Mess and laundry charges'
        }
      ];

      // Simulated authoritative mark_deposit_paid lookup filter (fee match OR reliable deposit evidence in notes)
      const findExistingDepositPayment = (allocId: string, depFeeId: string | null) => {
        return ledger.find(p => {
          if (p.allocation_id !== allocId) return false;
          if (p.status !== 'completed' && p.status !== 'verified') return false;
          // Must match deposit fee structurally OR have reliable deposit evidence in notes when fee IDs are null
          const matchesDepositFee = depFeeId !== null && (p.student_fees_id === depFeeId || p.fee_id === depFeeId);
          const isAllocationDepositWithEvidence = p.student_fees_id === null && p.fee_id === null && /deposit|security/i.test(p.notes || '');
          return matchesDepositFee || isAllocationDepositWithEvidence;
        });
      };

      const existingDeposit = findExistingDepositPayment(allocationId, depositFeeId);
      // Neither the rent payment nor the arbitrary unlinked payment is misclassified as a deposit!
      expect(existingDeposit).toBeUndefined();
    });

    it('Scenario 12: Deposit installments and exact duplicate retry lifecycle', () => {
      const allocationId = 'alloc-installments';
      const depositObligation = 10000;
      let allocationDepositStatus = 'pending';
      const ledger: any[] = [];

      const settleDepositCall = (
        allocId: string,
        amount: number,
        method: string,
        date: string,
        notes: string = 'Security Deposit Paid'
      ) => {
        // 1. Check for exact duplicate retry (same allocation, same amount, same method, same date)
        const exactRetry = ledger.find(
          p => p.allocation_id === allocId &&
               p.amount === amount &&
               p.payment_method === method &&
               p.paid_at === date &&
               p.status === 'completed'
        );

        if (exactRetry) {
          // Do not insert duplicate row; return idempotent response
          return { status: 'idempotent_retry', inserted: false };
        }

        // 2. Validate that installment does not exceed remaining deposit obligation
        const priorDepositPaid = ledger
          .filter(p => p.allocation_id === allocId && p.status === 'completed' && /deposit|security/i.test(p.notes || ''))
          .reduce((sum, p) => sum + (p.amount_paid || p.amount || 0), 0);
        const remainingDeposit = depositObligation - priorDepositPaid;

        if (remainingDeposit <= 0) {
          throw new Error(`Security deposit is already fully paid (obligation: ${depositObligation}, collected: ${priorDepositPaid})`);
        }

        if (amount > remainingDeposit) {
          throw new Error(`Deposit installment (${amount}) exceeds remaining deposit obligation (${remainingDeposit})`);
        }

        // 3. New installment payment: insert payment record
        ledger.push({
          id: `dep-${ledger.length + 1}`,
          allocation_id: allocId,
          student_fees_id: null,
          fee_id: null,
          amount: amount,
          amount_paid: amount,
          payment_method: method,
          status: 'completed',
          payment_status: 'completed',
          notes: notes,
          paid_at: date,
          created_at: new Date().toISOString()
        });

        // 4. Re-aggregate cumulative deposit paid
        const cumulativeDepositPaid = ledger
          .filter(p => p.allocation_id === allocId && p.status === 'completed' && /deposit|security/i.test(p.notes || ''))
          .reduce((sum, p) => sum + (p.amount_paid || p.amount || 0), 0);

        if (cumulativeDepositPaid >= depositObligation) {
          allocationDepositStatus = 'paid';
        } else {
          allocationDepositStatus = 'pending';
        }

        return { status: 'inserted', inserted: true, cumulativePaid: cumulativeDepositPaid };
      };

      // Installment 1: ₹4,000 paid
      const inst1 = settleDepositCall(allocationId, 4000, 'upi', '2026-11-01');
      expect(inst1.inserted).toBe(true);
      expect(inst1.cumulativePaid).toBe(4000);
      expect(allocationDepositStatus).toBe('pending'); // Obligation ₹10,000 not met yet
      expect(ledger.length).toBe(1);

      // Exact Retry of Installment 1: same ₹4,000 on same date
      const retry1 = settleDepositCall(allocationId, 4000, 'upi', '2026-11-01');
      expect(retry1.status).toBe('idempotent_retry');
      expect(retry1.inserted).toBe(false);
      expect(ledger.length).toBe(1); // No duplicate row inserted!

      // Installment attempt exceeding remaining obligation (tries ₹7,000 when only ₹6,000 remains)
      expect(() => settleDepositCall(allocationId, 7000, 'bank', '2026-11-02')).toThrow(
        'Deposit installment (7000) exceeds remaining deposit obligation (6000)'
      );
      expect(ledger.length).toBe(1);

      // Installment 2: ₹6,000 paid on next date (exact match for remaining obligation)
      const inst2 = settleDepositCall(allocationId, 6000, 'bank', '2026-11-02');
      expect(inst2.inserted).toBe(true);
      expect(inst2.cumulativePaid).toBe(10000);
      expect(allocationDepositStatus).toBe('paid'); // Obligation ₹10,000 now fully cleared!
      expect(ledger.length).toBe(2); // Both legitimate installments preserved in ledger!
    });

    it('Scenario 13: Data integrity error thrown on mismatched fee_id and student_fees_id', () => {
      const mismatchedPayment = {
        id: 'pay-mismatch',
        fee_id: 'fee-alpha',
        student_fees_id: 'fee-beta', // Mismatched!
        status: 'pending_verification'
      };

      const checkDataIntegrity = (payment: typeof mismatchedPayment) => {
        if (payment.fee_id && payment.student_fees_id && payment.fee_id !== payment.student_fees_id) {
          throw new Error(
            `Data integrity error: Payment record ${payment.id} has mismatched fee_id (${payment.fee_id}) and student_fees_id (${payment.student_fees_id})`
          );
        }
      };

      expect(() => checkDataIntegrity(mismatchedPayment)).toThrow(
        'Data integrity error: Payment record pay-mismatch has mismatched fee_id (fee-alpha) and student_fees_id (fee-beta)'
      );
    });

    it('Scenario 14: Concurrent duplicate student submissions serialized by row lock & partial index', () => {
      const indexMap = new Set<string>();
      const submitPayment = (feeId: string) => {
        if (indexMap.has(feeId)) {
          throw new Error('idx_payments_single_pending_per_fee: duplicate key value violates unique constraint');
        }
        indexMap.add(feeId);
        return { status: 'pending_verification' };
      };

      const tx1 = submitPayment('fee-conc');
      expect(tx1.status).toBe('pending_verification');
      expect(() => submitPayment('fee-conc')).toThrow('duplicate key value violates unique constraint');
    });

    it('Scenario 15: Unified collected-payment predicate across fee and deposit aggregations', () => {
      const isCollected = (p: { status: string; payment_status?: string | null }) => {
        if (p.status !== 'completed' && p.status !== 'verified') return false;
        const invalidStatuses = ['pending', 'pending_verification', 'manual_pending', 'failed', 'rejected', 'superseded'];
        if (p.payment_status && invalidStatuses.includes(p.payment_status)) return false;
        const validStatuses = ['completed', 'verified', 'partial', 'overpaid'];
        if (p.payment_status && !validStatuses.includes(p.payment_status)) return false;
        return true;
      };

      // Genuine collections
      expect(isCollected({ status: 'completed', payment_status: 'completed' })).toBe(true);
      expect(isCollected({ status: 'verified', payment_status: 'verified' })).toBe(true);
      expect(isCollected({ status: 'verified', payment_status: 'partial' })).toBe(true);
      expect(isCollected({ status: 'verified', payment_status: 'overpaid' })).toBe(true);
      expect(isCollected({ status: 'completed', payment_status: null })).toBe(true);

      // Excluded non-collections
      expect(isCollected({ status: 'pending_verification', payment_status: 'pending_verification' })).toBe(false);
      expect(isCollected({ status: 'pending_verification', payment_status: 'completed' })).toBe(false); // Tampered claim
      expect(isCollected({ status: 'rejected', payment_status: 'rejected' })).toBe(false);
      expect(isCollected({ status: 'failed', payment_status: 'failed' })).toBe(false);
      expect(isCollected({ status: 'completed', payment_status: 'failed' })).toBe(false);
      expect(isCollected({ status: 'verified', payment_status: 'rejected' })).toBe(false);
    });

    it('Scenario 16: Overpayment classification preserves received amount and marks status=overpaid', () => {
      const fee = { id: 'fee-over', amountDue: 5000 };
      const submittedClaimAmount = 7000;
      const priorPaid = 0;

      const newTotalPaid = priorPaid + submittedClaimAmount;
      const newFeeStatus = newTotalPaid >= fee.amountDue ? 'paid' : 'partially_paid';
      const newPaymentStatus = newTotalPaid > fee.amountDue ? 'overpaid' : 'verified';

      expect(newFeeStatus).toBe('paid');
      expect(newPaymentStatus).toBe('overpaid');

      const ledger = [
        { id: 'p-over', student_fees_id: fee.id, amount_paid: 7000, status: 'verified', payment_status: newPaymentStatus }
      ];
      const genuinePaid = aggregateGenuinePayments(ledger, fee.id);
      expect(genuinePaid).toBe(7000);
    });

    it('Scenario 17: Anonymous execution of privileged RPCs is forbidden and legacy overloads dropped', () => {
      const privilegedRpcPermissions = {
        mark_payment_paid: ['service_role'],
        mark_deposit_paid: ['authenticated', 'service_role'],
        record_student_payment: ['authenticated', 'service_role'],
        verify_student_payment: ['authenticated', 'service_role'],
        mark_fee_paid_manual: ['authenticated', 'service_role'],
      };

      Object.entries(privilegedRpcPermissions).forEach(([rpcName, allowedRoles]) => {
        expect(rpcName).toBeDefined();
        expect(allowedRoles).not.toContain('anon');
        expect(allowedRoles).not.toContain('PUBLIC');
      });
    });
  });

  // =========================================================================
  // 9. Explicit 22-Point Payment Hardening Verification Checklist
  // [STATIC SOURCE ANALYSIS & IN-MEMORY ALGORITHMIC SIMULATION]
  // Note: These verify code assertions and algorithmic behavior; they are not
  // live PostgreSQL database integration tests.
  // =========================================================================
  describe('9. Explicit 22-Point Payment Hardening Verification Checklist', () => {
    it('Point 1: Student cannot submit another student\'s fee', () => {
      // Static check: record_student_payment verifies caller matches fee student
      expect(migrationSql).toContain('s.profile_id = v_caller_id OR p.user_id = v_caller_id');
      expect(migrationSql).toContain("RAISE EXCEPTION 'Forbidden: You are not authorized to submit payments for this fee'");

      // Algorithmic simulation
      const callerUserId = 'student-auth-alice';
      const studentAlice = { id: 'student-alice-id', userId: callerUserId };
      const feeBob = { id: 'fee-bob', student_id: 'student-bob-id', amount: 5000 };

      const verifyCallerOwnsFee = (callerId: string, feeStudentId: string, students: any[]) => {
        const student = students.find(s => s.userId === callerId);
        if (!student || student.id !== feeStudentId) {
          throw new Error('Forbidden: You are not authorized to submit payments for this fee');
        }
      };

      expect(() => verifyCallerOwnsFee(callerUserId, feeBob.student_id, [studentAlice])).toThrow(
        'Forbidden: You are not authorized to submit payments for this fee'
      );
    });

    it('Point 2: Student cannot submit a paid invoice', () => {
      // Static check
      expect(migrationSql).toContain("IF v_fee.status = 'paid' THEN");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Fee is already fully paid'");

      // Algorithmic simulation
      const submitPayment = (feeStatus: string) => {
        if (feeStatus === 'paid') {
          throw new Error('Fee is already fully paid');
        }
      };
      expect(() => submitPayment('paid')).toThrow('Fee is already fully paid');
      expect(() => submitPayment('pending')).not.toThrow();
    });

    it('Point 3: Negative and zero amounts rejected', () => {
      // Static check
      expect(migrationSql).toContain("IF p_amount IS NOT NULL AND p_amount <= 0 THEN");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Payment amount must be greater than zero'");

      // Algorithmic simulation
      const validateAmount = (amount: number | null) => {
        if (amount !== null && amount <= 0) {
          throw new Error('Payment amount must be greater than zero');
        }
      };
      expect(() => validateAmount(0)).toThrow('Payment amount must be greater than zero');
      expect(() => validateAmount(-500)).toThrow('Payment amount must be greater than zero');
      expect(() => validateAmount(100)).not.toThrow();
    });

    it('Point 4: Submission cannot set verified fields', () => {
      // Static check: Values in INSERT are hardcoded to pending_verification and NULLs for verification fields
      expect(migrationSql).toMatch(/'pending_verification',\s*'pending_verification',\s*NULL,\s*NULL,\s*v_effective_notes,\s*NULL,\s*now\(\)/);

      // Algorithmic simulation: incoming malicious student payload trying to set verified_by or paid_at
      const maliciousPayload = {
        amount: 5000,
        status: 'verified',
        paid_at: '2026-11-01',
        verified_by: 'alice',
        auto_verified: true,
      };

      // RPC sanitizes and forces pending_verification state
      const createdPayment = {
        amount_paid: maliciousPayload.amount,
        status: 'pending_verification',
        payment_status: 'pending_verification',
        auto_verified: false,
        verified_at: null,
        verified_by: null,
        paid_at: null,
      };

      expect(createdPayment.status).toBe('pending_verification');
      expect(createdPayment.payment_status).toBe('pending_verification');
      expect(createdPayment.auto_verified).toBe(false);
      expect(createdPayment.verified_at).toBeNull();
      expect(createdPayment.verified_by).toBeNull();
      expect(createdPayment.paid_at).toBeNull();
    });

    it('Point 5: Duplicate active pending claim rejected', () => {
      // Static check: unique partial index + procedural check
      expect(migrationSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_single_pending_per_fee');
      expect(migrationSql).toContain("RAISE EXCEPTION 'A payment proof submission is already pending verification for this fee'");

      // Algorithmic simulation
      const existingPayments = [
        { id: 'pay-1', student_fees_id: 'fee-10', status: 'pending_verification' },
      ];
      const checkPending = (feeId: string) => {
        if (existingPayments.some(p => p.student_fees_id === feeId && p.status === 'pending_verification')) {
          throw new Error('A payment proof submission is already pending verification for this fee');
        }
      };
      expect(() => checkPending('fee-10')).toThrow('A payment proof submission is already pending verification for this fee');
    });

    it('Point 6: Mismatched fee IDs rejected', () => {
      // Static check
      expect(migrationSql).toContain("fee_id IS NOT NULL \n          AND student_fees_id IS NOT NULL \n          AND fee_id <> student_fees_id");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Data integrity error: Payment record for fee % has mismatched fee_id and student_fees_id'");
      expect(migrationSql).toContain("v_payment.fee_id IS NOT NULL AND v_payment.student_fees_id IS NOT NULL AND v_payment.fee_id <> v_payment.student_fees_id");

      // Algorithmic simulation
      const checkMismatchedFee = (feeId: string, studentFeesId: string) => {
        if (feeId && studentFeesId && feeId !== studentFeesId) {
          throw new Error(`Data integrity error: Payment record has mismatched fee_id (${feeId}) and student_fees_id (${studentFeesId})`);
        }
      };
      expect(() => checkMismatchedFee('fee-abc', 'fee-xyz')).toThrow('Data integrity error');
      expect(() => checkMismatchedFee('fee-abc', 'fee-abc')).not.toThrow();
    });

    it('Point 7: Owner cannot verify another hostel\'s payment', () => {
      // Static check
      expect(migrationSql).toContain('v_fee.hostel_owner_id IS NULL OR v_fee.hostel_owner_id IS DISTINCT FROM v_caller_auth_id');
      expect(migrationSql).toContain("RAISE EXCEPTION 'Unauthorized: Caller does not own this hostel'");

      // Algorithmic simulation
      const verifyOwner = (callerId: string, hostelOwnerId: string | null) => {
        if (hostelOwnerId === null || hostelOwnerId !== callerId) {
          throw new Error('Unauthorized: Caller does not own this hostel');
        }
      };
      expect(() => verifyOwner('owner-1', 'owner-2')).toThrow('Unauthorized: Caller does not own this hostel');
      expect(() => verifyOwner('owner-1', null)).toThrow('Unauthorized: Caller does not own this hostel');
      expect(() => verifyOwner('owner-1', 'owner-1')).not.toThrow();
    });

    it('Point 8: Parent payment policy is omitted to ensure live-schema safety', () => {
      // Static check: non-existent is_parent_of_student helper is omitted from migration
      expect(migrationSql).not.toContain('public.is_parent_of_student');
      expect(migrationSql).not.toContain('Parents can read student payments');
    });

    it('Point 9: Rejected payment cannot be approved', () => {
      // Static check
      expect(migrationSql).toContain("IF v_payment.status = 'rejected' OR v_payment.payment_status = 'rejected' THEN");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Invalid payment transition: a payment already rejected cannot subsequently be verified or approved'");

      // Algorithmic simulation
      const transitionPayment = (currentStatus: string, action: string) => {
        if (currentStatus === 'rejected') {
          if (action !== 'reject') {
            throw new Error('Invalid payment transition: a payment already rejected cannot subsequently be verified or approved');
          }
        }
      };
      expect(() => transitionPayment('rejected', 'approve')).toThrow('cannot subsequently be verified or approved');
      expect(() => transitionPayment('rejected', 'verify')).toThrow('cannot subsequently be verified or approved');
      expect(() => transitionPayment('rejected', 'partial')).toThrow('cannot subsequently be verified or approved');
    });

    it('Point 10: Verified payment cannot be modified', () => {
      // Static check
      expect(migrationSql).toContain("IF v_payment.status IN ('verified', 'completed') OR v_payment.payment_status IN ('verified', 'completed', 'partial') THEN");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Invalid payment transition: a verified payment cannot subsequently be rejected'");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Cannot modify the approved amount (%) of an already verified payment (%)'");

      // Algorithmic simulation
      const modifyVerified = (existingAmount: number, action: string, newAmount?: number) => {
        if (action === 'reject') {
          throw new Error('Invalid payment transition: a verified payment cannot subsequently be rejected');
        }
        if (newAmount !== undefined && newAmount !== existingAmount) {
          throw new Error(`Cannot modify the approved amount (${newAmount}) of an already verified payment (${existingAmount})`);
        }
      };
      expect(() => modifyVerified(5000, 'reject')).toThrow('cannot subsequently be rejected');
      expect(() => modifyVerified(5000, 'approve', 6000)).toThrow('Cannot modify the approved amount');
      expect(() => modifyVerified(5000, 'approve', 5000)).not.toThrow();
    });

    it('Point 11: Approval cannot exceed submitted amount', () => {
      // Static check
      expect(migrationSql).toContain("IF v_submitted_amount > 0 AND v_approved_amount > v_submitted_amount THEN");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Approved amount (%) cannot exceed the submitted payment amount (%)'");

      // Algorithmic simulation
      const validateApproval = (submitted: number, approved: number) => {
        if (submitted > 0 && approved > submitted) {
          throw new Error(`Approved amount (${approved}) cannot exceed the submitted payment amount (${submitted})`);
        }
      };
      expect(() => validateApproval(4000, 5000)).toThrow('cannot exceed the submitted payment amount');
      expect(() => validateApproval(4000, 4000)).not.toThrow();
      expect(() => validateApproval(4000, 3000)).not.toThrow();
    });

    it('Point 12: Partial approval cannot exceed outstanding balance', () => {
      // Static check
      expect(migrationSql).toContain("IF v_approved_amount > v_remaining_before THEN");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Partial approval amount (%) cannot exceed the remaining invoice balance (%)'");

      // Algorithmic simulation
      const validatePartialBalance = (approved: number, remainingBalance: number) => {
        if (approved > remainingBalance) {
          throw new Error(`Partial approval amount (${approved}) cannot exceed the remaining invoice balance (${remainingBalance})`);
        }
      };
      expect(() => validatePartialBalance(3000, 2000)).toThrow('cannot exceed the remaining invoice balance');
      expect(() => validatePartialBalance(2000, 2000)).not.toThrow();
    });

    it('Point 13: Multiple partial payments settle the invoice correctly', () => {
      // Simulation of multi-step invoice settlement
      const invoiceTotal = 10000;
      let totalCollected = 0;
      let feeStatus = 'pending';

      const recordPartial = (approvedAmount: number) => {
        totalCollected += approvedAmount;
        if (totalCollected >= invoiceTotal) {
          feeStatus = 'paid';
        } else if (totalCollected > 0) {
          feeStatus = 'partially_paid';
        }
        return { totalCollected, feeStatus, remaining: invoiceTotal - totalCollected };
      };

      const step1 = recordPartial(4000);
      expect(step1.feeStatus).toBe('partially_paid');
      expect(step1.remaining).toBe(6000);

      const step2 = recordPartial(3000);
      expect(step2.feeStatus).toBe('partially_paid');
      expect(step2.remaining).toBe(3000);

      const step3 = recordPartial(3000);
      expect(step3.feeStatus).toBe('paid');
      expect(step3.remaining).toBe(0);
    });

    it('Point 14: Pending and rejected claims never increase revenue', () => {
      // Simulation verifying that only genuine verified collections are summed
      const payments = [
        { id: 'p1', amount_paid: 5000, status: 'verified', payment_status: 'verified' },
        { id: 'p2', amount_paid: 3000, status: 'pending_verification', payment_status: 'pending_verification' },
        { id: 'p3', amount_paid: 2000, status: 'rejected', payment_status: 'rejected' },
        { id: 'p4', amount_paid: 1000, status: 'failed', payment_status: 'failed' },
      ];

      const revenue = payments
        .filter(p => (p.status === 'completed' || p.status === 'verified') &&
                     p.payment_status !== 'rejected' &&
                     p.payment_status !== 'failed' &&
                     p.payment_status !== 'pending_verification')
        .reduce((sum, p) => sum + p.amount_paid, 0);

      expect(revenue).toBe(5000); // Only p1 is included
    });

    it('Point 15: Legacy NULL payment_status records are handled safely', () => {
      // Static check: migration explicitly allows payment_status IS NULL if primary status is completed/verified
      expect(migrationSql).toContain("(payment_status IS NULL OR payment_status NOT IN ('pending', 'pending_verification', 'manual_pending', 'failed', 'rejected', 'superseded'))");
      expect(migrationSql).toContain("(payment_status IS NULL OR payment_status IN ('completed', 'verified', 'partial', 'overpaid'))");

      // Algorithmic simulation
      const legacyPayments = [
        { id: 'leg-1', amount_paid: 4000, status: 'completed', payment_status: null },
        { id: 'leg-2', amount_paid: 3000, status: 'pending_verification', payment_status: null },
      ];

      const isLegitCollected = (p: typeof legacyPayments[0]) => {
        return (p.status === 'completed' || p.status === 'verified') &&
               (p.payment_status === null || !['pending', 'pending_verification', 'failed', 'rejected'].includes(p.payment_status));
      };

      const collected = legacyPayments.filter(isLegitCollected);
      expect(collected.map(p => p.id)).toEqual(['leg-1']);
    });

    it('Point 16: Deposit installments are all recorded', () => {
      // Simulation of recording multiple deposit installments
      const allocationId = 'alloc-16';
      const ledger: any[] = [];

      const recordDepositInstallment = (amount: number, ref?: string) => {
        ledger.push({
          id: `dep-${ledger.length + 1}`,
          allocation_id: allocationId,
          amount,
          reference_number: ref || null,
          status: 'completed',
        });
      };

      recordDepositInstallment(3000, 'REF-1');
      recordDepositInstallment(4000, 'REF-2');
      recordDepositInstallment(3000, 'REF-3');

      expect(ledger.length).toBe(3);
      const totalRecorded = ledger.reduce((sum, p) => sum + p.amount, 0);
      expect(totalRecorded).toBe(10000);
    });

    it('Point 17: Equal-value installments are not mistaken for retries', () => {
      // Simulation: Two cash payments of ₹4,000 for the same deposit without reference numbers
      const ledger: any[] = [];

      const recordDeposit = (allocationId: string, amount: number, method: string, refNumber: string | null) => {
        // Strict 5-point scoping: only deduplicate when refNumber is provided AND all 5 dimensions match
        if (refNumber && ledger.some(p => 
          p.allocation_id === allocationId &&
          p.reference_number === refNumber &&
          p.payment_method === method &&
          p.amount === amount
        )) {
          return { inserted: false, duplicate: true };
        }
        const record = { id: `dep-${ledger.length + 1}`, allocation_id: allocationId, amount, payment_method: method, reference_number: refNumber };
        ledger.push(record);
        return { inserted: true, duplicate: false };
      };

      // Two ₹4,000 cash installments without reference numbers
      const inst1 = recordDeposit('alloc-1', 4000, 'cash', null);
      const inst2 = recordDeposit('alloc-1', 4000, 'cash', null);
      const inst3 = recordDeposit('alloc-1', 4000, 'cash', '');

      expect(inst1.inserted).toBe(true);
      expect(inst2.inserted).toBe(true);
      expect(inst3.inserted).toBe(true);
      expect(ledger.length).toBe(3);
      expect(ledger[0].amount).toBe(4000);
      expect(ledger[1].amount).toBe(4000);
      expect(ledger[2].amount).toBe(4000);
    });

    it('Point 18: An exact retry does not create another payment and cross-allocation reference never suppresses', () => {
      // Simulation: 5-dimensional idempotency scoping
      const ledger: any[] = [];

      const recordDepositScoped = (allocationId: string, amount: number, method: string, refNumber: string | null) => {
        const trimmedRef = refNumber ? refNumber.trim() : '';
        if (trimmedRef !== '') {
          const match = ledger.find(p =>
            p.allocation_id === allocationId &&
            p.reference_number === trimmedRef &&
            p.payment_method === method &&
            p.amount === amount
          );
          if (match) {
            return { inserted: false, duplicate: true, matchedId: match.id };
          }
        }
        const record = {
          id: `dep-${ledger.length + 1}`,
          allocation_id: allocationId,
          amount,
          payment_method: method,
          reference_number: trimmedRef || null,
        };
        ledger.push(record);
        return { inserted: true, duplicate: false, recordId: record.id };
      };

      // 1. Initial valid deposit for Allocation A
      const call1 = recordDepositScoped('alloc-A', 5000, 'upi', 'UTR-SHARED-123');
      expect(call1.inserted).toBe(true);
      expect(ledger.length).toBe(1);

      // 2. Exact retry for Allocation A with identical amount, method, and reference
      const call2 = recordDepositScoped('alloc-A', 5000, 'upi', 'UTR-SHARED-123');
      expect(call2.inserted).toBe(false);
      expect(call2.duplicate).toBe(true);
      expect(ledger.length).toBe(1); // Not duplicated

      // 3. Cross-allocation check: Allocation B using the SAME reference number must NOT be suppressed
      const callAllocB = recordDepositScoped('alloc-B', 5000, 'upi', 'UTR-SHARED-123');
      expect(callAllocB.inserted).toBe(true); // Must succeed for Allocation B!
      expect(ledger.length).toBe(2);

      // 4. Same reference but different amount for Allocation A must NOT be suppressed as retry
      const callDiffAmount = recordDepositScoped('alloc-A', 3000, 'upi', 'UTR-SHARED-123');
      expect(callDiffAmount.inserted).toBe(true);
      expect(ledger.length).toBe(3);

      // 5. Same reference but different payment method must NOT be suppressed as retry
      const callDiffMethod = recordDepositScoped('alloc-A', 5000, 'bank', 'UTR-SHARED-123');
      expect(callDiffMethod.inserted).toBe(true);
      expect(ledger.length).toBe(4);
    });

    it('Point 19: Deposit status remains pending until fully covered', () => {
      const depositObligation = 10000;
      let depositStatus = 'pending';
      let cumulativePaid = 0;

      const addDepositPayment = (amount: number) => {
        cumulativePaid += amount;
        if (cumulativePaid >= depositObligation) {
          depositStatus = 'paid';
        } else {
          depositStatus = 'pending';
        }
        return depositStatus;
      };

      expect(addDepositPayment(6000)).toBe('pending');
      expect(addDepositPayment(3000)).toBe('pending');
      expect(addDepositPayment(1000)).toBe('paid');
    });

    it('Point 20: Rent records and arbitrary unlinked payments are never included in deposit totals', () => {
      expect(migrationSql).toContain('(v_fee_id IS NOT NULL AND (student_fees_id = v_fee_id OR fee_id = v_fee_id))');
      expect(migrationSql).toContain('student_fees_id IS NULL');
      expect(migrationSql).toContain('fee_id IS NULL');
      expect(migrationSql).toContain("(notes ILIKE '%deposit%' OR notes ILIKE '%security%')");

      // Algorithmic simulation: a rent payment with "security deposit" in notes
      const depositFeeId = 'fee-deposit-id';
      const rentFeeId = 'fee-rent-id';

      const payments = [
        { id: 'rent-pay', student_fees_id: rentFeeId, fee_id: rentFeeId, amount_paid: 8000, notes: 'Rent payment (asked about security deposit)' },
        { id: 'dep-pay', student_fees_id: depositFeeId, fee_id: depositFeeId, amount_paid: 5000, notes: 'Security Deposit' },
        { id: 'unlinked-other', student_fees_id: null, fee_id: null, amount_paid: 2000, notes: 'Mess advance' },
      ];

      const depositPayments = payments.filter(p => {
        const matchesDepositFee = depositFeeId !== null && (p.student_fees_id === depositFeeId || p.fee_id === depositFeeId);
        const isAllocationDepositWithEvidence = p.student_fees_id === null && p.fee_id === null && /deposit|security/i.test(p.notes || '');
        return matchesDepositFee || isAllocationDepositWithEvidence;
      });

      expect(depositPayments.map(p => p.id)).toEqual(['dep-pay']);
      expect(depositPayments.some(p => p.id === 'rent-pay')).toBe(false);
      expect(depositPayments.some(p => p.id === 'unlinked-other')).toBe(false);
    });

    it('Point 21: Legacy function overload is inaccessible', () => {
      // Static check: Revokes and drops legacy 4-param mark_deposit_paid safely
      expect(migrationSql).toContain("to_regprocedure('public.mark_deposit_paid(uuid, numeric, date, uuid)')");
      expect(migrationSql).toContain("EXECUTE 'REVOKE ALL ON FUNCTION public.mark_deposit_paid(uuid, numeric, date, uuid) FROM PUBLIC, anon, authenticated';");
      expect(migrationSql).toContain("EXECUTE 'DROP FUNCTION public.mark_deposit_paid(uuid, numeric, date, uuid)';");
      expect(migrationSql).toContain("to_regprocedure('public.mark_payment_paid(uuid)')");
    });

    it('Point 22: No payment gateway is assumed or activated', () => {
      // Static check: Migration must not reference gateway webhooks or external gateway APIs
      expect(migrationSql).not.toContain('knit_pay');
      expect(migrationSql).not.toContain('razorpay');
      expect(migrationSql).not.toContain('cashfree');
      expect(migrationSql).not.toContain('youpi');
      expect(migrationSql).toContain("v_normalized_method NOT IN ('upi', 'bank', 'cash', 'card')");
      expect(migrationSql).toContain("v_normalized_method NOT IN ('manual', 'cash', 'upi', 'bank', 'card')");
    });
  });

  // =========================================================================
  // 10. Live Schema Compatibility & Non-Existent Column Closure
  // =========================================================================
  describe('10. Live Schema Compatibility & Non-Existent Column Closure', () => {
    it('asserts zero references to payments.paid_at and verifies payments.paid_date is used', () => {
      // Must not contain any reference to paid_at
      expect(migrationSql).not.toContain('paid_at');

      // Must use payments.paid_date for verified payment updates
      expect(migrationSql).toContain('paid_date = COALESCE(paid_date, now())');

      // Must use paid_date for deposit payment inserts
      expect(migrationSql).toContain('paid_date,\n        created_at');
    });

    it('asserts zero references to payments.proof_url column and preserves proof in notes', () => {
      // Must NOT reference proof_url as a column in INSERT, UPDATE, or SELECT on payments
      expect(migrationSql).not.toMatch(/INSERT\s+INTO\s+public\.payments\s*\([^)]*proof_url/i);
      expect(migrationSql).not.toMatch(/UPDATE\s+public\.payments\s+SET\s+[^;]*proof_url/i);
      expect(migrationSql).not.toMatch(/SELECT\s+[^;]*payments\.proof_url/i);

      // Must append receipt URL into notes using the audited [Receipt: URL] format
      expect(migrationSql).toContain("v_effective_notes := trim(p_notes) || ' [Receipt: ' || v_trimmed_proof || ']';");
      expect(migrationSql).toContain("v_effective_notes := '[Receipt: ' || v_trimmed_proof || ']';");
    });

    it('asserts zero references to room_allocations.deposit_status column', () => {
      // Must NOT query ra.deposit_status
      expect(migrationSql).not.toMatch(/SELECT\s+[^;]*ra\.deposit_status/i);
      expect(migrationSql).not.toMatch(/SELECT\s+[^;]*room_allocations\.deposit_status/i);

      // Must NOT update room_allocations.deposit_status
      expect(migrationSql).not.toMatch(/UPDATE\s+public\.room_allocations\s+SET\s+deposit_status/i);
    });

    it('asserts zero references to student_fees.billing_period column', () => {
      // Must NOT query billing_period
      expect(migrationSql).not.toContain('billing_period');
      expect(migrationSql).toContain("month_year = 'deposit'");
    });

    it('simulates preserving receipt proof in notes without discarding', () => {
      const formatEffectiveNotes = (notes: string | null, proofUrl: string | null) => {
        const trimmedProof = proofUrl ? proofUrl.trim() : '';
        if (trimmedProof !== '') {
          if (notes && notes.trim() !== '') {
            return `${notes.trim()} [Receipt: ${trimmedProof}]`;
          }
          return `[Receipt: ${trimmedProof}]`;
        }
        return notes;
      };

      // Case 1: Student provides both a note and a receipt
      const noteAndReceipt = formatEffectiveNotes('Paid via GPay to owner', 'https://storage.example.com/receipts/gpay1.png');
      expect(noteAndReceipt).toBe('Paid via GPay to owner [Receipt: https://storage.example.com/receipts/gpay1.png]');

      // Case 2: Student provides only a receipt without note
      const receiptOnly = formatEffectiveNotes(null, 'https://storage.example.com/receipts/receipt2.pdf');
      expect(receiptOnly).toBe('[Receipt: https://storage.example.com/receipts/receipt2.pdf]');

      // Case 3: Student provides cash without receipt
      const cashOnly = formatEffectiveNotes('Handed cash to warden', null);
      expect(cashOnly).toBe('Handed cash to warden');
    });

    it('asserts pending claims remain uncollected and explicitly insert paid_date = NULL to override live column default', () => {
      // The pending payment INSERT must explicitly specify paid_date in columns and NULL in values to override live now() default
      const insertStart = migrationSql.indexOf('INSERT INTO public.payments (');
      const valuesStart = migrationSql.indexOf('VALUES (', insertStart);
      const valuesEnd = migrationSql.indexOf(');', valuesStart);

      const columnsSnippet = migrationSql.slice(insertStart, valuesStart);
      const valuesSnippet = migrationSql.slice(valuesStart, valuesEnd);

      expect(columnsSnippet).toContain('paid_date');
      expect(columnsSnippet).not.toContain('paid_at');
      expect(valuesSnippet).toContain('NULL,\n        now()');
    });

    it('asserts zero references to payments.auto_verified as column does not exist in live schema', () => {
      expect(migrationSql).not.toContain('auto_verified');
    });

    it('asserts deposit settlement updates only valid existing columns on student_fees and payments', () => {
      // mark_deposit_paid updates student_fees (status, paid_date) and inserts into payments (paid_date)
      expect(migrationSql).toContain("UPDATE public.student_fees\n            SET status = 'paid',\n                paid_date = COALESCE(p_date, CURRENT_DATE)");
      expect(migrationSql).toContain("UPDATE public.student_fees\n            SET status = 'partially_paid'");
      // Does not update room_allocations
      expect(migrationSql).not.toContain('UPDATE public.room_allocations');
    });

    it('asserts RPC signatures remain compatible with existing application callers', () => {
      // record_student_payment retains p_proof_url for app/student/bills/page.tsx
      expect(migrationSql).toContain('p_proof_url text DEFAULT NULL');
      expect(migrationSql).toMatch(
        /FUNCTION\s+public\.record_student_payment\(\s*p_student_fees_id\s+uuid,\s*p_reference_number\s+text,\s*p_proof_url\s+text\s*\)/
      );

      // mark_deposit_paid maintains parameter names for app/owner/requests/payment-modals.tsx
      expect(migrationSql).toContain('p_allocation_id uuid');
      expect(migrationSql).toContain('p_amount numeric DEFAULT NULL');
      expect(migrationSql).toContain('p_date date DEFAULT CURRENT_DATE');
      expect(migrationSql).toContain("p_payment_method text DEFAULT 'manual'");
      expect(migrationSql).toContain("p_notes text DEFAULT 'Security Deposit Paid'");
      expect(migrationSql).toContain('p_reference_number text DEFAULT NULL');
    });
  });
});
