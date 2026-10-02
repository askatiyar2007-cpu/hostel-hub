/**
 * GET /api/students/photo-url
 *
 * Generates a signed URL for a student's passport photo from their room request
 *
 * Only accessible to:
 * - Owners of the hostel where the student has a room request
 * - Super admins
 *
 * The photo belongs to the student's room_request.photo_path
 * Includes both pending and approved room requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

const PhotoUrlSchema = z.object({
  student_id: z.string().uuid('Invalid student ID format'),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    if (!studentId) {
      return NextResponse.json(
        { error: 'student_id is required' },
        { status: 400 }
      );
    }

    const validationResult = PhotoUrlSchema.safeParse({ student_id: studentId });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid student_id format' },
        { status: 400 }
      );
    }

    const supabase = createClient(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch the student's room request with photo_path and hostel ownership using service role
    // Include both pending and approved requests to show correct photo for pending requests
    const { data: roomRequest, error: requestError } = await supabaseServer
      .from('room_requests')
      .select(`
        id,
        photo_path,
        hostel_id,
        student_id,
        status,
        hostels!inner (
          owner_id
        )
      `)
      .eq('student_id', studentId)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (requestError) {
      console.error('[Photo URL API] Error fetching room request:', requestError);
      return NextResponse.json(
        { error: 'Failed to fetch room request' },
        { status: 500 }
      );
    }

    if (!roomRequest) {
      return NextResponse.json(
        { error: 'No room request found for this student' },
        { status: 404 }
      );
    }

    if (!roomRequest.photo_path) {
      return NextResponse.json(
        { error: 'No photo uploaded for this student' },
        { status: 404 }
      );
    }

    // Authorization verification
    const hostel = roomRequest.hostels as any;
    let isAuthorized = hostel?.owner_id === user.id;

    if (!isAuthorized) {
      // Check if user is super admin or the student themselves
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.role === 'super_admin') {
        isAuthorized = true;
      } else if (profile?.role === 'student') {
        const { data: studentRecord } = await supabaseServer
          .from('students')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('id', studentId)
          .maybeSingle();

        if (studentRecord) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to access this photo' },
        { status: 403 }
      );
    }

    // Generate signed URL (valid for 1 hour) using service role client
    const photoPath = roomRequest.photo_path;
    const { data: signedUrlData, error: signedUrlError } = await supabaseServer.storage
      .from('student-room-requests')
      .createSignedUrl(photoPath, 3600); // 1 hour expiry

    if (signedUrlError) {
      console.error('[Photo URL API] Error generating signed URL:', signedUrlError);
      return NextResponse.json(
        { error: 'Failed to generate photo URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: signedUrlData.signedUrl,
      expiresIn: 3600
    });

  } catch (error: any) {
    console.error('Error in photo-url API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
