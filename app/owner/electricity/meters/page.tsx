'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { Plus, Zap, Filter, AlertCircle, CheckCircle } from 'lucide-react';
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-yellow-500" />
            Electricity Meters
          </h1>
          <p className="text-gray-600 mt-1">
            Manage electricity meters for your rooms
          </p>
        </div>
        
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Meter
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hostel Filter */}
            <div className="space-y-2">
              <Label>Hostel</Label>
              <Select value={selectedHostel} onValueChange={setSelectedHostel}>
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>Readings</Label>
              <Select 
                value={pendingFilter ? 'pending' : 'all'} 
                onValueChange={(v) => setPendingFilter(v === 'pending')}
              >
                <SelectTrigger>
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
          <p className="text-gray-500">Loading meters...</p>
        </div>
      ) : filteredMeters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No meters found</p>
            <p className="text-gray-400 text-sm mt-2">
              {selectedHostel === 'all' 
                ? 'Select a hostel to view meters' 
                : 'Click "Add Meter" to create your first meter'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeters.map(meter => (
            <MeterCard key={meter.id} meter={meter} onRefresh={fetchMeters} />
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
    </div>
  );
}

// MeterCard Component (Task 21.2)
interface MeterCardProps {
  meter: MeterWithDetails;
  onRefresh: () => void;
}

function MeterCard({ meter, onRefresh: _onRefresh }: MeterCardProps) {
  const getStatusColor = (status: string) => {
    return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
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

  return (
    <Card className={meter.pending_reading ? 'border-yellow-500 border-2' : ''}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">Room {meter.room_number}</CardTitle>
            <CardDescription className="font-mono text-sm">
              {meter.meter_number}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(meter.status)}>
            {meter.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Last Reading */}
        {meter.last_reading ? (
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Last Reading</p>
            <p className="text-2xl font-bold">{meter.last_reading.value} kWh</p>
            <p className="text-xs text-gray-400">
              {formatDate(meter.last_reading.timestamp)}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-gray-500">No readings yet</p>
            <p className="text-sm text-gray-400">Record your first reading</p>
          </div>
        )}
        
        {/* Pending Reading Indicator */}
        {meter.pending_reading && (
          <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-xs text-yellow-800 font-medium">
              Reading Required
            </span>
          </div>
        )}
        
        {/* Open Segment Indicator */}
        {meter.open_segment_id && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-blue-800 font-medium">
              Active Billing Segment
            </span>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            onClick={() => window.location.href = `/owner/electricity/readings/history?meter_id=${meter.id}`}
          >
            History
          </Button>
          <Button 
            size="sm" 
            className="flex-1"
            onClick={() => window.location.href = `/owner/electricity/readings/record?meter_id=${meter.id}`}
          >
            Record Reading
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
