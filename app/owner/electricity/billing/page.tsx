'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import { DollarSign, Download, Zap, Users, Gauge, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from "@/components/owner/page-header";
import Link from 'next/link';

export type ElectricityBillingStatus =
  | 'paid'
  | 'pending_verification'
  | 'payment_due'
  | 'recorded_unbilled'
  | 'awaiting_initial_reading'
  | 'awaiting_allocation_reading'
  | 'awaiting_month_end_reading'
  | 'zero_consumption'
  | 'unmetered';

interface BillingSummary {
  total_consumption_all: number;
  total_consumption_occupied: number;
  total_consumption_empty: number;
  total_revenue_paise: number;
  total_revenue_rupees: number;
  total_students: number;
  total_metered_rooms: number;
  rooms_awaiting_reading?: number;
  rooms_with_calculable_consumption?: number;
}

interface RoomBilling {
  room_id: string;
  room_number: string;
  floor?: number;
  capacity?: number;
  occupancy?: number;
  meter_id?: string | null;
  meter_number?: string | null;
  segments_count: number;
  closed_segments_count?: number;
  open_segments_count?: number;
  is_cycle_in_progress?: boolean;
  total_consumption: number;
  total_revenue_paise: number;
  total_revenue_rupees: number;
  empty_room_consumption: number;
  consumption_calculable?: boolean;
  status: 'occupied' | 'empty' | 'mixed' | 'unmetered' | 'awaiting_reading' | 'zero_consumption';
  detailed_status?: ElectricityBillingStatus;
  status_label?: string;
  initial_reading?: {
    id: string;
    value: number;
    timestamp: string;
    reason: string;
  } | null;
  latest_reading?: {
    id: string;
    value: number;
    timestamp: string;
    reason: string;
  } | null;
  current_occupants?: {
    student_id: string;
    student_name: string;
    student_email?: string | null;
  }[];
  student_charges_paise?: number;
  student_charges_rupees?: number;
}

interface StudentBilling {
  student_id: string;
  student_name: string;
  student_email: string;
  room_id: string;
  room_number: string;
  allocation_id: string;
  allocation_start: string;
  allocation_end?: string | null;
  meter_id?: string | null;
  meter_number?: string | null;
  consumption_units: number;
  consumption_calculable?: boolean;
  charge_amount_paise: number;
  charge_amount_rupees: number;
  status: ElectricityBillingStatus;
  status_label: string;
  fee_id?: string | null;
  fee_status?: string | null;
  segments_count: number;
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
  const [studentBilling, setStudentBilling] = useState<StudentBilling[]>([]);
  const [activeTab, setActiveTab] = useState<'students' | 'rooms'>('students');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<'all' | 'occupied' | 'empty' | 'awaiting' | 'billed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

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

  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Set default current month on initial mount
  useEffect(() => {
    if (monthOptions.length > 0 && !selectedMonth) {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [monthOptions, selectedMonth]);

  // Fetch owner hostels
  const fetchHostels = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch('/api/hostels/owner');
      if (!response.ok) throw new Error('Failed to fetch hostels');
      
      const data = await response.json();
      const list = data.hostels || [];
      setHostels(list);
      
      if (list.length > 0 && !selectedHostel) {
        setSelectedHostel(list[0].id);
      }
    } catch (error) {
      console.error('Error fetching hostels:', error);
      toast.error('Failed to load hostels');
    }
  }, [user?.id, selectedHostel]);

  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

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
      if (!response.ok) throw new Error('Failed to fetch billing overview');
      
      const data = await response.json();
      setSummary(data.summary || null);
      setRoomBilling(data.rooms || []);
      setStudentBilling(data.students || []);
    } catch (error) {
      console.error('Error fetching billing overview:', error);
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [selectedHostel, selectedMonth]);

  useEffect(() => {
    fetchBillingOverview();
  }, [fetchBillingOverview]);

  // Export to CSV
  const handleExport = async () => {
    if (!selectedHostel || !selectedMonth) return;
    
    setExportLoading(true);
    
    try {
      const params = new URLSearchParams({
        hostel_id: selectedHostel,
        billing_month: selectedMonth
      });
      
      const response = await fetch(`/api/billing/export?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to export billing data');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hostelhub-electricity-${selectedMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Billing data exported successfully');
    } catch (error: any) {
      console.error('Error exporting billing data:', error);
      toast.error(error.message || 'Failed to export billing data');
    } finally {
      setExportLoading(false);
    }
  };

  const formatCurrency = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

  // Filter students based on search and status
  const filteredStudents = useMemo(() => {
    let list = studentBilling;

    if (statusFilter !== 'all') {
      if (statusFilter === 'billed') {
        list = list.filter(s => s.status === 'paid' || s.status === 'payment_due' || s.status === 'pending_verification');
      } else if (statusFilter === 'unbilled') {
        list = list.filter(s => s.status === 'recorded_unbilled');
      } else if (statusFilter === 'awaiting') {
        list = list.filter(s => s.status.startsWith('awaiting_'));
      } else if (statusFilter === 'unmetered') {
        list = list.filter(s => s.status === 'unmetered');
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.student_name.toLowerCase().includes(q) ||
        s.room_number.toLowerCase().includes(q) ||
        (s.student_email && s.student_email.toLowerCase().includes(q)) ||
        (s.meter_number && s.meter_number.toLowerCase().includes(q))
      );
    }

    return list;
  }, [studentBilling, statusFilter, searchQuery]);

  // Filter rooms based on search and roomFilter
  const filteredRooms = useMemo(() => {
    let list = roomBilling;

    if (roomFilter !== 'all') {
      if (roomFilter === 'occupied') {
        list = list.filter(r => (r.occupancy ?? 0) > 0);
      } else if (roomFilter === 'empty') {
        list = list.filter(r => (r.occupancy ?? 0) === 0);
      } else if (roomFilter === 'awaiting') {
        list = list.filter(r => !r.consumption_calculable || r.status === 'awaiting_reading');
      } else if (roomFilter === 'billed') {
        list = list.filter(r => r.consumption_calculable && r.total_consumption > 0);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.room_number.toLowerCase().includes(q) ||
        (r.meter_number && r.meter_number.toLowerCase().includes(q)) ||
        (r.current_occupants && r.current_occupants.some(o => o.student_name.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [roomBilling, roomFilter, searchQuery]);

  // Concise Status Badge Renderer
  const renderStatusBadge = (status: string, fallbackLabel?: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold py-0 px-2 h-5">
            Paid
          </Badge>
        );
      case 'pending_verification':
        return (
          <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-[11px] font-semibold py-0 px-2 h-5">
            Pending Verification
          </Badge>
        );
      case 'payment_due':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-semibold py-0 px-2 h-5">
            Payment Due
          </Badge>
        );
      case 'recorded_unbilled':
      case 'billed':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px] font-semibold py-0 px-2 h-5">
            Billed
          </Badge>
        );
      case 'awaiting_initial_reading':
      case 'awaiting_allocation_reading':
      case 'awaiting_reading':
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] font-semibold py-0 px-2 h-5">
            Awaiting Reading
          </Badge>
        );
      case 'awaiting_month_end_reading':
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] font-semibold py-0 px-2 h-5">
            Cycle in Progress
          </Badge>
        );
      case 'zero_consumption':
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[11px] font-semibold py-0 px-2 h-5">
            Zero Consumption
          </Badge>
        );
      case 'unmetered':
      default:
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200 text-[11px] font-normal py-0 px-2 h-5">
            {fallbackLabel || 'Unmetered'}
          </Badge>
        );
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <PageHeader
        label="Electricity Billing"
        title="Billing Overview"
        description="Monitor student electricity consumption, review calculated charges, and track room sub-meters"
      >
        <Button
          onClick={handleExport}
          disabled={exportLoading || !selectedHostel || !selectedMonth}
          variant="outline"
          size="sm"
          className="border-slate-200 hover:bg-slate-50 text-slate-700 h-8 text-xs font-semibold"
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          {exportLoading ? 'Exporting...' : 'Export CSV'}
        </Button>
      </PageHeader>

      {/* Control Filters */}
      <Card className="border border-slate-200/90 bg-white shadow-2xs rounded-xl">
        <CardContent className="p-3.5 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Select Hostel</Label>
              <Select value={selectedHostel} onValueChange={setSelectedHostel}>
                <SelectTrigger className="bg-white border-slate-300 hover:border-slate-400 text-slate-900 font-medium rounded-lg h-8 text-xs focus:ring-teal-500 focus:border-teal-500 shadow-2xs">
                  <SelectValue placeholder="Choose hostel..." />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom" 
                  align="start" 
                  sideOffset={4} 
                  className="z-50 max-h-72 bg-white border-slate-200 shadow-lg text-slate-900"
                >
                  {hostels.map(hostel => (
                    <SelectItem key={hostel.id} value={hostel.id} className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">
                      {hostel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Billing Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="bg-white border-slate-300 hover:border-slate-400 text-slate-900 font-medium rounded-lg h-8 text-xs focus:ring-teal-500 focus:border-teal-500 shadow-2xs">
                  <SelectValue placeholder="Select month..." />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom" 
                  align="start" 
                  sideOffset={4} 
                  className="z-50 max-h-72 bg-white border-slate-200 shadow-lg text-slate-900"
                >
                  {monthOptions.map(month => (
                    <SelectItem key={month.value} value={month.value} className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <Input
                  placeholder="Room # or student name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-white border-slate-300 hover:border-slate-400 text-slate-900 placeholder:text-slate-400 rounded-lg h-8 text-xs focus-visible:ring-teal-500 shadow-2xs font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                {activeTab === 'students' ? 'Student Status' : 'Room Filter'}
              </Label>
              {activeTab === 'students' ? (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-white border-slate-300 hover:border-slate-400 text-slate-900 font-medium rounded-lg h-8 text-xs focus:ring-teal-500 focus:border-teal-500 shadow-2xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent 
                    position="popper" 
                    side="bottom" 
                    align="start" 
                    sideOffset={4} 
                    className="z-50 max-h-72 bg-white border-slate-200 shadow-lg text-slate-900"
                  >
                    <SelectItem value="all" className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">All Students ({studentBilling.length})</SelectItem>
                    <SelectItem value="billed" className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">Billed</SelectItem>
                    <SelectItem value="unbilled" className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">Unbilled</SelectItem>
                    <SelectItem value="awaiting" className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">Awaiting Reading</SelectItem>
                    <SelectItem value="unmetered" className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">Unmetered</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={roomFilter} onValueChange={(v: any) => setRoomFilter(v)}>
                  <SelectTrigger className="bg-white border-slate-300 hover:border-slate-400 text-slate-900 font-medium rounded-lg h-8 text-xs focus:ring-teal-500 focus:border-teal-500 shadow-2xs">
                    <SelectValue placeholder="All Rooms" />
                  </SelectTrigger>
                  <SelectContent 
                    position="popper" 
                    side="bottom" 
                    align="start" 
                    sideOffset={4} 
                    className="z-50 max-h-72 bg-white border-slate-200 shadow-lg text-slate-900"
                  >
                    <SelectItem value="all" className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">All Rooms ({roomBilling.length})</SelectItem>
                    <SelectItem value="occupied" className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">Occupied</SelectItem>
                    <SelectItem value="empty" className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">Empty</SelectItem>
                    <SelectItem value="awaiting" className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">Awaiting Reading</SelectItem>
                    <SelectItem value="billed" className="text-xs text-slate-800 font-medium focus:bg-teal-50 focus:text-teal-900 cursor-pointer">Billed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPI Cards - Compact */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Total Billed Revenue</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xl font-bold text-slate-900 font-mono">
              ₹{(summary.total_revenue_paise / 100).toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              From {summary.rooms_with_calculable_consumption ?? 0} finalized rooms
            </p>
          </div>
          
          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Billed Consumption</span>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold text-slate-900 font-mono">
              {summary.total_consumption_all.toFixed(2)} <span className="text-xs font-normal text-slate-500">kWh</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {summary.rooms_awaiting_reading && summary.rooms_awaiting_reading > 0 ? (
                <span className="text-amber-700 font-medium">{summary.rooms_awaiting_reading} room(s) in progress</span>
              ) : (
                `Occupied: ${summary.total_consumption_occupied.toFixed(2)} kWh`
              )}
            </p>
          </div>
          
          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Allocated Students</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-slate-900">
              {studentBilling.length}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              In {roomBilling.filter(r => (r.occupancy ?? 0) > 0).length} occupied rooms
            </p>
          </div>
          
          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Readings</span>
              <Gauge className="h-4 w-4 text-violet-500" />
            </div>
            <p className="text-xl font-bold text-slate-900">
              {summary.rooms_awaiting_reading ?? roomBilling.filter(r => !r.consumption_calculable && r.meter_number).length}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {summary.total_metered_rooms} total meters &bull; {summary.rooms_with_calculable_consumption ?? 0} finalized
            </p>
          </div>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-3">
        <div className="flex items-center justify-between">
          <TabsList className="bg-slate-100 p-1 rounded-xl border border-slate-200 h-9">
            <TabsTrigger 
              value="students" 
              className="rounded-lg text-xs font-semibold px-4 py-1.5 transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-xs data-[state=inactive]:text-slate-600 hover:text-slate-900"
            >
              Allocated Students ({filteredStudents.length})
            </TabsTrigger>
            <TabsTrigger 
              value="rooms" 
              className="rounded-lg text-xs font-semibold px-4 py-1.5 transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-xs data-[state=inactive]:text-slate-600 hover:text-slate-900"
            >
              Room Electricity Consumption ({filteredRooms.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Allocated Students Table */}
        <TabsContent value="students" className="m-0">
          <Card className="border border-slate-200/90 bg-white shadow-2xs rounded-xl overflow-hidden">
            <div className="w-full overflow-x-auto">
              {loading ? (
                <div className="text-center py-10">
                  <p className="text-slate-500 text-xs">Loading student billing data...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-10">
                  <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-700 font-semibold text-xs">No allocated students found</p>
                </div>
              ) : (
                <Table className="w-full text-xs">
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 border-b border-slate-200/80">
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Student</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Room</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Sub-Meter</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Consumption</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Charge</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Status</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map(student => (
                      <TableRow key={student.allocation_id} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors">
                        <TableCell className="px-3.5 py-2.5 font-medium text-slate-900">
                          <div>{student.student_name}</div>
                          {student.student_email && (
                            <div className="text-[11px] text-slate-400 font-normal truncate max-w-[150px]">{student.student_email}</div>
                          )}
                        </TableCell>
                        <TableCell className="px-3.5 py-2.5 font-medium text-slate-800">
                          Room {student.room_number}
                        </TableCell>
                        <TableCell className="px-3.5 py-2.5 font-mono text-slate-700">
                          {student.meter_number || <span className="text-slate-400 italic">None</span>}
                        </TableCell>
                        <TableCell className="px-3.5 py-2.5">
                          {student.consumption_calculable ? (
                            <span className="font-semibold text-slate-900">{student.consumption_units.toFixed(2)} kWh</span>
                          ) : (
                            <span className="text-amber-700 font-medium">Pending Reading</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3.5 py-2.5 font-semibold text-slate-900">
                          {student.charge_amount_paise > 0 ? (
                            <span className="text-emerald-700">{formatCurrency(student.charge_amount_paise)}</span>
                          ) : student.consumption_calculable ? (
                            <span className="text-slate-400 font-normal">₹0.00</span>
                          ) : (
                            <span className="text-slate-400 font-normal italic">Pending</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3.5 py-2.5">
                          {renderStatusBadge(student.status, student.status_label)}
                        </TableCell>
                        <TableCell className="px-3.5 py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="h-7 text-xs px-2.5 border-slate-200 hover:bg-slate-50 text-slate-700"
                          >
                            <Link href={`/owner/electricity/billing/room-details?room_id=${student.room_id}&month=${selectedMonth}`}>
                              Details
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Room Electricity Consumption Table - Compact & Responsive */}
        <TabsContent value="rooms" className="m-0">
          <Card className="border border-slate-200/90 bg-white shadow-2xs rounded-xl overflow-hidden">
            <div className="w-full overflow-x-auto">
              {loading ? (
                <div className="text-center py-10">
                  <p className="text-slate-500 text-xs">Loading room billing data...</p>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="text-center py-10">
                  <Zap className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-600 font-medium text-xs">No matching rooms found</p>
                </div>
              ) : (
                <Table className="w-full text-xs">
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 border-b border-slate-200/80">
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Room</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Sub-Meter</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Occupancy</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Latest Reading</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Consumption</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5">Billing Status</TableHead>
                      <TableHead className="font-semibold text-slate-600 uppercase text-[11px] px-3.5 py-2.5 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRooms.map(room => {
                      const isPending = !room.consumption_calculable || room.status === 'awaiting_reading';
                      const badgeStatus = room.detailed_status || (isPending ? 'awaiting_month_end_reading' : room.status);
                      const latest = room.latest_reading;

                      return (
                        <TableRow key={room.room_id} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors">
                          {/* 1. Room Number */}
                          <TableCell className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                            Room {room.room_number}
                            {room.floor !== undefined && (
                              <span className="text-[10px] text-slate-400 font-normal ml-1.5">Fl. {room.floor}</span>
                            )}
                          </TableCell>

                          {/* 2. Sub-Meter */}
                          <TableCell className="px-3.5 py-2.5 whitespace-nowrap">
                            {room.meter_number ? (
                              <span className="font-mono text-xs font-medium text-slate-700">{room.meter_number}</span>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </TableCell>

                          {/* 3. Current Occupancy */}
                          <TableCell className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className="text-slate-800 font-medium">
                              {room.occupancy ?? 0} {(room.occupancy === 1 ? 'resident' : 'residents')}
                            </span>
                          </TableCell>

                          {/* 4. Latest Relevant Reading & Date */}
                          <TableCell className="px-3.5 py-2.5 whitespace-nowrap">
                            {latest ? (
                              <div>
                                <span className="font-mono font-medium text-slate-800">{latest.value} kWh</span>
                                <span className="text-[10px] text-slate-400 block">
                                  {new Date(latest.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>

                          {/* 5. Consumption or Pending State */}
                          <TableCell className="px-3.5 py-2.5 whitespace-nowrap">
                            {room.consumption_calculable ? (
                              room.total_consumption > 0 ? (
                                <span className="font-bold text-slate-900">{room.total_consumption.toFixed(2)} kWh</span>
                              ) : (
                                <span className="text-slate-500 font-medium">0.00 kWh</span>
                              )
                            ) : room.meter_number ? (
                              <span className="text-amber-700 font-medium">Pending Reading</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>

                          {/* 6. Billing Status */}
                          <TableCell className="px-3.5 py-2.5 whitespace-nowrap">
                            {renderStatusBadge(badgeStatus, room.status_label)}
                          </TableCell>

                          {/* 7. Actions */}
                          <TableCell className="px-3.5 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {room.meter_id && isPending && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                  className="h-7 text-xs px-2.5 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold"
                                >
                                  <Link href={`/owner/electricity/readings/record?meter_id=${room.meter_id}&reason=${room.detailed_status === 'awaiting_initial_reading' ? 'initial' : room.detailed_status === 'awaiting_allocation_reading' ? 'occupancy_change' : 'month_end'}`}>
                                    Record
                                  </Link>
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline" 
                                asChild
                                className="h-7 text-xs px-2.5 border-slate-200 hover:bg-slate-50 text-slate-700"
                              >
                                <Link href={`/owner/electricity/billing/room-details?room_id=${room.room_id}&month=${selectedMonth}`}>
                                  Details
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}