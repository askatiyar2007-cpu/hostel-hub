'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  FileText, 
  Users, 
  Clock, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  Gauge,
  Calculator,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());

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
        
        if (!response.ok) {
          throw new Error('Failed to fetch billing details');
        }
        
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

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleSegment = (segmentId: string) => {
    setExpandedSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId);
      } else {
        newSet.add(segmentId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="h-8 w-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading room billing breakdown...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-bold text-red-900 text-sm">Error Loading Billing Details</h3>
                <p className="text-xs text-red-700 mt-1">{error || 'Failed to load billing details'}</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="mt-4 border-red-200 text-red-800 hover:bg-red-100/60"
                  onClick={() => window.location.href = '/owner/electricity/billing'}
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  Back to Billing Overview
                </Button>
              </div>
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

  // Group charges by student
  const chargesByStudent = details.student_charges.reduce((acc, charge) => {
    if (!acc[charge.student_id]) {
      acc[charge.student_id] = {
        student_name: charge.student_name,
        total_charge: 0,
        total_consumption: 0,
        segments: []
      };
    }
    acc[charge.student_id].total_charge += charge.charge_amount_paise;
    
    const segment = details.segments.find(s => s.id === charge.segment_id);
    if (segment && segment.rate_per_unit > 0) {
      const consumption = charge.charge_amount_paise / 100 / segment.rate_per_unit;
      acc[charge.student_id].total_consumption += consumption;
    }
    
    acc[charge.student_id].segments.push({
      segment_id: charge.segment_id,
      charge: charge.charge_amount_paise,
      consumption: segment ? charge.charge_amount_paise / 100 / segment.rate_per_unit : 0
    });
    return acc;
  }, {} as Record<string, { student_name: string; total_charge: number; total_consumption: number; segments: Array<{ segment_id: string; charge: number; consumption: number }> }>);

  // Determine comparison panel values
  // Priority: Active cycle comparison if cycle in progress, otherwise latest closed segment
  const comparisonStartVal = activeSegment 
    ? activeSegment.start_reading_value 
    : (latestClosedSegment?.start_reading_value ?? details.initial_reading?.value ?? null);
  
  const comparisonStartDate = activeSegment 
    ? activeSegment.start_date 
    : (latestClosedSegment?.start_date ?? details.initial_reading?.timestamp ?? null);

  const comparisonEndVal = activeSegment 
    ? null 
    : (latestClosedSegment?.end_reading_value ?? null);

  const comparisonEndDate = activeSegment 
    ? null 
    : (latestClosedSegment?.end_date ?? null);

  const isZeroConsumption = details.status === 'zero_consumption' || (closedSegmentsCount > 0 && details.total_consumption === 0 && !hasOpenSegment);
  const tariffRate = details.tariff_rate_rupees || 10.0;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => window.location.href = '/owner/electricity/billing'}
            className="border-slate-200 hover:bg-slate-50 text-slate-700 h-9 w-9 rounded-lg shrink-0"
            aria-label="Back to Billing Overview"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-900 font-display">
                <FileText className="h-5 w-5 md:h-6 md:w-6 text-teal-600" />
                Room {details.room_number} Billing Breakdown
              </h1>
              {details.status_label && (
                <Badge 
                  variant="outline" 
                  className={
                    details.status === 'billed' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold' 
                      : details.status === 'zero_consumption'
                        ? 'bg-slate-100 text-slate-700 border-slate-300 font-semibold'
                        : details.status?.startsWith('awaiting_') || hasOpenSegment
                          ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold' 
                          : 'bg-slate-100 text-slate-600 border-slate-200 font-semibold'
                  }
                >
                  {hasOpenSegment && closedSegmentsCount === 0 
                    ? 'Awaiting Month-End Reading' 
                    : details.status_label}
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {details.hostel_name ? `${details.hostel_name} • ` : ''}
              Sub-Meter: <span className="font-mono font-semibold text-slate-700">{details.meter_number || 'None'}</span> •{' '}
              {new Date(details.billing_month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {details.meter_id && hasOpenSegment && (
          <Button
            size="sm"
            onClick={() => {
              window.location.href = `/owner/electricity/readings/record?meter_id=${details.meter_id}&reason=month_end`;
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold h-9 shadow-xs shrink-0 flex items-center gap-1.5"
          >
            <Gauge className="h-3.5 w-3.5" />
            Record Closing Reading
          </Button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Room Consumption</p>
          <div className="mt-1">
            {hasOpenSegment && closedSegmentsCount === 0 ? (
              <div>
                <span className="text-base sm:text-lg font-bold text-amber-700">Pending Reading</span>
                <p className="text-[10px] text-amber-600 font-medium">Cycle in progress</p>
              </div>
            ) : (
              <div>
                <span className="text-lg sm:text-xl font-bold text-slate-900">
                  {details.total_consumption.toFixed(2)} <span className="text-xs font-normal text-slate-500">kWh</span>
                </span>
                {hasOpenSegment && (
                  <p className="text-[10px] text-amber-600 font-medium">+ Active cycle ongoing</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Total Billed Cost</p>
          <div className="mt-1">
            {hasOpenSegment && closedSegmentsCount === 0 ? (
              <div>
                <span className="text-base sm:text-lg font-bold text-slate-400">₹0.00</span>
                <p className="text-[10px] text-slate-500">Unbilled cycle</p>
              </div>
            ) : (
              <div>
                <span className="text-lg sm:text-xl font-bold text-emerald-700">
                  {formatCurrency(details.total_cost_paise)}
                </span>
                <p className="text-[10px] text-slate-500">Finalized charges</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Closed Segments</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg sm:text-xl font-bold text-slate-900">
              {closedSegmentsCount}
            </span>
            {hasOpenSegment && (
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 py-0 px-1.5 h-4">
                1 Active Cycle
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Finalized billing intervals</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Hostel Tariff</p>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-bold text-slate-900">
              ₹{tariffRate.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 font-normal"> / kWh</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Hostel-wide rate</p>
        </div>
      </div>

      {/* Prominent Reading Comparison & Delta Banner Panel */}
      <Card className="border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-teal-400" />
              <h2 className="text-sm sm:text-base font-bold font-display">
                Meter Reading Comparison & Delta Verification
              </h2>
            </div>
            <span className="text-[11px] font-mono text-teal-300 bg-teal-950/60 border border-teal-800/80 px-2.5 py-0.5 rounded-full">
              Meter #{details.meter_number || 'N/A'}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Auditable reading interval used to measure exact kilowatt-hour consumption for this room.
          </p>
        </div>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Two-Box Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
            {/* Start / Previous Reading Box */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {hasOpenSegment && closedSegmentsCount === 0 ? 'Active Cycle Baseline' : 'Start Reading'}
                </span>
                <Badge variant="outline" className="text-[10px] bg-slate-200/80 text-slate-700 border-slate-300">
                  {activeSegment ? 'Cycle Start' : (latestClosedSegment ? 'Interval Start' : 'Baseline')}
                </Badge>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                  {comparisonStartVal !== null ? `${comparisonStartVal.toFixed(2)}` : '—'}
                </span>
                <span className="text-xs font-semibold text-slate-500">kWh</span>
              </div>
              <p className="text-xs text-slate-500">
                {comparisonStartDate ? `Recorded on ${formatDate(comparisonStartDate)}` : 'No start reading recorded'}
              </p>
            </div>

            {/* End / Closing Reading Box */}
            <div className={`p-4 rounded-xl border space-y-2 ${
              hasOpenSegment 
                ? 'border-amber-300 bg-amber-50/50' 
                : 'border-slate-200 bg-slate-50/70'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  hasOpenSegment ? 'text-amber-800' : 'text-slate-500'
                }`}>
                  {hasOpenSegment ? 'Month-End Closing Reading' : 'End Reading'}
                </span>
                {hasOpenSegment ? (
                  <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 font-bold">
                    PENDING
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">
                    FINALIZED
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                {hasOpenSegment ? (
                  <span className="text-lg sm:text-xl font-bold text-amber-800">
                    Awaiting Reading
                  </span>
                ) : (
                  <>
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                      {comparisonEndVal !== null ? `${comparisonEndVal.toFixed(2)}` : '—'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">kWh</span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {hasOpenSegment ? (
                  <span className="text-amber-700 font-medium">Record reading at month-end to close cycle</span>
                ) : (
                  comparisonEndDate ? `Recorded on ${formatDate(comparisonEndDate)}` : 'No closing reading'
                )}
              </p>
            </div>
          </div>

          {/* Explicit Delta Formula Strip */}
          <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            hasOpenSegment 
              ? 'bg-amber-50/80 border-amber-200 text-amber-900' 
              : isZeroConsumption
                ? 'bg-slate-100 border-slate-300 text-slate-800'
                : 'bg-teal-50/80 border-teal-200 text-teal-950'
          }`}>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                <Calculator className="h-3.5 w-3.5 text-teal-700" />
                <span>Delta Calculation Formula</span>
              </div>
              <p className="text-xs sm:text-sm font-medium">
                {hasOpenSegment ? (
                  <span>
                    <strong>Cycle in Progress:</strong> Baseline = <span className="font-mono font-bold">{comparisonStartVal !== null ? `${comparisonStartVal.toFixed(2)} kWh` : 'Pending'}</span>. 
                    Formula: <code className="bg-white/80 px-1.5 py-0.5 rounded text-xs font-mono font-bold text-amber-900">Consumption = Closing Reading − Start Reading</code>.
                  </span>
                ) : isZeroConsumption ? (
                  <span>
                    <strong>Zero Measured Consumption:</strong> Meter remained unchanged at <span className="font-mono font-bold">{comparisonStartVal?.toFixed(2)} kWh</span>. 
                    Delta: <code className="bg-white/80 px-1.5 py-0.5 rounded text-xs font-mono font-bold text-slate-800">0.00 kWh</code>.
                  </span>
                ) : (
                  <span>
                    <strong>Calculated Consumption:</strong> <span className="font-mono font-bold">{comparisonEndVal?.toFixed(2)} kWh</span> − <span className="font-mono font-bold">{comparisonStartVal?.toFixed(2)} kWh</span> = <span className="font-mono font-extrabold text-teal-900 bg-white/80 px-1.5 py-0.5 rounded">{details.total_consumption.toFixed(2)} kWh</span>
                  </span>
                )}
              </p>
            </div>

            {hasOpenSegment && details.meter_id && (
              <Button
                size="sm"
                onClick={() => {
                  window.location.href = `/owner/electricity/readings/record?meter_id=${details.meter_id}&reason=month_end`;
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold h-8 shadow-2xs shrink-0"
              >
                Record Reading
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charge Calculation Breakdown Card */}
      <Card className="border border-slate-200 shadow-xs">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold flex items-center gap-2 text-slate-900 font-display">
              <Users className="h-4 w-4 text-teal-600" />
              Charge Calculation & Occupant Cost Breakdown
            </h2>
            <Badge variant="outline" className="text-xs font-semibold text-slate-600 border-slate-200">
              {details.current_occupants?.length || 0} Current Occupant{details.current_occupants?.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Formula Breakdown Banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-slate-600" />
              Room Billing Formula
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">1. Total Room Cost</span>
                <span className="font-mono font-bold text-slate-900">
                  {hasOpenSegment && closedSegmentsCount === 0 
                    ? `Units × ₹${tariffRate.toFixed(2)}` 
                    : `${details.total_consumption.toFixed(2)} kWh × ₹${tariffRate.toFixed(2)} = ₹${(details.total_cost_paise / 100).toFixed(2)}`}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">2. Division Method</span>
                <span className="font-mono font-bold text-slate-900">
                  Total Cost ÷ Occupants Active in Segment
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">3. Student Obligation</span>
                <span className="font-mono font-bold text-teal-700">
                  {hasOpenSegment && closedSegmentsCount === 0 
                    ? 'Computed on cycle closure' 
                    : `Direct per-student charge`}
                </span>
              </div>
            </div>
          </div>

          {/* Student Charges Table or Pending Status */}
          {hasOpenSegment && closedSegmentsCount === 0 ? (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">
                    Charges Pending Month-End Meter Reading
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Room {details.room_number} currently has an open billing cycle starting at <strong className="font-mono">{comparisonStartVal !== null ? `${comparisonStartVal.toFixed(2)} kWh` : 'baseline'}</strong>. 
                    Individual student charges will be calculated and billed automatically once the month-end closing reading is recorded.
                  </p>
                </div>
              </div>

              {/* Current Occupants List */}
              {details.current_occupants && details.current_occupants.length > 0 && (
                <div className="pt-2 border-t border-amber-200/80">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Occupants in this active cycle:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {details.current_occupants.map(occupant => (
                      <div key={occupant.student_id} className="p-2.5 bg-white rounded-lg border border-amber-200/60 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{occupant.student_name}</p>
                          {occupant.student_email && (
                            <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{occupant.student_email}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300">
                          Active Resident
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : Object.keys(chargesByStudent).length === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-sm font-semibold text-slate-600">No student charges found for this billing period</p>
              <p className="text-xs text-slate-400 mt-1">
                {isZeroConsumption 
                  ? 'Zero kilowatt-hours measured across all closed segments; no charges were generated.' 
                  : 'Room was unoccupied or had no active student allocations during closed segments.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(chargesByStudent).map(([studentId, data]) => (
                <div 
                  key={studentId} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{data.student_name}</span>
                      <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-200">
                        {data.segments.length} segment{data.segments.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      Calculated share: <strong className="font-mono text-slate-700">{data.total_consumption.toFixed(2)} kWh</strong>
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <p className="text-base sm:text-lg font-bold text-emerald-700 font-mono">
                        {formatCurrency(data.total_charge)}
                      </p>
                      <p className="text-[10px] text-slate-400">Total Billed</p>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                      Billed
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Segments & Timeline */}
      <Card className="border border-slate-200 shadow-xs">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold flex items-center gap-2 text-slate-900 font-display">
              <Clock className="h-4 w-4 text-teal-600" />
              Billing Segments Timeline
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-slate-600 border-slate-200">
                {closedSegmentsCount} Closed
              </Badge>
              {hasOpenSegment && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300">
                  1 Open
                </Badge>
              )}
            </div>
          </div>

          {details.segments.length === 0 ? (
            <p className="text-center text-slate-500 py-6 text-sm">No billing segments recorded for this month.</p>
          ) : (
            <div className="space-y-4">
              {/* 1. Active Open Segment Card (if any) */}
              {activeSegment && (
                <div className="border-2 border-amber-300 rounded-xl bg-amber-50/40 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-bold flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        ACTIVE CYCLE — READING REQUIRED
                      </Badge>
                      <Badge variant={activeSegment.segment_type === 'occupied' ? 'default' : 'secondary'} className="text-xs">
                        {activeSegment.segment_type === 'occupied' ? 'Occupied Room' : 'Empty Room'}
                      </Badge>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      Tariff: ₹{activeSegment.rate_per_unit.toFixed(2)}/kWh
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3 rounded-lg border border-amber-200">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Cycle Start Date</span>
                      <span className="font-semibold text-slate-900">{formatDate(activeSegment.start_date)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Baseline Meter Reading</span>
                      <span className="font-mono font-bold text-slate-900">
                        {activeSegment.start_reading_value !== null ? `${activeSegment.start_reading_value.toFixed(2)} kWh` : 'Pending'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Status</span>
                      <span className="font-bold text-amber-700">Awaiting Month-End Reading</span>
                    </div>
                  </div>

                  {/* Occupants or Empty Room Notice */}
                  {activeSegment.segment_type === 'empty' ? (
                    <div className="p-2.5 bg-amber-100/60 rounded-lg text-xs text-amber-900 font-medium">
                      Unoccupied Room — Consumption will be attributed to owner account.
                    </div>
                  ) : activeSegment.occupants.length > 0 ? (
                    <div className="text-xs text-slate-700">
                      <span className="font-semibold text-slate-800">Current Occupants: </span>
                      <span>{activeSegment.occupants.map(o => o.student_name).join(', ')}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">No active occupants assigned to this segment.</div>
                  )}

                  {details.meter_id && (
                    <div className="pt-1 flex items-center justify-end">
                      <Button 
                        size="sm" 
                        onClick={() => window.location.href = `/owner/electricity/readings/record?meter_id=${details.meter_id}&reason=month_end`}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 font-semibold rounded-lg shadow-xs"
                      >
                        Record Closing Reading
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Closed Segments History */}
              {closedSegments.length > 0 && (
                <div className="space-y-3">
                  {closedSegments.map((segment, index) => {
                    const isExpanded = expandedSegments.has(segment.id);
                    const isEmpty = segment.segment_type === 'empty';

                    return (
                      <div 
                        key={segment.id} 
                        className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        <div className="p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                              <Badge variant={isEmpty ? 'secondary' : 'default'} className="text-xs font-semibold">
                                {isEmpty ? 'Empty Room' : 'Occupied'}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
                                Closed
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-600">
                                ₹{segment.rate_per_unit.toFixed(2)}/kWh
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-slate-500 hover:text-slate-900"
                                onClick={() => toggleSegment(segment.id)}
                                aria-label={isExpanded ? 'Collapse segment' : 'Expand segment'}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div>
                              <p className="text-[11px] text-slate-500">Interval</p>
                              <p className="font-semibold text-slate-900 truncate">
                                {formatDate(segment.start_date).split(',')[0]} → {formatDate(segment.end_date!).split(',')[0]}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-slate-500">Consumption</p>
                              <p className="font-mono font-bold text-slate-900">
                                {segment.consumption_units !== null ? `${segment.consumption_units.toFixed(2)} kWh` : '0.00 kWh'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-slate-500">Total Segment Cost</p>
                              <p className="font-mono font-bold text-emerald-700">
                                {segment.total_cost_paise !== null ? formatCurrency(segment.total_cost_paise) : '₹0.00'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-slate-500">Occupants</p>
                              <p className="font-medium text-slate-700 truncate">
                                {isEmpty 
                                  ? 'Unoccupied' 
                                  : segment.occupants.length > 0 
                                    ? segment.occupants.map(o => o.student_name).join(', ') 
                                    : 'None'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 p-3.5 bg-slate-50 space-y-3 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                <span className="text-[11px] text-slate-500 block">Meter Range</span>
                                <span className="font-mono font-semibold text-slate-900">
                                  {segment.start_reading_value !== null ? `${segment.start_reading_value.toFixed(2)}` : '—'} kWh →{' '}
                                  {segment.end_reading_value !== null ? `${segment.end_reading_value.toFixed(2)}` : '—'} kWh
                                </span>
                              </div>
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                <span className="text-[11px] text-slate-500 block">Interval Timestamps</span>
                                <span className="text-slate-700">
                                  {formatDate(segment.start_date)} → {formatDate(segment.end_date!)}
                                </span>
                              </div>
                            </div>

                            {isEmpty ? (
                              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 font-medium">
                                Unoccupied Room — Consumption attributed to owner account.
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <p className="font-semibold text-slate-700">Per-Student Charge Distribution:</p>
                                <div className="space-y-1">
                                  {segment.occupants.map(occupant => {
                                    const charge = details.student_charges.find(
                                      c => c.student_id === occupant.student_id && c.segment_id === segment.id
                                    );
                                    return (
                                      <div key={occupant.student_id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                                        <span className="font-medium text-slate-800">{occupant.student_name}</span>
                                        <span className="font-mono font-bold text-emerald-700">
                                          {charge ? formatCurrency(charge.charge_amount_paise) : '₹0.00'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
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
