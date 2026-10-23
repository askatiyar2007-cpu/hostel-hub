'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import { supabase } from '@/lib/supabase/client';
import { 
  Zap, 
  Clock, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
      if (!res.ok) throw new Error(`Failed to fetch charges: ${res.status}`);
      
      const data: ApiResponse = await res.json();
      setCharges(data.charges || []);
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
  
  const formatMonth = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, m] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(m, 10) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isOpenCycle = cycleStatus === 'awaiting_month_end_reading' || (!charges.length && activeCycle?.status === 'awaiting_month_end_reading');
  const isZeroMeasured = cycleStatus === 'zero_consumption';
  const isUnmetered = cycleStatus === 'unmetered';
  const roomNumber = activeCycle?.room_number || charges[0]?.room_number || '101';
  const meterNumber = activeCycle?.meter_number || 'Sub-Meter';
  const tariffRate = activeCycle?.rate_per_unit || charges[0]?.rate_per_unit || 10.0;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-[#1a3d52]">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Zap className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Electricity &amp; Sub-Meter
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Personal electricity consumption and billing records
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label htmlFor="month-select" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Period:
          </label>
          <select
            id="month-select"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-[#122b3b] border border-slate-200 dark:border-[#1a3d52] rounded-lg shadow-2xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
        <Card className="border-rose-200 bg-rose-50/40">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-rose-900 text-sm">Failed to Load Records</h3>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => studentId && month && fetchCharges(studentId, month)}
                className="mt-3 text-xs border-rose-200 text-rose-800"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="py-20 text-center">
          <div className="h-7 w-7 rounded-full border-2 border-teal-600 border-t-transparent animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading electricity billing...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* =========================================================================
              SECTION A: COMPACT SUMMARY
              Billing Month, Room Number, Billing Status, Consumption, Charge Amount
              ========================================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* 1. Room & Sub-Meter */}
            <div className="bg-white dark:bg-[#0e222e] border border-slate-200/90 dark:border-[#1a3d52] rounded-xl p-3 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                Room &amp; Meter
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                Room {roomNumber}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono mt-0.5 truncate">
                {meterNumber}
              </p>
            </div>

            {/* 2. Billing Status */}
            <div className="bg-white dark:bg-[#0e222e] border border-slate-200/90 dark:border-[#1a3d52] rounded-xl p-3 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                Cycle Status
              </span>
              <div className="mt-1">
                {isOpenCycle ? (
                  <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] font-semibold py-0 px-2 h-5">
                    Cycle in Progress
                  </Badge>
                ) : isZeroMeasured ? (
                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-300 text-[11px] font-semibold py-0 px-2 h-5">
                    Zero Consumption
                  </Badge>
                ) : feeStatus === 'paid' ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold py-0 px-2 h-5">
                    Paid
                  </Badge>
                ) : charges.length > 0 ? (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-semibold py-0 px-2 h-5">
                    Payment Due
                  </Badge>
                ) : isUnmetered ? (
                  <Badge variant="outline" className="text-slate-500 border-slate-200 text-[11px] font-normal py-0 px-2 h-5">
                    Unmetered
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 border-slate-200 text-[11px] font-normal py-0 px-2 h-5">
                    Unbilled
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                {formatMonth(month)}
              </p>
            </div>

            {/* 3. Your Consumption */}
            <div className="bg-white dark:bg-[#0e222e] border border-slate-200/90 dark:border-[#1a3d52] rounded-xl p-3 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                Your Consumption
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                {isOpenCycle ? (
                  <span className="text-amber-700 font-semibold text-xs">Pending Reading</span>
                ) : isZeroMeasured ? (
                  <span>0.00 kWh</span>
                ) : charges.length > 0 ? (
                  <span>{totalStudentConsumption.toFixed(2)} kWh</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                {isOpenCycle ? 'Logging active usage' : 'Measured share'}
              </p>
            </div>

            {/* 4. Your Share (Charge Amount) */}
            <div className="bg-white dark:bg-[#0e222e] border border-slate-200/90 dark:border-[#1a3d52] rounded-xl p-3 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                Your Share
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                {isOpenCycle ? (
                  <span className="text-amber-800 font-semibold text-xs">Pending Calculation</span>
                ) : isZeroMeasured ? (
                  <span className="text-slate-700 dark:text-slate-300">₹0.00</span>
                ) : charges.length > 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-mono">₹{(totalCost / 100).toFixed(2)}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                {feeDueDate ? `Due: ${formatDate(feeDueDate)}` : 'Month-end invoice'}
              </p>
            </div>
          </div>

          {/* =========================================================================
              SECTION B: ACTIVE BILLING CYCLE
              Compact single panel when cycle is open
              ========================================================================= */}
          {isOpenCycle && (
            <Card className="border border-amber-200/90 bg-amber-50/40 shadow-2xs rounded-xl overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-700" />
                    <span className="font-bold text-slate-900 text-xs">
                      Active Billing Cycle &bull; Room {roomNumber}
                    </span>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                    In Progress
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white dark:bg-[#0e222e] p-3 rounded-lg border border-amber-200/70 dark:border-amber-900/60">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block text-[11px]">Start Baseline</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {activeCycle?.start_reading_value != null ? `${activeCycle.start_reading_value.toFixed(2)} kWh` : 'Recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block text-[11px]">Start Date</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{formatDate(activeCycle?.start_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block text-[11px]">Tariff Rate</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">₹{tariffRate.toFixed(2)}/kWh</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block text-[11px]">Roommates</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{activeCycle?.occupant_count || 1} Resident(s)</span>
                  </div>
                </div>

                <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                  Your electricity charge will be calculated after the closing meter reading is recorded and verified.
                </p>
              </CardContent>
            </Card>
          )}

          {/* =========================================================================
              SECTION C: BILLING HISTORY & FINALIZED CHARGES
              Clean table of finalized charges
              ========================================================================= */}
          <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-2xs rounded-xl overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 dark:border-[#1a3d52] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Finalized Billing Records &bull; {formatMonth(month)}
              </span>
              {charges.length > 0 && (
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  {charges.length} finalized interval{charges.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <CardContent className="p-0">
              {charges.length === 0 ? (
                <div className="text-center py-8 px-4 text-xs">
                  {isOpenCycle ? (
                    <p className="text-slate-500 dark:text-slate-400">
                      No finalized closed intervals for {formatMonth(month)} yet. Final charges will appear here once the closing reading is verified.
                    </p>
                  ) : isZeroMeasured ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Zero Measured Consumption</p>
                      <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        The room sub-meter was read with no change in cumulative units (0.00 kWh consumed). No charges were billed for this cycle.
                      </p>
                    </div>
                  ) : isUnmetered ? (
                    <p className="text-slate-500 dark:text-slate-400">This room does not have an active sub-meter configured.</p>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400">No electricity charges recorded for {formatMonth(month)}.</p>
                  )}
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-white/[0.03] border-b border-slate-100 dark:border-[#1a3d52] text-slate-600 dark:text-slate-400 text-left text-[11px] uppercase">
                        <th className="px-3.5 py-2.5 font-semibold">Interval</th>
                        <th className="px-3.5 py-2.5 font-semibold">Your Units</th>
                        <th className="px-3.5 py-2.5 font-semibold">Tariff</th>
                        <th className="px-3.5 py-2.5 font-semibold">Your Share</th>
                        <th className="px-3.5 py-2.5 font-semibold">Status</th>
                        <th className="px-3.5 py-2.5 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1a3d52]">
                      {charges.map((c, idx) => (
                        <tr key={c.segment_id || idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                          <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {formatDate(c.start_date)} &rarr; {formatDate(c.end_date)}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {c.student_consumption_units.toFixed(2)} kWh
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            ₹{c.rate_per_unit.toFixed(2)}/kWh
                          </td>
                          <td className="px-3.5 py-2.5 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            ₹{(c.charge_amount_paise / 100).toFixed(2)}
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            {feeStatus === 'paid' ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold py-0 px-2 h-5">
                                Paid
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold py-0 px-2 h-5">
                                Payment Due
                              </Badge>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                            <Link href="/student/bills">
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-teal-700 dark:text-teal-400 hover:text-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 px-2">
                                View Bills &rarr;
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick link to Bills */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-xl text-xs text-slate-600 dark:text-slate-300">
            <span>Electricity charges are billed through your monthly hostel invoice.</span>
            <Link href="/student/bills" className="font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 shrink-0">
              Go to Bills <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}