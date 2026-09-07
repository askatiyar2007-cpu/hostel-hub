'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { TrendingUp, Clock, History, AlertCircle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { IconWrapper } from '@/components/owner/icon-wrapper';
import { cn } from '@/lib/utils';

interface Hostel {
  id: string;
  name: string;
}

interface RateHistoryEntry {
  id: string;
  rate_per_unit: number;
  effective_from: string;
  created_at: string;
  created_by_name: string;
  notes: string | null;
  is_current: boolean;
}

export default function RateConfigurationPage() {
  const { user } = useAuth();
  
  // Hostel selection
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [hostelsLoading, setHostelsLoading] = useState(true);
  
  // Rate data
  const [currentRate, setCurrentRate] = useState<number | null>(null);
  const [rateHistory, setRateHistory] = useState<RateHistoryEntry[]>([]);
  const [rateDataLoading, setRateDataLoading] = useState(false);
  
  // Form state
  const [newRate, setNewRate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch hostels owned by user
  const fetchHostels = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setHostelsLoading(true);
      const response = await fetch('/api/hostels/owner');
      if (!response.ok) throw new Error('Failed to fetch hostels');
      
      const data = await response.json();
      setHostels(data.hostels || []);
      
      if (data.hostels && data.hostels.length > 0) {
        setSelectedHostelId(data.hostels[0].id);
      }
    } catch (error) {
      console.error('Error fetching hostels:', error);
      toast.error('Failed to load hostels');
    } finally {
      setHostelsLoading(false);
    }
  }, [user?.id]);

  // Fetch rate data for selected hostel
  const fetchRateData = useCallback(async (hostelId: string) => {
    if (!hostelId) {
      setCurrentRate(null);
      setRateHistory([]);
      return;
    }

    try {
      setRateDataLoading(true);
      const response = await fetch(`/api/rates/history?hostel_id=${hostelId}`);
      if (!response.ok) throw new Error('Failed to fetch rate data');
      
      const data = await response.json();
      setCurrentRate(data.current_rate);
      setRateHistory(data.history || []);
    } catch (error) {
      console.error('Error fetching rate data:', error);
      toast.error('Failed to load rate data');
      setCurrentRate(null);
      setRateHistory([]);
    } finally {
      setRateDataLoading(false);
    }
  }, []);

  // Load hostels on mount
  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  // Load rate data when hostel changes
  useEffect(() => {
    if (selectedHostelId) {
      fetchRateData(selectedHostelId);
    }
  }, [selectedHostelId, fetchRateData]);

  // Handle rate update
  const handleUpdateRate = async () => {
    if (!selectedHostelId) {
      toast.error('Please select a hostel');
      return;
    }

    const rateValue = parseFloat(newRate);
    if (isNaN(rateValue) || rateValue <= 0) {
      toast.error('Please enter a valid positive rate');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/rates/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostel_id: selectedHostelId,
          rate_per_unit: rateValue,
          notes: notes || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update rate');
      }

      toast.success(data.message || 'Rate updated successfully');
      
      // Refresh rate data
      await fetchRateData(selectedHostelId);
      
      // Clear form
      setNewRate('');
      setNotes('');
      
      // Show warning if applicable
      if (data.warning) {
        toast.warning(data.warning);
      }
    } catch (error: any) {
      console.error('Error updating rate:', error);
      toast.error(error.message || 'Failed to update rate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const selectedHostelName = hostels.find(h => h.id === selectedHostelId)?.name || '';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <IconWrapper color="blue" size="lg">
          <TrendingUp className="h-5 w-5" />
        </IconWrapper>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Electricity Rate Configuration
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Configure tariff rates per kWh, review current active pricing, and inspect historical rate adjustments
          </p>
        </div>
      </div>

      {/* Hostel Selection */}
      <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
          <CardTitle className="text-sm font-semibold text-slate-900">Select Hostel</CardTitle>
          <CardDescription className="text-xs text-slate-500">Choose the property to view and configure electricity rates</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {hostelsLoading ? (
            <div className="h-10 animate-pulse bg-slate-100 rounded-lg" />
          ) : hostels.length === 0 ? (
            <p className="text-sm text-slate-500">No hostels found. Please create a hostel first.</p>
          ) : (
            <div className="max-w-md">
              <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
                <SelectTrigger className="bg-slate-50/60 border-slate-200 hover:border-slate-300 rounded-lg">
                  <SelectValue placeholder="Select a hostel" />
                </SelectTrigger>
                <SelectContent>
                  {hostels.map(hostel => (
                    <SelectItem key={hostel.id} value={hostel.id}>
                      {hostel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Rate Display */}
      {selectedHostelId && (
        <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
          <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <IconWrapper color="emerald" size="sm">
                <TrendingUp className="h-3.5 w-3.5" />
              </IconWrapper>
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">Current Active Rate</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {selectedHostelName}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {rateDataLoading ? (
              <div className="h-16 animate-pulse bg-slate-100 rounded-lg" />
            ) : currentRate !== null ? (
              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-bold text-emerald-600">
                  ₹{currentRate.toFixed(4)}
                </div>
                <p className="text-xs text-slate-500">per kilowatt-hour (kWh)</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-800 bg-amber-50/80 border border-amber-200/80 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs font-medium">No rate configured for this hostel yet. Set an initial rate below.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rate Update Form */}
      {selectedHostelId && (
        <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
          <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
            <CardTitle className="text-sm font-semibold text-slate-900">Update Rate</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Set a new electricity rate. This will create an effective timestamped record for subsequent billing calculations.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newRate" className="text-xs font-semibold text-slate-700">New Rate (₹ per kWh) *</Label>
              <Input
                id="newRate"
                type="number"
                step="0.0001"
                min="0.0001"
                placeholder="e.g., 10.50"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                disabled={isSubmitting}
                className="bg-slate-50/60 border-slate-200 hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-lg max-w-md"
              />
              <p className="text-[11px] text-slate-400">
                Enter the unit rate in rupees per kilowatt-hour (e.g., 10.50 for ₹10.50/kWh)
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold text-slate-700">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Reason for rate change, government tariff revision, or approval reference..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={isSubmitting}
                className="bg-slate-50/60 border-slate-200 hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-lg max-w-xl"
              />
            </div>

            <div className="pt-2">
              <Button
                onClick={handleUpdateRate}
                disabled={isSubmitting || !newRate}
                className="bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-xs h-10 px-6"
              >
                {isSubmitting ? 'Updating Rate...' : 'Update Rate'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rate History */}
      {selectedHostelId && rateHistory.length > 0 && (
        <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
          <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <IconWrapper color="blue" size="sm">
                <History className="h-3.5 w-3.5" />
              </IconWrapper>
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">Rate History</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Audit log of past rate revisions for {selectedHostelName}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {rateHistory.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "p-4 rounded-xl border transition-all",
                    entry.is_current
                      ? "border-emerald-200/90 bg-emerald-50/50 shadow-xs"
                      : "border-slate-200/80 bg-slate-50/60"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl font-bold text-slate-900">
                          ₹{entry.rate_per_unit.toFixed(4)}
                        </span>
                        <span className="text-xs text-slate-500">/ kWh</span>
                        {entry.is_current && (
                          <Badge className="bg-emerald-600 text-white font-medium shadow-none text-xs">Current Active</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>Effective from: {formatDate(entry.effective_from)}</span>
                      </div>
                      {entry.created_by_name && (
                        <p className="text-xs text-slate-500">
                          Recorded by: <span className="font-medium text-slate-700">{entry.created_by_name}</span>
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-slate-600 mt-1 bg-white/80 p-2 rounded-lg border border-slate-200/60">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}