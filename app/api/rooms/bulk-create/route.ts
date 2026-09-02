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
  facilities: z.array(z.string()).optional()
});

// Bulk room creation schema
const BulkCreateRoomsSchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format'),
  rooms: z.array(SingleRoomSchema).min(1, 'At least one room is required').max(50, 'Maximum 50 rooms per batch')
});

interface BulkCreateRoomsResponse {
  success: boolean;
  message: string;
  rooms_created?: number;
  rooms?: Array<{
    room_id: string;
    room_number: string;
    capacity: number;
  }>;
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

    // 5. Call the bulk_create_rooms RPC function
    const { data, error } = await supabase.rpc('bulk_create_rooms', {
      p_hostel_id: validated.hostel_id,
      p_rooms: validated.rooms
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