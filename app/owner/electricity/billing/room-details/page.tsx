'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  FileText, 
  Users, 
  Gauge, 
  AlertCircle,
  ReceiptIndianRupee,
  Calendar,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface SegmentOccupant {
  student_id: string;
  student_name: string;
  student_email: string | null;
  allocation_id?: string;
  charge_amount_paise?: number | null;
  fee_id?: string | null;
  fee_status?: string | null;
  fee_due_date?: string | null;
}

interface BillingSegment {
  id: string;
  start_date: string;
  end_date: string | null;
  billing_month: string;
  created_at?: string;
  closed_at?: string | null;
  start_reading_id: string | null;
  end_reading_id: string | null;
  meter_id: string | null;
  start_reading_value: number | null;
  start_reading_timestamp: string | null;
  start_reading_reason: string | null;
  end_reading_value: number | null;
  end_reading_timestamp: string | null;
  end_reading_reason: string | null;
  consumption_units: number | null;
  rate_per_unit: number;
  total_cost_paise: number | null;
  occupant_count: number;
  segment_type: 'occupied' | 'empty';
  occupants: SegmentOccupant[];
  is_current_month?: boolean;
}

interface StudentCharge {
  student_id: string;
  student_name: string;
  charge_amount_paise: number;
  segment_id: string;
}

interface RoomBillingDetails {
  room_id: string;
  room_number: string;
  hostel_id?: string;
  hostel_name?: string;
  billing_month: string;
  meter_id: string | null;
  meter_number?: string | null;
  meter_status?: string | null;
  status?: string;
  status_label?: string;
  status_explanation?: string;
  initial_reading?: {
    id: string;
    value: number;
    timestamp: string;
    reason: string;
  } | null;
  latest_reading?: {
    id: string;
    value: number;
    timestamp: string;
    reason: string;
  } | null;
  all_readings?: {
    id: string;
    value: number;
    timestamp: string;
    reason: string;
  }[];
  current_occupants?: {
    student_id: string;
    student_name: string;
    student_email: string | null;
    start_date: string;
  }[];
  tariff_rate_rupees?: number;
  segments: BillingSegment[];
  student_charges: StudentCharge[];
  total_consumption: number;
  total_cost_paise: number;
  closed_segments_count?: number;
  open_segments_count?: number;
  is_cycle_in_progress?: boolean;
}

export default function RoomBillingDetailsPage() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room_id');
  const month = searchParams.get('month');
  
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<RoomBillingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !month) {
      setError('Missing required parameters: room_id and month');
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        const params = new URLSearchParams({
          room_id: roomId,
          billing_month: month
        });

        const response = await fetch(`/api/billing/room-details?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch billing details');
        
        const data = await response.json();
        setDetails(data);
      } catch (err: any) {
        console.error('Error fetching billing details:', err);
        setError(err.message || 'Failed to load billing details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [roomId, month]);

  const formatCurrency = (paise?: number | null) => {
    if (paise == null) return '₹0.00';
    return `₹${(paise / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const datePart = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timePart = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${datePart} at ${timePart}`;
  };

  const formatMonth = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, m] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(m, 10) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const formatReason = (reason?: string | null) => {
    if (!reason) return 'Reading';
    switch (reason) {
      case 'initial': return 'Initial Benchmark';
      case 'month_end': return 'Month End';
      case 'occupancy_change': return 'Occupancy Change';
      case 'meter_reset': return 'Meter Reset';
      case 'manual_override': return 'Manual Benchmark';
      default: return reason.replace(/_/g, ' ');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="h-7 w-7 rounded-full border-2 border-teal-600 border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium text-slate-500">Loading room breakdown...</p>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-900 text-sm">Error Loading Breakdown</h3>
              <p className="text-xs text-red-700 mt-1">{error || 'Failed to load billing details'}</p>
              <Button 
                variant="outline" 
                size="sm"
                className="mt-3 text-xs border-red-200 text-red-800"
                onClick={() => window.location.href = '/owner/electricity/billing'}
              >
                Back to Billing Overview
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Segment classification
  const openSegments = (details.segments || []).filter(s => !s.end_date);
  const closedSegments = (details.segments || []).filter(s => s.end_date !== null);
  const hasOpenSegment = openSegments.length > 0 || !!details.is_cycle_in_progress;
  const activeSegment = openSegments[0] || null;
  const latestClosedSegment = closedSegments.length > 0 ? closedSegments[0] : null;

  // Comparison baseline values
  const startReadingVal = activeSegment 
    ? activeSegment.start_reading_value 
    : (latestClosedSegment?.start_reading_value ?? details.initial_reading?.value ?? null);
  
  const startReadingDate = activeSegment 
    ? (activeSegment.start_reading_timestamp || activeSegment.start_date)
    : ((latestClosedSegment?.start_reading_timestamp || latestClosedSegment?.start_date) ?? details.initial_reading?.timestamp ?? null);

  const endReadingVal = activeSegment ? null : (latestClosedSegment?.end_reading_value ?? null);
  const endReadingDate = activeSegment ? null : ((latestClosedSegment?.end_reading_timestamp || latestClosedSegment?.end_date) ?? null);

  const tariffRate = details.tariff_rate_rupees || 10.0;
  const isZeroConsumption = details.status === 'zero_consumption' || (closedSegments.length > 0 && details.total_consumption === 0 && !hasOpenSegment);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* =========================================================================
          SECTION A: ROOM SUMMARY
          Compact header displaying room, hostel, sub-meter, month, status, tariff
          ========================================================================= */}
      <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-2xs rounded-xl overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => window.location.href = '/owner/electricity/billing'}
                className="border-slate-200 dark:border-[#1a3d52] hover:bg-slate-50 dark:hover:bg-[#122b3b] text-slate-700 dark:text-slate-200 h-8 w-8 rounded-lg shrink-0"
                aria-label="Back to Billing Overview"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-display flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    Room {details.room_number} Breakdown
                  </h1>
                  <Badge 
                    variant="outline" 
                    className={
                      hasOpenSegment
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-[11px] font-semibold py-0 px-2 h-5'
                        : isZeroConsumption
                          ? 'bg-slate-100 dark:bg-[#122b3b] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1a3d52] text-[11px] font-semibold py-0 px-2 h-5'
                          : details.status === 'billed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold py-0 px-2 h-5'
                            : 'bg-slate-50 dark:bg-[#122b3b] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#1a3d52] text-[11px] font-medium py-0 px-2 h-5'
                    }
                  >
                    {hasOpenSegment
                      ? 'Cycle in Progress' 
                      : (details.status_label || 'Billed')}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>{details.hostel_name || 'Hostel'}</span>
                  <span>&bull;</span>
                  <span>Sub-Meter: <strong className="font-mono text-slate-700 dark:text-slate-200">{details.meter_number || 'None'}</strong></span>
                  <span>&bull;</span>
                  <span>{formatMonth(details.billing_month)}</span>
                  <span>&bull;</span>
                  <span>Tariff: <strong className="text-slate-800 dark:text-slate-200">₹{tariffRate.toFixed(2)}/kWh</strong></span>
                </div>
              </div>
            </div>

            {/* Header Action Button for Active Cycle */}
            {details.meter_id && hasOpenSegment && (
              <Button
                size="sm"
                asChild
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold h-8 shadow-2xs shrink-0 self-start sm:self-auto"
              >
                <Link href={`/owner/electricity/readings/record?meter_id=${details.meter_id}&reason=month_end`}>
                  Record Closing Reading
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* =========================================================================
          SECTION B: ACTIVE CYCLE PANEL (Rendered separately when an active cycle exists)
          Shows baseline reading, baseline date, current occupants, tariff, and pending state
          ========================================================================= */}
      {hasOpenSegment && (
        <Card className="border border-amber-300/80 dark:border-amber-700/60 bg-amber-50/30 dark:bg-amber-950/20 shadow-2xs rounded-xl overflow-hidden">
          <CardContent className="p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-amber-800/60">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  Active Billing Cycle in Progress
                </span>
              </div>
              <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 text-[10px] font-semibold">
                Open Cycle
              </Badge>
            </div>

            <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
              This room currently has an active unclosed billing cycle. Kilowatt-hour consumption and individual student fee allocations will be computed once the month-end closing reading is submitted.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Baseline Reading */}
              <div className="bg-white/80 dark:bg-[#122b3b] border border-amber-200/70 dark:border-[#1a3d52] rounded-lg p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800/80 dark:text-amber-400 block">
                  Baseline Starting Reading
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {activeSegment?.start_reading_value != null ? activeSegment.start_reading_value.toFixed(2) : (startReadingVal != null ? startReadingVal.toFixed(2) : '—')}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">kWh</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatDateTime(activeSegment?.start_reading_timestamp || activeSegment?.start_date || startReadingDate)}
                </p>
              </div>

              {/* Closing Reading */}
              <div className="bg-white/80 dark:bg-[#122b3b] border border-amber-200/70 dark:border-[#1a3d52] rounded-lg p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800/80 dark:text-amber-400 block">
                  Closing Reading
                </span>
                <div className="text-lg font-bold text-amber-800 dark:text-amber-300">
                  Pending Submission
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Awaiting month-end recording
                </p>
              </div>

              {/* Active Tariff & Action */}
              <div className="bg-white/80 dark:bg-[#122b3b] border border-amber-200/70 dark:border-[#1a3d52] rounded-lg p-3 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800/80 dark:text-amber-400 block">
                    Cycle Tariff Rate
                  </span>
                  <p className="text-base font-bold text-slate-900 dark:text-white">
                    ₹{tariffRate.toFixed(2)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ kWh</span>
                  </p>
                </div>
                {details.meter_id && (
                  <Button
                    size="sm"
                    asChild
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold h-7 rounded shadow-2xs"
                  >
                    <Link href={`/owner/electricity/readings/record?meter_id=${details.meter_id}&reason=month_end`}>
                      Record Reading Now
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Current Residents in active cycle */}
            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
              <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-300 uppercase tracking-wide block mb-1.5">
                Current Room Occupants ({details.current_occupants?.length || 0}):
              </span>
              {details.current_occupants && details.current_occupants.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {details.current_occupants.map(occ => (
                    <div key={occ.student_id} className="bg-white/90 dark:bg-[#122b3b] border border-amber-200/70 dark:border-[#1a3d52] rounded-lg p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{occ.student_name}</p>
                        {occ.student_email && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-400">{occ.student_email}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                        Active Resident
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 italic">No residents currently allocated to this room.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* =========================================================================
          SECTION C: METER READINGS & FORMULA VERIFICATION
          Light-background comparison with single formula callout
          ========================================================================= */}
      <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-2xs rounded-xl overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#1a3d52]">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Meter Readings &amp; Consumption Formula
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-400 font-mono">
              Meter #{details.meter_number || 'N/A'}
            </span>
          </div>

          {/* Light/Dark-Background Side-by-Side Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Start Reading */}
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-[#1a3d52] bg-slate-50/60 dark:bg-[#122b3b] space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Starting Reading
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
                  {startReadingVal !== null ? startReadingVal.toFixed(2) : '—'}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">kWh</span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-400">
                {startReadingDate ? `Recorded: ${formatDateTime(startReadingDate)}` : 'Baseline benchmark'}
              </p>
            </div>

            {/* Closing Reading */}
            <div className={`p-3.5 rounded-lg border space-y-1 ${
              hasOpenSegment ? 'border-amber-200 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/30' : 'border-slate-200 dark:border-[#1a3d52] bg-slate-50/60 dark:bg-[#122b3b]'
            }`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                hasOpenSegment ? 'text-amber-800 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'
              }`}>
                Closing Reading
              </span>
              <div className="flex items-baseline gap-1">
                {hasOpenSegment ? (
                  <span className="text-lg sm:text-xl font-bold text-amber-800 dark:text-amber-300">
                    Pending
                  </span>
                ) : (
                  <>
                    <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
                      {endReadingVal !== null ? endReadingVal.toFixed(2) : '—'}
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">kWh</span>
                  </>
                )}
              </div>
              <p className={`text-[11px] ${hasOpenSegment ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-400'}`}>
                {hasOpenSegment 
                  ? 'Awaiting month-end meter recording' 
                  : endReadingDate ? `Recorded: ${formatDateTime(endReadingDate)}` : 'Cycle finalized'}
              </p>
            </div>
          </div>

          {/* Single Formula Strip */}
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#122b3b] border border-slate-200 dark:border-[#1a3d52] text-xs text-slate-700 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="font-mono text-slate-800 dark:text-slate-200">
              <span className="font-sans font-semibold text-slate-600 dark:text-slate-400 mr-1.5">Formula:</span>
              <code>Consumption = Closing Reading − Starting Reading</code>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {hasOpenSegment ? (
                <span className="text-amber-700 dark:text-amber-400 font-medium">Awaiting closing reading to calculate final consumption</span>
              ) : isZeroConsumption ? (
                <span className="text-slate-700 dark:text-slate-300 font-semibold">Net: 0.00 kWh (Meter unchanged)</span>
              ) : (
                <span className="text-slate-900 dark:text-white font-semibold">Net: {details.total_consumption.toFixed(2)} kWh</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =========================================================================
          SECTION D: FINALIZED BILLING SEGMENT HISTORY
          Complete segment-by-segment record with readings, delta, tariff, costs,
          associated occupants, individual shares with formulas, and fee statuses.
          ========================================================================= */}
      <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-2xs rounded-xl overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#1a3d52]">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <ReceiptIndianRupee className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Billing Segment History
              </span>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
                Immutable record of finalized intervals, verified meter delta, and resident cost allocations
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-medium text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1a3d52] bg-slate-50 dark:bg-[#122b3b]">
              {closedSegments.length} Finalized Segment{closedSegments.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Case 1: No Finalized Segments in Database */}
          {closedSegments.length === 0 ? (
            <div className="py-10 text-center px-4">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-[#122b3b] text-slate-400 dark:text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Finalized Segments Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                There are currently no closed billing intervals recorded for this room. When a month-end or an occupancy-change meter reading is submitted, the finalized segment will appear here with previous/closing readings, calculated kilowatt-hours, historical tariff, and student share breakdowns.
              </p>
              {hasOpenSegment && (
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-3">
                  An active billing cycle is currently running above awaiting its closing reading.
                </p>
              )}
            </div>
          ) : (
            /* Case 2: Finalized Billing Segments List */
            <div className="space-y-4">
              {closedSegments.map((segment, idx) => {
                const segmentNum = closedSegments.length - idx;
                const isEmpty = segment.segment_type === 'empty' || segment.occupant_count === 0;
                const consumption = segment.consumption_units != null ? segment.consumption_units : 0;
                const costPaise = segment.total_cost_paise != null ? segment.total_cost_paise : 0;
                const costRupees = (costPaise / 100).toFixed(2);
                const occupantCount = segment.occupants?.length || segment.occupant_count || 1;
                const baseShareRupees = occupantCount > 0 ? ((costPaise / occupantCount) / 100).toFixed(2) : costRupees;

                return (
                  <div 
                    key={segment.id} 
                    className="border border-slate-200/90 dark:border-[#1a3d52] rounded-xl p-4 bg-slate-50/30 dark:bg-[#122b3b]/30 hover:bg-slate-50/60 dark:hover:bg-[#122b3b]/60 transition-colors space-y-3.5"
                  >
                    {/* Segment Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70 dark:border-[#1a3d52]">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-md bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center font-mono">
                          #{segmentNum}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                              Segment {segmentNum} &mdash; {formatMonth(segment.billing_month)}
                            </h2>
                            <Badge className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold py-0">
                              Finalized
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Period: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(segment.start_date)}</span> to <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(segment.end_date)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Summary Metrics */}
                      <div className="flex items-center gap-3 self-start sm:self-auto text-right">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block">Consumption</span>
                          <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                            {consumption.toFixed(2)} kWh
                          </span>
                        </div>
                        <div className="h-7 w-[1px] bg-slate-200 dark:bg-[#1a3d52]" />
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block">Total Cost</span>
                          <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(costPaise)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Reading Verification Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {/* Previous / Start Reading */}
                      <div className="bg-white dark:bg-[#0e222e] p-2.5 rounded-lg border border-slate-200 dark:border-[#1a3d52] space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wide block">
                          Previous Reading ({formatReason(segment.start_reading_reason)})
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-bold font-mono text-slate-800 dark:text-slate-200">
                            {segment.start_reading_value != null ? segment.start_reading_value.toFixed(2) : '—'}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">kWh</span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-400">
                          {formatDateTime(segment.start_reading_timestamp || segment.start_date)}
                        </p>
                      </div>

                      {/* Closing Reading */}
                      <div className="bg-white dark:bg-[#0e222e] p-2.5 rounded-lg border border-slate-200 dark:border-[#1a3d52] space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wide block">
                          Closing Reading ({formatReason(segment.end_reading_reason)})
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-bold font-mono text-slate-800 dark:text-slate-200">
                            {segment.end_reading_value != null ? segment.end_reading_value.toFixed(2) : '—'}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">kWh</span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-400">
                          {formatDateTime(segment.end_reading_timestamp || segment.end_date)}
                        </p>
                      </div>

                      {/* Tariff Rate & Net Delta */}
                      <div className="bg-white dark:bg-[#0e222e] p-2.5 rounded-lg border border-slate-200 dark:border-[#1a3d52] space-y-0.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wide block">
                            Historical Tariff &amp; Delta
                          </span>
                          <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                            ₹{Number(segment.rate_per_unit || tariffRate).toFixed(2)}/kWh &bull; &Delta; {consumption.toFixed(2)} kWh
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {segment.end_reading_value != null && segment.start_reading_value != null ? (
                            `${segment.end_reading_value.toFixed(2)} − ${segment.start_reading_value.toFixed(2)} = ${consumption.toFixed(2)} kWh`
                          ) : 'Calculated Delta'}
                        </p>
                      </div>
                    </div>

                    {/* Occupants & Individual Allocation Section */}
                    <div className="pt-2 border-t border-slate-200/70 dark:border-[#1a3d52] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                          Occupant Allocation &amp; Payment Status
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {segment.occupants.length} Resident{segment.occupants.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {isEmpty ? (
                        <div className="bg-white dark:bg-[#0e222e] p-3 rounded-lg border border-slate-200 dark:border-[#1a3d52] text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                          <Info className="h-4 w-4 text-slate-400 shrink-0" />
                          <span>
                            <strong>Unoccupied Period:</strong> Measured consumption of <strong>{consumption.toFixed(2)} kWh</strong> ({formatCurrency(costPaise)}) is attributed to the owner account / vacant room period.
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Calculation explanation note */}
                          <div className="p-2.5 bg-white dark:bg-[#0e222e] rounded-lg border border-slate-200 dark:border-[#1a3d52] text-xs text-slate-700 dark:text-slate-300 font-mono flex items-center justify-between">
                            <span className="text-[11px]">
                              <strong className="font-sans font-semibold text-slate-600 dark:text-slate-400 mr-1">Calculation:</strong>
                              ₹{costRupees} total &divide; {occupantCount} resident{occupantCount > 1 ? 's' : ''} = ₹{baseShareRupees} base share (with deterministic remainder allocation)
                            </span>
                          </div>

                          {/* Individual Occupants Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {segment.occupants.map(occ => {
                              const sharePaise = occ.charge_amount_paise != null ? occ.charge_amount_paise : Math.round(costPaise / occupantCount);
                              const feeStatus = occ.fee_status || 'billed';
                              
                              return (
                                <div 
                                  key={occ.student_id} 
                                  className="bg-white dark:bg-[#0e222e] p-2.5 rounded-lg border border-slate-200 dark:border-[#1a3d52] flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">{occ.student_name}</p>
                                    {occ.student_email && (
                                      <p className="text-[11px] text-slate-400 dark:text-slate-400">{occ.student_email}</p>
                                    )}
                                  </div>
                                  <div className="text-right space-y-1">
                                    <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                      {formatCurrency(sharePaise)}
                                    </div>
                                    <div>
                                      {feeStatus === 'paid' ? (
                                        <Badge className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] py-0">
                                          Paid
                                        </Badge>
                                      ) : feeStatus === 'pending_verification' ? (
                                        <Badge className="bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-[10px] py-0">
                                          Payment Submitted
                                        </Badge>
                                      ) : feeStatus === 'overdue' ? (
                                        <Badge className="bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 text-[10px] py-0">
                                          Overdue
                                        </Badge>
                                      ) : feeStatus === 'pending' ? (
                                        <Badge className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-[10px] py-0">
                                          Payment Due
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1a3d52] text-[10px] py-0">
                                          Billed
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
