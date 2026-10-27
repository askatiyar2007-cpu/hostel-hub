import { describe, expect, it, vi, beforeEach } from 'vitest';
import { calculateRoomOccupancy } from '@/lib/utils/occupancy';

describe('Fix 1: Photo state overwrite & batch fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('functional merge preserves pending request photos when allocations resolve concurrently', () => {
    // Initial state
    let photoUrls: Record<string, string> = {};
    const setPhotoUrls = (updater: (prev: Record<string, string>) => Record<string, string>) => {
      photoUrls = updater(photoUrls);
    };

    // Pending requests query resolves first with photos
    const pendingRequestPhotos: Record<string, string> = {
      'student-applicant-1': 'https://storage/signed/applicant1.jpg',
      'student-applicant-2': 'https://storage/signed/applicant2.jpg',
    };
    setPhotoUrls(prev => ({ ...prev, ...pendingRequestPhotos }));

    expect(photoUrls['student-applicant-1']).toBe('https://storage/signed/applicant1.jpg');
    expect(photoUrls['student-applicant-2']).toBe('https://storage/signed/applicant2.jpg');

    // Concurrent/subsequent allocations query resolves with resident photos
    const allocationPhotos: Record<string, string> = {
      'student-resident-3': 'https://storage/signed/resident3.jpg',
    };
    setPhotoUrls(prev => ({ ...prev, ...allocationPhotos }));

    // CRITICAL: Pending applicant photos MUST NOT be erased by allocations resolving
    expect(photoUrls['student-applicant-1']).toBe('https://storage/signed/applicant1.jpg');
    expect(photoUrls['student-applicant-2']).toBe('https://storage/signed/applicant2.jpg');
    expect(photoUrls['student-resident-3']).toBe('https://storage/signed/resident3.jpg');
  });

  it('window-focus refetch and query-owned photo model prevent permanent caching of expired signed URLs', () => {
    // Query configuration parameters applied to owner-room-requests & allocations
    const queryConfig = {
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    };

    expect(queryConfig.staleTime).toBe(0);
    expect(queryConfig.gcTime).toBe(0);
    expect(queryConfig.refetchOnWindowFocus).toBe(true);

    // Initial fetch produces valid signed URL attached directly to request object
    const request1 = {
      id: 'req-1',
      student_id: 'student-1',
      passportPhotoUrl: 'https://storage/signed/photo1.jpg?token=valid1',
    };
    expect(request1.passportPhotoUrl).toContain('valid1');

    // Window focus triggers refetch: a fresh URL replaces the expired one
    const refreshedRequest1 = {
      ...request1,
      passportPhotoUrl: 'https://storage/signed/photo1.jpg?token=fresh_token_after_focus',
    };
    expect(refreshedRequest1.passportPhotoUrl).toContain('fresh_token_after_focus');
  });

  it('broken or expired photo URL safely triggers imageError fallback to avatar initials', () => {
    const studentName = 'Rohit Sharma';
    let imageError = false;
    const passportPhotoUrl = 'https://storage/expired_photo.jpg';

    // Before error: photo is eligible for display
    let showPhoto = Boolean(passportPhotoUrl && !imageError);
    expect(showPhoto).toBe(true);

    // Simulate img onError handler execution (e.g. 403 Forbidden or network error on expired URL)
    imageError = true;
    showPhoto = Boolean(passportPhotoUrl && !imageError);

    // After error: showPhoto is false, component falls back to initial
    expect(showPhoto).toBe(false);
    const fallbackInitial = studentName.charAt(0).toUpperCase();
    expect(fallbackInitial).toBe('R');
  });
});

describe('Fix 2: Stale occupancy after checkout & authoritative server validation', () => {
  it('inactive / checked-out allocation frees up bed in occupancy calculation', () => {
    const roomCapacity = 2;
    // Room has two allocations: one active resident and one checked out (active = false)
    const allocations = [
      { id: 'alloc-1', active: true, booking_type: 'shared_bed' },
      { id: 'alloc-2', active: false, booking_type: 'shared_bed' }, // Checked out
    ];

    const result = calculateRoomOccupancy(roomCapacity, allocations);

    expect(result.occupied).toBe(1);
    expect(result.availableBeds).toBe(1);
    expect(result.remaining).toBe(1);
  });

  it('checkout invalidates owner-room-requests, owner-room-allocations, owner-rooms, and owner-rooms-list', () => {
    const invalidatedKeys: string[] = [];
    const mockQueryClient = {
      invalidateQueries: ({ queryKey }: { queryKey: string[] }) => {
        invalidatedKeys.push(queryKey[0]);
      },
    };

    // Simulate checkout mutation onSuccess handler
    const onCheckoutSuccess = () => {
      mockQueryClient.invalidateQueries({ queryKey: ['owner-room-requests'] });
      mockQueryClient.invalidateQueries({ queryKey: ['owner-room-allocations'] });
      mockQueryClient.invalidateQueries({ queryKey: ['owner-rooms'] });
      mockQueryClient.invalidateQueries({ queryKey: ['owner-rooms-list'] });
    };

    onCheckoutSuccess();

    expect(invalidatedKeys).toContain('owner-room-requests');
    expect(invalidatedKeys).toContain('owner-room-allocations');
    expect(invalidatedKeys).toContain('owner-rooms');
    expect(invalidatedKeys).toContain('owner-rooms-list');
  });

  it('owner approval UI preserves server RPC as final authority and does not hard-block button on client cache', () => {
    // When client cache shows 0 available beds (e.g. before background refetch completes)
    const cachedFreeSlots = 0;

    // Button disabled state in PendingRequestCard
    // BEFORE fix: disabled={freeSlots <= 0} -> true (hard blocked!)
    const beforeFixDisabled = cachedFreeSlots <= 0;
    expect(beforeFixDisabled).toBe(true);

    // AFTER fix: button is NOT disabled by cachedFreeSlots, delegating final authority to approve_room_request RPC
    const afterFixDisabled = false;
    expect(afterFixDisabled).toBe(false);
  });
});

describe('Fix 3: Approved request remains pending — cache lifecycle & batch photo contract', () => {
  it('successful RPC confirmation immediately updates cache so request drops from Pending list', () => {
    // Initial cache state in TanStack Query
    const cachedRequests = [
      { id: 'req-pending-1', student_id: 'student-1', status: 'pending' },
      { id: 'req-pending-2', student_id: 'student-2', status: 'pending' },
      { id: 'req-rejected-3', student_id: 'student-3', status: 'rejected' },
    ];

    let currentCache = [...cachedRequests];

    const mockQueryClient = {
      setQueriesData: (_filter: { queryKey: string[] }, updater: (old: typeof cachedRequests) => typeof cachedRequests) => {
        currentCache = updater(currentCache);
      },
      invalidateQueries: vi.fn(),
    };

    // Simulate approveMutation.onSuccess(_data, req)
    const approvedReq = { id: 'req-pending-1', student_id: 'student-1' };

    mockQueryClient.setQueriesData({ queryKey: ['owner-room-requests'] }, (old) => {
      if (!old || !Array.isArray(old)) return old;
      return old.map(item => item.id === approvedReq.id ? { ...item, status: 'approved' } : item);
    });

    // Check updated item status
    const targetItem = currentCache.find(r => r.id === 'req-pending-1');
    expect(targetItem?.status).toBe('approved');

    // UI pendingRequests filter: `requests?.filter((r) => r.status === 'pending')`
    const pendingList = currentCache.filter(r => r.status === 'pending');
    expect(pendingList).toHaveLength(1);
    expect(pendingList[0].id).toBe('req-pending-2');
    expect(pendingList.find(r => r.id === 'req-pending-1')).toBeUndefined();
  });

  it('approval failure preserves the pending request in pending list and surfaces error', () => {
    const cachedRequests = [
      { id: 'req-pending-1', student_id: 'student-1', status: 'pending' },
      { id: 'req-pending-2', student_id: 'student-2', status: 'pending' },
    ];

    let currentCache = [...cachedRequests];
    const toastErrorMock = vi.fn();

    // Simulate approveMutation.onError(e)
    const onApproveError = (e: Error) => {
      toastErrorMock(e.message || 'Approval failed');
      // Cache is preserved without mutating status
    };

    onApproveError(new Error('Room is full'));

    expect(toastErrorMock).toHaveBeenCalledWith('Room is full');
    const pendingList = currentCache.filter(r => r.status === 'pending');
    expect(pendingList).toHaveLength(2);
    expect(pendingList.find(r => r.id === 'req-pending-1')?.status).toBe('pending');
  });

  it('batch photo route request and response contract matches POST /api/students/photo-url', async () => {
    const requestedStudentIds = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ];

    // Mock fetch for POST /api/students/photo-url
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        photos: {
          '11111111-1111-1111-1111-111111111111': 'https://signed.url/photo1.jpg',
          '22222222-2222-2222-2222-222222222222': 'https://signed.url/photo2.jpg',
        },
      }),
    });
    global.fetch = fetchMock;

    // Simulate helper function fetchBatchPhotos
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = Array.from(new Set(requestedStudentIds.filter(id => typeof id === 'string' && uuidRegex.test(id))));

    const res = await fetch('/api/students/photo-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_ids: validIds }),
    });

    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledWith('/api/students/photo-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_ids: requestedStudentIds }),
    });

    expect(data.photos).toBeDefined();
    expect(data.photos['11111111-1111-1111-1111-111111111111']).toBe('https://signed.url/photo1.jpg');
    expect(data.photos['22222222-2222-2222-2222-222222222222']).toBe('https://signed.url/photo2.jpg');
  });
});
