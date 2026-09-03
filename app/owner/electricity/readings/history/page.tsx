'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Reading {
  id: string;
  reading_value: number;
  reading_timestamp: string;
  reason: string;
  recorded_by_name: string;
  notes?: string;
}

export default function ReadingHistoryPage() {
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
    return <div className="p-6">Loading...</div>;
  }

  if (!meterId) {
    return <div className="p-6">Meter ID is required</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reading History - {meterInfo?.meter_number || meterId}</CardTitle>
          {meterInfo && (
            <p className="text-sm text-muted-foreground">Room {meterInfo.room_number}</p>
          )}
        </CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <p className="text-muted-foreground">No readings recorded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Reading</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.map((reading) => (
                  <TableRow key={reading.id}>
                    <TableCell>{new Date(reading.reading_timestamp).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="font-medium">{reading.reading_value} kWh</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          reading.reason === 'occupancy_change' ? 'default' : 
                          reading.reason === 'month_end' ? 'secondary' : 
                          reading.reason === 'initial' ? 'outline' : 'outline'
                        }
                        className={
                          reading.reason === 'occupancy_change' ? 'bg-blue-100 text-blue-800' :
                          reading.reason === 'month_end' ? 'bg-purple-100 text-purple-800' :
                          reading.reason === 'initial' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }
                      >
                        {reading.reason === 'manual_check' ? 'Manual Check' : 
                         reading.reason === 'initial' ? 'Initial Reading' :
                         reading.reason === 'occupancy_change' ? 'New Allocation' :
                         reading.reason === 'month_end' ? 'Month End' :
                         reading.reason.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{reading.recorded_by_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{reading.notes || '-'}</TableCell>
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
