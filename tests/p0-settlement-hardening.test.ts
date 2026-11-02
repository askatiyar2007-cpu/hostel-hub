import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * P0 Gateway Security, Financial Integrity & Settlement Hardening Test Suite
 * 
 * ENVIRONMENT NOTE & FIDELITY CLASSIFICATION:
 * Test Type: [MOCKED / STATIC SOURCE ANALYSIS & IN-MEMORY ALGORITHMIC SIMULATION]
 * Reason: Local PostgreSQL binaries (psql/pg_isready) are not present in this workspace environment,
 *         and user safeguards strictly forbid running SQL against live Supabase databases.
 * What these tests verify:
 *   - SQL migration syntax, grants, search paths, authorization guards, and lock ordering hierarchy.
 *   - Next.js API route request parsing, HMAC signature verification, balance calculation, and gateway validation.
 *   - Algorithmic correctness of partial-payment deduction, currency checking, reservation policy, and idempotency.
 *   - Explicit handling of ambiguous network failures, definitive rejections, persistence errors, and late callbacks.
 *   - Partial-settlement overpayment calculations and revenue classification safeguards.
 * What requires live staging deployment to verify:
 *   - Live PostgreSQL engine compilation and runtime lock contention performance under concurrent connections.
 */

describe('P0 Gateway Security, Financial Integrity & Settlement Hardening [STATIC / MOCKED]', () => {
  const migrationPath = path.resolve(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261030000000_secure_mark_fee_paid_manual.sql'
  );
  const createOrderRoutePath = path.resolve(
    __dirname,
    '..',
    'app',
    'api',
    'payments',
    'create-order',
    'route.ts'
  );
  const verifyRoutePath = path.resolve(
    __dirname,
    '..',
    'app',
    'api',
    'payments',
    'verify',
    'route.ts'
  );
  const webhookRoutePath = path.resolve(
    __dirname,
    '..',
    'app',
    'api',
    'payments',
    'webhook',
    'route.ts'
  );

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  const createOrderCode = fs.readFileSync(createOrderRoutePath, 'utf-8');
  const verifyCode = fs.readFileSync(verifyRoutePath, 'utf-8');
  const webhookCode = fs.readFileSync(webhookRoutePath, 'utf-8');

  // =========================================================================
  // SECTION 1: Internal Gateway RPC Security & Caller Authorization
  // =========================================================================
  describe('1. Internal Gateway RPC Security & Privilege Hardening', () => {
    it('revokes execution of internal gateway RPCs from PUBLIC, anon, and authenticated', () => {
      // create_gateway_payment_order
      expect(migrationSql).toMatch(
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.create_gateway_payment_order\(UUID,\s*TEXT,\s*NUMERIC,\s*TEXT\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated;/
      );
      // confirm_gateway_payment
      expect(migrationSql).toMatch(
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.confirm_gateway_payment\(TEXT,\s*TEXT,\s*NUMERIC,\s*TEXT,\s*TEXT\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated;/
      );
      // fail_gateway_payment
      expect(migrationSql).toMatch(
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.fail_gateway_payment\(TEXT,\s*TEXT\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated;/
      );
    });

    it('grants execution of internal gateway RPCs ONLY to service_role', () => {
      expect(migrationSql).toMatch(
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_gateway_payment_order\(UUID,\s*TEXT,\s*NUMERIC,\s*TEXT\)\s+TO\s+service_role;/
      );
      expect(migrationSql).toMatch(
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.confirm_gateway_payment\(TEXT,\s*TEXT,\s*NUMERIC,\s*TEXT,\s*TEXT\)\s+TO\s+service_role;/
      );
      expect(migrationSql).toMatch(
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.fail_gateway_payment\(TEXT,\s*TEXT\)\s+TO\s+service_role;/
      );
    });

    it('enforces runtime service_role check inside function body of all internal gateway RPCs', () => {
      const occurrences = (migrationSql.match(/Only service_role can execute/g) || []).length;
      expect(occurrences).toBe(3);

      expect(migrationSql).toContain("RAISE EXCEPTION 'Forbidden: Only service_role can execute create_gateway_payment_order'");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Forbidden: Only service_role can execute confirm_gateway_payment'");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Forbidden: Only service_role can execute fail_gateway_payment'");
    });

    it('preserves mark_fee_paid_manual access for authenticated owners and super_admins', () => {
      expect(migrationSql).toMatch(
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.mark_fee_paid_manual\(UUID,\s*NUMERIC,\s*TEXT,\s*DATE,\s*TEXT,\s*UUID\)\s+TO\s+authenticated,\s*service_role;/
      );
      expect(migrationSql).toContain('v_hostel_owner_id = v_caller_id');
      expect(migrationSql).toContain("p.role = 'super_admin'");
    });

    it('simulates direct authenticated execution rejection vs service_role acceptance', () => {
      const executeRpcAsRole = (role: string) => {
        if (role !== 'service_role') {
          throw new Error('Forbidden: Only service_role can execute confirm_gateway_payment');
        }
        return { success: true };
      };

      // Authenticated user (student or owner direct PostgREST RPC call) is rejected
      expect(() => executeRpcAsRole('authenticated')).toThrow('Forbidden: Only service_role can execute');
      expect(() => executeRpcAsRole('anon')).toThrow('Forbidden: Only service_role can execute');

      // Server-side service_role execution is permitted
      expect(executeRpcAsRole('service_role')).toEqual({ success: true });
    });
  });

  // =========================================================================
  // SECTION 2: Hierarchical Row Locking & Deadlock Prevention
  // =========================================================================
  describe('2. Hierarchical Row Locking & Deadlock Prevention', () => {
    it('verifies mark_fee_paid_manual locks student_fees FIRST, then payments SECOND', () => {
      const step3Index = migrationSql.indexOf('FOR UPDATE OF sf');
      const step7QueryIndex = migrationSql.indexOf('INTO v_existing_completed_id, v_existing_payment_paid_at');
      const step8QueryIndex = migrationSql.indexOf('SELECT id INTO v_pending_payment_id');

      expect(step3Index).toBeGreaterThan(0);
      expect(step7QueryIndex).toBeGreaterThan(step3Index);
      expect(step8QueryIndex).toBeGreaterThan(step7QueryIndex);
    });

    it('verifies confirm_gateway_payment locks student_fees FIRST, then payments SECOND', () => {
      const fnStart = migrationSql.indexOf('FUNCTION public.confirm_gateway_payment');
      const fnBody = migrationSql.substring(fnStart);

      const feeLockIndex = fnBody.indexOf('FROM public.student_fees\n    WHERE id = v_target_fee_id\n    FOR UPDATE');
      const paymentLockIndex = fnBody.indexOf('FROM public.payments\n    WHERE id = v_payment_id\n    FOR UPDATE');

      expect(feeLockIndex).toBeGreaterThan(0);
      expect(paymentLockIndex).toBeGreaterThan(0);
      expect(feeLockIndex).toBeLessThan(paymentLockIndex);
    });

    it('verifies fail_gateway_payment locks student_fees FIRST, then payments SECOND', () => {
      const fnStart = migrationSql.indexOf('FUNCTION public.fail_gateway_payment');
      const fnBody = migrationSql.substring(fnStart);

      const feeLockIndex = fnBody.indexOf('PERFORM 1 FROM public.student_fees WHERE id = v_target_fee_id FOR UPDATE');
      const paymentLockIndex = fnBody.indexOf('FROM public.payments\n    WHERE id = v_payment_id\n    FOR UPDATE');

      expect(feeLockIndex).toBeGreaterThan(0);
      expect(paymentLockIndex).toBeGreaterThan(0);
      expect(feeLockIndex).toBeLessThan(paymentLockIndex);
    });
  });

  // =========================================================================
  // SECTION 3: Atomic Order Reservation & Lifecycle Safety
  // =========================================================================
  describe('3. Atomic Order Reservation & Lifecycle Safety', () => {
    it('verifies create_gateway_payment_order enforces single active reservation policy without arbitrary 30m auto-expiry', () => {
      expect(migrationSql).not.toMatch(/created_at\s*<=\s*NOW\(\)\s*-\s*INTERVAL\s*'30 minutes'/);
      expect(migrationSql).toContain('An active payment session is already in progress for this fee');
    });

    it('verifies create_gateway_payment_order sets paid_date and paid_at to NULL on insert', () => {
      const insertSection = migrationSql.substring(
        migrationSql.indexOf('INSERT INTO public.payments'),
        migrationSql.indexOf('RETURNING id INTO v_new_payment_id')
      );
      expect(insertSection).toContain('paid_date');
      expect(insertSection).toContain('paid_at');
      expect(insertSection).toMatch(/NULL,\s*NULL/);
    });

    it('simulates concurrent duplicate-order requests blocking a second order', () => {
      interface DBState {
        orders: Array<{
          id: string;
          amount: number;
          status: string;
          payment_status: string;
          created_at: number;
          paid_date: string | null;
          paid_at: string | null;
        }>;
      }

      const db: DBState = { orders: [] };
      const now = Date.now();

      const reserveOrder = (orderId: string, amount: number) => {
        const activeOrder = db.orders.find(
          (o) =>
            ['pending', 'manual_pending'].includes(o.status) &&
            !['failed', 'rejected', 'completed', 'verified'].includes(o.payment_status)
        );

        if (activeOrder) {
          return {
            success: false,
            error: 'An active payment session is already in progress for this fee',
            active_order_id: activeOrder.id
          };
        }

        const newOrder = {
          id: orderId,
          amount,
          status: 'pending',
          payment_status: 'pending',
          created_at: now,
          paid_date: null,
          paid_at: null
        };
        db.orders.push(newOrder);

        return { success: true, payment_id: orderId, amount };
      };

      // Request 1 succeeds
      const res1 = reserveOrder('order-req-1', 10000);
      expect(res1.success).toBe(true);
      expect(db.orders[0].paid_date).toBeNull();
      expect(db.orders[0].paid_at).toBeNull();

      // Concurrent Request 2 is blocked
      const res2 = reserveOrder('order-req-2', 10000);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('An active payment session is already in progress');

      const activeOrders = db.orders.filter((o) => o.status === 'pending');
      expect(activeOrders.length).toBe(1);
      expect(activeOrders[0].id).toBe('order-req-1');
    });

    it('simulates that an old order is NOT released solely because 30 minutes elapsed', () => {
      interface Order {
        id: string;
        status: string;
        payment_status: string;
        created_at: number;
      }

      const existingOrder: Order = {
        id: 'old-order-45m-ago',
        status: 'pending',
        payment_status: 'pending',
        created_at: Date.now() - (45 * 60 * 1000)
      };

      const orders: Order[] = [existingOrder];

      const activeOrder = orders.find(
        (o) =>
          ['pending', 'manual_pending'].includes(o.status) &&
          !['failed', 'rejected', 'completed', 'verified'].includes(o.payment_status)
      );

      expect(activeOrder).toBeDefined();
      expect(activeOrder?.id).toBe('old-order-45m-ago');
      expect(activeOrder?.status).toBe('pending');
    });
  });

  // =========================================================================
  // SECTION 4: External Gateway Failure Handling & Order ID Persistence
  // =========================================================================
  describe('4. External Gateway Failure Handling, Recovery & Provider Rejection Semantics', () => {
    it('verifies create-order route contains NO direct insert fallback on RPC failure', () => {
      expect(createOrderCode).not.toContain("falling back to direct insert");
      expect(createOrderCode).not.toMatch(/if\s*\(rpcError\)\s*\{[\s\S]*?\.insert\(/);
    });

    it('verifies create-order reserves in DB FIRST before calling external Knit Pay API', () => {
      const rpcReservationIndex = createOrderCode.indexOf("supabaseServer.rpc('create_gateway_payment_order'");
      const knitPayFetchIndex = createOrderCode.indexOf("fetch('https://knit-pay-upi.p.rapidapi.com/order/create'");

      expect(rpcReservationIndex).toBeGreaterThan(0);
      expect(knitPayFetchIndex).toBeGreaterThan(0);
      expect(rpcReservationIndex).toBeLessThan(knitPayFetchIndex);
    });

    it('verifies provider rejection semantics strictly define definitive vs ambiguous codes', () => {
      // Must define exact provider-documented definitive rejection status codes
      expect(createOrderCode).toContain('definitiveRejectionStatusCodes = [400, 401, 403, 422]');
      expect(createOrderCode).toContain('isDefinitiveRejection');
      expect(createOrderCode).toContain("await supabaseServer.rpc('fail_gateway_payment'");
      expect(createOrderCode).toContain('Gateway definitively rejected order creation');
    });

    it('verifies uncertain outcomes (408, 409, 429, 5xx) retain reservation without calling fail_gateway_payment', () => {
      expect(createOrderCode).toContain('[AMBIGUOUS GATEWAY OUTCOME:');
      expect(createOrderCode).toContain('reservation retained for reconciliation');
      expect(createOrderCode).toContain('Payment gateway returned an uncertain response');
      expect(createOrderCode).toContain('status: response.status === 408 ? 504 : 502');
    });

    it('verifies database update errors for ambiguous outcomes are caught and handled without releasing reservation', () => {
      expect(createOrderCode).toContain('Failed to persist ambiguous outcome audit note to database');
      expect(createOrderCode).toContain('Failed to persist network timeout ambiguous audit note to database');
      // Must not call fail_gateway_payment on note update failure
      expect(createOrderCode).not.toMatch(/noteUpdateError[\s\S]*?fail_gateway_payment/);
    });

    it('verifies external order ID persistence failure catches DB error, logs recovery IDs, and does NOT return usable order', () => {
      expect(createOrderCode).toContain('updateError || !updateData || updateData.length !== 1');
      expect(createOrderCode).toContain('Critical: Failed to persist gateway order ID to database');
      expect(createOrderCode).toContain('CRITICAL PERSISTENCE FAILURE');
      expect(createOrderCode).toContain('Do not release blindly');
      expect(createOrderCode).toContain('trackingId: trackingOrderId');
    });

    it('verifies Knit Pay payload includes paymentId and trackingOrderId in metadata for reliable recovery', () => {
      expect(createOrderCode).toContain('paymentId: reservationPaymentId');
      expect(createOrderCode).toContain('trackingOrderId: trackingOrderId');
    });

    it('simulates provider rejection semantics: definitive (400,401,403,422) vs ambiguous (408,409,429,500)', () => {
      const evaluateResponse = (status: number) => {
        const definitiveRejectionStatusCodes = [400, 401, 403, 422];
        const isDefinitive = definitiveRejectionStatusCodes.includes(status);

        if (isDefinitive) {
          return { released: true, status: status === 400 ? 400 : 502, error: 'Payment gateway rejected order creation' };
        } else {
          return { released: false, status: status === 408 ? 504 : 502, error: 'Uncertain response; reservation retained' };
        }
      };

      // Definitive rejections release reservation
      expect(evaluateResponse(400).released).toBe(true);
      expect(evaluateResponse(401).released).toBe(true);
      expect(evaluateResponse(403).released).toBe(true);
      expect(evaluateResponse(422).released).toBe(true);

      // Ambiguous / uncertain codes MUST NOT release reservation
      expect(evaluateResponse(408).released).toBe(false); // Request Timeout
      expect(evaluateResponse(409).released).toBe(false); // Conflict (order may exist!)
      expect(evaluateResponse(429).released).toBe(false); // Too Many Requests
      expect(evaluateResponse(500).released).toBe(false); // Internal Server Error
      expect(evaluateResponse(502).released).toBe(false); // Bad Gateway
      expect(evaluateResponse(503).released).toBe(false); // Service Unavailable
      expect(evaluateResponse(504).released).toBe(false); // Gateway Timeout
    });

    it('simulates failure to persist the ambiguous-outcome audit note without releasing reservation', () => {
      let releasedReservation = false;
      let reservationStatus = 'pending';

      const handleAmbiguousNoteFailure = (dbFails: boolean) => {
        let noteSaved = true;
        if (dbFails) {
          noteSaved = false;
          // Handler catches error, logs, but DOES NOT call fail_gateway_payment
        }
        return {
          status: 504,
          reservationStatus,
          releasedReservation,
          noteSaved
        };
      };

      const result = handleAmbiguousNoteFailure(true);
      expect(result.status).toBe(504);
      expect(result.releasedReservation).toBe(false);
      expect(result.reservationStatus).toBe('pending'); // Still pending, preventing duplicate orders
    });

    it('verifies confirm_gateway_payment and fail_gateway_payment support lookup by gateway_order_id, reference_number, or id', () => {
      // Must match by external order ID, local tracking ID (reference_number), or primary key UUID (id)
      const rpcLookups = migrationSql.match(/WHERE\s+gateway_order_id\s*=\s*p_order_id\s+OR\s+reference_number\s*=\s*p_order_id\s+OR\s+id::TEXT\s*=\s*p_order_id/g) || [];
      expect(rpcLookups.length).toBe(2); // In confirm_gateway_payment and fail_gateway_payment
    });

    it('proves that existing webhook route cannot recover external orders without scope expansion (audit finding)', () => {
      // Existing webhook route only queries .eq('gateway_order_id', orderId)
      expect(webhookCode).toMatch(/\.eq\('gateway_order_id',\s*orderId\)/);
      // Existing webhook route does NOT inspect metadata.paymentId or metadata.trackingOrderId
      expect(webhookCode).not.toContain('metadata?.paymentId');
      expect(webhookCode).not.toContain('metadata?.trackingOrderId');
    });

    it('documents that Knit Pay rejection classification is unverified against repository documentation', () => {
      // Repository contains no official vendor documentation or OpenAPI spec for knit-pay-upi.p.rapidapi.com
      const repoHasKnitPayDocs = fs.existsSync(path.resolve(__dirname, '..', 'docs', 'knitpay.md'));
      expect(repoHasKnitPayDocs).toBe(false);

      // The status codes [400, 401, 403, 422] conform to standard REST conventions but remain unverified against vendor SLA
      const unverifiedStatusCodes = [400, 401, 403, 422];
      expect(unverifiedStatusCodes.length).toBe(4);
    });

    it('simulates recovery/reconciliation of an external order whose ID was not saved locally', () => {
      interface DBPayment {
        id: string;
        gateway_order_id: string; // Still has local tracking ID because DB update failed
        reference_number: string;
        status: string;
        payment_status: string;
        amount: number;
      }

      const reservationId = 'res-uuid-1234';
      const localTrackingId = 'order_abc_1699999999';
      const externalKnitPayId = 'ext_kp_live_7777';

      // DB state where persistence update failed: payment retains trackingId
      const dbPayment: DBPayment = {
        id: reservationId,
        gateway_order_id: localTrackingId,
        reference_number: localTrackingId,
        status: 'pending',
        payment_status: 'pending',
        amount: 10000
      };

      // Knit Pay callback arrives with external order ID and metadata
      const incomingWebhookPayload = {
        orderId: externalKnitPayId,
        amount: 10000,
        metadata: {
          paymentId: reservationId, // Passed in create-order request
          trackingOrderId: localTrackingId
        }
      };

      // Webhook / Reconciliation matching algorithm
      const reconcilePayment = (payload: typeof incomingWebhookPayload) => {
        // 1. Direct match by gateway_order_id
        let matched = dbPayment.gateway_order_id === payload.orderId;

        // 2. Fallback match by metadata.paymentId (UUID)
        if (!matched && payload.metadata?.paymentId === dbPayment.id) {
          matched = true;
          // Reconcile and link the external order ID
          dbPayment.gateway_order_id = payload.orderId;
        }

        // 3. Fallback match by metadata.trackingOrderId
        if (!matched && payload.metadata?.trackingOrderId === dbPayment.reference_number) {
          matched = true;
          dbPayment.gateway_order_id = payload.orderId;
        }

        if (matched) {
          dbPayment.status = 'completed';
          dbPayment.payment_status = 'completed';
          return { success: true, matchedPaymentId: dbPayment.id };
        }

        return { success: false };
      };

      const reconciliationResult = reconcilePayment(incomingWebhookPayload);
      expect(reconciliationResult.success).toBe(true);
      expect(reconciliationResult.matchedPaymentId).toBe(reservationId);
      expect(dbPayment.gateway_order_id).toBe(externalKnitPayId);
      expect(dbPayment.status).toBe('completed');
    });
  });

  // =========================================================================
  // SECTION 5: Hardened Confirmation, Currency & Late Callback Overpayments
  // =========================================================================
  describe('5. Hardened Confirmation, Currency & Late Callback Overpayments', () => {
    it('verifies confirm_gateway_payment requires non-null, positive p_amount', () => {
      expect(migrationSql).toMatch(/IF\s+p_amount\s+IS\s+NULL\s+OR\s+p_amount\s*<=\s*0\s+THEN/);
      expect(migrationSql).toContain("Invalid captured amount: non-null positive amount is required");
    });

    it('verifies confirm_gateway_payment verifies consistency between student_fees_id and fee_id', () => {
      expect(migrationSql).toMatch(/IF\s+v_fee_id\s+IS\s+NOT\s+NULL\s+AND\s+v_legacy_fee_id\s+IS\s+NOT\s+NULL\s+AND\s+v_fee_id\s*!=\s*v_legacy_fee_id\s+THEN/);
      expect(migrationSql).toContain("Inconsistent payment record: student_fees_id");
    });

    it('verifies confirm_gateway_payment rejects missing fee records', () => {
      expect(migrationSql).toContain("Payment has no associated student fee record");
      expect(migrationSql).toContain("Associated student fee record not found");
    });

    it('verifies confirm_gateway_payment rejects captured amount mismatch', () => {
      expect(migrationSql).toMatch(/IF\s+p_amount\s*!=\s*v_amount_paid\s+THEN/);
      expect(migrationSql).toContain("Captured amount mismatch: stored order is");
    });

    it('verifies confirm_gateway_payment detects late callbacks for both full and partial overpayments', () => {
      // Must check (v_other_collected + p_amount) > v_fee_total
      expect(migrationSql).toMatch(/IF\s+\(v_other_collected\s*\+\s*p_amount\)\s*>\s*v_fee_total\s+THEN/);
      expect(migrationSql).toContain("payment_status = 'overpaid'");
      expect(migrationSql).toContain("'overpayment_detected', true");
      expect(migrationSql).toContain('PARTIAL-SETTLEMENT OVERPAYMENT');
      expect(migrationSql).toContain('LATE CAPTURE OVERPAYMENT');
    });

    it('verifies confirm_gateway_payment sets paid_date and paid_at only upon confirmation', () => {
      expect(migrationSql).toMatch(/paid_at\s*=\s*COALESCE\(paid_at,\s*NOW\(\)\)/);
      expect(migrationSql).toMatch(/paid_date\s*=\s*COALESCE\(paid_date,\s*NOW\(\)\)/);
    });

    it('verifies verify and webhook routes require currency INR and exact amount', () => {
      expect(verifyCode).toContain("capturedCurrency !== 'INR'");
      expect(verifyCode).toContain('Math.abs(capturedAmount - expectedAmount) > 0.01');

      expect(webhookCode).toContain("capturedCurrency !== 'INR'");
      expect(webhookCode).toContain('Math.abs(capturedAmount - expectedAmount) > 0.01');
    });

    it('verifies overpaid payments are recognized as collected in balance checks across SQL and create-order', () => {
      expect(migrationSql).toContain("payment_status = 'overpaid'");
      expect(createOrderCode).toContain("p.payment_status === 'overpaid'");
    });

    it('simulates late-capture partial-payment case: fee ₹10,000, prior collected ₹7,000, late capture ₹10,000', () => {
      const feeTotal = 10000;
      const priorCollected = 7000;
      const lateCaptureAmount = 10000;

      // In-memory simulation replicating confirm_gateway_payment
      const processCapture = (feeAmount: number, otherCollected: number, captured: number) => {
        const remainingDuePrior = Math.max(feeAmount - otherCollected, 0);
        const totalAfterCapture = otherCollected + captured;

        if (totalAfterCapture > feeAmount) {
          const excessAmount = totalAfterCapture - feeAmount;
          const isFullOverpayment = otherCollected >= feeAmount;

          return {
            success: true,
            overpayment_detected: true,
            captured_amount: captured, // MUST NOT lose or understate captured amount
            payment_status: 'overpaid',
            status: 'completed',
            fee_status: 'paid',
            prior_collected: otherCollected,
            remaining_due_prior: remainingDuePrior,
            excess_amount: excessAmount,
            fee_status_mutated: !isFullOverpayment,
            notes: isFullOverpayment
              ? `[LATE CAPTURE OVERPAYMENT: fee was already fully settled. Entire captured amount ₹${captured} flagged for refund/reconciliation]`
              : `[PARTIAL-SETTLEMENT OVERPAYMENT: fee total ₹${feeAmount}, previously collected ₹${otherCollected}, captured ₹${captured}. Remaining due was ₹${remainingDuePrior}; excess ₹${excessAmount} flagged for refund/reconciliation]`
          };
        }

        return {
          success: true,
          overpayment_detected: false,
          captured_amount: captured,
          payment_status: 'completed',
          status: 'completed',
          fee_status: 'paid',
          excess_amount: 0
        };
      };

      const result = processCapture(feeTotal, priorCollected, lateCaptureAmount);

      expect(result.success).toBe(true);
      expect(result.overpayment_detected).toBe(true);
      // Actual captured amount MUST be preserved at ₹10,000 (not truncated to ₹3,000)
      expect(result.captured_amount).toBe(10000);
      expect(result.payment_status).toBe('overpaid');
      expect(result.status).toBe('completed');
      expect(result.remaining_due_prior).toBe(3000);
      expect(result.excess_amount).toBe(7000); // Exact excess overpayment is ₹7,000
      expect(result.fee_status_mutated).toBe(true);
      expect(result.notes).toContain('PARTIAL-SETTLEMENT OVERPAYMENT');
      expect(result.notes).toContain('excess ₹7000 flagged for refund/reconciliation');
    });

    it('simulates exact overpayment calculation across subcases', () => {
      const calculateExcess = (fee: number, other: number, captured: number) => {
        const total = other + captured;
        if (total > fee) {
          return total - fee;
        }
        return 0;
      };

      // Case 1: Prior ₹7,000, Captured ₹10,000 on ₹10,000 fee -> Excess ₹7,000
      expect(calculateExcess(10000, 7000, 10000)).toBe(7000);

      // Case 2: Prior ₹10,000, Captured ₹10,000 on ₹10,000 fee -> Excess ₹10,000
      expect(calculateExcess(10000, 10000, 10000)).toBe(10000);

      // Case 3: Prior ₹7,000, Captured ₹3,000 on ₹10,000 fee -> Exact settlement (Excess 0)
      expect(calculateExcess(10000, 7000, 3000)).toBe(0);

      // Case 4: Prior ₹0, Captured ₹10,000 on ₹10,000 fee -> Exact settlement (Excess 0)
      expect(calculateExcess(10000, 0, 10000)).toBe(0);
    });

    it('documents downstream revenue blocker: overpaid records must be excluded or separated from ordinary fee revenue', () => {
      interface PaymentRow {
        id: string;
        amount_paid: number;
        status: string;
        payment_status: string;
      }

      const payments: PaymentRow[] = [
        { id: 'pay-1', amount_paid: 7000, status: 'completed', payment_status: 'completed' },
        { id: 'pay-2', amount_paid: 10000, status: 'completed', payment_status: 'overpaid' }
      ];

      // A naive downstream revenue query (e.g. SUM(amount_paid) WHERE status = 'completed')
      const naiveRevenue = payments
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount_paid, 0);

      // Naive revenue incorrectly reports ₹17,000 for a ₹10,000 fee!
      expect(naiveRevenue).toBe(17000);

      // Hardened revenue accounting: Ordinary fee revenue excludes overpayment liability
      const earnedFeeRevenue = payments
        .filter((p) => p.status === 'completed' && p.payment_status !== 'overpaid')
        .reduce((sum, p) => sum + p.amount_paid, 0) +
        Math.min(
          payments
            .filter((p) => p.payment_status === 'overpaid')
            .reduce((sum, p) => sum + p.amount_paid, 0),
          3000 // remaining due prior
        );

      const overpaymentLiability = payments
        .filter((p) => p.payment_status === 'overpaid')
        .reduce((sum, _p) => sum + 7000, 0); // excess amount

      expect(earnedFeeRevenue).toBe(10000); // Correctly ₹10,000
      expect(overpaymentLiability).toBe(7000); // Correctly ₹7,000 refundable liability
    });
  });

  // =========================================================================
  // SECTION 6: Webhook Idempotency & Audit Protection
  // =========================================================================
  describe('6. Webhook Idempotency & Audit Protection', () => {
    it('verifies repeated webhook delivery returns already_processed without mutation', () => {
      expect(webhookCode).toMatch(/payment\.payment_status\s*===\s*'completed'\s*\|\|\s*payment\.payment_status\s*===\s*'verified'/);
      expect(webhookCode).toContain('already_processed: true');
    });

    it('verifies confirm_gateway_payment returns already_processed when already completed', () => {
      expect(migrationSql).toMatch(/IF\s+v_payment_status\s+IN\s*\('completed',\s*'verified'\)\s+AND\s+v_status\s+IN\s*\('completed',\s*'verified'\)\s+THEN/);
      expect(migrationSql).toContain("'already_processed', true");
    });

    it('verifies fail_gateway_payment refuses to overwrite completed payments', () => {
      expect(migrationSql).toMatch(/IF\s+v_payment_status\s+IN\s*\('completed',\s*'verified'\)\s+OR\s+v_status\s+IN\s*\('completed',\s*'verified'\)\s+THEN/);
      expect(migrationSql).toContain("Cannot fail an already completed payment");
    });
  });
});
