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
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    const supabase = await createClient();

    // Log Supabase project reference (safe to log hostname fragment)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'unknown';
    const projectRef = supabaseUrl.includes('supabase.co') ? supabaseUrl.split('//')[1].split('.')[0] : 'unknown';
    console.log('[Photo URL API] Supabase project:', projectRef);

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch the student's room request with photo_path and hostel ownership
    const { data: roomRequest, error: requestError } = await supabase
      .from('room_requests')
      .select(`
        id,
        photo_path,
        hostel_id,
        hostels!inner (
          owner_id
        )
      `)
      .eq('student_id', studentId)
      .eq('status', 'approved')
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
      console.log('[Photo URL API] No approved room request found for student_id:', studentId);
      return NextResponse.json(
        { error: 'No approved room request found for this student' },
        { status: 404 }
      );
    }

    console.log('[Photo URL API] Room request found:', {
      room_request_id: roomRequest.id,
      student_id: studentId
    });

    if (!roomRequest.photo_path) {
      console.log('[Photo URL API] No photo_path found for student_id:', studentId);
      return NextResponse.json(
        { error: 'No photo uploaded for this student' },
        { status: 404 }
      );
    }

    // Verify owner authorization BEFORE storage operations
    const hostel = roomRequest.hostels as any;
    if (hostel.owner_id !== user.id) {
      // Check if user is super admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role !== 'super_admin') {
        console.log('[Photo URL API] Authorization failed for user:', user.id);
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to access this photo' },
          { status: 403 }
        );
      }
    }

    // Diagnostic logging
    const photoPath = roomRequest.photo_path;
    console.log('[Photo URL API] Diagnostics:', {
      student_id: studentId,
      photo_path: photoPath,
      photo_path_length: photoPath.length,
      photo_path_trimmed: photoPath.trim(),
      has_leading_slash: photoPath.startsWith('/'),
      has_trailing_slash: photoPath.endsWith('/'),
      contains_bucket_name: photoPath.includes('student-room-requests'),
      bucket_name: 'student-room-requests'
    });

    // Try to list objects in the student's directory to verify what exists
    const studentFolder = photoPath.split('/')[0]; // Get the student ID folder
    console.log('[Photo URL API] Listing objects in folder:', studentFolder);
    const { data: listData, error: listError } = await supabase.storage
      .from('student-room-requests')
      .list(studentFolder, { limit: 10, sortBy: { column: 'name', order: 'asc' } });

    console.log('[Photo URL API] Storage list result:', {
      folder: studentFolder,
      found_objects: listData?.length || 0,
      object_names: listData?.map(obj => obj.name) || [],
      list_error: listError ? listError.message : null
    });

    // Try to get public URL to verify path format
    console.log('[Photo URL API] Attempting to get public URL for path:', photoPath);
    const { data: publicUrlData } = await supabase.storage
      .from('student-room-requests')
      .getPublicUrl(photoPath);

    console.log('[Photo URL API] Public URL check result:', {
      path: photoPath,
      has_public_url: !!publicUrlData.publicUrl
    });

    // Try to download the file to verify it exists and is accessible
    console.log('[Photo URL API] Attempting to download file to verify existence:', photoPath);
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('student-room-requests')
      .download(photoPath);

    console.log('[Photo URL API] Download check result:', {
      path: photoPath,
      download_error: downloadError ? downloadError.message : null,
      download_error_status: downloadError ? (downloadError as any).statusCode : null,
      file_size: downloadData ? downloadData.size : null,
      file_type: downloadData ? downloadData.type : null
    });

    // If download succeeded but createSignedUrl fails, that's a specific issue
    if (!downloadError && downloadData) {
      console.log('[Photo URL API] Download succeeded - object exists at path:', photoPath);
    } else {
      console.log('[Photo URL API] Download failed - object may not exist at path:', photoPath);
    }

    // Generate signed URL (valid for 1 hour)
    console.log('[Photo URL API] Attempting to create signed URL for path:', photoPath);
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('student-room-requests')
      .createSignedUrl(photoPath, 3600); // 1 hour expiry

    if (signedUrlError) {
      console.error('[Photo URL API] Error generating signed URL:', {
        error: signedUrlError,
        path_used: photoPath,
        bucket: 'student-room-requests',
        error_name: signedUrlError.name,
        error_message: signedUrlError.message,
        error_status: signedUrlError.statusCode
      });
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
