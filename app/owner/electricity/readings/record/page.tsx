'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Zap, AlertTriangle, Info, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconWrapper } from '@/components/owner/icon-wrapper';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MeterInfo {
  id: string;
  meter_number: string;
  room_number: string;
  hostel_name: string;
  status: string;
  last_reading: {
    id: string;
    value: number;
    timestamp: string;
    reason: string;
  } | null;
}

interface Meter {
  id: string;
  meter_number: string;
  room_number: string;
}

function ReadingEntryContent() {
  const searchParams = useSearchParams();
  const meterIdFromUrl = searchParams.get('meter_id');
  const reasonFromUrl = searchParams.get('reason');
  
  // Meter selection state
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');
  const [meterInfo, setMeterInfo] = useState<MeterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Form states
  const [readingValue, setReadingValue] = useState('');
  const [reason, setReason] = useState<'initial' | 'occupancy_change' | 'month_end'>(
    (reasonFromUrl === 'initial' || reasonFromUrl === 'occupancy_change' || reasonFromUrl === 'month_end') 
      ? reasonFromUrl as 'initial' | 'occupancy_change' | 'month_end' 
      : 'initial'
  );
  const [notes, setNotes] = useState('');
  
  // Validation states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [highConsumptionWarning, setHighConsumptionWarning] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Load meters first - fetch hostel then meters
  useEffect(() => {
    const loadMeters = async () => {
      try {
        // First get owner's hostels
        const hostelsResponse = await fetch('/api/hostels/owner');
        if (!hostelsResponse.ok) throw new Error('Failed to fetch hostels');
        const hostelsData = await hostelsResponse.json();
        
        if (!hostelsData.hostels || hostelsData.hostels.length === 0) {
          setLoading(false);
          return;
        }
        
        // Use first hostel
        const hostelId = hostelsData.hostels[0].id;
        
        // Fetch meters for that hostel
        const response = await fetch(`/api/meters?hostel_id=${hostelId}`);
        if (!response.ok) throw new Error('Failed to fetch meters');
        const data = await response.json();
        setMeters(data.meters || []);
        
        // Auto-select meter: use URL param, or if exactly 1 meter, select it
        if (meterIdFromUrl) {
          setSelectedMeterId(meterIdFromUrl);
        } else if (data.meters?.length === 1) {
          setSelectedMeterId(data.meters[0].id);
        } else {
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Error fetching meters:', error);
        toast.error('Failed to load meters');
        setLoading(false);
      }
    };
    
    loadMeters();
  }, [meterIdFromUrl]);

  // Fetch selected meter information
  useEffect(() => {
    if (!selectedMeterId) return;
    
    const fetchMeterInfo = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/meters/${selectedMeterId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch meter information');
        }
        
        const data = await response.json();
        setMeterInfo(data.meter);
      } catch (error: any) {
        console.error('Error fetching meter info:', error);
        toast.error(error.message || 'Failed to load meter information');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMeterInfo();
  }, [selectedMeterId]);

  // Validate reading value
  useEffect(() => {
    if (!readingValue || !meterInfo?.last_reading) {
      setValidationError(null);
      setHighConsumptionWarning(false);
      return;
    }
    
    const value = parseFloat(readingValue);
    if (isNaN(value)) {
      setValidationError('Please enter a valid number');
      return;
    }
    
    if (value < 0) {
      setValidationError('Reading cannot be negative');
      return;
    }
    
    if (value < meterInfo.last_reading.value) {
      setValidationError(`Reading cannot be less than previous reading (${meterInfo.last_reading.value} kWh)`);
      return;
    }
    
    const consumption = value - meterInfo.last_reading.value;
    if (consumption > 1000) {
      setHighConsumptionWarning(true);
    } else {
      setHighConsumptionWarning(false);
    }
    
    setValidationError(null);
  }, [readingValue, meterInfo]);

  // Calculate expected consumption preview
  const getExpectedConsumption = (): number | null => {
    if (!readingValue || !meterInfo?.last_reading) return null;
    
    const value = parseFloat(readingValue);
    if (isNaN(value)) return null;
    
    return value - meterInfo.last_reading.value;
  };

  // Calculate days elapsed
  const getDaysElapsed = (): number | null => {
    if (!meterInfo?.last_reading) return null;
    
    const lastReadingDate = new Date(meterInfo.last_reading.timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastReadingDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    
    if (!readingValue) {
      toast.error('Please enter a reading value');
      return;
    }
    
    // Show confirmation dialog for high consumption
    if (highConsumptionWarning && !showConfirmDialog) {
      setShowConfirmDialog(true);
      return;
    }
    
    setSubmitLoading(true);
    
    try {
      const response = await fetch('/api/readings/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_id: selectedMeterId,
          reading_value: parseFloat(readingValue),
          reason,
          notes: notes || undefined
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record reading');
      }
      
      toast.success('Reading recorded successfully');
      
      // Redirect to meters page
      window.location.href = '/owner/electricity/meters';
    } catch (error: any) {
      console.error('Error recording reading:', error);
      toast.error(error.message || 'Failed to record reading');
    } finally {
      setSubmitLoading(false);
      setShowConfirmDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-gray-500">Loading...</p>
      </div>
    );
  }

  // Show meter selector if no meter selected yet
  if (!selectedMeterId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Meter</CardTitle>
            <CardDescription>Choose a meter to record a reading</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {meters.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No electricity meters configured yet</p>
                <Button onClick={() => window.location.href = '/owner/electricity/meters'}>
                  Configure Meter
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Select Meter</Label>
                <Select value={selectedMeterId} onValueChange={setSelectedMeterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a meter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {meters.map((meter) => (
                      <SelectItem key={meter.id} value={meter.id}>
                        {meter.meter_number} - Room {meter.room_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading after meter selected
  if (!meterInfo) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-gray-500">Loading meter information...</p>
      </div>
    );
  }

  const expectedConsumption = getExpectedConsumption();
  const daysElapsed = getDaysElapsed();

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
          <IconWrapper color="amber" size="lg">
            <Zap className="h-5 w-5" />
          </IconWrapper>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Record Meter Reading
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Room {meterInfo.room_number} • <span className="font-mono text-xs font-semibold text-slate-700">{meterInfo.meter_number}</span> • {meterInfo.hostel_name}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Previous Reading Info */}
          {meterInfo.last_reading && (
            <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
              <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
                <CardTitle className="text-sm font-semibold text-slate-900">Previous Benchmark Reading</CardTitle>
                <CardDescription className="text-xs text-slate-500">Last verified reading recorded for this room submeter</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-100">
                    <p className="text-xs text-slate-500 font-medium">Last Reading Value</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{meterInfo.last_reading.value} <span className="text-xs font-normal text-slate-500">kWh</span></p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-100">
                    <p className="text-xs text-slate-500 font-medium">Days Elapsed</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{daysElapsed} <span className="text-xs font-normal text-slate-500">days ago</span></p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  <span>Recorded on: {new Date(meterInfo.last_reading.timestamp).toLocaleString('en-IN')}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reading Form */}
          <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
              <CardTitle className="text-sm font-semibold text-slate-900">New Reading Entry</CardTitle>
              <CardDescription className="text-xs text-slate-500">Enter the current cumulative reading displayed on the physical meter</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* Reading Value */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Reading Value (kWh) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={meterInfo.last_reading?.value || 0}
                  placeholder="e.g., 1250.50"
                  value={readingValue}
                  onChange={(e) => setReadingValue(e.target.value)}
                  className={cn(
                    "bg-slate-50/60 border-slate-200 hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-lg",
                    validationError && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
                  )}
                />
                {validationError && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {validationError}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Reason for Reading *</Label>
                <Select value={reason} onValueChange={(v: any) => setReason(v)}>
                  <SelectTrigger className="bg-slate-50/60 border-slate-200 hover:border-slate-300 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initial">Initial Reading</SelectItem>
                    <SelectItem value="occupancy_change">New Allocation</SelectItem>
                    <SelectItem value="month_end">Month End</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">
                  {reason === 'initial' && 'First reading for occupied room (establishes opening billing segment)'}
                  {reason === 'occupancy_change' && 'Student joining/leaving (closes and creates segments)'}
                  {reason === 'month_end' && 'End of month reading (closes and creates segments)'}
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Notes (Optional)</Label>
                <Textarea
                  placeholder="Additional notes or meter observations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="bg-slate-50/60 border-slate-200 hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-lg"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preview & Warnings */}
        <div className="space-y-6">
          {/* Consumption Preview */}
          {expectedConsumption !== null && expectedConsumption >= 0 && (
            <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
              <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
                <div className="flex items-center gap-2.5">
                  <IconWrapper color="blue" size="sm">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </IconWrapper>
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    Consumption Preview
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-center py-2">
                  <p className="text-4xl font-bold text-blue-600">
                    {expectedConsumption.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">kWh consumed in period</p>
                  {daysElapsed ? (
                    <p className="text-xs text-slate-400 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      ≈ {(expectedConsumption / daysElapsed).toFixed(2)} kWh / day
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}

          {/* High Consumption Warning */}
          {highConsumptionWarning && (
            <Card className="border border-amber-300 bg-amber-50/60 shadow-xs rounded-xl overflow-hidden">
              <CardHeader className="bg-amber-100/60 px-6 py-3.5 border-b border-amber-200/80">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  High Consumption Notice
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <p className="text-xs text-amber-800 leading-relaxed">
                  This reading reflects consumption over 1,000 kWh. Please confirm the physical reading before submitting.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Segment Impact Info */}
          {reason !== 'initial' && (
            <Card className="border border-blue-200 bg-blue-50/50 shadow-xs rounded-xl overflow-hidden">
              <CardHeader className="bg-blue-100/50 px-6 py-3.5 border-b border-blue-200/70">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-900">
                  <Info className="h-4 w-4 text-blue-600" />
                  Billing Cycle Impact
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <p className="text-xs text-blue-800 leading-relaxed">
                  {reason === 'occupancy_change' && 'This reading will close the current billing segment and establish a new segment with revised room occupancy.'}
                  {reason === 'month_end' && 'This reading will finalize the month-end billing segment and initialize the upcoming month cycle.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <Button 
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-xs h-11" 
            size="lg"
            onClick={handleSubmit}
            disabled={!!validationError || !readingValue || submitLoading}
          >
            {submitLoading ? 'Recording...' : 'Record Reading'}
          </Button>
        </div>
      </div>

      {/* High Consumption Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirm High Consumption
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              This reading shows unusually high consumption ({expectedConsumption?.toFixed(2)} kWh).
              Are you sure the reading is correct?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitLoading} className="bg-teal-600 hover:bg-teal-700 text-white font-medium">
              {submitLoading ? 'Recording...' : 'Confirm & Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ReadingEntryPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6"><p className="text-center text-gray-500">Loading...</p></div>}>
      <ReadingEntryContent />
    </Suspense>
  );
}
