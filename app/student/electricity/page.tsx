'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import { supabase } from '@/lib/supabase/client';
import { 
  Zap, 
  Calendar, 
  Users, 
  TrendingUp, 
  Info, 
  IndianRupee, 
  Clock, 
  Building2,
  Gauge,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ChargeData {
  segment_id: string;
  room_number: string;
  start_date: string;
  end_date: string;
  previous_reading: number | null;
  current_reading: number | null;
  room_consumption_units: number;
  student_consumption_units: number;
  consumption_units: number;
  rate_per_unit: number;
  occupant_count: number;
  charge_amount_paise: number;
  charge_amount_rupees: number;
}

interface ActiveCycleData {
  status: string;
  room_number: string;
  meter_number?: string | null;
  start_date?: string;
  start_reading_value?: number | null;
  rate_per_unit?: number;
  occupant_count?: number;
  occupants?: { student_id: string; student_name: string }[];
  message?: string;
}

interface ApiResponse {
  student_id: string;
  student_name: string;
  billing_month: string;
  charges: ChargeData[];
  total_room_consumption_units: number;
  total_student_consumption_units: number;
  total_paise: number;
  total_rupees: number;
  fee_id?: string | null;
  fee_status?: string | null;
  fee_due_date?: string | null;
  cycle_status?: string;
  active_cycle?: ActiveCycleData | null;
}

export default function StudentElectricityPage() {
  const { profile } = useAuth();
  const [charges, setCharges] = useState<ChargeData[]>([]);
  const [totalRoomConsumption, setTotalRoomConsumption] = useState<number>(0);
  const [totalStudentConsumption, setTotalStudentConsumption] = useState<number>(0);
  const [feeStatus, setFeeStatus] = useState<string | null>(null);
  const [feeDueDate, setFeeDueDate] = useState<string | null>(null);
  const [cycleStatus, setCycleStatus] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<ActiveCycleData | null>(null);
  const [month, setMonth] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);

  // Available last 6 months list
  const availableMonths = useMemo(() => {
    const list: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
  }, []);

  // Initialize selected month to current
  useEffect(() => {
    if (availableMonths.length > 0 && !month) {
      setMonth(availableMonths[0]);
    }
  }, [availableMonths, month]);
  
  // Resolve student id from profile
  const fetchStudentId = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();
      
      if (studentRecord) {
        setStudentId(studentRecord.id);
      }
    } catch (err) {
      console.error('Error fetching student record:', err);
    }
  }, [profile?.id]);
  
  useEffect(() => {
    fetchStudentId();
  }, [fetchStudentId]);

  // Fetch electricity charges when studentId or month changes
  const fetchCharges = useCallback(async (sId: string, bMonth: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/student-charges?student_id=${sId}&billing_month=${bMonth}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch charges: ${res.status}`);
      }
      const data: ApiResponse = await res.json();
      setCharges(data.charges || []);
      setTotalRoomConsumption(data.total_room_consumption_units ?? 0);
      setTotalStudentConsumption(data.total_student_consumption_units ?? 0);
      setFeeStatus(data.fee_status ?? null);
      setFeeDueDate(data.fee_due_date ?? null);
      setCycleStatus(data.cycle_status ?? null);
      setActiveCycle(data.active_cycle ?? null);
    } catch (err: unknown) {
      console.error('Error fetching charges:', err);
      setError('Unable to load electricity data for the selected month.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (studentId && month) {
      fetchCharges(studentId, month);
    } else if (!studentId && !profile?.id) {
      setLoading(false);
    }
  }, [studentId, month, fetchCharges, profile?.id]);
  
  const totalCost = charges.reduce((sum, c) => sum + (c.charge_amount_paise || 0), 0);
  const avgRate = charges.length > 0 
    ? charges.reduce((sum, c) => sum + (c.rate_per_unit || 0), 0) / charges.length 
    : 0;
  
  const formatMonth = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, m] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(m, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getStatusBadge = () => {
    if (cycleStatus === 'awaiting_month_end_reading' || (!charges.length && activeCycle?.status === 'awaiting_month_end_reading')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Awaiting Month-End Reading
        </span>
      );
    }
    if (cycleStatus === 'zero_consumption') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
          Zero Measured Consumption
        </span>
      );
    }
    if (!feeStatus) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          Unbilled
        </span>
      );
    }
    if (feeStatus === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Paid
        </span>
      );
    }
    if (feeStatus === 'pending_verification') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          Under Verification
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
        Payment Pending
      </span>
    );
  };
  
  if (loading && charges.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Clock className="animate-spin h-8 w-8 text-teal-600" />
        <p className="text-sm text-slate-500 font-medium">Loading electricity records...</p>
      </div>
    );
  }

  const isOpenCycle = activeCycle && (activeCycle.status === 'awaiting_month_end_reading' || cycleStatus === 'awaiting_month_end_reading');
  const isZeroMeasured = cycleStatus === 'zero_consumption';
  const isUnmetered = cycleStatus === 'unmetered';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header with Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display tracking-tight">Electricity &amp; Sub-meter</h1>
          <p className="text-sm text-slate-500 mt-1">Track certified sub-meter readings, room kWh consumption, and your individual split.</p>
        </div>

        {/* Month Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="month-select" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Period:
          </label>
          <select
            id="month-select"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 shadow-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 bg-rose-50/50 border border-rose-100 rounded-2xl">
          <div className="h-12 w-12 rounded-2xl bg-rose-100 flex items-center justify-center mb-3">
            <Info className="h-6 w-6 text-rose-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Failed to Load Electricity Records</h2>
          <p className="text-sm text-slate-600 text-center max-w-md mb-4">{error}</p>
          <Button 
            variant="outline" 
            onClick={() => studentId && month && fetchCharges(studentId, month)}
            className="rounded-xl border-slate-200"
          >
            Retry Loading
          </Button>
        </div>
      ) : charges.length === 0 ? (
        isOpenCycle ? (
          /* ACTIVE BILLING CYCLE IN PROGRESS VIEW */
          <div className="space-y-6">
            {/* KPI Cards for Active Cycle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border border-amber-200/90 bg-amber-50/30 shadow-xs rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                      <IndianRupee className="h-5 w-5" />
                    </div>
                    {getStatusBadge()}
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Share</p>
                  <p className="text-2xl font-bold text-amber-800 mt-1 font-display">Pending</p>
                  <p className="text-[11px] text-amber-700 mt-1">Calculated upon month-end close</p>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Consumption</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1 font-display">Active Cycle</p>
                  <p className="text-[11px] text-slate-400 mt-1">Sub-meter currently logging usage</p>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                      <Zap className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tariff Rate</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1 font-display">
                    ₹{(activeCycle?.rate_per_unit || 10).toFixed(2)} <span className="text-sm font-medium text-slate-500">/ kWh</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Hostel electricity rate</p>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Occupancy Split</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1 font-display">
                    {activeCycle?.occupant_count || 1} <span className="text-sm font-medium text-slate-500">{activeCycle?.occupant_count === 1 ? 'Resident' : 'Residents'}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Room {activeCycle?.room_number}</p>
                </CardContent>
              </Card>
            </div>

            {/* Active Cycle Details Card */}
            <Card className="border border-amber-200 bg-white shadow-xs rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 border-b border-amber-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Active Billing Interval &bull; Room {activeCycle?.room_number}
                    </h3>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Sub-meter: <span className="font-mono font-semibold">{activeCycle?.meter_number || 'Active'}</span> &bull; Cycle started on {activeCycle?.start_date ? new Date(activeCycle.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Beginning of month'}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-200/80 text-amber-900 border border-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  Reading in Progress
                </span>
              </div>

              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Cycle Start Baseline
                    </span>
                    <p className="text-2xl font-bold text-slate-900 font-display">
                      {activeCycle?.start_reading_value !== null && activeCycle?.start_reading_value !== undefined 
                        ? `${activeCycle.start_reading_value.toFixed(2)} kWh` 
                        : 'Benchmark Recorded'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Recorded on {activeCycle?.start_date ? new Date(activeCycle.start_date).toLocaleDateString() : 'Cycle Open'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1">
                    <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">
                      Cycle Closing Reading
                    </span>
                    <p className="text-2xl font-bold text-amber-900 font-display">
                      Awaiting Month-End Reading
                    </p>
                    <p className="text-xs text-amber-700">
                      Owner will record the ending reading at month close
                    </p>
                  </div>
                </div>

                {/* Transparent Formula Callout */}
                <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 text-xs text-teal-950 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-teal-900">
                    <Info className="h-4 w-4 text-teal-700" />
                    How your charge will be calculated
                  </div>
                  <p className="text-teal-800 leading-relaxed">
                    Once the month-end reading is submitted:
                  </p>
                  <div className="font-mono bg-white/80 p-2.5 rounded-lg border border-teal-200 text-teal-950 font-semibold text-xs">
                    Your Share = ((Closing Reading &minus; {activeCycle?.start_reading_value !== null && activeCycle?.start_reading_value !== undefined ? activeCycle.start_reading_value.toFixed(2) : 'Start'} kWh) &divide; {activeCycle?.occupant_count || 1} Roommates) &times; ₹{(activeCycle?.rate_per_unit || 10).toFixed(2)}/kWh
                  </div>
                  <p className="text-teal-700 text-[11px] pt-1">
                    You will receive a notification and itemized invoice breakdown as soon as the closing reading is verified.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : isZeroMeasured ? (
          /* ZERO MEASURED CONSUMPTION */
          <Card className="border border-slate-200 bg-white shadow-sm rounded-2xl">
            <CardContent className="p-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4 text-slate-700">
                <CheckCircle2 className="h-8 w-8 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Zero Measured Consumption for {formatMonth(month)}</h3>
              <p className="text-slate-600 max-w-md mx-auto text-sm">
                The sub-meter was read at the start and end of this billing cycle with no change in cumulative units (0.00 kWh consumed). No electricity charges are due for this interval.
              </p>
            </CardContent>
          </Card>
        ) : isUnmetered ? (
          /* UNMETERED ROOM */
          <Card className="border border-slate-200 bg-white shadow-sm rounded-2xl">
            <CardContent className="p-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4 text-slate-500">
                <Gauge className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Room is Unmetered</h3>
              <p className="text-slate-600 max-w-md mx-auto text-sm">
                Your assigned room does not have an active individual sub-meter configured. Electricity charges are not billed via sub-meter for this room.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-slate-200 bg-white shadow-sm rounded-2xl">
            <CardContent className="p-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-teal-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No electricity readings recorded for {formatMonth(month)}</h3>
              <p className="text-slate-600 max-w-md mx-auto text-sm">
                Your hostel management has not yet finalized meter readings for this cycle. If a reading has recently been taken, it will show up here once validated.
              </p>
            </CardContent>
          </Card>
        )
      ) : (
        <>
          {isOpenCycle && (
            <div className="flex items-center gap-3 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Ongoing Cycle:</strong> A new billing interval started on {activeCycle?.start_date ? new Date(activeCycle.start_date).toLocaleDateString() : 'recently'} at {activeCycle?.start_reading_value !== null ? `${activeCycle?.start_reading_value} kWh` : 'baseline'}. Its charges will be calculated at cycle close. Finalized segments for this month are shown below.
              </span>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Charge */}
            <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                  {getStatusBadge()}
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Share</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 font-display">₹{(totalCost / 100).toFixed(2)}</p>
                {feeDueDate && (
                  <p className="text-[11px] text-slate-400 mt-1">Due: {new Date(feeDueDate).toLocaleDateString()}</p>
                )}
              </CardContent>
            </Card>

            {/* Student kWh Consumption */}
            <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Consumption</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 font-display">{totalStudentConsumption.toFixed(2)} <span className="text-sm font-medium text-slate-500">kWh</span></p>
                <p className="text-[11px] text-slate-400 mt-1">Room total: {totalRoomConsumption.toFixed(2)} kWh</p>
              </CardContent>
            </Card>

            {/* Average Electricity Rate */}
            <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                    <Zap className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tariff Rate</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 font-display">₹{avgRate.toFixed(2)} <span className="text-sm font-medium text-slate-500">/ kWh</span></p>
                <p className="text-[11px] text-slate-400 mt-1">Hostel electricity rate</p>
              </CardContent>
            </Card>

            {/* Billing Segments */}
            <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                    <Gauge className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Segments Billed</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 font-display">{charges.length} <span className="text-sm font-medium text-slate-500">{charges.length === 1 ? 'Period' : 'Periods'}</span></p>
                <p className="text-[11px] text-slate-400 mt-1">{formatMonth(month)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Transparent Calculation Banner */}
          <div className="flex items-start gap-3 p-4 bg-teal-50/70 border border-teal-200/80 rounded-2xl text-xs text-teal-900">
            <Info className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-teal-950">How your electricity share is calculated</p>
              <p className="text-teal-800 leading-relaxed">
                Electricity consumption is measured directly from the physical sub-meter of your assigned room.
                When roommates move in or out, a new certified segment begins.
                For every segment, <strong>Your Charge = (Total Room kWh ÷ Number of Occupants) × Rate/kWh</strong>.
              </p>
            </div>
          </div>

          {/* Detailed Room Breakdown */}
          <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-teal-600" />
                <h3 className="font-bold text-base text-slate-900 font-display">Meter Readings &amp; Segment Breakdown</h3>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {charges.length} {charges.length === 1 ? 'segment' : 'segments'} in {formatMonth(month)}
              </span>
            </div>

            <CardContent className="p-6 space-y-6">
              {charges.map((c, index) => {
                const startDateStr = c.start_date ? new Date(c.start_date).toLocaleDateString() : 'N/A';
                const endDateStr = c.end_date ? new Date(c.end_date).toLocaleDateString() : 'Present';
                
                return (
                  <div key={c.segment_id || index} className="p-5 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-4">
                    {/* Segment Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-teal-100/70 border border-teal-200 flex items-center justify-center font-bold text-teal-700 text-sm">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-base">Room {c.room_number}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {startDateStr} &mdash; {endDateStr}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-xs text-slate-500 font-medium">Segment Share</p>
                        <p className="text-xl font-bold text-slate-900 font-display">₹{(c.charge_amount_paise / 100).toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Meter Readings Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Start Reading
                        </span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">
                          {c.previous_reading !== null ? `${c.previous_reading.toFixed(2)} kWh` : 'Initial / N/A'}
                        </p>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          End Reading
                        </span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">
                          {c.current_reading !== null ? `${c.current_reading.toFixed(2)} kWh` : 'Active Period'}
                        </p>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Room Total Units
                        </span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">
                          {c.room_consumption_units.toFixed(2)} kWh
                        </p>
                      </div>
                    </div>

                    {/* Split & Calculation Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="p-3 bg-white rounded-xl border border-slate-200/60">
                        <span className="text-[11px] text-slate-500 block mb-0.5">Occupants</span>
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <Users className="h-4 w-4 text-purple-600" />
                          <span>{c.occupant_count} {c.occupant_count === 1 ? 'student' : 'students'}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200/60">
                        <span className="text-[11px] text-slate-500 block mb-0.5">Your Units</span>
                        <span className="font-semibold text-teal-700">
                          {c.student_consumption_units.toFixed(2)} kWh
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200/60">
                        <span className="text-[11px] text-slate-500 block mb-0.5">Unit Rate</span>
                        <span className="font-semibold text-slate-800">
                          ₹{c.rate_per_unit.toFixed(2)}/kWh
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200/60">
                        <span className="text-[11px] text-slate-500 block mb-0.5">Your Charge</span>
                        <span className="font-bold text-slate-900">
                          ₹{(c.charge_amount_paise / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Action Link to Bills */}
          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div>
              <p className="font-semibold text-slate-900 text-sm">Need to make a payment or view overall hostel bills?</p>
              <p className="text-xs text-slate-500">Electricity charges are rolled into your monthly hostel invoice.</p>
            </div>
            <Link href="/student/bills">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold h-9 px-4 gap-1.5">
                Go to Bills <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}