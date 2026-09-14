'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { supabase } from '@/lib/supabase/client';
import { Zap, Calendar, Users, TrendingUp, Info, IndianRupee, Clock, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ChargeData {
  segment_id: string;
  room_number: string;
  start_date: string;
  end_date: string;
  consumption_units: number;
  rate_per_unit: number;
  occupant_count: number;
  charge_amount_paise: number;
  charge_amount_rupees: number;
}

export default function StudentElectricityPage() {
  const { profile } = useAuth();
  const [charges, setCharges] = useState<ChargeData[]>([]);
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  
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
    } catch (error) {
      console.error('Error fetching student record:', error);
    }
  }, [profile?.id]);
  
  useEffect(() => {
    fetchStudentId();
  }, [fetchStudentId]);
  
  useEffect(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    setMonth(months[0]);
    
    if (studentId && months[0]) {
      setLoading(true);
      setError(null);
      fetch(`/api/billing/student-charges?student_id=${studentId}&billing_month=${months[0]}`)
        .then(r => {
          if (!r.ok) {
            throw new Error(`Failed to fetch charges: ${r.status}`);
          }
          return r.json();
        })
        .then(d => { 
          setCharges(d.charges || []); 
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching charges:', err);
          setError('Unable to load electricity data. Please try again.');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [studentId]);
  
  const total = charges.reduce((sum, c) => sum + (c.charge_amount_paise || 0), 0);
  const totalConsumption = charges.reduce((sum, c) => sum + (c.consumption_units || 0), 0);
  const avgRate = charges.length > 0 ? charges.reduce((sum, c) => sum + (c.rate_per_unit || 0), 0) / charges.length : 0;
  
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };
  
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Clock className="animate-spin h-8 w-8 text-teal-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="h-16 w-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
          <Info className="h-8 w-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Error Loading Data</h2>
        <p className="text-slate-600 text-center max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 font-display">Electricity</h1>
        <p className="text-slate-600">Your electricity charges and usage</p>
      </div>

      {charges.length === 0 ? (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No electricity charges for {formatMonth(month)}</h3>
            <p className="text-slate-600 max-w-md mx-auto">Check back later or contact support if you believe this is incorrect.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Charge</p>
                    <p className="font-bold text-slate-900">₹{(total/100).toFixed(2)}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{formatMonth(month)}</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Consumption</p>
                    <p className="font-bold text-slate-900">{totalConsumption.toFixed(2)} kWh</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{charges.length} segments</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Average Rate</p>
                    <p className="font-bold text-slate-900">₹{avgRate.toFixed(2)}/kWh</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">Per unit</p>
              </CardContent>
            </Card>
          </div>

          {/* Billing Details */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900">Billing Details</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Billing Period</p>
                  <p className="font-semibold text-slate-900">{formatMonth(month)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Billing Segments</p>
                  <p className="font-semibold text-slate-900">{charges.length}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Average Rate</p>
                  <p className="font-semibold text-slate-900">₹{avgRate.toFixed(2)}/kWh</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Your Share</p>
                  <p className="font-bold text-slate-900">₹{(total/100).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Room Breakdown */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-slate-900">Room Breakdown</h3>
              </div>

              <div className="space-y-4">
                {charges.map((c, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">Room {c.room_number}</p>
                          <p className="text-xs text-slate-500">
                            {c.start_date ? new Date(c.start_date).toLocaleDateString() : ''} 
                            {c.end_date ? ` - ${new Date(c.end_date).toLocaleDateString()}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-900">₹{(c.charge_amount_paise/100).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-200">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Consumption</p>
                        <p className="font-semibold text-slate-900">{c.consumption_units.toFixed(2)} kWh</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Rate</p>
                        <p className="font-semibold text-slate-900">₹{c.rate_per_unit.toFixed(2)}/kWh</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Occupants</p>
                        <p className="font-semibold text-slate-900">{c.occupant_count}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}