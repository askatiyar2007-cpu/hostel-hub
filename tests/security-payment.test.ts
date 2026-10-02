import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock lib/supabase/server
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No session') })
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    }))
  })),
  supabaseServer: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis()
    }))
  }
}));

// Mock @supabase/ssr for middleware
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No user session') })
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  }))
}));

import { POST as createOrderPOST } from '../app/api/payments/create-order/route';
import { POST as verifyPOST } from '../app/api/payments/verify/route';
import { POST as webhookPOST } from '../app/api/payments/webhook/route';
import { middleware } from '../middleware';

describe('P0/P1 Security Lockdown Verification', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
    process.env.KNITPAY_WEBHOOK_SECRET = 'test_secret_key_12345';
  });

  describe('P0-1: Middleware Route Protection', () => {
    test('blocks unauthenticated access to /owner/dashboard and redirects to /auth/login', async () => {
      const req = new NextRequest('http://localhost:3000/owner/dashboard');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/auth/login');
    });

    test('blocks unauthenticated access to /student/dashboard and redirects to /auth/login', async () => {
      const req = new NextRequest('http://localhost:3000/student/dashboard');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/auth/login');
    });

    test('blocks unauthenticated access to /admin/dashboard and redirects to /auth/login', async () => {
      const req = new NextRequest('http://localhost:3000/admin/dashboard');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/auth/login');
    });

    test('blocks unauthenticated access to /parent/dashboard and redirects to /auth/login', async () => {
      const req = new NextRequest('http://localhost:3000/parent/dashboard');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/auth/login');
    });

    test('allows public access to landing page / without redirecting to login', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    test('allows public access to /find-hostel without redirecting to login', async () => {
      const req = new NextRequest('http://localhost:3000/find-hostel');
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });
  });

  describe('P1 & P0-5: Payment Authorization & Verification', () => {
    test('P1: /api/payments/create-order rejects unauthenticated callers', async () => {
      const req = new NextRequest('http://localhost:3000/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fee_id: '00000000-0000-0000-0000-000000000001',
          amount: 5000,
          purpose: 'hostel_fee'
        })
      });
      const res = await createOrderPOST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Authentication required|Unauthorized/i);
    });

    test('P0-5: /api/payments/verify rejects unauthenticated callers', async () => {
      const req = new NextRequest('http://localhost:3000/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: 'order_123',
          payment_id: 'pay_123',
          signature: 'mock_signature'
        })
      });
      const res = await verifyPOST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Authentication required|Unauthorized/i);
    });
  });

  describe('P0-4: Payment Webhook Cryptographic Verification', () => {
    test('rejects webhook requests when signature header is missing completely', async () => {
      const req = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: 'order_123',
          status: 'SUCCESS'
        })
      });
      const res = await webhookPOST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Missing webhook signature/i);
    });

    test('rejects webhook requests with invalid HMAC signature', async () => {
      const req = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-knitpay-signature': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        },
        body: JSON.stringify({
          order_id: 'order_123',
          status: 'SUCCESS'
        })
      });
      const res = await webhookPOST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Invalid webhook signature/i);
    });
  });
});
