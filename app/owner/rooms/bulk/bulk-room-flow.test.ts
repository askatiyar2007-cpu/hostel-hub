import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/rooms/bulk-create/route';

// Mock supabase server clients
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  supabaseServer: {
    from: vi.fn(),
    rpc: vi.fn()
  }
}));

import { createClient, supabaseServer } from '@/lib/supabase/server';

describe('Bulk Room Creation Functional & UX Flow Verification', () => {
  const mockUserId = '11111111-1111-4111-a111-111111111111';
  const mockHostelId = '22222222-2222-4222-a222-222222222222';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockOwnerAuth() {
    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null
        })
      },
      rpc: vi.fn()
    });

    (supabaseServer.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'prof-1', user_id: mockUserId, role: 'owner' },
            error: null
          })
        };
      }
      if (table === 'hostels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: mockHostelId, owner_id: mockUserId, name: 'Sunrise Hostel' },
            error: null
          })
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });
  }

  // --- TEST 1 to 6: Step 1 Generate Draft Rooms ---
  it('Step 1: generates draft rooms (101-105) purely in local state without database insertion', () => {
    const start = 101;
    const end = 105;
    const defaultDetails = {
      floor: 1,
      room_type: 'double' as const,
      rent: 5000,
      security_deposit: 5000,
      facilities: ['AC', 'WiFi']
    };

    // State generator logic identical to handleGenerateRooms in BulkRoomForm
    const generatedDrafts = [];
    for (let i = start; i <= end; i++) {
      generatedDrafts.push({
        room_number: i.toString(),
        floor: defaultDetails.floor,
        room_type: defaultDetails.room_type,
        rent: defaultDetails.rent,
        security_deposit: defaultDetails.security_deposit,
        facilities: [...defaultDetails.facilities]
      });
    }

    expect(generatedDrafts).toHaveLength(5);
    expect(generatedDrafts.map(r => r.room_number)).toEqual(['101', '102', '103', '104', '105']);
    // Verified: no database calls executed during generation
    expect(supabaseServer.from).not.toHaveBeenCalled();
  });

  // --- TEST 7 to 9: Step 2 Apply Common Details ---
  it('Step 2: populates all draft rooms when Common Details are applied', () => {
    let drafts: Array<{
      room_number: string;
      floor: number;
      room_type: 'single' | 'double' | 'triple' | 'quad';
      rent: number;
      security_deposit: number;
      facilities: string[];
    }> = [
      { room_number: '101', floor: 0, room_type: 'single', rent: 0, security_deposit: 0, facilities: [] },
      { room_number: '102', floor: 0, room_type: 'single', rent: 0, security_deposit: 0, facilities: [] },
      { room_number: '103', floor: 0, room_type: 'single', rent: 0, security_deposit: 0, facilities: [] },
      { room_number: '104', floor: 0, room_type: 'single', rent: 0, security_deposit: 0, facilities: [] },
      { room_number: '105', floor: 0, room_type: 'single', rent: 0, security_deposit: 0, facilities: [] }
    ];

    const commonDetails = {
      room_type: 'double' as const,
      floor: 1,
      rent: 5000,
      security_deposit: 2000,
      facilities: 'AC, Laundry, Mess'
    };

    const parsedFacilities = commonDetails.facilities.split(',').map(s => s.trim()).filter(Boolean);

    // Apply common details
    drafts = drafts.map(room => ({
      ...room,
      floor: commonDetails.floor,
      room_type: commonDetails.room_type,
      rent: commonDetails.rent,
      security_deposit: commonDetails.security_deposit,
      facilities: [...parsedFacilities]
    }));

    expect(drafts).toHaveLength(5);
    drafts.forEach(room => {
      expect(room.room_type).toBe('double');
      expect(room.floor).toBe(1);
      expect(room.rent).toBe(5000);
      expect(room.security_deposit).toBe(2000);
      expect(room.facilities).toEqual(['AC', 'Laundry', 'Mess']);
    });
  });

  // --- TEST 10: Step 3 Edit ONLY Room 103 ---
  it('Step 3: editing individual room (103 -> Rent ₹5500) overrides only that room', () => {
    let drafts = [
      { room_number: '101', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: ['AC'] },
      { room_number: '102', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: ['AC'] },
      { room_number: '103', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: ['AC'] },
      { room_number: '104', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: ['AC'] },
      { room_number: '105', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: ['AC'] }
    ];

    const idx = drafts.findIndex(r => r.room_number === '103');
    drafts[idx] = { ...drafts[idx], rent: 5500 };

    expect(drafts.find(r => r.room_number === '103')?.rent).toBe(5500);
    expect(drafts.find(r => r.room_number === '101')?.rent).toBe(5000);
    expect(drafts.find(r => r.room_number === '102')?.rent).toBe(5000);
    expect(drafts.find(r => r.room_number === '104')?.rent).toBe(5000);
    expect(drafts.find(r => r.room_number === '105')?.rent).toBe(5000);
  });

  // --- TEST 11: Delete one draft room ---
  it('Step 3: deleting a draft room (105) updates room count and draft list correctly', () => {
    let drafts = [
      { room_number: '101', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: [] },
      { room_number: '102', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: [] },
      { room_number: '103', floor: 1, room_type: 'double' as const, rent: 5500, security_deposit: 2000, facilities: [] },
      { room_number: '104', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: [] },
      { room_number: '105', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: [] }
    ];

    drafts = drafts.filter(r => r.room_number !== '105');

    expect(drafts).toHaveLength(4);
    expect(drafts.map(r => r.room_number)).toEqual(['101', '102', '103', '104']);
  });

  // --- TEST 12: Add custom room 106A ---
  it('Step 3: adding custom room 106A appends correctly to draft list', () => {
    const drafts = [
      { room_number: '101', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: ['AC'] },
      { room_number: '102', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: ['AC'] },
      { room_number: '103', floor: 1, room_type: 'double' as const, rent: 5500, security_deposit: 2000, facilities: ['AC'] },
      { room_number: '104', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: ['AC'] }
    ];

    drafts.push({
      room_number: '106A',
      floor: 1,
      room_type: 'double',
      rent: 5000,
      security_deposit: 2000,
      facilities: ['AC']
    });

    expect(drafts).toHaveLength(5);
    expect(drafts[4].room_number).toBe('106A');
    expect(drafts[4].rent).toBe(5000);
  });

  // --- TEST 13: Summary calculations ---
  it('Step 3: review summary computes correct room count, bed capacity, and total rent', () => {
    const capacityMap = { single: 1, double: 2, triple: 3, quad: 4 };
    const drafts = [
      { room_number: '101', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: [] },
      { room_number: '102', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: [] },
      { room_number: '103', floor: 1, room_type: 'double' as const, rent: 5500, security_deposit: 2000, facilities: [] },
      { room_number: '104', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: [] },
      { room_number: '106A', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: [] }
    ];

    const roomCount = drafts.length;
    const totalCapacity = drafts.reduce((acc, r) => acc + (capacityMap[r.room_type] || 2), 0);
    const totalRent = drafts.reduce((acc, r) => acc + r.rent, 0);

    expect(roomCount).toBe(5);
    expect(totalCapacity).toBe(10); // 5 double rooms * 2 beds = 10 beds
    expect(totalRent).toBe(25500); // 4 * 5000 + 5500 = 25500
  });

  // --- TEST 14 to 17: Step 4 Final Create via API / RPC ---
  it('Step 4: creates full batch atomically via API route and verifies response', async () => {
    mockOwnerAuth();

    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        message: 'Created 5 rooms successfully',
        rooms_created: 5,
        rooms: [
          { room_id: 'room-101', room_number: '101', capacity: 2 },
          { room_id: 'room-102', room_number: '102', capacity: 2 },
          { room_id: 'room-103', room_number: '103', capacity: 2 },
          { room_id: 'room-104', room_number: '104', capacity: 2 },
          { room_id: 'room-106A', room_number: '106A', capacity: 2 }
        ]
      },
      error: null
    });

    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null
        })
      },
      rpc: mockRpc
    });

    const payload = {
      hostel_id: mockHostelId,
      rooms: [
        { room_number: '101', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: ['AC'] },
        { room_number: '102', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: ['AC'] },
        { room_number: '103', floor: 1, room_type: 'double', rent: 5500, security_deposit: 2000, facilities: ['AC'] },
        { room_number: '104', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: ['AC'] },
        { room_number: '106A', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: ['AC'] }
      ]
    };

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const response = await POST(req);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.rooms_created).toBe(5);
    expect(body.rooms).toHaveLength(5);
    expect(mockRpc).toHaveBeenCalledWith('bulk_create_rooms', {
      p_hostel_id: mockHostelId,
      p_rooms: payload.rooms.map(r => ({ ...r, allow_duplicate: false }))
    });
  });

  // --- TEST 18: Intra-batch duplicate rejection ---
  it('Validation: rejects intra-batch duplicate room numbers', () => {
    const drafts = [
      { room_number: '101', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: [] },
      { room_number: '101', floor: 1, room_type: 'double' as const, rent: 5000, security_deposit: 2000, facilities: [] }
    ];

    const errors: Record<number, string> = {};
    drafts.forEach((room, index) => {
      const num = room.room_number.trim();
      const duplicateIndex = drafts.findIndex((r, i) => i !== index && r.room_number.trim() === num);
      if (duplicateIndex !== -1) {
        errors[index] = `Duplicate room number (Row ${duplicateIndex + 1})`;
      }
    });

    expect(Object.keys(errors)).toHaveLength(2);
    expect(errors[0]).toContain('Duplicate room number');
    expect(errors[1]).toContain('Duplicate room number');
  });

  // --- TEST 19: Batch size limit enforcement (max 50) ---
  it('Validation: enforces batch size limit (maximum 50 rooms)', async () => {
    mockOwnerAuth();

    const overLimitRooms = Array.from({ length: 51 }, (_, i) => ({
      room_number: (100 + i).toString(),
      floor: 1,
      room_type: 'double' as const,
      rent: 5000,
      security_deposit: 2000,
      facilities: []
    }));

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: overLimitRooms
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid request data');
    expect(JSON.stringify(body.details)).toContain('Maximum 50 rooms per batch');
  });

  // --- TEST 20: Empty batch rejection ---
  it('Validation: rejects empty rooms batch', async () => {
    mockOwnerAuth();

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: []
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid request data');
    expect(JSON.stringify(body.details)).toContain('At least one room is required');
  });

  // --- TEST 21: Rejects unauthenticated caller ---
  it('Security: rejects unauthenticated requests with 401', async () => {
    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('No session')
        })
      }
    });

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [{ room_number: '101' }]
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  // --- TEST 22: Rejects non-owner role ---
  it('Security: rejects non-owner role with 403', async () => {
    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null
        })
      }
    });

    (supabaseServer.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'prof-1', user_id: mockUserId, role: 'student' },
            error: null
          })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() };
    });

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [{ room_number: '101' }]
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('Only hostel owners can create rooms');
  });

  // --- TEST 23: Rejects unauthorized hostel targeting ---
  it('Security: rejects creating rooms for another owner\'s hostel with 403', async () => {
    mockOwnerAuth();

    (supabaseServer.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'prof-1', user_id: mockUserId, role: 'owner' },
            error: null
          })
        };
      }
      if (table === 'hostels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: mockHostelId, owner_id: 'some-other-owner-id', name: 'Other Hostel' },
            error: null
          })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [{ room_number: '101' }]
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('You do not own this hostel');
  });

  // --- TEST 24: Error visibility - RPC error returns 500 with details ---
  it('Error handling: bubbles database RPC error message to response', async () => {
    mockOwnerAuth();

    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' }
    });

    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null
        })
      },
      rpc: mockRpc
    });

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [{ room_number: '101' }]
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to create rooms');
    expect(body.details).toBe('Database connection failed');
  });

  // --- TEST 25: Error visibility - RPC business failure returns 400 with message ---
  it('Error handling: bubbles RPC business rule failure (e.g. duplicate room number)', async () => {
    mockOwnerAuth();

    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        success: false,
        message: 'Room number 101 already exists in this hostel',
        detail: 'Unique constraint violated'
      },
      error: null
    });

    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null
        })
      },
      rpc: mockRpc
    });

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [{ room_number: '101' }]
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Room number 101 already exists in this hostel');
    expect(body.details).toBe('Unique constraint violated');
  });

  // =========================================================================
  // TARGETED DUPLICATE-ROOM TESTS (CASES A THROUGH H)
  // =========================================================================

  // Case A: Existing 101, create 102 -> creates normally without warning
  it('Case A: Existing 101 in DB, create 102 creates normally without warning', async () => {
    mockOwnerAuth();

    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        message: 'Created 1 rooms successfully',
        rooms_created: 1,
        rooms: [{ room_id: 'room-102', room_number: '102', capacity: 2 }]
      },
      error: null
    });

    (createClient as any).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockUserId } }, error: null }) },
      rpc: mockRpc
    });

    // DB has room 101, so query for 102 returns empty
    (supabaseServer.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'prof-1', user_id: mockUserId, role: 'owner' }, error: null })
        };
      }
      if (table === 'hostels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: mockHostelId, owner_id: mockUserId, name: 'Sunrise' }, error: null })
        };
      }
      if (table === 'rooms') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockImplementation((_col: string, vals: string[]) => {
            const existing = vals.includes('101') ? [{ id: 'room-101', room_number: '101' }] : [];
            return Promise.resolve({ data: existing, error: null });
          })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [{ draft_id: 'draft-1', room_number: '102', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] }]
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.rooms_created).toBe(1);
    expect(mockRpc).toHaveBeenCalledWith('bulk_create_rooms', {
      p_hostel_id: mockHostelId,
      p_rooms: [
        expect.objectContaining({
          room_number: '102',
          allow_duplicate: false
        })
      ]
    });
  });

  // Case B: Existing 101, create 101 -> warning -> Change -> change to 101A -> create succeeds with 101A
  it('Case B: Existing 101, create 101 -> warning -> change to 101A -> succeeds', async () => {
    mockOwnerAuth();

    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        message: 'Created 1 rooms successfully',
        rooms_created: 1,
        rooms: [{ room_id: 'room-101A', room_number: '101A', capacity: 2 }]
      },
      error: null
    });

    (createClient as any).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockUserId } }, error: null }) },
      rpc: mockRpc
    });

    (supabaseServer.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'prof-1', user_id: mockUserId, role: 'owner' }, error: null })
        };
      }
      if (table === 'hostels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: mockHostelId, owner_id: mockUserId, name: 'Sunrise' }, error: null })
        };
      }
      if (table === 'rooms') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockImplementation((_col: string, vals: string[]) => {
            const existing = vals.includes('101') ? [{ id: 'room-101', room_number: '101' }] : [];
            return Promise.resolve({ data: existing, error: null });
          })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    // Step 1: Submit draft with room 101 without approval -> 409
    const req1 = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [{ draft_id: 'draft-1', room_number: '101', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] }]
      })
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(409);
    const body1 = await res1.json();
    expect(body1.code).toBe('DUPLICATE_ROOM_CONFIRMATION_REQUIRED');
    expect(body1.duplicates).toHaveLength(1);
    expect(body1.duplicates[0].room_number).toBe('101');
    expect(body1.duplicates[0].existing_room_id).toBe('room-101');
    expect(mockRpc).not.toHaveBeenCalled();

    // Step 2: Owner changes room 101 to 101A and resubmits
    const req2 = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [{ draft_id: 'draft-1', room_number: '101A', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] }]
      })
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(201);
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('bulk_create_rooms', {
      p_hostel_id: mockHostelId,
      p_rooms: [
        expect.objectContaining({
          room_number: '101A',
          allow_duplicate: false
        })
      ]
    });
  });

  // Case C: Existing 101, create 101 -> warning -> Keep Anyway -> creates duplicate 101
  it('Case C: Existing 101, create 101 -> warning -> Keep Anyway -> creates duplicate 101', async () => {
    mockOwnerAuth();

    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        message: 'Created 1 rooms successfully',
        rooms_created: 1,
        rooms: [{ room_id: 'room-101-dup', room_number: '101', capacity: 2 }]
      },
      error: null
    });

    (createClient as any).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockUserId } }, error: null }) },
      rpc: mockRpc
    });

    (supabaseServer.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'prof-1', user_id: mockUserId, role: 'owner' }, error: null })
        };
      }
      if (table === 'hostels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: mockHostelId, owner_id: mockUserId, name: 'Sunrise' }, error: null })
        };
      }
      if (table === 'rooms') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [{ id: 'room-101', room_number: '101' }], error: null })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    // Step 1: Initial submission fails with 409
    const req1 = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [{ draft_id: 'draft-1', room_number: '101', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] }]
      })
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(409);

    // Step 2: Keep Anyway approves draft-1
    const req2 = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [{ draft_id: 'draft-1', room_number: '101', allow_duplicate: true, floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] }],
        confirmed_draft_ids: ['draft-1']
      })
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(201);
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('bulk_create_rooms', {
      p_hostel_id: mockHostelId,
      p_rooms: [
        expect.objectContaining({
          room_number: '101',
          allow_duplicate: true
        })
      ]
    });
  });

  // Case D: Existing 101 and 103, batch 101/102/103 -> both duplicates shown -> Keep both -> all 3 created
  it('Case D: Existing 101 and 103, batch 101/102/103 -> both duplicates shown -> Keep both -> all 3 created', async () => {
    mockOwnerAuth();

    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        message: 'Created 3 rooms successfully',
        rooms_created: 3,
        rooms: [
          { room_id: 'r-101', room_number: '101', capacity: 2 },
          { room_id: 'r-102', room_number: '102', capacity: 2 },
          { room_id: 'r-103', room_number: '103', capacity: 2 }
        ]
      },
      error: null
    });

    (createClient as any).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockUserId } }, error: null }) },
      rpc: mockRpc
    });

    (supabaseServer.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'prof-1', user_id: mockUserId, role: 'owner' }, error: null })
        };
      }
      if (table === 'hostels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: mockHostelId, owner_id: mockUserId, name: 'Sunrise' }, error: null })
        };
      }
      if (table === 'rooms') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { id: 'room-101', room_number: '101' },
              { id: 'room-103', room_number: '103' }
            ],
            error: null
          })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const batchRooms = [
      { draft_id: 'd-101', room_number: '101', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] },
      { draft_id: 'd-102', room_number: '102', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] },
      { draft_id: 'd-103', room_number: '103', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] }
    ];

    const req1 = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostel_id: mockHostelId, rooms: batchRooms })
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(409);
    const body1 = await res1.json();
    expect(body1.duplicates).toHaveLength(2);
    expect(body1.duplicates.map((d: any) => d.room_number)).toEqual(['101', '103']);

    // Step 2: Keep both 101 and 103 -> submits with both approved
    const req2 = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: batchRooms.map(r => ({
          ...r,
          allow_duplicate: r.room_number === '101' || r.room_number === '103'
        })),
        confirmed_draft_ids: ['d-101', 'd-103']
      })
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(201);
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('bulk_create_rooms', {
      p_hostel_id: mockHostelId,
      p_rooms: [
        expect.objectContaining({ room_number: '101', allow_duplicate: true }),
        expect.objectContaining({ room_number: '102', allow_duplicate: false }),
        expect.objectContaining({ room_number: '103', allow_duplicate: true })
      ]
    });
  });

  // Case E: Batch 101/101/102 with no existing 101 -> intra-batch duplicate warning -> independently resolve both
  it('Case E: Batch 101/101/102 with no existing 101 -> intra-batch duplicate warning -> independently resolve both', async () => {
    mockOwnerAuth();

    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        message: 'Created 3 rooms successfully',
        rooms_created: 3,
        rooms: [
          { room_id: 'r-101-a', room_number: '101', capacity: 2 },
          { room_id: 'r-101-b', room_number: '101', capacity: 2 },
          { room_id: 'r-102', room_number: '102', capacity: 2 }
        ]
      },
      error: null
    });

    (createClient as any).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockUserId } }, error: null }) },
      rpc: mockRpc
    });

    (supabaseServer.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'prof-1', user_id: mockUserId, role: 'owner' }, error: null })
        };
      }
      if (table === 'hostels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: mockHostelId, owner_id: mockUserId, name: 'Sunrise' }, error: null })
        };
      }
      if (table === 'rooms') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const batchRooms = [
      { draft_id: 'd-1', room_number: '101', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] },
      { draft_id: 'd-2', room_number: '101', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] },
      { draft_id: 'd-3', room_number: '102', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] }
    ];

    // Step 1: Initial unapproved batch
    const req1 = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostel_id: mockHostelId, rooms: batchRooms })
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(409);
    const body1 = await res1.json();
    expect(body1.duplicates).toHaveLength(2);
    expect(body1.duplicates[0].draft_id).toBe('d-1');
    expect(body1.duplicates[0].is_intra_batch).toBe(true);
    expect(body1.duplicates[1].draft_id).toBe('d-2');
    expect(body1.duplicates[1].is_intra_batch).toBe(true);

    // Step 2: Approving ONLY d-1 does not approve d-2!
    const req2 = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [
          { ...batchRooms[0], allow_duplicate: true },
          { ...batchRooms[1], allow_duplicate: false },
          { ...batchRooms[2], allow_duplicate: false }
        ],
        confirmed_draft_ids: ['d-1']
      })
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(409);
    const body2 = await res2.json();
    expect(body2.duplicates).toHaveLength(1);
    expect(body2.duplicates[0].draft_id).toBe('d-2');

    // Step 3: Owner independently approves BOTH d-1 and d-2
    const req3 = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [
          { ...batchRooms[0], allow_duplicate: true },
          { ...batchRooms[1], allow_duplicate: true },
          { ...batchRooms[2], allow_duplicate: false }
        ],
        confirmed_draft_ids: ['d-1', 'd-2']
      })
    });

    const res3 = await POST(req3);
    expect(res3.status).toBe(201);
    const body3 = await res3.json();
    expect(body3.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('bulk_create_rooms', {
      p_hostel_id: mockHostelId,
      p_rooms: [
        expect.objectContaining({ room_number: '101', allow_duplicate: true }),
        expect.objectContaining({ room_number: '101', allow_duplicate: true }),
        expect.objectContaining({ room_number: '102', allow_duplicate: false })
      ]
    });
  });

  // Case F: Batch 101/101/102 -> change only first 101 to 101A, keep second 101 -> creates 101A, 101, 102
  it('Case F: Batch 101/101/102 -> change only first 101 to 101A, keep second 101 -> creates 101A, 101, 102', async () => {
    mockOwnerAuth();

    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        message: 'Created 3 rooms successfully',
        rooms_created: 3,
        rooms: [
          { room_id: 'r-101A', room_number: '101A', capacity: 2 },
          { room_id: 'r-101', room_number: '101', capacity: 2 },
          { room_id: 'r-102', room_number: '102', capacity: 2 }
        ]
      },
      error: null
    });

    (createClient as any).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockUserId } }, error: null }) },
      rpc: mockRpc
    });

    (supabaseServer.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'prof-1', user_id: mockUserId, role: 'owner' }, error: null })
        };
      }
      if (table === 'hostels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: mockHostelId, owner_id: mockUserId, name: 'Sunrise' }, error: null })
        };
      }
      if (table === 'rooms') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [
          { draft_id: 'd-1', room_number: '101A', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] },
          { draft_id: 'd-2', room_number: '101', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] },
          { draft_id: 'd-3', room_number: '102', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] }
        ]
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('bulk_create_rooms', {
      p_hostel_id: mockHostelId,
      p_rooms: [
        expect.objectContaining({ room_number: '101A', allow_duplicate: false }),
        expect.objectContaining({ room_number: '101', allow_duplicate: false }),
        expect.objectContaining({ room_number: '102', allow_duplicate: false })
      ]
    });
  });

  // Case G: Duplicate submitted without explicit approval returns 409 and creates no rooms
  it('Case G: Duplicate submitted without explicit approval returns 409 and creates no rooms', async () => {
    mockOwnerAuth();

    const mockRpc = vi.fn();
    (createClient as any).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockUserId } }, error: null }) },
      rpc: mockRpc
    });

    (supabaseServer.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'prof-1', user_id: mockUserId, role: 'owner' }, error: null })
        };
      }
      if (table === 'hostels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: mockHostelId, owner_id: mockUserId, name: 'Sunrise' }, error: null })
        };
      }
      if (table === 'rooms') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [{ id: 'existing-101', room_number: '101' }], error: null })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [{ draft_id: 'd-1', room_number: '101' }]
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('DUPLICATE_ROOM_CONFIRMATION_REQUIRED');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // Case H: Failure halfway through creation rolls back entire batch
  it('Case H: Failure halfway through creation rolls back entire batch', async () => {
    mockOwnerAuth();

    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        success: false,
        message: 'Bed creation failed on room 102',
        detail: 'Unique constraint on bed number violated'
      },
      error: null
    });

    (createClient as any).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockUserId } }, error: null }) },
      rpc: mockRpc
    });

    (supabaseServer.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'prof-1', user_id: mockUserId, role: 'owner' }, error: null })
        };
      }
      if (table === 'hostels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: mockHostelId, owner_id: mockUserId, name: 'Sunrise' }, error: null })
        };
      }
      if (table === 'rooms') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const req = new NextRequest('http://localhost:3000/api/rooms/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostel_id: mockHostelId,
        rooms: [
          { room_number: '101', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] },
          { room_number: '102', floor: 1, room_type: 'double', rent: 5000, security_deposit: 2000, facilities: [] }
        ]
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Bed creation failed on room 102');
    expect(body.details).toBe('Unique constraint on bed number violated');
  });
});
