/**
 * Physical Electricity Meter Replacement Module
 * 
 * Handles the complete lifecycle of replacing a physical electricity meter in a room:
 * 1. Validates owner authorization, hostel ownership, and room association.
 * 2. Handles both readable and unreadable/burned-out meters with full audit honesty.
 * 3. Records old meter final reading when available, or closes at last known verified reading without fabricating data.
 * 4. Calculates and stores prior occupants' electricity charges for consumption on the old meter.
 * 5. Deactivates the old physical meter (setting status to 'inactive' and timestamping deactivation).
 * 6. Creates the new physical meter record with its unique identifier.
 * 7. Records the initial benchmark reading on the new meter (which can be lower than old meter's final reading).
 * 8. Opens a new billing segment on the new meter linked to the room's active student occupants.
 * 9. Provides comprehensive multi-step rollback in case of any mid-process failures.
 * 10. Ensures all historical readings, segments, charges, and payments for the old meter remain intact.
 */

import { supabaseServer } from '@/lib/supabase/server';
import { closeOpenSegment, createBillingSegment } from './segment-lifecycle';

export interface ReplaceMeterParams {
  hostelId: string;
  roomId: string;
  oldMeterId: string;
  newMeterNumber: string;
  initialReading: number;
  finalReading?: number | null;
  finalReadingUnavailable?: boolean;
  notes?: string;
  userId: string;
}

export interface ReplaceMeterResult {
  success: boolean;
  oldMeter: {
    id: string;
    meter_number: string;
    final_reading_status: 'verified' | 'unavailable' | 'not_applicable';
    final_reading?: number | null;
    last_known_reading?: number | null;
    closed_segment_id?: string | null;
  };
  newMeter: {
    id: string;
    meter_number: string;
    initial_reading: number;
    initial_reading_id: string;
    open_segment_id: string;
  };
  message: string;
}

/**
 * Replace a physical electricity sub-meter for a room with failure-injection rollback resilience.
 */
export async function replacePhysicalMeter(params: ReplaceMeterParams): Promise<ReplaceMeterResult> {
  const {
    hostelId,
    roomId,
    oldMeterId,
    newMeterNumber,
    initialReading,
    finalReading,
    finalReadingUnavailable = false,
    notes,
    userId
  } = params;

  // 1. Basic validation
  if (!oldMeterId || !newMeterNumber || initialReading === undefined || initialReading === null) {
    throw new Error('Missing required parameters for meter replacement');
  }

  const cleanedNewMeterNumber = newMeterNumber.trim();
  if (!cleanedNewMeterNumber) {
    throw new Error('New meter number cannot be empty');
  }

  if (initialReading < 0) {
    throw new Error('New meter initial reading must be non-negative');
  }

  // 2. Fetch old meter and verify active status
  const { data: oldMeter, error: oldMeterError } = await supabaseServer
    .from('electricity_meters')
    .select('id, hostel_id, room_id, meter_number, status, notes')
    .eq('id', oldMeterId)
    .single();

  if (oldMeterError || !oldMeter) {
    throw new Error(`Old meter not found: ${oldMeterError?.message || 'Invalid ID'}`);
  }

  if (oldMeter.hostel_id !== hostelId) {
    throw new Error('Meter does not belong to the specified hostel');
  }

  if (oldMeter.room_id !== roomId) {
    throw new Error('Meter does not belong to the specified room');
  }

  // Idempotency check: If old meter is already inactive, check if new replacement meter already exists
  if (oldMeter.status === 'inactive') {
    const { data: existingReplacement } = await supabaseServer
      .from('electricity_meters')
      .select('id, meter_number')
      .eq('room_id', roomId)
      .eq('meter_number', cleanedNewMeterNumber)
      .eq('status', 'active')
      .maybeSingle();

    if (existingReplacement) {
      const { data: existingReading } = await supabaseServer
        .from('meter_readings')
        .select('id, reading_value')
        .eq('meter_id', existingReplacement.id)
        .eq('reason', 'initial')
        .maybeSingle();

      const { data: existingSegment } = await supabaseServer
        .from('billing_segments')
        .select('id')
        .eq('meter_id', existingReplacement.id)
        .is('end_date', null)
        .maybeSingle();

      return {
        success: true,
        oldMeter: {
          id: oldMeter.id,
          meter_number: oldMeter.meter_number,
          final_reading_status: 'verified',
          final_reading: null
        },
        newMeter: {
          id: existingReplacement.id,
          meter_number: existingReplacement.meter_number,
          initial_reading: existingReading?.reading_value ?? initialReading,
          initial_reading_id: existingReading?.id || '',
          open_segment_id: existingSegment?.id || ''
        },
        message: `Physical meter was already replaced by ${cleanedNewMeterNumber}.`
      };
    }

    throw new Error('Specified old meter is already inactive and cannot be replaced.');
  }

  // 3. Ensure new meter number is unique across the hostel
  // Notice: uq_meter_number_per_hostel prohibits reusing meter numbers even from inactive meters.
  const { data: duplicateMeter } = await supabaseServer
    .from('electricity_meters')
    .select('id, meter_number, status')
    .eq('hostel_id', hostelId)
    .eq('meter_number', cleanedNewMeterNumber)
    .maybeSingle();

  if (duplicateMeter) {
    throw new Error(
      `Meter number "${cleanedNewMeterNumber}" has already been used in this hostel. ` +
      `Because meter history is permanently preserved, please provide a unique replacement meter number (e.g. ${oldMeter.meter_number}-B or hardware serial number).`
    );
  }

  // 4. Fetch old meter's latest recorded reading
  const { data: latestOldReading } = await supabaseServer
    .from('meter_readings')
    .select('id, reading_value, reading_timestamp')
    .eq('meter_id', oldMeterId)
    .order('reading_timestamp', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Validate final reading value if provided
  if (!finalReadingUnavailable && finalReading !== undefined && finalReading !== null && latestOldReading) {
    if (finalReading < latestOldReading.reading_value) {
      throw new Error(
        `Old meter final reading (${finalReading} kWh) cannot be less than its last recorded reading (${latestOldReading.reading_value} kWh).`
      );
    }
  }

  // Track state for granular rollback in case of subsequent failures
  let insertedOldReadingId: string | null = null;
  let closedSegmentId: string | null = null;
  let oldSegmentOriginalState: any = null;
  let createdNewMeterId: string | null = null;
  let createdNewReadingId: string | null = null;
  let createdNewSegmentId: string | null = null;

  try {
    // 5. Close old meter's open billing segment (if open)
    const { data: openSegment } = await supabaseServer
      .from('billing_segments')
      .select('id, start_date, start_reading_id, occupant_count, segment_type, rate_per_unit')
      .eq('room_id', roomId)
      .eq('meter_id', oldMeterId)
      .is('end_date', null)
      .maybeSingle();

    if (openSegment) {
      oldSegmentOriginalState = { ...openSegment };
      let closingReadingId = latestOldReading?.id;
      let closingReadingValue = latestOldReading?.reading_value ?? 0;

      if (finalReadingUnavailable) {
        // Old meter is unreadable/burned out:
        // Do NOT insert a fake reading. Close segment referencing the last physically verified reading.
        closingReadingId = latestOldReading?.id;
        closingReadingValue = latestOldReading?.reading_value ?? 0;
      } else if (finalReading !== undefined && finalReading !== null) {
        // Final reading was measured and provided
        if (!latestOldReading || finalReading > latestOldReading.reading_value) {
          const { data: finalReadingRow, error: finalReadingErr } = await supabaseServer
            .from('meter_readings')
            .insert({
              meter_id: oldMeterId,
              room_id: roomId,
              hostel_id: hostelId,
              reading_value: finalReading,
              reading_timestamp: new Date().toISOString(),
              recorded_by: userId,
              reason: 'month_end',
              notes: `Final reading prior to physical meter replacement${notes ? `: ${notes}` : ''}`
            })
            .select('id')
            .single();

          if (finalReadingErr) {
            throw new Error(`Failed to record old meter final reading: ${finalReadingErr.message}`);
          }
          insertedOldReadingId = finalReadingRow.id;
          closingReadingId = finalReadingRow.id;
        }
        closingReadingValue = finalReading;
      }

      if (closingReadingId && closingReadingValue !== undefined) {
        closedSegmentId = await closeOpenSegment(
          roomId,
          closingReadingId,
          closingReadingValue,
          new Date()
        );
      }
    }

    // 6. Deactivate old meter with full audit trail
    const auditStatusNote = finalReadingUnavailable
      ? `Final physical reading UNREADABLE / UNAVAILABLE (closed at last verified reading ${latestOldReading?.reading_value ?? 'none'} kWh)`
      : `Final reading verified at ${finalReading ?? latestOldReading?.reading_value ?? 'initial'} kWh`;

    const deactivationNotes = (oldMeter.notes ? `${oldMeter.notes} | ` : '') +
      `Replaced by ${cleanedNewMeterNumber} on ${new Date().toISOString().slice(0, 10)}. ` +
      `${auditStatusNote}${notes ? `. Notes: ${notes}` : ''}`;

    const { error: deactivateErr } = await supabaseServer
      .from('electricity_meters')
      .update({
        status: 'inactive',
        deactivated_at: new Date().toISOString(),
        deactivated_by: userId,
        notes: deactivationNotes
      })
      .eq('id', oldMeterId);

    if (deactivateErr) {
      throw new Error(`Failed to deactivate old meter: ${deactivateErr.message}`);
    }

    // 7. Create new meter in electricity_meters
    const creationNotes = `Replacement for meter ${oldMeter.meter_number}${notes ? `: ${notes}` : ''}`;

    const { data: newMeter, error: newMeterErr } = await supabaseServer
      .from('electricity_meters')
      .insert({
        hostel_id: hostelId,
        room_id: roomId,
        meter_number: cleanedNewMeterNumber,
        status: 'active',
        created_by: userId,
        notes: creationNotes
      })
      .select('id, meter_number')
      .single();

    if (newMeterErr || !newMeter) {
      throw new Error(`Failed to create replacement meter: ${newMeterErr?.message || 'Insert failed'}`);
    }
    createdNewMeterId = newMeter.id;

    // 8. Record initial benchmark reading on new meter (reason: 'initial')
    // Natively passes trg_validate_meter_reading_value because newMeter.id has no prior readings.
    const { data: newReading, error: newReadingErr } = await supabaseServer
      .from('meter_readings')
      .insert({
        meter_id: newMeter.id,
        room_id: roomId,
        hostel_id: hostelId,
        reading_value: initialReading,
        reading_timestamp: new Date().toISOString(),
        recorded_by: userId,
        reason: 'initial',
        notes: `Initial baseline benchmark for replacement meter ${cleanedNewMeterNumber}`
      })
      .select('id, reading_value')
      .single();

    if (newReadingErr || !newReading) {
      throw new Error(`Failed to record initial reading on new meter: ${newReadingErr?.message || 'Insert failed'}`);
    }
    createdNewReadingId = newReading.id;

    // 9. Open a new billing segment on the new meter
    createdNewSegmentId = await createBillingSegment(
      hostelId,
      roomId,
      newMeter.id,
      newReading.id,
      new Date(),
      true
    );

    // 10. Mark pending occupancy change events as completed
    try {
      await supabaseServer
        .from('occupancy_change_events')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          required_reading_id: newReading.id
        })
        .eq('room_id', roomId)
        .eq('status', 'pending_reading');
    } catch (eventErr) {
      console.warn('Non-fatal error resolving pending occupancy events on meter replacement:', eventErr);
    }

    const finalReadingStatus = finalReadingUnavailable
      ? 'unavailable'
      : (finalReading !== undefined && finalReading !== null ? 'verified' : 'not_applicable');

    return {
      success: true,
      oldMeter: {
        id: oldMeter.id,
        meter_number: oldMeter.meter_number,
        final_reading_status: finalReadingStatus,
        final_reading: finalReadingUnavailable ? null : (finalReading ?? latestOldReading?.reading_value ?? null),
        last_known_reading: latestOldReading?.reading_value ?? null,
        closed_segment_id: closedSegmentId
      },
      newMeter: {
        id: newMeter.id,
        meter_number: newMeter.meter_number,
        initial_reading: initialReading,
        initial_reading_id: newReading.id,
        open_segment_id: createdNewSegmentId
      },
      message: finalReadingUnavailable
        ? `Physical meter ${oldMeter.meter_number} marked as unreadable and replaced by ${newMeter.meter_number}. Closed at last known verified reading (${latestOldReading?.reading_value ?? 0} kWh). New meter benchmarked at ${initialReading} kWh.`
        : `Physical meter ${oldMeter.meter_number} replaced by ${newMeter.meter_number} with initial benchmark ${initialReading} kWh.`
    };

  } catch (executionError: any) {
    // -------------------------------------------------------------------------
    // FAILURE-INJECTION ROLLBACK HANDLER
    // Ensure the system is never left in an inconsistent half-transition state.
    // -------------------------------------------------------------------------
    console.error('[Meter Replacement Error] Executing rollback:', executionError.message);

    try {
      // 1. Delete created new billing segment and occupants if created
      if (createdNewSegmentId) {
        await supabaseServer.from('billing_segments').delete().eq('id', createdNewSegmentId);
      }

      // 2. Delete created new reading if created
      if (createdNewReadingId) {
        await supabaseServer.from('meter_readings').delete().eq('id', createdNewReadingId);
      }

      // 3. Delete created new meter if created
      if (createdNewMeterId) {
        await supabaseServer.from('electricity_meters').delete().eq('id', createdNewMeterId);
      }

      // 4. Reactivate old meter if it was deactivated
      await supabaseServer
        .from('electricity_meters')
        .update({
          status: 'active',
          deactivated_at: null,
          deactivated_by: null,
          notes: oldMeter.notes || null
        })
        .eq('id', oldMeterId);

      // 5. If old segment was closed during this attempt, reopen it
      if (closedSegmentId && oldSegmentOriginalState) {
        // Remove student electricity charges generated for this closed segment
        await supabaseServer
          .from('student_electricity_charges')
          .delete()
          .eq('segment_id', closedSegmentId);

        // Reopen segment to maintain exactly one open segment for the room
        await supabaseServer
          .from('billing_segments')
          .update({
            end_reading_id: null,
            end_date: null,
            consumption_units: null,
            total_cost_paise: null,
            closed_at: null
          })
          .eq('id', closedSegmentId);
      }

      // 6. Delete inserted old final reading if created in this attempt
      if (insertedOldReadingId) {
        await supabaseServer.from('meter_readings').delete().eq('id', insertedOldReadingId);
      }

    } catch (rollbackErr: any) {
      console.error('[Meter Replacement Rollback Critical Error]:', rollbackErr.message);
    }

    throw executionError;
  }
}
