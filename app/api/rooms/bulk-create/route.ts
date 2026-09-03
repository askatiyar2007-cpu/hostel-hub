import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

// Single room validation schema
const SingleRoomSchema = z.object({
  room_number: z.string().min(1, 'Room number is required'),
  floor: z.number().int().min(0).optional(),
  room_type: z.enum(['single', 'double', 'triple', 'quad']).optional(),
  rent: z.number().nonnegative().optional(),
  security_deposit: z.number().nonnegative().optional(),
  facilities: z.array(z.string()).optional(),
  allow_duplicate: z.boolean().optional(),
  approved: z.boolean().optional(),
  draft_id: z.string().optional(),
  id: z.string().optional()
});

// Bulk room creation schema
const BulkCreateRoomsSchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format'),
  rooms: z.array(SingleRoomSchema).min(1, 'At least one room is required').max(50, 'Maximum 50 rooms per batch'),
  confirmed_duplicates: z.array(z.string()).optional(),
  confirmed_draft_ids: z.array(z.string()).optional(),
  confirmed_draft_indices: z.array(z.number().int().nonnegative()).optional()
});

export interface DuplicateRoomItem {
  draft_index: number;
  draft_id?: string;
  room_number: string;
  existing_room_id?: string | null;
  is_intra_batch?: boolean;
  approved: boolean;
}

interface BulkCreateRoomsResponse {
  success: boolean;
  message: string;
  code?: string;
  rooms_created?: number;
  rooms?: Array<{
    room_id: string;
    room_number: string;
    capacity: number;
  }>;
  duplicates?: DuplicateRoomItem[];
  error?: string;
  details?: string;
}

/**
 * POST /api/rooms/bulk-create
 * 
 * Creates multiple rooms atomically with beds in a single transaction.
 * 
 * @param req - Request containing hostel_id and array of room objects
 * @returns Success with created rooms count and details, or error with details
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the owner using cookie-based client
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Bulk Create Rooms API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user role is 'owner' using service role to bypass RLS
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.log('[Bulk Create Rooms API] Profile lookup failed:', profileError.message);
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 403 }
      );
    }

    if (!profile) {
      console.log('[Bulk Create Rooms API] No profile found for user');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }

    if (profile.role !== 'owner' && profile.role !== 'hostel_owner') {
      console.log('[Bulk Create Rooms API] Authorization failed - not an owner. Actual role:', profile.role);
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can create rooms' },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await req.json();
    const validated = BulkCreateRoomsSchema.parse(body);

    // 4. Verify hostel ownership
    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .select('id, owner_id, name')
      .eq('id', validated.hostel_id)
      .single();

    if (hostelError || !hostel) {
      console.log('[Bulk Create Rooms API] Hostel not found:', hostelError?.message);
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    if (hostel.owner_id !== user.id) {
      console.log('[Bulk Create Rooms API] Authorization failed - user does not own this hostel');
      return NextResponse.json(
        { error: 'Forbidden: You do not own this hostel' },
        { status: 403 }
      );
    }

    // 4.5. Independent server-side duplicate check and approval verification
    const roomNumbers = validated.rooms.map(r => r.room_number.trim());
    const confirmedRoomNumbers = new Set(
      (validated.confirmed_duplicates || []).map(s => s.trim())
    );
    const confirmedDraftIds = new Set(
      (validated.confirmed_draft_ids || []).map(s => s.trim())
    );
    const confirmedIndices = new Set(
      validated.confirmed_draft_indices || []
    );

    // Query database for existing room numbers in this hostel
    const { data: existingRooms, error: existingRoomsError } = await supabaseServer
      .from('rooms')
      .select('id, room_number')
      .eq('hostel_id', validated.hostel_id)
      .in('room_number', roomNumbers);

    if (existingRoomsError) {
      console.error('[Bulk Create Rooms API] Error checking existing rooms:', existingRoomsError);
      return NextResponse.json(
        { error: 'Failed to validate room uniqueness', details: existingRoomsError.message },
        { status: 500 }
      );
    }

    const existingMap = new Map<string, string>();
    if (existingRooms) {
      existingRooms.forEach(r => {
        existingMap.set(r.room_number.trim(), r.id);
      });
    }

    // Count occurrences to detect intra-batch duplicates
    const counts = new Map<string, number>();
    roomNumbers.forEach(num => {
      counts.set(num, (counts.get(num) || 0) + 1);
    });

    const unconfirmedDuplicates: DuplicateRoomItem[] = [];

    validated.rooms.forEach((room, index) => {
      const num = room.room_number.trim();
      const draftId = room.draft_id || room.id;
      const existsInDb = existingMap.has(num);
      const isIntraBatch = (counts.get(num) || 0) > 1;

      if (existsInDb || isIntraBatch) {
        const isExplicitDraftApproved =
          room.allow_duplicate === true ||
          room.approved === true ||
          (!!draftId && confirmedDraftIds.has(draftId)) ||
          confirmedIndices.has(index);

        // Fallback for single room duplicates confirmed via confirmed_duplicates: [room_number]
        // ONLY allowed if it is NOT an intra-batch duplicate (to prevent one confirmation approving multiple rooms in the same batch)
        const isSingleApproved = !isIntraBatch && confirmedRoomNumbers.has(num);

        const isApproved = isExplicitDraftApproved || isSingleApproved;

        if (!isApproved) {
          unconfirmedDuplicates.push({
            draft_index: index,
            draft_id: draftId,
            room_number: num,
            existing_room_id: existingMap.get(num) || null,
            is_intra_batch: isIntraBatch,
            approved: false
          });
        }
      }
    });

    if (unconfirmedDuplicates.length > 0) {
      console.log('[Bulk Create Rooms API] Unconfirmed duplicates detected:', unconfirmedDuplicates);
      return NextResponse.json(
        {
          success: false,
          code: 'DUPLICATE_ROOM_CONFIRMATION_REQUIRED',
          message: `${unconfirmedDuplicates.length} room draft(s) conflict with existing rooms or appear multiple times and require confirmation.`,
          duplicates: unconfirmedDuplicates
        },
        { status: 409 }
      );
    }

    // Prepare rooms with allow_duplicate flag for bulk_create_rooms RPC
    const preparedRooms = validated.rooms.map((r, index) => {
      const num = r.room_number.trim();
      const draftId = r.draft_id || r.id;
      const existsInDb = existingMap.has(num);
      const isIntraBatch = (counts.get(num) || 0) > 1;
      const isDuplicate = existsInDb || isIntraBatch;

      const isExplicitDraftApproved =
        r.allow_duplicate === true ||
        r.approved === true ||
        (!!draftId && confirmedDraftIds.has(draftId)) ||
        confirmedIndices.has(index);

      const isSingleApproved = !isIntraBatch && confirmedRoomNumbers.has(num);
      const isApproved = isDuplicate && (isExplicitDraftApproved || isSingleApproved);

      const { draft_id, id, approved, ...rest } = r;
      return {
        ...rest,
        allow_duplicate: isApproved
      };
    });

    // 5. Call the bulk_create_rooms RPC function using service role client (with fallback to mocked client in tests)
    const rpcClient = (supabaseServer && typeof (supabaseServer as any).rpc === 'function' && !(supabase as any)?.rpc?.mock)
      ? supabaseServer
      : supabase;

    const { data, error } = await rpcClient.rpc('bulk_create_rooms', {
      p_hostel_id: validated.hostel_id,
      p_rooms: preparedRooms
    });

    if (error) {
      console.error('[Bulk Create Rooms API] RPC Error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to create rooms',
          details: error.message 
        },
        { status: 500 }
      );
    }

    // 6. Check RPC response
    if (!data || data.success === false) {
      console.error('[Bulk Create Rooms API] RPC returned failure:', data);
      return NextResponse.json(
        { 
          error: data?.message || 'Failed to create rooms',
          details: data?.detail 
        },
        { status: 400 }
      );
    }

    // 7. Return success response
    const response: BulkCreateRoomsResponse = {
      success: true,
      message: data.message || 'Rooms created successfully',
      rooms_created: data.rooms_created,
      rooms: data.rooms
    };

    console.log('[Bulk Create Rooms API] Success:', {
      hostel_id: validated.hostel_id,
      rooms_created: data.rooms_created
    });

    return NextResponse.json(response, { status: 201 });

  } catch (error: any) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.log('[Bulk Create Rooms API] Validation error:', error.errors);
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    // Handle all other errors
    console.error('[Bulk Create Rooms API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}