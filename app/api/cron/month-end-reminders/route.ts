export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/cron/month-end-reminders
 * 
 * Scheduled job to send month-end reading reminders to hostel owners.
 * Called by Vercel cron on the last day of each month.
 * 
 * Authentication: Requires CRON_SECRET header
 * 
 * Requirements:
 * - REQ-9.6: Monthly reminders for month-end readings
 * - REQ-25.2: Automated notifications via cron
 * 
 * Design reference: Section 3.5.2, 6.6.1
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Verify CRON_SECRET authentication
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Month-End Cron] Missing or invalid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const providedSecret = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!cronSecret) {
      console.error('[Month-End Cron] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (providedSecret !== cronSecret) {
      console.error('[Month-End Cron] Invalid CRON_SECRET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[Month-End Cron] Authentication successful');
    
    // 2. Get all hostels
    const { data: hostels, error: hostelsError } = await supabaseServer
      .from('hostels')
      .select('id, name, owner_id')
      .eq('status', 'approved');
    
    if (hostelsError) {
      console.error('[Month-End Cron] Failed to fetch hostels:', hostelsError);
      return NextResponse.json({ error: 'Failed to fetch hostels' }, { status: 500 });
    }
    
    if (!hostels || hostels.length === 0) {
      console.log('[Month-End Cron] No approved hostels found');
      return NextResponse.json({ 
        success: true, 
        message: 'No hostels to process',
        processed: 0,
        notifications_created: 0
      });
    }
    
    console.log(`[Month-End Cron] Processing ${hostels.length} hostels`);
    
    let totalNotificationsCreated = 0;
    let hostelsProcessed = 0;
    const processingErrors: string[] = [];
    
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfDayIso = startOfDay.toISOString();

    // 3. Process each hostel
    for (const hostel of hostels) {
      try {
        // Get pending readings for this hostel
        const { data: pendingReadings, error: pendingError } = await supabaseServer.rpc(
          'get_month_end_pending_readings',
          { p_hostel_id: hostel.id }
        );
        
        if (pendingError) {
          console.error(`[Month-End Cron] Failed to get pending readings for hostel ${hostel.id}:`, pendingError);
          processingErrors.push(`Hostel ${hostel.name}: ${pendingError.message}`);
          continue;
        }
        
        if (!pendingReadings || pendingReadings.length === 0) {
          console.log(`[Month-End Cron] No pending readings for hostel ${hostel.name}`);
          hostelsProcessed++;
          continue;
        }
        
        console.log(`[Month-End Cron] Found ${pendingReadings.length} pending readings for hostel ${hostel.name}`);
        
        // Avoid duplicate notifications if the endpoint runs repeatedly on the same day.
        const { data: existingNotif, error: notifCheckError } = await supabaseServer
          .from('notifications')
          .select('id')
          .eq('user_id', hostel.owner_id)
          .eq('type', 'electricity_month_end_reminder')
          .gte('created_at', startOfDayIso)
          .limit(1);

        if (notifCheckError) {
          console.error(`[Month-End Cron] Failed to check existing notifications for hostel ${hostel.id}:`, notifCheckError);
        }

        if (existingNotif && existingNotif.length > 0) {
          console.log(`[Month-End Cron] Already notified owner for hostel ${hostel.name} today`);
          hostelsProcessed++;
          continue;
        }

        // Create notification for the owner
        const notificationTitle = 'Month-End Meter Readings Required';
        const notificationMessage = `You have ${pendingReadings.length} meter readings pending for month-end. Please record readings for all active meters by the end of the month to ensure accurate billing.`;
        
        const { error: notificationError } = await supabaseServer
          .from('notifications')
          .insert({
            user_id: hostel.owner_id,
            title: notificationTitle,
            message: notificationMessage,
            type: 'electricity_month_end_reminder',
            read: false
          });
        
        if (notificationError) {
          console.error(`[Month-End Cron] Failed to create notification for hostel ${hostel.id}:`, notificationError);
          processingErrors.push(`Hostel ${hostel.name}: Failed to create notification`);
        } else {
          totalNotificationsCreated++;
          console.log(`[Month-End Cron] Created notification for hostel ${hostel.name}`);
        }
        
        hostelsProcessed++;
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Month-End Cron] Error processing hostel ${hostel.id}:`, error);
        processingErrors.push(`Hostel ${hostel.name}: ${errorMessage}`);
      }
    }
    
    // 4. Return processing statistics
    const response = {
      success: true,
      message: 'Month-end reminders processed',
      processed: hostelsProcessed,
      total_hostels: hostels.length,
      notifications_created: totalNotificationsCreated,
      errors: processingErrors.length > 0 ? processingErrors : undefined
    };
    
    console.log('[Month-End Cron] Completed:', response);
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Month-End Cron] Unexpected error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}