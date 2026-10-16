'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  FileText, 
  Users, 
  Gauge, 
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface BillingSegment {
  id: string;
  start_date: string;
  end_date: string | null;
  start_reading_id: string | null;
  end_reading_id: string | null;
  meter_id: string | null;
  start_reading_value: number | null;
  end_reading_value: number | null;
  consumption_units: number | null;
  rate_per_unit: number;
  total_cost_paise: number | null;
  occupant_count: number;
  segment_type: 'occupied' | 'empty';
}

interface SegmentOccupant {
  student_id: string;
  student_name: string;
  student_email: string | null;
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
  segments: (BillingSegment & { occupants: SegmentOccupant[] })[];
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

  const formatCurrency = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatMonth = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, m] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(m, 10) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-center py-20">
        <div className="h-7 w-7 rounded-full border-2 border-teal-600 border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium text-slate-500">Loading room breakdown...</p>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
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
  const openSegments = details.segments.filter(s => !s.end_date);
  const closedSegments = details.segments.filter(s => s.end_date !== null);
  const closedSegmentsCount = details.closed_segments_count ?? closedSegments.length;
  const hasOpenSegment = openSegments.length > 0 || !!details.is_cycle_in_progress;
  const activeSegment = openSegments[0] || null;
  const latestClosedSegment = closedSegments.length > 0 ? closedSegments[0] : null;

  // Comparison values
  const startReadingVal = activeSegment 
    ? activeSegment.start_reading_value 
    : (latestClosedSegment?.start_reading_value ?? details.initial_reading?.value ?? null);
  
  const startReadingDate = activeSegment 
    ? activeSegment.start_date 
    : (latestClosedSegment?.start_date ?? details.initial_reading?.timestamp ?? null);

  const endReadingVal = activeSegment ? null : (latestClosedSegment?.end_reading_value ?? null);
  const endReadingDate = activeSegment ? null : (latestClosedSegment?.end_date ?? null);

  const tariffRate = details.tariff_rate_rupees || 10.0;
  const isZeroConsumption = details.status === 'zero_consumption' || (closedSegmentsCount > 0 && details.total_consumption === 0 && !hasOpenSegment);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-4xl">
      {/* =========================================================================
          SECTION A: ROOM SUMMARY
          Compact header displaying room, hostel, sub-meter, month, status, tariff
          ========================================================================= */}
      <Card className="border border-slate-200/90 bg-white shadow-2xs rounded-xl overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => window.location.href = '/owner/electricity/billing'}
                className="border-slate-200 hover:bg-slate-50 text-slate-700 h-8 w-8 rounded-lg shrink-0"
                aria-label="Back to Billing Overview"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 font-display flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-teal-600" />
                    Room {details.room_number} Breakdown
                  </h1>
                  <Badge 
                    variant="outline" 
                    className={
                      hasOpenSegment && closedSegmentsCount === 0
                        ? 'bg-amber-50 text-amber-800 border-amber-300 text-[11px] font-semibold py-0 px-2 h-5'
                        : isZeroConsumption
                          ? 'bg-slate-100 text-slate-700 border-slate-300 text-[11px] font-semibold py-0 px-2 h-5'
                          : details.status === 'billed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold py-0 px-2 h-5'
                            : 'bg-slate-50 text-slate-600 border-slate-200 text-[11px] font-medium py-0 px-2 h-5'
                    }
                  >
                    {hasOpenSegment && closedSegmentsCount === 0 
                      ? 'Cycle in Progress' 
                      : (details.status_label || 'Billed')}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 mt-1">
                  <span>{details.hostel_name || 'Hostel'}</span>
                  <span>&bull;</span>
                  <span>Sub-Meter: <strong className="font-mono text-slate-700">{details.meter_number || 'None'}</strong></span>
                  <span>&bull;</span>
                  <span>{formatMonth(details.billing_month)}</span>
                  <span>&bull;</span>
                  <span>Tariff: <strong className="text-slate-800">₹{tariffRate.toFixed(2)}/kWh</strong></span>
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
          SECTION B: METER READINGS
          Simple light-background side-by-side comparison with single formula callout
          ========================================================================= */}
      <Card className="border border-slate-200/90 bg-white shadow-2xs rounded-xl overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-teal-600" />
              Meter Readings & Consumption Verification
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Meter #{details.meter_number || 'N/A'}
            </span>
          </div>

          {/* Light-Background Side-by-Side Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Start Reading */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Starting Reading
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                  {startReadingVal !== null ? startReadingVal.toFixed(2) : '—'}
                </span>
                <span className="text-xs font-medium text-slate-500">kWh</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {startReadingDate ? `Recorded on ${formatDate(startReadingDate)}` : 'Baseline benchmark'}
              </p>
            </div>

            {/* Closing Reading */}
            <div className={`p-3.5 rounded-lg border space-y-1 ${
              hasOpenSegment ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-slate-50/60'
            }`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                hasOpenSegment ? 'text-amber-800' : 'text-slate-500'
              }`}>
                Closing Reading
              </span>
              <div className="flex items-baseline gap-1">
                {hasOpenSegment ? (
                  <span className="text-lg sm:text-xl font-bold text-amber-800">
                    Pending
                  </span>
                ) : (
                  <>
                    <span className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                      {endReadingVal !== null ? endReadingVal.toFixed(2) : '—'}
                    </span>
                    <span className="text-xs font-medium text-slate-500">kWh</span>
                  </>
                )}
              </div>
              <p className={`text-[11px] ${hasOpenSegment ? 'text-amber-700' : 'text-slate-400'}`}>
                {hasOpenSegment 
                  ? 'Awaiting month-end meter submission' 
                  : endReadingDate ? `Recorded on ${formatDate(endReadingDate)}` : 'Cycle finalized'}
              </p>
            </div>
          </div>

          {/* Single Formula Strip */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="font-mono text-slate-800">
              <span className="font-sans font-semibold text-slate-600 mr-1.5">Formula:</span>
              <code>Consumption = Closing Reading − Starting Reading</code>
            </div>
            <div className="text-[11px] font-medium text-slate-500">
              {hasOpenSegment ? (
                <span className="text-amber-700">Awaiting closing reading to calculate final consumption</span>
              ) : isZeroConsumption ? (
                <span className="text-slate-700 font-semibold">Net: 0.00 kWh (Meter unchanged)</span>
              ) : (
                <span className="text-slate-900 font-semibold">Net: {details.total_consumption.toFixed(2)} kWh</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =========================================================================
          SECTION C: OCCUPANT AND BILLING BREAKDOWN
          Residents, occupancy dates, tariff, consumption, charges, and payment status
          ========================================================================= */}
      <Card className="border border-slate-200/90 bg-white shadow-2xs rounded-xl overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-teal-600" />
              Occupant & Billing Breakdown
            </span>
            <span className="text-xs text-slate-500">
              {details.current_occupants?.length || 0} Resident{(details.current_occupants?.length !== 1 ? 's' : '')}
            </span>
          </div>

          {/* Case 1: Active Cycle with Charges Pending */}
          {hasOpenSegment && closedSegmentsCount === 0 ? (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg text-xs text-amber-900 leading-relaxed">
                Electricity charge calculation is pending the month-end closing reading. 
                Once recorded, measured kilowatt-hours will be billed at <strong className="font-semibold">₹{tariffRate.toFixed(2)}/kWh</strong> and divided equally among active residents.
              </div>

              {details.current_occupants && details.current_occupants.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                    Residents in this active cycle:
                  </span>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/30">
                    {details.current_occupants.map(occupant => (
                      <div key={occupant.student_id} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-900">{occupant.student_name}</p>
                          {occupant.student_email && (
                            <p className="text-[11px] text-slate-400">{occupant.student_email}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[11px] bg-white text-slate-600 border-slate-200">
                          Active Resident
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No residents currently allocated to this room.</p>
              )}
            </div>
          ) : (
            /* Case 2: Closed Segments with Finalized Charges */
            <div className="space-y-3">
              {/* If an active cycle also exists alongside closed segments (e.g. occupancy change mid-month) */}
              {hasOpenSegment && (
                <div className="p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-lg text-xs text-amber-800 flex items-center justify-between">
                  <span>A subsequent billing cycle is currently active from {activeSegment?.start_reading_value} kWh.</span>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">Open Cycle</Badge>
                </div>
              )}

              {/* Segments Breakdown List */}
              {closedSegments.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No finalized billing segments recorded for this period.</p>
              ) : (
                <div className="space-y-2.5">
                  {closedSegments.map((segment, idx) => {
                    const isEmpty = segment.segment_type === 'empty';
                    return (
                      <div key={segment.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/40 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                            <span>Interval #{idx + 1}:</span>
                            <span className="font-normal text-slate-600">
                              {formatDate(segment.start_date)} &rarr; {formatDate(segment.end_date!)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-slate-900">
                              {segment.consumption_units !== null ? `${segment.consumption_units.toFixed(2)} kWh` : '0.00 kWh'}
                            </span>
                            <span className="text-slate-400">&bull;</span>
                            <span className="font-mono font-bold text-emerald-700">
                              {segment.total_cost_paise !== null ? formatCurrency(segment.total_cost_paise) : '₹0.00'}
                            </span>
                          </div>
                        </div>

                        {/* Occupant Charges */}
                        {isEmpty ? (
                          <p className="text-[11px] text-slate-500 italic">
                            Unoccupied Room &mdash; Consumption attributed to owner account.
                          </p>
                        ) : segment.occupants.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/60 text-xs">
                            {segment.occupants.map(occ => {
                              const charge = details.student_charges.find(
                                c => c.student_id === occ.student_id && c.segment_id === segment.id
                              );
                              return (
                                <div key={occ.student_id} className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded border border-slate-200/70">
                                  <span className="font-medium text-slate-700">{occ.student_name}</span>
                                  <span className="font-mono font-bold text-emerald-700">
                                    {charge ? formatCurrency(charge.charge_amount_paise) : '₹0.00'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">No residents allocated during this interval.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
