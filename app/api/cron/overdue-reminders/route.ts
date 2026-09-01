export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/cron/overdue-reminders
 * 
 * Scheduled job to send overdue reading reminders to hostel owners.
 * Called by Vercel cron daily.
 * 
 * Authentication: Requires CRON_SECRET header
 * 
 * Requirements:
 * - REQ-25.4: Overdue reminders for occupancy change readings
 * - REQ-5.4: Reading deadline tracking
 * 
 * Design reference: Section 6.6.2
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Verify CRON_SECRET authentication
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Overdue Cron] Missing or invalid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const providedSecret = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!cronSecret) {
      console.error('[Overdue Cron] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (providedSecret !== cronSecret) {
      console.error('[Overdue Cron] Invalid CRON_SECRET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[Overdue Cron] Authentication successful');
    
    // 2. Define overdue threshold (24 hours ago)
    const dayAgo = new Date();
    dayAgo.setHours(dayAgo.getHours() - 24);
    
    // 3. Find overdue occupancy change events
    const { data: overdueEvents, error: eventsError } = await supabaseServer
      .from('occupancy_change_events')
      .select(`
        id,
        hostel_id,
        room_id,
        student_id,
        change_type,
        reading_deadline,
        change_timestamp,
        hostels!inner (
          id,
          name,
          owner_id
        ),
        rooms!inner (
          room_number,
          electricity_meters (
            id,
            meter_number,
            status
          )
        )
      `)
      .eq('status', 'pending_reading')
      .lt('change_timestamp', dayAgo.toISOString());
    
    if (eventsError) {
      console.error('[Overdue Cron] Failed to fetch overdue events:', eventsError);
      return NextResponse.json({ error: 'Failed to fetch overdue events' }, { status: 500 });
    }
    
    if (!overdueEvents || overdueEvents.length === 0) {
      console.log('[Overdue Cron] No overdue events found');
      return NextResponse.json({ 
        success: true, 
        message: 'No overdue events to process',
        processed: 0,
        notifications_created: 0
      });
    }
    
    console.log(`[Overdue Cron] Found ${overdueEvents.length} overdue events`);
    
    // 4. Resolve student information by fetching profiles in batch
    const studentIds = Array.from(new Set(overdueEvents.map(e => e.student_id)));
    const { data: studentProfiles, error: profilesError } = await supabaseServer
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', studentIds);
      
    if (profilesError) {
      console.error('[Overdue Cron] Failed to fetch student profiles:', profilesError);
    }
    
    const studentProfileMap = new Map<string, string>(
      studentProfiles?.map(p => [p.user_id, p.full_name]) || []
    );
    
    let totalNotificationsCreated = 0;
    const processingErrors: string[] = [];
    const processedHostels = new Set<string>();
    
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfDayIso = startOfDay.toISOString();
    
    // 5. Process each overdue event
    for (const event of overdueEvents) {
      try {
        // Safe relation extraction and normalization
        const rawHostels = event.hostels;
        const hostel = (Array.isArray(rawHostels) ? rawHostels[0] : rawHostels) as {
          id: string;
          name: string;
          owner_id: string;
        } | null;

        const rawRooms = event.rooms;
        const room = (Array.isArray(rawRooms) ? rawRooms[0] : rawRooms) as {
          room_number: string;
          electricity_meters: {
            id: string;
            meter_number: string;
            status: string;
          } | {
            id: string;
            meter_number: string;
            status: string;
          }[] | null;
        } | null;
        
        if (!hostel || !room) {
          console.warn(`[Overdue Cron] Missing hostel or room relation for event ${event.id}`);
          continue;
        }
        
        // Find active meter for the room
        const rawMeters = room.electricity_meters;
        const meters = Array.isArray(rawMeters)
          ? rawMeters
          : rawMeters
            ? [rawMeters]
            : [];
        const activeMeter = meters.find((m) => m.status === 'active');
        
        if (!activeMeter) {
          console.warn(`[Overdue Cron] No active electricity meter found for room ${room.room_number} (Hostel: ${hostel.name})`);
          continue;
        }
        
        const studentName = studentProfileMap.get(event.student_id) || 'Unknown';
        
        // Query to check if we already sent an overdue notification for this specific room/meter today
        const { data: existingNotifs, error: notifCheckError } = await supabaseServer
          .from('notifications')
          .select('message')
          .eq('user_id', hostel.owner_id)
          .eq('type', 'electricity_overdue_reminder')
          .gte('created_at', startOfDayIso);
          
        if (notifCheckError) {
          console.error(`[Overdue Cron] Failed to check existing notifications for owner ${hostel.owner_id}:`, notifCheckError);
        }
        
        const isAlreadyNotified = existingNotifs?.some(n => 
          n.message.includes(`Room ${room.room_number}`) && n.message.includes(`Meter: ${activeMeter.meter_number}`)
        );
        
        if (isAlreadyNotified) {
          console.log(`[Overdue Cron] Already notified owner for Room ${room.room_number} (Meter: ${activeMeter.meter_number}) today`);
          continue;
        }
        
        // Create notification for the owner (High Priority title)
        const changeTypeLabel = event.change_type === 'student_join' ? 'joining' : 'leaving';
        const notificationTitle = 'URGENT: Overdue Meter Reading Required';
        const notificationMessage = `You have an overdue meter reading for an occupancy change. Room ${room.room_number} (Meter: ${activeMeter.meter_number}) has a pending reading for student ${studentName} ${changeTypeLabel} that was due on ${new Date(event.reading_deadline || event.change_timestamp).toLocaleDateString()}. Please record the reading immediately.`;
        
        const { error: notificationError } = await supabaseServer
          .from('notifications')
          .insert({
            user_id: hostel.owner_id,
            title: notificationTitle,
            message: notificationMessage,
            type: 'electricity_overdue_reminder',
            read: false
          });
        
        if (notificationError) {
          console.error(`[Overdue Cron] Failed to create notification for hostel ${hostel.id}:`, notificationError);
          processingErrors.push(`Hostel ${hostel.name}, Room ${room.room_number}: Failed to create notification`);
        } else {
          totalNotificationsCreated++;
          processedHostels.add(hostel.id);
          console.log(`[Overdue Cron] Created notification for Room ${room.room_number} in hostel ${hostel.name}`);
        }
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Overdue Cron] Error processing event ${event.id}:`, error);
        processingErrors.push(`Event ${event.id}: ${errorMessage}`);
      }
    }
    
    // 6. Return processing statistics
    const response = {
      success: true,
      message: 'Overdue reminders processed',
      hostels_notified: processedHostels.size,
      total_events: overdueEvents.length,
      notifications_created: totalNotificationsCreated,
      errors: processingErrors.length > 0 ? processingErrors : undefined
    };
    
    console.log('[Overdue Cron] Completed:', response);
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Overdue Cron] Unexpected error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}