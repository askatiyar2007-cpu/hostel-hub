'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { DollarSign, Download, Zap, Filter, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface BillingSummary {
  total_consumption: number;
  total_revenue_paise: number;
  occupied_rooms: number;
  empty_rooms: number;
  total_segments: number;
}

interface RoomBilling {
  room_id: string;
  room_number: string;
  segment_count: number;
  total_consumption: number;
  total_revenue_paise: number;
  occupied_segment_count: number;
  empty_segment_count: number;
}

interface Hostel {
  id: string;
  name: string;
}

export default function BillingOverviewPage() {
  const { user } = useAuth();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [roomBilling, setRoomBilling] = useState<RoomBilling[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  // Filters
  const [roomTypeFilter, setRoomTypeFilter] = useState<'all' | 'occupied' | 'empty'>('all');

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
    const months: { value: string; label: string }[] = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      months.push({ value, label });
    }
    
    return months;
  };

  const monthOptions = getMonthOptions();

  // Fetch hostels
  const fetchHostels = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch('/api/hostels/owner');
      if (!response.ok) throw new Error('Failed to fetch hostels');
      
      const data = await response.json();
      setHostels(data.hostels || []);
      
      if (data.hostels && data.hostels.length > 0) {
        setSelectedHostel(data.hostels[0].id);
      }
    } catch (error) {
      console.error('Error fetching hostels:', error);
      toast.error('Failed to load hostels');
    }
  }, [user?.id]);

  // Fetch billing overview
  const fetchBillingOverview = useCallback(async () => {
    if (!selectedHostel || !selectedMonth) return;
    
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        hostel_id: selectedHostel,
        billing_month: selectedMonth
      });
      
      const response = await fetch(`/api/billing/overview?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch billing overview');
      }
      
      const data = await response.json();
      setSummary(data.summary);
      setRoomBilling(data.rooms || []);
    } catch (error: any) {
      console.error('Error fetching billing:', error);
      toast.error(error.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [selectedHostel, selectedMonth]);

  // Export billing data
  const handleExport = async () => {
    if (!selectedHostel || !selectedMonth) {
      toast.error('Please select hostel and month');
      return;
    }
    
    setExportLoading(true);
    
    try {
      const params = new URLSearchParams({
        hostel_id: selectedHostel,
        billing_month: selectedMonth
      });
      
      const response = await fetch(`/api/billing/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to export billing data');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-${selectedMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Billing data exported successfully');
    } catch (error: any) {
      console.error('Error exporting billing:', error);
      toast.error(error.message || 'Failed to export billing data');
    } finally {
      setExportLoading(false);
    }
  };

  // Load hostels on mount
  useEffect(() => {
    fetchHostels();
    setSelectedMonth(monthOptions[0]?.value || '');
  }, [fetchHostels]);

  // Load billing when filters change
  useEffect(() => {
    if (selectedHostel && selectedMonth) {
      fetchBillingOverview();
    }
  }, [selectedHostel, selectedMonth, fetchBillingOverview]);

  // Filter rooms by type
  const filteredRooms = roomBilling.filter(room => {
    if (roomTypeFilter === 'occupied') return room.occupied_segment_count > 0;
    if (roomTypeFilter === 'empty') return room.empty_segment_count > 0;
    return true;
  });

  // Format currency
  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toFixed(2)}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-green-500" />
            Billing Overview
          </h1>
          <p className="text-gray-600 mt-1">
            Monthly electricity billing summary
          </p>
        </div>
        
        <Button 
          onClick={handleExport} 
          disabled={exportLoading || !selectedHostel || !selectedMonth}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {exportLoading ? 'Exporting...' : 'Export CSV'}
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
                  {hostels.map(hostel => (
                    <SelectItem key={hostel.id} value={hostel.id}>
                      {hostel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Month Filter */}
            <div className="space-y-2">
              <Label>Billing Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Room Type Filter */}
            <div className="space-y-2">
              <Label>Room Type</Label>
              <Select value={roomTypeFilter} onValueChange={(v: any) => setRoomTypeFilter(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  <SelectItem value="occupied">Occupied Only</SelectItem>
                  <SelectItem value="empty">Empty Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.total_revenue_paise)}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Consumption</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">
                {summary.total_consumption.toFixed(2)} kWh
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Occupied Rooms</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.occupied_rooms}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Empty Rooms</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-500">{summary.empty_rooms}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Room Billing Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Room-wise Billing
          </CardTitle>
          <CardDescription>
            {filteredRooms.length} rooms • {selectedMonth}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading billing data...</p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No billing data for selected period</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Segments</TableHead>
                  <TableHead>Consumption</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map(room => (
                  <TableRow key={room.room_id}>
                    <TableCell className="font-medium">
                      Room {room.room_number}
                    </TableCell>
                    <TableCell>{room.segment_count}</TableCell>
                    <TableCell>{room.total_consumption.toFixed(2)} kWh</TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(room.total_revenue_paise)}
                    </TableCell>
                    <TableCell>
                      {room.empty_segment_count > 0 && room.occupied_segment_count > 0 ? (
                        <Badge variant="outline">Mixed</Badge>
                      ) : room.empty_segment_count > 0 ? (
                        <Badge variant="outline" className="bg-gray-100">Empty</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">Occupied</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.location.href = `/owner/electricity/billing/room-details?room_id=${room.room_id}&month=${selectedMonth}`}
                      >
                        View Details
                      </Button>
                    </TableCell>
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