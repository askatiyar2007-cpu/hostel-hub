'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import { DollarSign, Download, Zap, Users, Gauge, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { IconWrapper } from '@/components/owner/icon-wrapper';
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
  total_consumption: number;
  total_revenue_paise: number;
  total_revenue_rupees: number;
  empty_room_consumption: number;
  status: 'occupied' | 'empty' | 'mixed' | 'unmetered' | 'awaiting_reading';
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
      
      if (!response.ok) {
        throw new Error('Failed to fetch billing overview');
      }
      
      const data = await response.json();
      setSummary(data.summary || null);
      setRoomBilling(data.rooms || []);
      setStudentBilling(data.students || []);
    } catch (error: any) {
      console.error('Error fetching billing:', error);
      toast.error(error.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [selectedHostel, selectedMonth]);

  useEffect(() => {
    fetchBillingOverview();
  }, [fetchBillingOverview]);

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
        month: selectedMonth,
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
      a.download = `electricity_billing_${selectedMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Billing data exported successfully');
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Failed to export billing data');
    } finally {
      setExportLoading(false);
    }
  };

  const formatCurrency = (paise: number) => {
    const rupees = (paise || 0) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(rupees);
  };

  // Filter students based on statusFilter
  const filteredStudents = useMemo(() => {
    if (statusFilter === 'all') return studentBilling;
    if (statusFilter === 'billed') {
      return studentBilling.filter(s => s.status === 'paid' || s.status === 'pending_verification' || s.status === 'payment_due');
    }
    if (statusFilter === 'unbilled') {
      return studentBilling.filter(s => s.status === 'recorded_unbilled');
    }
    if (statusFilter === 'awaiting') {
      return studentBilling.filter(s => s.status.startsWith('awaiting_'));
    }
    if (statusFilter === 'unmetered') {
      return studentBilling.filter(s => s.status === 'unmetered');
    }
    return studentBilling;
  }, [studentBilling, statusFilter]);

  // Render Status Badge
  const renderStatusBadge = (status: ElectricityBillingStatus, label: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200/80 font-medium hover:bg-emerald-100 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            {label}
          </Badge>
        );
      case 'pending_verification':
        return (
          <Badge className="bg-violet-50 text-violet-700 border-violet-200/80 font-medium hover:bg-violet-100 flex items-center gap-1">
            <Clock className="h-3 w-3 text-violet-600" />
            {label}
          </Badge>
        );
      case 'payment_due':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200/80 font-medium hover:bg-amber-100 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-amber-600" />
            {label}
          </Badge>
        );
      case 'recorded_unbilled':
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200/80 font-medium hover:bg-blue-100 flex items-center gap-1">
            <Zap className="h-3 w-3 text-blue-600" />
            {label}
          </Badge>
        );
      case 'awaiting_initial_reading':
        return (
          <Badge className="bg-orange-50 text-orange-700 border-orange-200/80 font-medium hover:bg-orange-100 flex items-center gap-1">
            <Clock className="h-3 w-3 text-orange-600" />
            {label}
          </Badge>
        );
      case 'awaiting_allocation_reading':
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-300 font-medium hover:bg-amber-100 flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-700" />
            {label}
          </Badge>
        );
      case 'awaiting_month_end_reading':
        return (
          <Badge className="bg-sky-50 text-sky-700 border-sky-200/80 font-medium hover:bg-sky-100 flex items-center gap-1">
            <Clock className="h-3 w-3 text-sky-600" />
            {label}
          </Badge>
        );
      case 'zero_consumption':
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-medium">
            {label}
          </Badge>
        );
      case 'unmetered':
      default:
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-300 font-medium">
            {label}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        label="Electricity Billing"
        title="Billing Overview"
        description="Monitor student electricity consumption, review calculated charges, and track room sub-meter summaries"
      >
        <Button
          onClick={handleExport}
          disabled={exportLoading || !selectedHostel || !selectedMonth}
          variant="outline"
          className="border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs h-9 text-xs"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          {exportLoading ? 'Exporting...' : 'Export CSV'}
        </Button>
      </PageHeader>

      {/* Control Filters */}
      <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Hostel Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Select Hostel</Label>
              <Select value={selectedHostel} onValueChange={setSelectedHostel}>
                <SelectTrigger className="bg-slate-50/60 border-slate-200 hover:border-slate-300 rounded-lg h-9">
                  <SelectValue placeholder="Choose hostel..." />
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

            {/* Billing Month Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Billing Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="bg-slate-50/60 border-slate-200 hover:border-slate-300 rounded-lg h-9">
                  <SelectValue placeholder="Select month..." />
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

            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Billing Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-slate-50/60 border-slate-200 hover:border-slate-300 rounded-lg h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts ({studentBilling.length})</SelectItem>
                  <SelectItem value="billed">Billed (Paid / Due / Pending)</SelectItem>
                  <SelectItem value="unbilled">Recorded (Unbilled)</SelectItem>
                  <SelectItem value="awaiting">Awaiting Readings</SelectItem>
                  <SelectItem value="unmetered">Unmetered Rooms</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-xs font-medium text-slate-500">Total Billed Revenue</CardDescription>
              <IconWrapper color="emerald" size="sm">
                <DollarSign className="h-3.5 w-3.5" />
              </IconWrapper>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(summary.total_revenue_paise)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Calculated electricity charges</p>
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
              <p className="text-xs text-slate-400 mt-1">Occupied: {summary.total_consumption_occupied.toFixed(2)} kWh</p>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-xs font-medium text-slate-500">Allocated Students</CardDescription>
              <IconWrapper color="blue" size="sm">
                <Users className="h-3.5 w-3.5" />
              </IconWrapper>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{studentBilling.length}</p>
              <p className="text-xs text-slate-400 mt-1">In {roomBilling.filter(r => r.occupancy && r.occupancy > 0).length} occupied rooms</p>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-xs font-medium text-slate-500">Sub-meters Configured</CardDescription>
              <IconWrapper color="violet" size="sm">
                <Gauge className="h-3.5 w-3.5" />
              </IconWrapper>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-700">{summary.total_metered_rooms}</p>
              <p className="text-xs text-slate-400 mt-1">Active room meters</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="students" className="rounded-lg text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs">
              Allocated Students ({filteredStudents.length})
            </TabsTrigger>
            <TabsTrigger value="rooms" className="rounded-lg text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs">
              Room Sub-meters ({roomBilling.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Allocated Students Electricity Billing Table */}
        <TabsContent value="students" className="m-0">
          <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <IconWrapper color="blue" size="sm">
                  <Users className="h-3.5 w-3.5" />
                </IconWrapper>
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    Allocated Students Electricity Billing
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Students with active room allocations and their electricity billing breakdown for {selectedMonth}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 text-sm">Loading student billing data...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-700 font-semibold text-sm">No allocated students found</p>
                  <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                    No active student room allocations were found for this hostel during {selectedMonth}.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 border-b border-slate-200/80">
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider pl-6">Student</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Room</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Sub-Meter</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Consumption</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Electricity Charge</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Billing Status</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map(student => (
                      <TableRow key={student.allocation_id} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors">
                        <TableCell className="pl-6 py-3.5">
                          <div className="font-semibold text-slate-900 text-sm">{student.student_name}</div>
                          {student.student_email && (
                            <div className="text-xs text-slate-400 font-normal">{student.student_email}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-semibold text-slate-700 border-slate-200">
                            Room {student.room_number}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {student.meter_number ? (
                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {student.meter_number}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No meter</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-700 font-medium">
                          {student.consumption_units > 0 ? (
                            <span>{student.consumption_units.toFixed(2)} kWh</span>
                          ) : (
                            <span className="text-slate-400 text-xs">0.00 kWh</span>
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-slate-900">
                          {student.charge_amount_paise > 0 ? (
                            <span className="text-emerald-600">{formatCurrency(student.charge_amount_paise)}</span>
                          ) : (
                            <span className="text-slate-400 text-xs font-normal">₹0.00</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {renderStatusBadge(student.status, student.status_label)}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {student.meter_id && student.status.startsWith('awaiting_') ? (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-8 text-xs border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-800"
                            >
                              <Link href={`/owner/electricity/readings/record?meter_id=${student.meter_id}&reason=${student.status === 'awaiting_initial_reading' ? 'initial' : student.status === 'awaiting_allocation_reading' ? 'occupancy_change' : 'month_end'}`}>
                                Record Reading
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-8 text-xs border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700"
                            >
                              <Link href={`/owner/electricity/billing/room-details?room_id=${student.room_id}&month=${selectedMonth}`}>
                                View Details
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Room Sub-meters Summary Table */}
        <TabsContent value="rooms" className="m-0">
          <Card className="border border-slate-200/90 bg-white shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <IconWrapper color="blue" size="sm">
                  <FileText className="h-3.5 w-3.5" />
                </IconWrapper>
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    Room-wise Sub-meter Summaries
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Cumulative reading summaries per physical room for {selectedMonth}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 text-sm">Loading room billing data...</p>
                </div>
              ) : roomBilling.length === 0 ? (
                <div className="text-center py-12">
                  <Zap className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium text-sm">No rooms found in hostel</p>
                  <p className="text-slate-400 text-xs mt-1">Add rooms to this hostel to track electricity consumption.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 border-b border-slate-200/80">
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider pl-6">Room</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Sub-Meter</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Segments</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Consumption</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Total Revenue</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Room Type</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-600 uppercase tracking-wider text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roomBilling.map(room => (
                      <TableRow key={room.room_id} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors">
                        <TableCell className="font-semibold text-slate-900 pl-6">
                          Room {room.room_number}
                          {room.floor !== undefined && (
                            <span className="text-xs text-slate-400 font-normal ml-2">Floor {room.floor}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {room.meter_number ? (
                            <span className="font-mono text-xs font-semibold text-slate-700">{room.meter_number}</span>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-slate-200 font-normal">Unmetered</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600">{room.segments_count}</TableCell>
                        <TableCell className="text-slate-700 font-medium">{room.total_consumption.toFixed(2)} kWh</TableCell>
                        <TableCell className="font-bold text-emerald-600">
                          {formatCurrency(room.total_revenue_paise)}
                        </TableCell>
                        <TableCell>
                          {room.status === 'unmetered' ? (
                            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-300 font-normal">Unmetered</Badge>
                          ) : room.status === 'awaiting_reading' ? (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-normal">Awaiting Reading</Badge>
                          ) : room.empty_room_consumption > 0 && room.total_consumption > room.empty_room_consumption ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200/80 font-normal">Mixed</Badge>
                          ) : room.empty_room_consumption > 0 || (room.occupancy === 0) ? (
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 font-normal">Empty</Badge>
                          ) : (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200/80 font-normal shadow-none hover:bg-emerald-100">Occupied</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button 
                            size="sm" 
                            variant="outline"
                            asChild
                            className="h-8 text-xs border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700"
                          >
                            <Link href={`/owner/electricity/billing/room-details?room_id=${room.room_id}&month=${selectedMonth}`}>
                              View Details
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}