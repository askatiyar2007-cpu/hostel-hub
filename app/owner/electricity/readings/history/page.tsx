'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, ArrowLeft, Zap } from 'lucide-react';
import { IconWrapper } from '@/components/owner/icon-wrapper';
import { toast } from 'sonner';

interface Reading {
  id: string;
  reading_value: number;
  reading_timestamp: string;
  reason: string;
  recorded_by_name: string;
  notes?: string;
}

function ReadingHistoryContent() {
  const searchParams = useSearchParams();
  const meterId = searchParams.get('meter_id');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [meterInfo, setMeterInfo] = useState<any>(null);

  useEffect(() => {
    if (!meterId) {
      toast.error('Meter ID is required');
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      try {
        const response = await fetch(`/api/readings/history?meter_id=${meterId}`);
        if (!response.ok) throw new Error('Failed to fetch reading history');
        
        const data = await response.json();
        setReadings(data.readings || []);
        setMeterInfo(data.meter);
      } catch (error: any) {
        console.error('Error fetching history:', error);
        toast.error(error.message || 'Failed to load reading history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [meterId]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-12 text-center text-slate-500 text-sm">
        Loading reading logs...
      </div>
    );
  }

  if (!meterId) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-12 text-center text-rose-500 text-sm">
        Meter ID is required to inspect history.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => window.location.href = '/owner/electricity/meters'}
          className="border-slate-200 hover:bg-slate-50 text-slate-700 h-9 w-9 rounded-lg shadow-2xs"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3.5">
          <IconWrapper color="blue" size="lg">
            <History className="h-5 w-5" />
          </IconWrapper>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Reading History
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              {meterInfo?.room_number ? `Room ${meterInfo.room_number} • ` : ''}Meter <span className="font-mono text-xs font-semibold text-slate-700">{meterInfo?.meter_number || meterId}</span>
            </p>
          </div>
        </div>
      </div>

      <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">Historical Consumption Logs</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Chronological list of all verified cumulative kWh meter readings
              </CardDescription>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200">
              {readings.length} {readings.length === 1 ? 'Reading' : 'Readings'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {readings.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium text-sm">No readings recorded yet</p>
              <p className="text-slate-400 text-xs mt-1">Record the initial reading from the meters dashboard.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 border-b border-slate-200/80">
                  <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider pl-6">Date & Time</TableHead>
                  <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Reading Value</TableHead>
                  <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Reason</TableHead>
                  <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Recorded By</TableHead>
                  <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider pr-6">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.map((reading) => (
                  <TableRow key={reading.id} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors">
                    <TableCell className="text-xs text-slate-600 pl-6">
                      {new Date(reading.reading_timestamp).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="font-bold text-slate-900">
                      {reading.reading_value} <span className="text-xs font-normal text-slate-500">kWh</span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={
                          reading.reason === 'occupancy_change' ? 'bg-blue-50 text-blue-700 border-blue-200/80 font-normal' :
                          reading.reason === 'month_end' ? 'bg-purple-50 text-purple-700 border-purple-200/80 font-normal' :
                          reading.reason === 'initial' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-normal' :
                          'bg-slate-100 text-slate-700 border-slate-200 font-normal'
                        }
                      >
                        {reading.reason === 'manual_check' ? 'Manual Check' : 
                         reading.reason === 'initial' ? 'Initial Reading' :
                         reading.reason === 'occupancy_change' ? 'New Allocation' :
                         reading.reason === 'month_end' ? 'Month End' :
                         reading.reason.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 font-medium">{reading.recorded_by_name}</TableCell>
                    <TableCell className="text-xs text-slate-500 pr-6">{reading.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReadingHistoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-slate-500 text-sm">Loading history...</div>}>
      <ReadingHistoryContent />
    </Suspense>
  );
}
