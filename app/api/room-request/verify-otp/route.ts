import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    console.log('[ROOM VERIFY OTP] Request received');
    
    const { otp, hostelId, roomId, bookingType, details, photoPath } = await req.json();
    console.log('[ROOM VERIFY OTP] Request body validated:', { hostelId, roomId, bookingType, hasPhoto: !!photoPath });

    // Use SSR client for authentication check only
    const authClient = createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    console.log('[ROOM VERIFY OTP] Auth check completed:', { hasUser: !!user, authError: authError?.message });

    if (authError || !user) {
      console.error('[ROOM VERIFY OTP] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('[ROOM VERIFY OTP] Auth user found:', { userId: user.id, email: user.email });

    // Use service role client for database operations and RPC calls
    const supabase = supabaseServer;
    console.log('[ROOM VERIFY OTP] Service role client created');

    // Get student profile using service role client
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('[ROOM VERIFY OTP] Profile lookup completed:', { hasProfile: !!profile, profileError: profileError?.message });

    if (profileError || !profile) {
      console.error('[ROOM VERIFY OTP] Profile not found for user:', user.id, profileError);
      return NextResponse.json(
        { error: 'Student profile not found' },
        { status: 404 }
      );
    }

    // Get student record using service role client
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();

    console.log('[ROOM VERIFY OTP] Student lookup completed:', { hasStudent: !!student, studentError: studentError?.message });

    if (studentError || !student) {
      console.error('[ROOM VERIFY OTP] Student record not found for profile:', profile.id, studentError);
      return NextResponse.json(
        { error: 'Student record not found' },
        { status: 404 }
      );
    }

    // Use the same email from room-request details for OTP verification
    const otpEmail = details?.parent_email?.trim();

    if (!otpEmail) {
      console.error('[ROOM VERIFY OTP] Parent email missing from room-request details');
      return NextResponse.json(
        { error: 'Parent email is required for OTP verification' },
        { status: 400 }
      );
    }

    // Validate photo path is provided
    if (!photoPath) {
      console.error('[ROOM VERIFY OTP] Photo path missing from request');
      return NextResponse.json(
        { error: 'Passport-size photo is required' },
        { status: 400 }
      );
    }

    console.log('[ROOM VERIFY OTP] OTP email validated:', { email: otpEmail, photoPath });

    // Verify OTP using service role client
    console.log('[ROOM VERIFY OTP] Calling verify_otp RPC');
    const { data, error } = await supabase.rpc('verify_otp', {
      p_email: otpEmail,
      p_otp: otp,
      p_purpose: 'room_request_verification'
    });
    console.log('[ROOM VERIFY OTP] RPC completed:', { hasData: !!data, error: error?.message, success: data?.success });

    if (error) {
      console.error('[ROOM VERIFY OTP] OTP verification error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to verify code' },
        { status: 400 }
      );
    }

    if (!data?.success) {
      console.error('[ROOM VERIFY OTP] RPC returned failure:', data.error);
      return NextResponse.json(
        { error: data.error || 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    // Revalidate room availability before creating request
    console.log('[ROOM VERIFY OTP] Checking room availability');
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('capacity')
      .eq('id', roomId)
      .single();

    if (roomError || !roomData) {
      console.error('[ROOM VERIFY OTP] Room not found:', roomError);
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Check room capacity
    const { data: activeAllocations, error: allocationError } = await supabase
      .from('room_allocations')
      .select('id, booking_type')
      .eq('room_id', roomId)
      .eq('active', true);

    if (allocationError) {
      console.error('[ROOM VERIFY OTP] Failed to check room availability:', allocationError);
      return NextResponse.json(
        { error: 'Failed to check room availability' },
        { status: 500 }
      );
    }

    const hasEntireRoom = activeAllocations?.some(
      (a: any) => a.booking_type === 'entire_room'
    );
    const actualOccupancy = hasEntireRoom ? roomData.capacity : (activeAllocations?.length || 0);
    const normalizedBookingType = bookingType === 'entire_room' ? 'entire_room' : 'shared_bed';

    if (normalizedBookingType === 'shared_bed') {
      if (actualOccupancy >= roomData.capacity) {
        console.log('[ROOM VERIFY OTP] Room at full capacity:', { actualOccupancy, capacity: roomData.capacity });
        return NextResponse.json(
          { error: 'This room is now at full capacity. Please select a different room.' },
          { status: 400 }
        );
      }
    } else if (normalizedBookingType === 'entire_room') {
      if (actualOccupancy > 0) {
        console.log('[ROOM VERIFY OTP] Entire room not available, occupancy:', actualOccupancy);
        return NextResponse.json(
          { error: 'Entire room is unavailable because this room already has an occupant. Choose Shared Bed or another room.' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate pending requests
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('room_requests')
      .select('id')
      .eq('student_id', student.id)
      .eq('status', 'pending');

    if (pendingError) {
      console.error('[ROOM VERIFY OTP] Failed to check existing requests:', pendingError);
      return NextResponse.json(
        { error: 'Failed to check existing requests' },
        { status: 500 }
      );
    }

    if (pendingRequests && pendingRequests.length > 0) {
      console.log('[ROOM VERIFY OTP] Pending request already exists');
      return NextResponse.json(
        { error: 'You already have a pending room request' },
        { status: 400 }
      );
    }

    // Create room request
    console.log('[ROOM VERIFY OTP] Creating room request');
    const { error: insertError } = await supabase.from('room_requests').insert({
      student_id: student.id,
      hostel_id: hostelId,
      room_id: roomId,
      status: 'pending',
      booking_type: bookingType,
      student_name: details.student_name,
      student_email: details.student_email.trim().toLowerCase(),
      student_phone: details.student_phone,
      address: details.address,
      parent_name: details.parent_name,
      parent_phone: details.parent_phone,
      parent_email: details.parent_email.trim().toLowerCase(),
      emergency_contact: `${details.emergency_name} - ${details.emergency_phone}`,
      emergency_contact_name: details.emergency_name,
      emergency_contact_phone: details.emergency_phone,
      photo_path: photoPath,
      created_at: new Date().toISOString()
    });

    if (insertError) {
      console.error('[ROOM VERIFY OTP] Room request creation error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create room request' },
        { status: 500 }
      );
    }

    console.log('[ROOM VERIFY OTP] Request completed successfully');
    return NextResponse.json({
      success: true,
      message: 'Room request submitted successfully'
    });

  } catch (error: any) {
    console.error('[ROOM VERIFY OTP] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify and submit request' },
      { status: 500 }
    );
  }
}
