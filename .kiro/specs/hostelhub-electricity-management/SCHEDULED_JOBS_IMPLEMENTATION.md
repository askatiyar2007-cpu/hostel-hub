# Scheduled Jobs Implementation Guide

## Overview
The electricity management system requires two scheduled jobs for automated notifications.

## Jobs Required

### 1. Month-End Reminder Job (Task 30.1)
**Schedule**: Daily at 9:00 AM UTC
**Function**: Send reminders for month-end readings

**Implementation**:

```typescript
// app/api/cron/month-end-reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (Vercel Cron)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get all hostels
    const { data: hostels } = await supabaseServer
      .from('hostels')
      .select('id, name');
    
    if (!hostels) return NextResponse.json({ processed: 0 });
    
    let notificationsCreated = 0;
    
    for (const hostel of hostels) {
      // Call RPC function to get meters needing month-end readings
      const { data: meters } = await supabaseServer
        .rpc('get_month_end_pending_readings', { p_hostel_id: hostel.id });
      
      if (meters && meters.length > 0) {
        // Create notifications for pending meters
        for (const meter of meters) {
          await supabaseServer.from('notifications').insert({
            hostel_id: hostel.id,
            type: 'month_end_reading',
            priority: 'medium',
            title: 'Month-End Reading Required',
            message: `Please enter month-end reading for Room ${meter.room_number}, Meter ${meter.meter_number}`,
            action_url: `/owner/electricity/readings/record?meter_id=${meter.meter_id}`,
            metadata: {
              meter_id: meter.meter_id,
              room_id: meter.room_id,
              deadline: meter.deadline
            }
          });
          notificationsCreated++;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      hostels_processed: hostels.length,
      notifications_created: notificationsCreated
    });
  } catch (error: any) {
    console.error('[Month-End Reminders Job]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Vercel Configuration** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/cron/month-end-reminders",
    "schedule": "0 9 * * *"
  }]
}
```

### 2. Overdue Reading Reminder Job (Task 30.2)
**Schedule**: Daily at 10:00 AM UTC
**Function**: Send reminders for overdue occupancy change readings

**Implementation**:

```typescript
// app/api/cron/overdue-reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Find overdue occupancy change events
    const { data: overdueEvents } = await supabaseServer
      .from('occupancy_change_events')
      .select(`
        id,
        hostel_id,
        room_id,
        change_timestamp,
        rooms(room_number),
        electricity_meters(id, meter_number)
      `)
      .eq('status', 'pending_reading')
      .lt('change_timestamp', twentyFourHoursAgo);
    
    if (!overdueEvents || overdueEvents.length === 0) {
      return NextResponse.json({ processed: 0 });
    }
    
    // Create high-priority notifications
    for (const event of overdueEvents) {
      await supabaseServer.from('notifications').insert({
        hostel_id: event.hostel_id,
        type: 'overdue_reading',
        priority: 'high',
        title: 'OVERDUE: Reading Required',
        message: `Urgent: Reading overdue for Room ${(event.rooms as any).room_number} (>24hrs)`,
        action_url: `/owner/electricity/readings/record?meter_id=${(event.electricity_meters as any).id}`,
        metadata: {
          event_id: event.id,
          room_id: event.room_id
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      overdue_events: overdueEvents.length
    });
  } catch (error: any) {
    console.error('[Overdue Reminders Job]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Vercel Configuration**:
```json
{
  "crons": [{
    "path": "/api/cron/overdue-reminders",
    "schedule": "0 10 * * *"
  }]
}
```

## Environment Variables Required

Add to `.env.local`:
```
CRON_SECRET=<generate-secure-random-string>
```

## Testing Scheduled Jobs Locally

Since Vercel Cron doesn't run locally, test using direct API calls:

```bash
# Test month-end reminders
curl -X GET http://localhost:3000/api/cron/month-end-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test overdue reminders  
curl -X GET http://localhost:3000/api/cron/overdue-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Deployment Notes

1. Set `CRON_SECRET` in Vercel environment variables
2. Add `vercel.json` cron configuration to repository
3. Deploy to Vercel (cron jobs activate automatically)
4. Monitor execution in Vercel dashboard → Logs

## Notification Dismissal (Task 31.2)

Notifications are auto-dismissed when meter readings are recorded:

```typescript
// In recordMeterReading function (already implemented)
if (reason === 'occupancy_change' || reason === 'month_end') {
  // Dismiss related notifications
  await supabaseServer
    .from('notifications')
    .update({ dismissed: true })
    .eq('metadata->meter_id', meterId)
    .eq('type', reason === 'month_end' ? 'month_end_reading' : 'occupancy_change');
}
```

## Manual Testing Checklist

- [ ] Month-end RPC function returns correct meters
- [ ] Notifications created with correct priority
- [ ] Notification action URLs navigate to correct page
- [ ] Overdue detection correctly identifies events >24hrs old
- [ ] Auto-dismissal works when reading recorded
