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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-blue-600" />
          Electricity Rate Configuration
        </h1>
        <p className="text-gray-600 mt-1">
          Configure electricity rates per kWh for your hostels
        </p>
      </div>

      {/* Hostel Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Hostel</CardTitle>
          <CardDescription>Choose the hostel to configure rates for</CardDescription>
        </CardHeader>
        <CardContent>
          {hostelsLoading ? (
            <div className="h-10 animate-pulse bg-gray-100 rounded-md" />
          ) : hostels.length === 0 ? (
            <p className="text-sm text-gray-500">No hostels found. Please create a hostel first.</p>
          ) : (
            <div className="max-w-md">
              <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
                <SelectTrigger>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Current Rate
            </CardTitle>
            <CardDescription>
              {selectedHostelName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rateDataLoading ? (
              <div className="h-16 animate-pulse bg-gray-100 rounded-md" />
            ) : currentRate !== null ? (
              <div className="space-y-2">
                <div className="text-4xl font-bold text-green-600">
                  ₹{currentRate.toFixed(4)}
                </div>
                <p className="text-sm text-gray-500">per kWh</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">No rate configured for this hostel yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rate Update Form */}
      {selectedHostelId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Update Rate</CardTitle>
            <CardDescription>
              Set a new electricity rate. This will create a new rate entry effective from now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newRate">New Rate (₹ per kWh) *</Label>
              <Input
                id="newRate"
                type="number"
                step="0.0001"
                min="0.0001"
                placeholder="e.g., 10.50"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                Enter the rate in rupees per kilowatt-hour (e.g., 10.50 for ₹10.50/kWh)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Reason for rate change, approval reference, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <Button
              onClick={handleUpdateRate}
              disabled={isSubmitting || !newRate}
              className="w-full"
            >
              {isSubmitting ? 'Updating Rate...' : 'Update Rate'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rate History */}
      {selectedHostelId && rateHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Rate History
            </CardTitle>
            <CardDescription>
              Complete history of rate changes for {selectedHostelName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rateHistory.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-lg border ${
                    entry.is_current
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">
                          ₹{entry.rate_per_unit.toFixed(4)}
                        </span>
                        {entry.is_current && (
                          <Badge className="bg-green-600 text-white">Current</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>Effective from: {formatDate(entry.effective_from)}</span>
                      </div>
                      {entry.created_by_name && (
                        <p className="text-xs text-gray-500">
                          Created by: {entry.created_by_name}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>
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