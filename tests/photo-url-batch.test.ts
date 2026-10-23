import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUser = vi.fn();
const mockCreateClient = vi.fn(() => ({
  auth: {
    getUser: mockGetUser,
  },
}));

const mockFrom = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  supabaseServer: {
    from: (...args: any[]) => mockFrom(...args),
    storage: {
      from: () => ({
        createSignedUrl: (...args: any[]) => mockCreateSignedUrl(...args),
      }),
    },
  },
}));

import { POST } from '@/app/api/students/photo-url/route';

const OWNER_USER_ID = '11111111-1111-1111-1111-111111111111';
const STUDENT_ID_1 = '22222222-2222-2222-2222-222222222222';
const STUDENT_ID_2 = '33333333-3333-3333-3333-333333333333';
const UNAUTHORIZED_STUDENT_ID = '99999999-9999-9999-9999-999999999999';

function buildPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/students/photo-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/students/photo-url (Batch Resolution)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Not logged in' } });

    const res = await POST(buildPostRequest({ student_ids: [STUDENT_ID_1] }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('rejects invalid student ID format with 400', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_USER_ID } }, error: null });

    const res = await POST(buildPostRequest({ student_ids: ['invalid-uuid'] }));
    expect(res.status).toBe(400);
  });

  it('resolves batch photos in a single request enforcing owner authorization isolation', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_USER_ID } }, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'prof-owner', role: 'hostel_owner' },
          }),
        };
      }
      if (table === 'students') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: STUDENT_ID_1,
                profiles: { avatar_url: 'https://cdn.example.com/external-photo.jpg' },
              },
              {
                id: STUDENT_ID_2,
                profiles: { avatar_url: 'avatars/internal-avatar.jpg' },
              },
            ],
          }),
        };
      }
      if (table === 'room_allocations') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            // Only STUDENT_ID_1 and STUDENT_ID_2 are owned by this owner; UNAUTHORIZED_STUDENT_ID is not
            data: [
              { student_id: STUDENT_ID_1 },
              { student_id: STUDENT_ID_2 },
            ],
          }),
        };
      }
      if (table === 'room_requests') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [] }),
      };
    });

    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://supabase.co/signed/internal-avatar.jpg' },
      error: null,
    });

    const res = await POST(
      buildPostRequest({
        student_ids: [STUDENT_ID_1, STUDENT_ID_2, UNAUTHORIZED_STUDENT_ID],
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();

    // Contains authorized students' photos
    expect(data.photos[STUDENT_ID_1]).toBe('https://cdn.example.com/external-photo.jpg');
    expect(data.photos[STUDENT_ID_2]).toBe('https://supabase.co/signed/internal-avatar.jpg');

    // Unauthorized student was excluded by tenant isolation
    expect(data.photos[UNAUTHORIZED_STUDENT_ID]).toBeUndefined();
  });
});
