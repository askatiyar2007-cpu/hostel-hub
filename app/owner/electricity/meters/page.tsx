'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { Plus, Zap, Filter, AlertCircle, CheckCircle, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconWrapper } from '@/components/owner/icon-wrapper';
import { PageHeader } from "@/components/owner/page-header";

interface MeterWithDetails {
  id: string;
  room_id: string;
  room_number: string;
  meter_number: string;
  status: 'active' | 'inactive';
  last_reading: {
    value: number;
    timestamp: string;
  } | null;
  open_segment_id: string | null;
  pending_reading: boolean;
}

interface Hostel {
  id: string;
  name: string;
}

interface Room {
  id: string;
  room_number: string;
  hostel_id: string;
}

export default function MeterManagementPage() {
  const { user } = useAuth();
  const [meters, setMeters] = useState<MeterWithDetails[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedHostel, setSelectedHostel] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pendingFilter, setPendingFilter] = useState<boolean>(false);
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [meterToReplace, setMeterToReplace] = useState<MeterWithDetails | null>(null);
  const [replaceFormData, setReplaceFormData] = useState({
    final_reading: '',
    final_reading_unavailable: false,
    new_meter_number: '',
    initial_reading: '0',
    notes: ''
  });
  const [replaceLoading, setReplaceLoading] = useState(false);

  const handleOpenReplace = (m: MeterWithDetails) => {
    setMeterToReplace(m);
    setReplaceFormData({
      final_reading: m.last_reading ? String(m.last_reading.value) : '',
      final_reading_unavailable: false,
      new_meter_number: `${m.meter_number}-NEW`,
      initial_reading: '0',
      notes: ''
    });
    setReplaceModalOpen(true);
  };

  const handleConfirmReplace = async () => {
    if (!meterToReplace) return;
    if (!replaceFormData.new_meter_number.trim()) {
      toast.error('Please enter the new meter number');
      return;
    }
    const initialVal = parseFloat(replaceFormData.initial_reading);
    if (isNaN(initialVal) || initialVal < 0) {
      toast.error('Initial reading must be a non-negative number');
      return;
    }

    let finalVal: number | undefined = undefined;
    if (!replaceFormData.final_reading_unavailable && replaceFormData.final_reading.trim()) {
      finalVal = parseFloat(replaceFormData.final_reading);
      if (isNaN(finalVal) || finalVal < 0) {
        toast.error('Final reading must be a valid number');
        return;
      }
      if (meterToReplace.last_reading && finalVal < meterToReplace.last_reading.value) {
        toast.error(`Old meter final reading cannot be less than its last reading (${meterToReplace.last_reading.value} kWh)`);
        return;
      }
    }

    setReplaceLoading(true);
    try {
      const res = await fetch('/api/meters/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_meter_id: meterToReplace.id,
          new_meter_number: replaceFormData.new_meter_number.trim(),
          initial_reading: initialVal,
          final_reading: replaceFormData.final_reading_unavailable ? null : (finalVal ?? null),
          final_reading_unavailable: replaceFormData.final_reading_unavailable,
          notes: replaceFormData.notes || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to replace meter');
      }
      toast.success(data.message || 'Physical meter replaced successfully');
      setReplaceModalOpen(false);
      fetchMeters();
    } catch (err: any) {
      toast.error(err.message || 'Failed to replace meter');
    } finally {
      setReplaceLoading(false);
    }
  };
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    hostel_id: '',
    room_id: '',
    meter_number: '',
    initial_reading: '',
    notes: ''
  });

  // Fetch hostels owned by user
  const fetchHostels = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch('/api/hostels/owner');
      if (!response.ok) throw new Error('Failed to fetch hostels');
      
      const data = await response.json();
      setHostels(data.hostels || []);
      
      if (data.hostels && data.hostels.length > 0) {
        setSelectedHostel(data.hostels[0].id);
        setFormData(prev => ({ ...prev, hostel_id: data.hostels[0].id }));
      }
    } catch (error) {
      console.error('Error fetching hostels:', error);
      toast.error('Failed to load hostels');
    }
  }, [user?.id]);

  // Fetch rooms for selected hostel
  const fetchRooms = useCallback(async (hostelId: string) => {
    if (!hostelId || hostelId === 'all') return;
    
    try {
      const response = await fetch(`/api/rooms?hostel_id=${hostelId}`);
      if (!response.ok) throw new Error('Failed to fetch rooms');
      
      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    }
  }, []);

  // Fetch meters with enriched data
  const fetchMeters = useCallback(async () => {
    if (!user?.id || !selectedHostel || selectedHostel === 'all') {
      setMeters([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        hostel_id: selectedHostel
      });
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      const response = await fetch(`/api/meters?${params.toString()}`);
      
      if (!response.ok) throw new Error('Failed to fetch meters');
      
      const data = await response.json();
      setMeters(data.meters || []);
    } catch (error) {
      console.error('Error fetching meters:', error);
      toast.error('Failed to load meters');
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedHostel, statusFilter]);

  // Load hostels on mount
  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  // Load meters when hostel or filters change
  useEffect(() => {
    if (selectedHostel && selectedHostel !== 'all') {
      fetchMeters();
    }
  }, [selectedHostel, statusFilter, fetchMeters]);

  // Load rooms when creating meter
  useEffect(() => {
    if (isCreateOpen && formData.hostel_id) {
      fetchRooms(formData.hostel_id);
    }
  }, [isCreateOpen, formData.hostel_id, fetchRooms]);

  // Handle create meter
  const handleCreateMeter = async () => {
    if (!formData.hostel_id || !formData.room_id || !formData.meter_number || !formData.initial_reading) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    const initialReading = parseFloat(formData.initial_reading);
    if (isNaN(initialReading) || initialReading < 0) {
      toast.error('Initial reading must be a non-negative number');
      return;
    }
    
    setSubmitLoading(true);
    
    try {
      const response = await fetch('/api/meters/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostel_id: formData.hostel_id,
          room_id: formData.room_id,
          meter_number: formData.meter_number,
          initial_reading: initialReading,
          notes: formData.notes || undefined
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create meter');
      }
      
      toast.success(data.message || 'Meter created successfully');
      setIsCreateOpen(false);
      setFormData({
        hostel_id: selectedHostel === 'all' ? '' : selectedHostel,
        room_id: '',
        meter_number: '',
        initial_reading: '',
        notes: ''
      });
      
      // Refresh meters list
      fetchMeters();
    } catch (error: any) {
      console.error('Error creating meter:', error);
      toast.error(error.message || 'Failed to create meter');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Filter meters by pending reading indicator
  const filteredMeters = pendingFilter
    ? meters.filter(m => m.pending_reading)
    : meters;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader 
        title="Electricity Meters"
        description="Manage electricity submeters, monitor pending readings, and track consumption"
        icon={<Zap className="h-5 w-5" />}
      >
        <Link href={selectedHostel && selectedHostel !== 'all' ? `/owner/electricity/meters/bulk?hostelId=${selectedHostel}` : '/owner/electricity/meters/bulk'}>
          <Button variant="outline" className="gap-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium">
            <Layers className="h-4 w-4" />
            Bulk Create Meters
          </Button>
        </Link>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-xs">
          <Plus className="h-4 w-4" />
          Add Meter
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/80 dark:bg-[#122b3b] px-6 py-4 border-b border-slate-200/80 dark:border-[#1a3d52]">
          <div className="flex items-center gap-2.5">
            <IconWrapper color="teal" size="sm">
              <Filter className="h-3.5 w-3.5" />
            </IconWrapper>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
              Filter Meter Records
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hostel Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Hostel</Label>
              <Select value={selectedHostel} onValueChange={setSelectedHostel}>
                <SelectTrigger className="bg-slate-50/60 dark:bg-[#122b3b] border-slate-200 dark:border-[#1a3d52] hover:border-slate-300 dark:hover:border-teal-600 text-slate-900 dark:text-slate-100 rounded-lg">
                  <SelectValue placeholder="Select hostel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Hostels</SelectItem>
                  {hostels.map(hostel => (
                    <SelectItem key={hostel.id} value={hostel.id}>
                      {hostel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-slate-50/60 dark:bg-[#122b3b] border-slate-200 dark:border-[#1a3d52] hover:border-slate-300 dark:hover:border-teal-600 text-slate-900 dark:text-slate-100 rounded-lg">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Pending Reading Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Readings</Label>
              <Select 
                value={pendingFilter ? 'pending' : 'all'} 
                onValueChange={(v) => setPendingFilter(v === 'pending')}
              >
                <SelectTrigger className="bg-slate-50/60 dark:bg-[#122b3b] border-slate-200 dark:border-[#1a3d52] hover:border-slate-300 dark:hover:border-teal-600 text-slate-900 dark:text-slate-100 rounded-lg">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Meters</SelectItem>
                  <SelectItem value="pending">Pending Readings Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meters Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-600 font-medium">Loading meters...</p>
        </div>
      ) : filteredMeters.length === 0 ? (
        <Card className="border-slate-200/90 shadow-xs">
          <CardContent className="py-12 text-center">
            <Zap className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-800 font-semibold text-lg">No meters found</p>
            <p className="text-slate-600 text-sm mt-2">
              {selectedHostel === 'all' 
                ? 'Select a hostel to view meters' 
                : 'Click "Add Meter" or "Bulk Create Meters" to configure electricity meters'}
            </p>
            {selectedHostel !== 'all' && (
              <div className="flex justify-center gap-3 mt-4">
                <Link href={`/owner/electricity/meters/bulk?hostelId=${selectedHostel}`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Layers className="h-4 w-4" />
                    Bulk Create Meters
                  </Button>
                </Link>
                <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Meter
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeters.map(meter => (
            <MeterCard key={meter.id} meter={meter} onRefresh={fetchMeters} onReplace={handleOpenReplace} />
          ))}
        </div>
      )}

      {/* Create Meter Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Meter</DialogTitle>
            <DialogDescription>
              Add a new electricity meter for a room
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Hostel Selection */}
            <div className="space-y-2">
              <Label>Hostel *</Label>
              <Select 
                value={formData.hostel_id} 
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, hostel_id: value, room_id: '' }));
                  fetchRooms(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select hostel" />
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
            
            {/* Room Selection */}
            <div className="space-y-2">
              <Label>Room *</Label>
              <Select 
                value={formData.room_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, room_id: value }))}
                disabled={!formData.hostel_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      Room {room.room_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Meter Number */}
            <div className="space-y-2">
              <Label>Meter Number *</Label>
              <Input
                placeholder="e.g., MTR-101"
                value={formData.meter_number}
                onChange={(e) => setFormData(prev => ({ ...prev, meter_number: e.target.value }))}
              />
            </div>
            
            {/* Initial Reading */}
            <div className="space-y-2">
              <Label>Initial Reading (kWh) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 1000.00"
                value={formData.initial_reading}
                onChange={(e) => setFormData(prev => ({ ...prev, initial_reading: e.target.value }))}
              />
            </div>
            
            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input
                placeholder="Additional notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateMeter} disabled={submitLoading}>
              {submitLoading ? 'Creating...' : 'Create Meter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Replace Meter Modal */}
      <Dialog open={replaceModalOpen} onOpenChange={setReplaceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Replace Physical Meter</DialogTitle>
            <DialogDescription>
              Record old meter final reading and configure new replacement hardware for Room {meterToReplace?.room_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              <strong>Hardware Replacement Notice:</strong> This action permanently deactivates old meter <span className="font-mono font-bold">{meterToReplace?.meter_number}</span> and closes its billing segment. All historical readings, student charges, and payments remain preserved.
            </div>

            {/* Old Meter Final Reading */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Old Meter Final Reading (kWh)
                </Label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="final_reading_unavailable"
                    checked={replaceFormData.final_reading_unavailable}
                    onChange={(e) => setReplaceFormData(prev => ({
                      ...prev,
                      final_reading_unavailable: e.target.checked,
                      final_reading: e.target.checked ? '' : prev.final_reading
                    }))}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="final_reading_unavailable" className="text-[11px] text-amber-700 dark:text-amber-300 cursor-pointer font-medium">
                    Display unreadable / burned out
                  </label>
                </div>
              </div>
              <Input
                type="number"
                step="0.01"
                placeholder={meterToReplace?.last_reading ? String(meterToReplace.last_reading.value) : '0'}
                value={replaceFormData.final_reading}
                disabled={replaceFormData.final_reading_unavailable}
                onChange={(e) => setReplaceFormData(prev => ({ ...prev, final_reading: e.target.value }))}
                className={replaceFormData.final_reading_unavailable ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : ''}
              />
              <p className="text-[11px] text-slate-500">
                {replaceFormData.final_reading_unavailable
                  ? `Will close billing segment using last verified physical reading (${meterToReplace?.last_reading ? `${meterToReplace.last_reading.value} kWh` : 'None'}) without fabricating estimates.`
                  : `Last recorded reading: ${meterToReplace?.last_reading ? `${meterToReplace.last_reading.value} kWh` : 'None'}`}
              </p>
            </div>

            {/* New Meter Number */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                New Meter Number / Serial *
              </Label>
              <Input
                placeholder="e.g. M-101-B"
                value={replaceFormData.new_meter_number}
                onChange={(e) => setReplaceFormData(prev => ({ ...prev, new_meter_number: e.target.value }))}
              />
            </div>

            {/* New Meter Initial Reading */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                New Meter Initial Reading (kWh) *
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 15.00"
                value={replaceFormData.initial_reading}
                onChange={(e) => setReplaceFormData(prev => ({ ...prev, initial_reading: e.target.value }))}
              />
              <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                ✓ Can be lower than the old meter's reading (e.g. 15 kWh on new meter vs 1,250 kWh on old meter).
              </p>
            </div>

            {/* Replacement Reason / Notes */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Reason / Notes</Label>
              <Input
                placeholder="e.g. Display malfunction, burned out, digital upgrade"
                value={replaceFormData.notes}
                onChange={(e) => setReplaceFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReplace} disabled={replaceLoading} className="bg-amber-600 hover:bg-amber-700 text-white">
              {replaceLoading ? 'Replacing Meter...' : 'Confirm Replacement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// MeterCard Component (Task 21.2)
interface MeterCardProps {
  meter: MeterWithDetails;
  onRefresh: () => void;
  onReplace?: (meter: MeterWithDetails) => void;
}

function MeterCard({ meter, onRefresh: _onRefresh, onReplace }: MeterCardProps) {
  const getReadingStatus = () => {
    if (meter.pending_reading) {
      return {
        text: 'Reading Required',
        color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-medium',
        icon: <AlertCircle className="h-4 w-4" />
      };
    }
    if (!meter.last_reading) {
      return {
        text: 'No Reading',
        color: 'bg-slate-100 dark:bg-[#122b3b] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1a3d52] font-medium',
        icon: null
      };
    }
    return {
      text: 'Up to Date',
      color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-medium',
      icon: <CheckCircle className="h-4 w-4" />
    };
  };

  const getBillingStatus = () => {
    if (meter.open_segment_id) {
      return {
        text: 'Billing Active',
        color: 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-medium',
        icon: <CheckCircle className="h-4 w-4" />
      };
    }
    if (!meter.last_reading) {
      return {
        text: 'Not Started',
        color: 'bg-slate-100 dark:bg-[#122b3b] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1a3d52] font-medium',
        icon: null
      };
    }
    if (meter.pending_reading) {
      return {
        text: 'Billing Pending',
        color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-medium',
        icon: <AlertCircle className="h-4 w-4" />
      };
    }
    return {
      text: 'Not Started',
      color: 'bg-slate-100 dark:bg-[#122b3b] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1a3d52] font-medium',
      icon: null
    };
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

  const readingStatus = getReadingStatus();
  const billingStatus = getBillingStatus();

  return (
    <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="bg-slate-50/70 dark:bg-[#122b3b] px-5 py-4 border-b border-slate-100 dark:border-[#1a3d52]">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <IconWrapper color={meter.status === 'active' ? "blue" : "indigo"} size="md">
              <Zap className="h-4 w-4" />
            </IconWrapper>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Room {meter.room_number}</CardTitle>
              <CardDescription className="font-mono text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                {meter.meter_number}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-5 space-y-4">
        {/* Meter Status */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400 font-medium text-xs">Meter Status</span>
          <Badge className={meter.status === 'active' ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800 font-medium text-xs" : "bg-slate-100 dark:bg-[#122b3b] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#1a3d52] font-medium text-xs"} variant="outline">
            {meter.status === 'active' ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Reading Status */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400 font-medium text-xs">Reading Status</span>
          <Badge className={`${readingStatus.color} border text-xs`} variant="outline">
            {readingStatus.icon}
            <span className="ml-1">{readingStatus.text}</span>
          </Badge>
        </div>

        {/* Billing Status */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400 font-medium text-xs">Billing Status</span>
          <Badge className={`${billingStatus.color} border text-xs`} variant="outline">
            {billingStatus.icon}
            <span className="ml-1">{billingStatus.text}</span>
          </Badge>
        </div>

        {/* Last Reading */}
        {meter.last_reading ? (
          <div className="space-y-1 p-3 rounded-lg bg-slate-50/70 dark:bg-[#122b3b] border border-slate-100 dark:border-[#1a3d52]">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Last Reading</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{meter.last_reading.value} <span className="text-xs font-normal text-slate-600 dark:text-slate-400">kWh</span></p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              {formatDate(meter.last_reading.timestamp)}
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-3 rounded-lg bg-slate-50/70 dark:bg-[#122b3b] border border-slate-100 dark:border-[#1a3d52]">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">No readings yet</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Record initial reading to start tracking</p>
          </div>
        )}
        
        {/* Reading Required Message */}
        {meter.pending_reading && (
          <div className="flex items-start gap-2.5 p-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-700/60 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-amber-900 dark:text-amber-300 font-semibold">
                Reading Required
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-200/90 mt-0.5 leading-relaxed">
                New student allocation detected. Record a reading to start the new billing segment.
              </p>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs border-slate-200 dark:border-[#1a3d52] hover:bg-slate-50 dark:hover:bg-[#122b3b] text-slate-700 dark:text-slate-200"
              onClick={() => window.location.href = `/owner/electricity/readings/history?meter_id=${meter.id}`}
            >
              History
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-xs"
              onClick={() => window.location.href = `/owner/electricity/readings/record?meter_id=${meter.id}${meter.pending_reading ? '&reading_reason=occupancy_change' : ''}`}
            >
              Record Reading
            </Button>
          </div>
          {meter.status === 'active' && onReplace && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs text-slate-600 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-dashed border-slate-200 dark:border-[#1a3d52]"
              onClick={() => onReplace(meter)}
            >
              Replace Physical Meter →
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
