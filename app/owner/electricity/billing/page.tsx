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
import { IconWrapper } from '@/components/owner/icon-wrapper';

interface BillingSummary {
  total_consumption_all: number;
  total_consumption_occupied: number;
  total_consumption_empty: number;
  total_revenue_paise: number;
  total_revenue_rupees: number;
}

interface RoomBilling {
  room_id: string;
  room_number: string;
  segments_count: number;
  total_consumption: number;
  total_revenue_paise: number;
  total_revenue_rupees: number;
  empty_room_consumption: number;
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
    if (roomTypeFilter === 'occupied') return room.empty_room_consumption === 0 && room.segments_count > 0;
    if (roomTypeFilter === 'empty') return room.empty_room_consumption > 0;
    return true;
  });

  // Format currency
  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <IconWrapper color="emerald" size="lg">
            <DollarSign className="h-5 w-5" />
          </IconWrapper>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Billing Overview
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Monthly electricity billing summaries, room breakdowns, and consumption tracking
            </p>
          </div>
        </div>
        
        <Button 
          onClick={handleExport} 
          disabled={exportLoading || !selectedHostel || !selectedMonth}
          className="gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-xs shrink-0"
        >
          <Download className="h-4 w-4" />
          {exportLoading ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Filters */}
      <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <IconWrapper color="teal" size="sm">
              <Filter className="h-3.5 w-3.5" />
            </IconWrapper>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Filter Billing Records
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hostel Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Hostel</Label>
              <Select value={selectedHostel} onValueChange={setSelectedHostel}>
                <SelectTrigger className="bg-slate-50/60 border-slate-200 hover:border-slate-300 rounded-lg">
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
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Billing Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="bg-slate-50/60 border-slate-200 hover:border-slate-300 rounded-lg">
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
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Room Status Filter</Label>
              <Select value={roomTypeFilter} onValueChange={(v: any) => setRoomTypeFilter(v)}>
                <SelectTrigger className="bg-slate-50/60 border-slate-200 hover:border-slate-300 rounded-lg">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-xs font-medium text-slate-500">Total Revenue</CardDescription>
              <IconWrapper color="emerald" size="sm">
                <DollarSign className="h-3.5 w-3.5" />
              </IconWrapper>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(summary.total_revenue_paise)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Calculated billings</p>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-xs font-medium text-slate-500">Total Consumption</CardDescription>
              <IconWrapper color="amber" size="sm">
                <Zap className="h-3.5 w-3.5" />
              </IconWrapper>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">
                {summary.total_consumption_all.toFixed(2)} <span className="text-xs font-medium text-slate-500">kWh</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">Total electricity used</p>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-xs font-medium text-slate-500">Occupied Rooms</CardDescription>
              <IconWrapper color="blue" size="sm">
                <FileText className="h-3.5 w-3.5" />
              </IconWrapper>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{roomBilling.length}</p>
              <p className="text-xs text-slate-400 mt-1">Active billing accounts</p>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-xs font-medium text-slate-500">Empty Rooms</CardDescription>
              <IconWrapper color="violet" size="sm">
                <Zap className="h-3.5 w-3.5" />
              </IconWrapper>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-700">{roomBilling.filter(r => r.empty_room_consumption > 0).length}</p>
              <p className="text-xs text-slate-400 mt-1">Standby consumption</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Room Billing Table */}
      <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <IconWrapper color="blue" size="sm">
              <FileText className="h-3.5 w-3.5" />
            </IconWrapper>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">
                Room-wise Billing
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {filteredRooms.length} rooms • {selectedMonth}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">Loading billing data...</p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium text-sm">No billing data for selected period</p>
              <p className="text-slate-400 text-xs mt-1">Select another hostel or billing month to inspect records.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 border-b border-slate-200/80">
                  <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider pl-6">Room</TableHead>
                  <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Segments</TableHead>
                  <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Consumption</TableHead>
                  <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Revenue</TableHead>
                  <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Type</TableHead>
                  <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map(room => (
                  <TableRow key={room.room_id} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors">
                    <TableCell className="font-semibold text-slate-900 pl-6">
                      Room {room.room_number}
                    </TableCell>
                    <TableCell className="text-slate-600">{room.segments_count}</TableCell>
                    <TableCell className="text-slate-700 font-medium">{room.total_consumption.toFixed(2)} kWh</TableCell>
                    <TableCell className="font-bold text-emerald-600">
                      {formatCurrency(room.total_revenue_paise)}
                    </TableCell>
                    <TableCell>
                      {room.empty_room_consumption > 0 && room.total_consumption > room.empty_room_consumption ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200/80 font-normal">Mixed</Badge>
                      ) : room.empty_room_consumption > 0 ? (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 font-normal">Empty</Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200/80 font-normal shadow-none hover:bg-emerald-100">Occupied</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 text-xs border-slate-200 hover:border-slate-300 hover:bg-slate-100"
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