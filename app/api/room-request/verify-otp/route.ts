import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { email, otp, hostelId, roomId, bookingType, details } = await req.json();

    // Create Supabase client with cookies for authentication
    const supabase = createClient();

    // Get session from cookies
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = session.user;

    // Get student profile
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, profiles(email)')
      .eq('profile_id', user.id)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student profile not found' },
        { status: 404 }
      );
    }

    const studentEmail = (student.profiles as any)?.email;

    if (!studentEmail) {
      return NextResponse.json(
        { error: 'Student email not found' },
        { status: 400 }
      );
    }

    // Verify OTP
    const { data, error } = await supabase.rpc('verify_otp', {
      p_email: studentEmail,
      p_otp: otp,
      p_purpose: 'room_request_verification'
    });

    if (error) {
      console.error('OTP verification error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to verify code' },
        { status: 400 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { error: data.error || 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    // Revalidate room availability before creating request
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('capacity')
      .eq('id', roomId)
      .single();

    if (roomError || !roomData) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Check room capacity
    const { data: activeAllocations, error: allocationError } = await supabase
      .from('room_allocations')
      .select('id')
      .eq('room_id', roomId)
      .eq('active', true);

    if (allocationError) {
      return NextResponse.json(
        { error: 'Failed to check room availability' },
        { status: 500 }
      );
    }

    const occupied = activeAllocations?.length || 0;
    if (occupied >= roomData.capacity) {
      return NextResponse.json(
        { error: 'This room is now at full capacity. Please select a different room.' },
        { status: 400 }
      );
    }

    // Check for duplicate pending requests
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('room_requests')
      .select('id')
      .eq('student_id', student.id)
      .eq('status', 'pending');

    if (pendingError) {
      return NextResponse.json(
        { error: 'Failed to check existing requests' },
        { status: 500 }
      );
    }

    if (pendingRequests && pendingRequests.length > 0) {
      return NextResponse.json(
        { error: 'You already have a pending room request' },
        { status: 400 }
      );
    }

    // Create room request
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
      created_at: new Date().toISOString()
    });

    if (insertError) {
      console.error('Room request creation error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create room request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Room request submitted successfully'
    });

  } catch (error: any) {
    console.error('Room request verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify and submit request' },
      { status: 500 }
    );
  }
}
