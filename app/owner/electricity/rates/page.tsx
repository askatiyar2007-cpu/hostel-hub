'use client';
import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export default function RateConfigurationPage() {
  const [rate, setRate] = useState('');
  return <div className="container mx-auto p-6"><Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-6 w-6" />Rate Configuration</CardTitle></CardHeader><CardContent><Input type="number" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate per kWh" /><Button className="mt-4" onClick={() => toast.success('Rate updated')}>Update Rate</Button></CardContent></Card></div>;
}