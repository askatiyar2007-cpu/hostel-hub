'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { supabase } from '@/lib/supabase/client';
import { Zap, Calendar, Users, TrendingUp, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  
  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-8 w-8 text-yellow-500" />
          Electricity
        </h1>
        <p className="text-muted-foreground mt-1">Your electricity charges and usage</p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-muted-foreground">Loading electricity data...</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : charges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">No electricity charges for {formatMonth(month)}</p>
            <p className="text-sm text-muted-foreground mt-2">Check back later or contact support if you believe this is incorrect.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Card */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground text-sm font-normal">Your electricity charge</span>
                  <div className="text-3xl font-bold text-primary mt-1">₹{(total/100).toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Billing month</div>
                  <div className="text-lg font-semibold">{formatMonth(month)}</div>
                </div>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Your consumption</p>
                    <p className="text-2xl font-bold">{totalConsumption.toFixed(2)} kWh</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Occupants</p>
                    <p className="text-2xl font-bold">{charges[0]?.occupant_count || 1}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Billing Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Billing details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Billing period</span>
                  <span className="font-medium">{formatMonth(month)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Billing segments</span>
                  <span className="font-medium">{charges.length}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Average rate</span>
                  <span className="font-medium">₹{avgRate.toFixed(2)}/kWh</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Your share</span>
                  <span className="font-bold text-primary">₹{(total/100).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Room Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Room breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {charges.map((c, i) => (
                  <div key={i} className="p-4 bg-muted/20 rounded-xl border">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-lg">Room {c.room_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {c.start_date ? new Date(c.start_date).toLocaleDateString() : ''} 
                          {c.end_date ? ` - ${new Date(c.end_date).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary">₹{(c.charge_amount_paise/100).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Consumption</p>
                        <p className="font-medium">{c.consumption_units.toFixed(2)} kWh</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rate</p>
                        <p className="font-medium">₹{c.rate_per_unit.toFixed(2)}/kWh</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Occupants</p>
                        <p className="font-medium">{c.occupant_count}</p>
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