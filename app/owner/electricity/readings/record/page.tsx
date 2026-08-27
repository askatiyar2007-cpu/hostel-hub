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
function ReadingEntryContent() {
  const searchParams = useSearchParams();
  const meterId = searchParams.get('meter_id');
  
  const [meterInfo, setMeterInfo] = useState<MeterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Form states
  const [readingValue, setReadingValue] = useState('');
  const [reason, setReason] = useState<'manual_check' | 'occupancy_change' | 'month_end'>('manual_check');
  const [notes, setNotes] = useState('');
  
  // Validation states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [highConsumptionWarning, setHighConsumptionWarning] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Fetch meter information
  useEffect(() => {
    if (!meterId) {
      toast.error('Meter ID is required');
      return;
    }
    
    const fetchMeterInfo = async () => {
      try {
        const response = await fetch(`/api/meters/${meterId}`);
        
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
  }, [meterId]);

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
          meter_id: meterId,
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

  if (!meterInfo) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Meter not found</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => window.location.href = '/owner/electricity/meters'}
            >
              Back to Meters
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expectedConsumption = getExpectedConsumption();
  const daysElapsed = getDaysElapsed();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => window.location.href = '/owner/electricity/meters'}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-yellow-500" />
            Record Reading
          </h1>
          <p className="text-gray-600 mt-1">
            Room {meterInfo.room_number} • {meterInfo.meter_number}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Previous Reading Info */}
          {meterInfo.last_reading && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Previous Reading</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Reading Value</p>
                    <p className="text-2xl font-bold">{meterInfo.last_reading.value} kWh</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Days Ago</p>
                    <p className="text-2xl font-bold">{daysElapsed} days</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date & Time</p>
                  <p className="text-sm">
                    {new Date(meterInfo.last_reading.timestamp).toLocaleString('en-IN')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reading Form */}
          <Card>
            <CardHeader>
              <CardTitle>New Reading</CardTitle>
              <CardDescription>Enter the current meter reading</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reading Value */}
              <div className="space-y-2">
                <Label>Reading Value (kWh) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={meterInfo.last_reading?.value || 0}
                  placeholder="e.g., 1250.50"
                  value={readingValue}
                  onChange={(e) => setReadingValue(e.target.value)}
                  className={validationError ? 'border-red-500' : ''}
                />
                {validationError && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {validationError}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Select value={reason} onValueChange={(v: any) => setReason(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual_check">Manual Check</SelectItem>
                    <SelectItem value="occupancy_change">Occupancy Change</SelectItem>
                    <SelectItem value="month_end">Month End</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {reason === 'manual_check' && 'Regular meter check (does not close billing segments)'}
                  {reason === 'occupancy_change' && 'Student joining/leaving (closes and creates segments)'}
                  {reason === 'month_end' && 'End of month reading (closes and creates segments)'}
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Additional notes or observations"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preview & Warnings */}
        <div className="space-y-6">
          {/* Consumption Preview */}
          {expectedConsumption !== null && expectedConsumption >= 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Consumption
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-4xl font-bold text-blue-600">
                    {expectedConsumption.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">kWh consumed</p>
                  {daysElapsed && (
                    <p className="text-xs text-gray-400 mt-2">
                      ˜ {(expectedConsumption / daysElapsed).toFixed(2)} kWh/day
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* High Consumption Warning */}
          {highConsumptionWarning && (
            <Card className="border-yellow-500 border-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-yellow-700">
                  <AlertTriangle className="h-5 w-5" />
                  High Consumption
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-yellow-800">
                  This reading shows consumption over 1000 kWh. Please verify the reading is correct before submitting.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Segment Impact Info */}
          {reason !== 'manual_check' && (
            <Card className="border-blue-500 border-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                  <Info className="h-5 w-5" />
                  Billing Impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-800">
                  {reason === 'occupancy_change' && 'This reading will close the current billing segment and create a new one with updated occupants.'}
                  {reason === 'month_end' && 'This reading will close the current month\'s billing segment and start a new one with the same occupants.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <Button 
            className="w-full" 
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
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Confirm High Consumption
            </DialogTitle>
            <DialogDescription>
              This reading shows unusually high consumption ({expectedConsumption?.toFixed(2)} kWh).
              Are you sure the reading is correct?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitLoading}>
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
