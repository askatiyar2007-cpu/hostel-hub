'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { supabase } from '@/lib/supabase/client';
import { Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function StudentElectricityPage() {
  const { profile } = useAuth();
  const [charges, setCharges] = useState([]);
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(true);
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
      fetch(`/api/billing/student-charges?student_id=${studentId}&billing_month=${months[0]}`)
        .then(r => r.json())
        .then(d => { setCharges(d.charges || []); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [studentId]);
  
  const total = charges.reduce((sum, c: any) => sum + (c.charge_amount_paise || 0), 0);
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2"><Zap className="h-8 w-8 text-yellow-500" />My Electricity Charges</h1>
      <Card><CardHeader><CardTitle className="flex items-center justify-between"><span>Total for {month}</span><span className="text-2xl text-green-600">₹{(total/100).toFixed(2)}</span></CardTitle></CardHeader></Card>
      {loading ? <p className="text-center py-8 text-gray-500">Loading...</p> : charges.length === 0 ? <Card><CardContent className="py-8 text-center text-gray-500">No charges for this month</CardContent></Card> : (
        <div className="space-y-4">
          {charges.map((c: any, i: number) => (
            <Card key={i}><CardContent className="pt-6"><div className="flex justify-between items-center"><div><p className="font-semibold">Room {c.room_number}</p><p className="text-sm text-gray-500">{c.consumption?.toFixed(2)} kWh × ₹{c.rate_per_unit} ÷ {c.occupant_count} occupants</p></div><div className="text-right"><p className="text-lg font-bold">₹{(c.charge_amount_paise/100).toFixed(2)}</p></div></div></CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}