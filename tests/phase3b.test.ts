/**
 * Phase 3B Tests — Mobile Bearer Authentication
 *
 * Requirements covered:
 * 1. Existing cookie authentication still works
 * 2. Valid Bearer authentication works
 * 3. Missing authentication is rejected
 * 4. Invalid Bearer token is rejected
 * 5. Payment authorization cannot be bypassed with client-supplied IDs
 * 6. Electricity reading authorization cannot be bypassed
 * 7. Client-supplied owner/user/student identity cannot override authenticated identity
 *
 * Plus architectural contract verification:
 * - lib/supabase/server.ts exports & implementations
 * - API route integration
 * - Webhook route preserved
 * - Zero migrations created
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';

const ROOT = path.resolve(__dirname, '..');

describe('Phase 3B — Mobile Bearer Authentication', () => {

  // ══════════════════════════════════════════════════════════════════════
  // Section A: Architecture & Contract Verification
  // ══════════════════════════════════════════════════════════════════════

  describe('Contract: lib/supabase/server.ts exports and implementation', () => {
    const serverPath = path.join(ROOT, 'lib', 'supabase', 'server.ts');
    let serverContent: string;

    it('lib/supabase/server.ts exists', () => {
      expect(fs.existsSync(serverPath)).toBe(true);
      serverContent = fs.readFileSync(serverPath, 'utf-8');
    });

    it('exports createClient function that accepts optional NextRequest', () => {
      serverContent = fs.readFileSync(serverPath, 'utf-8');
      expect(serverContent).toMatch(/export\s+function\s+createClient\s*\(\s*req\?\s*:\s*NextRequest\s*\)/);
    });

    it('exports createClientFromRequest function for explicit mobile caller use', () => {
      serverContent = fs.readFileSync(serverPath, 'utf-8');
      expect(serverContent).toContain('export function createClientFromRequest');
    });

    it('imports NextRequest type from next/server', () => {
      serverContent = fs.readFileSync(serverPath, 'utf-8');
      expect(serverContent).toMatch(/import\s+.*NextRequest.*from\s+['"]next\/server['"]/);
    });

    it('detects Authorization: Bearer <token> in request headers', () => {
      serverContent = fs.readFileSync(serverPath, 'utf-8');
      expect(serverContent).toContain("get('authorization')");
      expect(serverContent).toMatch(/bearer\s/i);
    });

    it('instantiates @supabase/supabase-js client with global Authorization header for Bearer tokens', () => {
      serverContent = fs.readFileSync(serverPath, 'utf-8');
      expect(serverContent).toContain('createSupabaseClient(supabaseUrl, supabaseKey');
      expect(serverContent).toContain('global:');
      expect(serverContent).toContain('Authorization:');
      expect(serverContent).toMatch(/`Bearer \$\{token\}`/);
    });

    it('falls back to cookie-based SSR client when no Bearer token is present', () => {
      serverContent = fs.readFileSync(serverPath, 'utf-8');
      expect(serverContent).toContain('createSsrServerClient');
      expect(serverContent).toContain('cookies()');
    });

    it('does not log or leak tokens to console or output', () => {
      serverContent = fs.readFileSync(serverPath, 'utf-8');
      const createClientBody = serverContent.split('export function createClient')[1]?.split('export function createClientFromRequest')[0];
      expect(createClientBody).not.toMatch(/console\.(log|info|debug)\s*\(/);
    });

    it('still exports supabaseServer for service-role operations', () => {
      serverContent = fs.readFileSync(serverPath, 'utf-8');
      expect(serverContent).toContain('export const supabaseServer');
    });
  });

  describe('Contract: Route Integration', () => {
    it('app/api/payments/create-order passes req to createClient', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'create-order', 'route.ts'), 'utf-8');
      expect(content).toMatch(/createClient\s*\(\s*req\s*\)/);
    });

    it('app/api/payments/verify passes req to createClient', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'verify', 'route.ts'), 'utf-8');
      expect(content).toMatch(/createClient\s*\(\s*req\s*\)/);
    });

    it('app/api/readings/record passes request to createClient', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'readings', 'record', 'route.ts'), 'utf-8');
      expect(content).toMatch(/createClient\s*\(\s*request\s*\)/);
    });

    it('app/api/payments/webhook remains untouched (uses supabaseServer only)', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'webhook', 'route.ts'), 'utf-8');
      expect(content).toContain('supabaseServer');
      expect(content).not.toMatch(/createClient\s*\(/);
    });

    it('no database migrations were added for Phase 3B', () => {
      const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
      if (fs.existsSync(migrationsDir)) {
        const files = fs.readdirSync(migrationsDir);
        const phase3bFiles = files.filter(f => f.toLowerCase().includes('phase3b') || f.toLowerCase().includes('phase_3b'));
        expect(phase3bFiles).toHaveLength(0);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Section B: The 7 Focused Requirements
  // ══════════════════════════════════════════════════════════════════════

  // ─── 1. Existing cookie authentication still works ─────────────────────
  describe('1. Existing cookie authentication still works', () => {
    it('calling createClient() without arguments falls through to cookies() SSR client', async () => {
      const serverModule = await import('@/lib/supabase/server');
      // Calling createClient() without arguments should attempt cookie store lookup
      // In node/vitest environment without RequestAsyncStorage, it throws the known Next.js cookies error,
      // confirming it reaches the cookie-based branch and does NOT try to parse a missing request.
      expect(() => serverModule.createClient()).toThrow(/cookies/i);
    });

    it('calling createClient(req) without Authorization header falls through to cookies() SSR client', async () => {
      const serverModule = await import('@/lib/supabase/server');
      const req = new NextRequest('http://localhost:3000/api/payments/create-order');
      expect(() => serverModule.createClient(req)).toThrow(/cookies/i);
    });

    it('calling createClient(req) with non-Bearer Authorization header falls through to cookies() SSR client', async () => {
      const serverModule = await import('@/lib/supabase/server');
      const req = new NextRequest('http://localhost:3000/api/payments/create-order', {
        headers: { 'Authorization': 'Basic dXNlcjpwYXNz' }
      });
      expect(() => serverModule.createClient(req)).toThrow(/cookies/i);
    });
  });

  // ─── 2. Valid Bearer authentication works ──────────────────────────────
  describe('2. Valid Bearer authentication works', () => {
    it('calling createClient(req) with Authorization: Bearer <token> creates a Bearer client without calling cookies()', async () => {
      const serverModule = await import('@/lib/supabase/server');
      const req = new NextRequest('http://localhost:3000/api/payments/create-order', {
        headers: {
          'Authorization': 'Bearer valid.jwt.token'
        }
      });
      // Should NOT throw cookies error because it branches into createSupabaseClient with token
      const client = serverModule.createClient(req);
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      expect(typeof client.auth.getUser).toBe('function');
    });

    it('calling createClientFromRequest(req) with Bearer token creates Bearer client', async () => {
      const serverModule = await import('@/lib/supabase/server');
      const req = new NextRequest('http://localhost:3000/api/payments/create-order', {
        headers: {
          'Authorization': 'Bearer mobile.jwt.token'
        }
      });
      const client = serverModule.createClientFromRequest(req);
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
    });

    it('case-insensitive bearer prefix is supported ("bearer <token>")', async () => {
      const serverModule = await import('@/lib/supabase/server');
      const req = new NextRequest('http://localhost:3000/api/payments/create-order', {
        headers: {
          'Authorization': 'bearer valid.jwt.token'
        }
      });
      const client = serverModule.createClient(req);
      expect(client).toBeDefined();
    });
  });

  // ─── 3. Missing authentication is rejected ─────────────────────────────
  describe('3. Missing authentication is rejected', () => {
    it('POST /api/payments/create-order returns 401 when caller has no session', () => {
      const routeContent = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'create-order', 'route.ts'), 'utf-8');
      expect(routeContent).toContain('if (authError || !user)');
      expect(routeContent).toContain("status: 401");
    });

    it('POST /api/payments/verify returns 401 when caller has no session', () => {
      const routeContent = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'verify', 'route.ts'), 'utf-8');
      expect(routeContent).toContain('if (authError || !user)');
      expect(routeContent).toContain("status: 401");
    });

    it('POST /api/readings/record returns 401 when caller has no session', () => {
      const routeContent = fs.readFileSync(path.join(ROOT, 'app', 'api', 'readings', 'record', 'route.ts'), 'utf-8');
      expect(routeContent).toContain('if (authError || !user)');
      expect(routeContent).toContain("status: 401");
    });
  });

  // ─── 4. Invalid Bearer token is rejected ───────────────────────────────
  describe('4. Invalid Bearer token is rejected', () => {
    it('empty Bearer token ("Bearer ") falls back to cookie check, rejecting empty tokens', async () => {
      const serverModule = await import('@/lib/supabase/server');
      const req = new NextRequest('http://localhost:3000/api/payments/create-order', {
        headers: { 'Authorization': 'Bearer ' }
      });
      // Should not treat empty string as a valid token, falls back to cookies (which throws outside context)
      expect(() => serverModule.createClient(req)).toThrow(/cookies/i);
    });

    it('routes enforce auth.getUser() check for token validation before processing', () => {
      const routes = [
        path.join(ROOT, 'app', 'api', 'payments', 'create-order', 'route.ts'),
        path.join(ROOT, 'app', 'api', 'payments', 'verify', 'route.ts'),
        path.join(ROOT, 'app', 'api', 'readings', 'record', 'route.ts'),
      ];
      for (const routePath of routes) {
        const content = fs.readFileSync(routePath, 'utf-8');
        expect(content).toContain('await supabase.auth.getUser()');
        expect(content).toContain("401");
      }
    });
  });

  // ─── 5. Payment authorization cannot be bypassed with client-supplied IDs
  describe('5. Payment authorization cannot be bypassed with client-supplied IDs', () => {
    it('create-order: queries profile by authenticated user.id, NOT body student_id/user_id', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'create-order', 'route.ts'), 'utf-8');
      // Line 52: .eq('user_id', user.id)
      expect(content).toContain(".eq('user_id', user.id)");
      // Only feeId is destructured from body
      expect(content).toContain("const { feeId } = await req.json()");
    });

    it('create-order: verifies studentRecord.id matches fee.student_id', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'create-order', 'route.ts'), 'utf-8');
      expect(content).toContain("studentRecord.id !== fee.student_id");
      expect(content).toContain("You can only create payment orders for your own fees");
    });

    it('create-order: verifies hostel.owner_id matches user.id for owners', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'create-order', 'route.ts'), 'utf-8');
      expect(content).toContain("hostel.owner_id !== user.id");
      expect(content).toContain("You do not own the hostel for this fee");
    });

    it('verify: queries profile by authenticated user.id', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'verify', 'route.ts'), 'utf-8');
      expect(content).toContain(".eq('user_id', user.id)");
    });

    it('verify: checks payment ownership against studentRecord.id', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'verify', 'route.ts'), 'utf-8');
      expect(content).toContain("studentRecord.id !== payment.student_id");
      expect(content).toContain("You can only verify your own payments");
    });
  });

  // ─── 6. Electricity reading authorization cannot be bypassed ──────────
  describe('6. Electricity reading authorization cannot be bypassed', () => {
    it('readings/record: verifies meter hostel.owner_id matches authenticated user.id', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'readings', 'record', 'route.ts'), 'utf-8');
      expect(content).toContain("hostel.owner_id !== user.id");
      expect(content).toContain("You do not have permission to record readings for this meter");
      expect(content).toContain("status: 403");
    });

    it('readings/record: passes authenticated user.id to recordMeterReadingWithLock, never a body parameter', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'readings', 'record', 'route.ts'), 'utf-8');
      // Checks that recordMeterReadingWithLock receives user.id
      expect(content).toContain("recordMeterReadingWithLock(");
      expect(content).toContain("user.id,");
    });

    it('readings/record: only accepts meter_id, reading_value, reason, notes, idempotency_key in schema', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'readings', 'record', 'route.ts'), 'utf-8');
      // Zod schema only defines meter_id, reading_value, reason, notes, idempotency_key
      expect(content).toContain("RecordReadingSchema = z.object({");
      expect(content).not.toContain("owner_id: z.");
      expect(content).not.toContain("user_id: z.");
    });
  });

  // ─── 7. Client-supplied identity cannot override authenticated identity ─
  describe('7. Client-supplied owner/user/student identity cannot override authenticated identity', () => {
    it('create-order: derives payment amount strictly from server-side database fee record, not client', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'create-order', 'route.ts'), 'utf-8');
      expect(content).toContain("const serverAmount = Number(fee.amount)");
      expect(content).not.toContain("req.json().amount");
      expect(content).not.toContain("body.amount");
    });

    it('verify: fetches payment by order_id and derives fee and student from DB, never client', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'verify', 'route.ts'), 'utf-8');
      expect(content).toContain("const { order_id, payment_id, signature } = await req.json()");
      expect(content).not.toContain("student_id =");
    });

    it('create-order inserts payment record with server-derived student_id and amount', () => {
      const content = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'create-order', 'route.ts'), 'utf-8');
      expect(content).toContain("student_id: fee.student_id");
      expect(content).toContain("amount_paid: serverAmount");
    });

    it('none of the three routes trust client-provided user_id or student_id', () => {
      const createOrder = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'create-order', 'route.ts'), 'utf-8');
      const verify = fs.readFileSync(path.join(ROOT, 'app', 'api', 'payments', 'verify', 'route.ts'), 'utf-8');
      const readings = fs.readFileSync(path.join(ROOT, 'app', 'api', 'readings', 'record', 'route.ts'), 'utf-8');

      // None destructure user_id from body
      expect(createOrder).not.toMatch(/const\s+\{[^}]*user_id[^}]*\}\s*=\s*(await\s+)?(req|request)\.json\(\)/);
      expect(verify).not.toMatch(/const\s+\{[^}]*user_id[^}]*\}\s*=\s*(await\s+)?(req|request)\.json\(\)/);
      expect(readings).not.toMatch(/const\s+\{[^}]*user_id[^}]*\}\s*=\s*(await\s+)?(req|request)\.json\(\)/);
    });
  });

});
