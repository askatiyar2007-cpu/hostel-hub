/**
 * GET /api/students/photo-url
 *
 * Generates an authorized URL for a student's photo (current profile avatar or room request photo).
 *
 * Accessible to:
 * - Owners of any hostel where the student has an active OR historical room allocation or request
 * - The student themselves
 * - Super admins
 *
 * Photo resolution hierarchy:
 * 1. Current student profile avatar (profiles.avatar_url), signed if stored in private storage
 * 2. Room request passport photo (room_requests.photo_path), signed from student-room-requests bucket
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PhotoUrlSchema = z.object({
  student_id: z.string().uuid('Invalid student ID format'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // Authorization verification
    let isAuthorized = false;

    // 1. Check if user is super admin
    const { data: callerProfile } = await supabaseServer
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (callerProfile?.role === 'super_admin') {
      isAuthorized = true;
    }

    // 2. Check if user is the student themselves
    if (!isAuthorized) {
      const { data: studentRecord } = await supabaseServer
        .from('students')
        .select('id, user_id, profile_id')
        .eq('id', studentId)
        .maybeSingle();

      if (studentRecord && (studentRecord.user_id === user.id || studentRecord.profile_id === callerProfile?.id)) {
        isAuthorized = true;
      }
    }

    // 3. Check if user is an owner of ANY hostel associated with this student (active or historical allocation, or room request)
    if (!isAuthorized) {
      const [allocationsCheck, requestsCheck] = await Promise.all([
        supabaseServer
          .from('room_allocations')
          .select('id, hostels!inner(owner_id)')
          .eq('student_id', studentId)
          .eq('hostels.owner_id', user.id)
          .limit(1),
        supabaseServer
          .from('room_requests')
          .select('id, hostels!inner(owner_id)')
          .eq('student_id', studentId)
          .eq('hostels.owner_id', user.id)
          .limit(1),
      ]);

      if (
        (allocationsCheck.data && allocationsCheck.data.length > 0) ||
        (requestsCheck.data && requestsCheck.data.length > 0)
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to access this student photo' },
        { status: 403 }
      );
    }

    // Photo Resolution Flow
    // Step A: Check for canonical profile avatar (profiles.avatar_url)
    const { data: studentWithProfile } = await supabaseServer
      .from('students')
      .select(`
        id,
        profile_id,
        profiles (
          id,
          avatar_url
        )
      `)
      .eq('id', studentId)
      .maybeSingle();

    const profileData = Array.isArray(studentWithProfile?.profiles)
      ? studentWithProfile.profiles[0]
      : studentWithProfile?.profiles;

    if (profileData?.avatar_url && typeof profileData.avatar_url === 'string') {
      const rawAvatar = profileData.avatar_url.trim();

      // If full external URL (e.g. Google profile picture or CDN), return directly
      if (rawAvatar.startsWith('http://') || rawAvatar.startsWith('https://')) {
        return NextResponse.json({
          signedUrl: rawAvatar,
          source: 'profile_avatar',
          expiresIn: 3600,
        });
      }

      // If it's a storage path, generate a signed URL
      let bucket = 'avatars';
      let path = rawAvatar;
      if (rawAvatar.startsWith('student-room-requests/')) {
        bucket = 'student-room-requests';
        path = rawAvatar.replace(/^student-room-requests\//, '');
      } else if (rawAvatar.startsWith('avatars/')) {
        bucket = 'avatars';
        path = rawAvatar.replace(/^avatars\//, '');
      }

      const { data: signedAvatar, error: avatarSignErr } = await supabaseServer.storage
        .from(bucket)
        .createSignedUrl(path, 3600);

      if (!avatarSignErr && signedAvatar?.signedUrl) {
        return NextResponse.json({
          signedUrl: signedAvatar.signedUrl,
          source: 'profile_avatar',
          expiresIn: 3600,
        });
      }

      // If primary bucket failed, try the student-room-requests bucket as fallback
      if (bucket === 'avatars') {
        const { data: signedFallback } = await supabaseServer.storage
          .from('student-room-requests')
          .createSignedUrl(path, 3600);

        if (signedFallback?.signedUrl) {
          return NextResponse.json({
            signedUrl: signedFallback.signedUrl,
            source: 'profile_avatar',
            expiresIn: 3600,
          });
        }
      }
    }

    // Step B: Check room_requests for passport photo (include all historical/active requests)
    const { data: roomRequests } = await supabaseServer
      .from('room_requests')
      .select('id, photo_path, created_at')
      .eq('student_id', studentId)
      .not('photo_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (roomRequests && roomRequests.length > 0 && roomRequests[0].photo_path) {
      const photoPath = roomRequests[0].photo_path;
      const { data: signedUrlData, error: signedUrlError } = await supabaseServer.storage
        .from('student-room-requests')
        .createSignedUrl(photoPath, 3600);

      if (!signedUrlError && signedUrlData?.signedUrl) {
        return NextResponse.json({
          signedUrl: signedUrlData.signedUrl,
          source: 'room_request',
          expiresIn: 3600,
        });
      }
    }

    // If neither profile avatar nor room request photo exists
    return NextResponse.json(
      { error: 'No photo uploaded for this student' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('[Photo URL API] Internal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Shared helper to resolve and sign a single photo storage path or external URL
 */
async function signPhotoPath(rawAvatar: string): Promise<string | null> {
  const trimmed = rawAvatar.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  let bucket = 'avatars';
  let path = trimmed;
  if (trimmed.startsWith('student-room-requests/')) {
    bucket = 'student-room-requests';
    path = trimmed.replace(/^student-room-requests\//, '');
  } else if (trimmed.startsWith('avatars/')) {
    bucket = 'avatars';
    path = trimmed.replace(/^avatars\//, '');
  }

  const { data: signedAvatar, error: avatarSignErr } = await supabaseServer.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (!avatarSignErr && signedAvatar?.signedUrl) {
    return signedAvatar.signedUrl;
  }

  // Fallback to student-room-requests bucket if avatars failed
  if (bucket === 'avatars') {
    const { data: signedFallback } = await supabaseServer.storage
      .from('student-room-requests')
      .createSignedUrl(path, 3600);

    if (signedFallback?.signedUrl) {
      return signedFallback.signedUrl;
    }
  }

  return null;
}

const BatchPhotoUrlSchema = z.object({
  student_ids: z.array(z.string().uuid('Invalid student ID format')).min(1).max(100),
});

/**
 * POST /api/students/photo-url
 *
 * Secure batch resolution for student photos.
 * Takes { student_ids: string[] } and returns { photos: Record<string, string> }.
 * Executes only 2-3 batched database queries for up to 100 students instead of N+1 individual HTTP requests.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validationResult = BatchPhotoUrlSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const requestedIds = Array.from(new Set(validationResult.data.student_ids));
    const supabase = createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if caller is super admin
    const { data: callerProfile } = await supabaseServer
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isSuperAdmin = callerProfile?.role === 'super_admin';
    let authorizedIds: Set<string>;

    if (isSuperAdmin) {
      authorizedIds = new Set(requestedIds);
    } else {
      authorizedIds = new Set<string>();

      // 1. Check if caller is student querying their own student_id
      const { data: selfStudentRecord } = await supabaseServer
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (selfStudentRecord && requestedIds.includes(selfStudentRecord.id)) {
        authorizedIds.add(selfStudentRecord.id);
      }

      // 2. Check if caller is an owner of hostels associated with any requested students
      const [allocationsCheck, requestsCheck] = await Promise.all([
        supabaseServer
          .from('room_allocations')
          .select('student_id, hostels!inner(owner_id)')
          .in('student_id', requestedIds)
          .eq('hostels.owner_id', user.id),
        supabaseServer
          .from('room_requests')
          .select('student_id, hostels!inner(owner_id)')
          .in('student_id', requestedIds)
          .eq('hostels.owner_id', user.id),
      ]);

      allocationsCheck.data?.forEach((a: any) => authorizedIds.add(a.student_id));
      requestsCheck.data?.forEach((r: any) => authorizedIds.add(r.student_id));
    }

    const validIds = Array.from(authorizedIds);
    if (validIds.length === 0) {
      return NextResponse.json({ photos: {} });
    }

    // 1. Query profiles for all authorized students in one batch query
    const { data: studentsWithProfiles } = await supabaseServer
      .from('students')
      .select(`
        id,
        profile_id,
        profiles (
          id,
          avatar_url
        )
      `)
      .in('id', validIds);

    const photos: Record<string, string> = {};
    const studentsNeedingRoomRequest: string[] = [];
    const signingPromises: Promise<void>[] = [];

    studentsWithProfiles?.forEach((student: any) => {
      const prof = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
      const avatarUrl = prof?.avatar_url;
      if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim()) {
        signingPromises.push(
          signPhotoPath(avatarUrl).then((signed) => {
            if (signed) {
              photos[student.id] = signed;
            }
          })
        );
      } else {
        studentsNeedingRoomRequest.push(student.id);
      }
    });

    // 2. Fallback: Query room_requests for students who don't have a profile avatar
    if (studentsNeedingRoomRequest.length > 0) {
      const { data: reqPhotos } = await supabaseServer
        .from('room_requests')
        .select('student_id, photo_path, created_at')
        .in('student_id', studentsNeedingRoomRequest)
        .not('photo_path', 'is', null)
        .order('created_at', { ascending: false });

      // Group by student_id to pick the latest room request photo
      const latestReqMap = new Map<string, string>();
      reqPhotos?.forEach((r: any) => {
        if (!latestReqMap.has(r.student_id) && r.photo_path) {
          latestReqMap.set(r.student_id, r.photo_path);
        }
      });

      latestReqMap.forEach((photoPath, studentId) => {
        signingPromises.push(
          signPhotoPath(photoPath).then((signed) => {
            if (signed) {
              photos[studentId] = signed;
            }
          })
        );
      });
    }

    await Promise.all(signingPromises);

    return NextResponse.json({ photos });
  } catch (error: any) {
    console.error('[Batch Photo URL API] Internal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
