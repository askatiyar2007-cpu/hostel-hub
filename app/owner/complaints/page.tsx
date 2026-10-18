'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Complaint } from '@/types/database';
import {
  MessageSquare, Clock, Search, CheckCircle2, Circle, AlertCircle,
  Zap, Wrench, Wifi, Trash2, Home, ShieldAlert, Phone, Mail,
  Eye, Sparkles, Building2
} from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from "@/components/owner/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Category icons and colors
const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  electrical: { label: 'Electrical', icon: Zap, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900' },
  plumbing: { label: 'Plumbing', icon: Wrench, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900' },
  wifi: { label: 'WiFi', icon: Wifi, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-900' },
  cleaning: { label: 'Cleaning', icon: Trash2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900' },
  furniture: { label: 'Furniture', icon: Home, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900' },
  security: { label: 'Security', icon: ShieldAlert, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900' },
  other: { label: 'Other', icon: AlertCircle, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' }
};

interface ExtendedComplaint extends Complaint {
  hostels: {
    name: string;
  } | null;
  student_full_name: string | null;
  student_email: string | null;
  student_phone: string | null;
  student_avatar: string | null;
}

// Helper: Check if complaint is newly submitted (open and within 72 hours)
function isNewComplaint(createdAt: string, status: string): boolean {
  if (status !== 'open') return false;
  const created = new Date(createdAt).getTime();
  const diffHours = (Date.now() - created) / (1000 * 60 * 60);
  return diffHours <= 72;
}

// Helper: Human readable relative time
function formatTimeAgo(dateStr: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const days = Math.floor(diff / 86400);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

export default function OwnerComplaintsPage() {
  const { profile } = useAuth();
  const [complaints, setComplaints] = useState<ExtendedComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [selectedHostel, setSelectedHostel] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [onlyNew, setOnlyNew] = useState(false);

  // Detail Modal State
  const [selectedComplaint, setSelectedComplaint] = useState<ExtendedComplaint | null>(null);

  // Fetch complaints scoped to owner's hostels
  const fetchComplaints = useCallback(async () => {
    if (!profile?.user_id) return;
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          hostels!inner (name)
        `)
        .eq('hostels.owner_id', profile.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data as unknown as (Complaint & { hostels: { name: string } | null })[]) || [];

      const studentUserIds = Array.from(new Set(rows.map((c) => c.student_id).filter(Boolean)));
      let profileMap = new Map<string, { full_name: string | null; email: string | null; phone_number: string | null; avatar_url: string | null }>();

      if (studentUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, phone_number, avatar_url')
          .in('user_id', studentUserIds);

        if (!profilesError && profilesData) {
          profileMap = new Map(profilesData.map((p) => [p.user_id, p]));
        }
      }

      const withProfiles: ExtendedComplaint[] = rows.map((c) => {
        const sp = profileMap.get(c.student_id);
        return {
          ...c,
          student_full_name: sp?.full_name || null,
          student_email: sp?.email || null,
          student_phone: sp?.phone_number || null,
          student_avatar: sp?.avatar_url || null,
        };
      });

      setComplaints(withProfiles);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Update Status
  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Complaint status set to ${newStatus.replace('_', ' ')}`);
      
      // Update local state immediately
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: newStatus as any } : c));
      if (selectedComplaint && selectedComplaint.id === id) {
        setSelectedComplaint(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  // Distinct hostels list
  const uniqueHostels = useMemo(() => {
    return Array.from(new Set(complaints.map(c => c.hostels?.name).filter(Boolean))) as string[];
  }, [complaints]);

  // Count of new complaints
  const newComplaintsCount = useMemo(() => {
    return complaints.filter(c => isNewComplaint(c.created_at, c.status)).length;
  }, [complaints]);

  // Filtered complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        c.title?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.student_full_name?.toLowerCase().includes(q) ||
        c.hostels?.name?.toLowerCase().includes(q);

      const matchesStatus = statusTab === 'all' || c.status === statusTab;
      const matchesHostel = selectedHostel === 'all' || c.hostels?.name === selectedHostel;
      const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
      const matchesPriority = selectedPriority === 'all' || String(c.priority) === selectedPriority;
      const matchesOnlyNew = !onlyNew || isNewComplaint(c.created_at, c.status);

      return matchesSearch && matchesStatus && matchesHostel && matchesCategory && matchesPriority && matchesOnlyNew;
    });
  }, [complaints, searchQuery, statusTab, selectedHostel, selectedCategory, selectedPriority, onlyNew]);

  const hasActiveFilters = searchQuery || statusTab !== 'all' || selectedHostel !== 'all' || selectedCategory !== 'all' || selectedPriority !== 'all' || onlyNew;

  const resetFilters = () => {
    setSearchQuery('');
    setStatusTab('all');
    setSelectedHostel('all');
    setSelectedCategory('all');
    setSelectedPriority('all');
    setOnlyNew(false);
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return (
          <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-bold text-[10px]">
            HIGH PRIORITY
          </Badge>
        );
      case 2:
        return (
          <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900 font-semibold text-[10px]">
            MEDIUM PRIORITY
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-medium text-[10px]">
            LOW PRIORITY
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Resolved
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold">
            <Clock className="mr-1 h-3 w-3" /> In Progress
          </Badge>
        );
      case 'open':
        return (
          <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-bold">
            <Circle className="mr-1 h-3 w-3 fill-rose-500 text-rose-500" /> Open
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-medium capitalize">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <PageHeader 
        title="Student Complaints & Maintenance"
        description="Review, filter, and track resolution of student maintenance requests and reports."
      />

      {/* Top Controls & Multi-Filter Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0e222e] border border-slate-200/90 dark:border-[#1a3d52] shadow-xs space-y-3">
        {/* Row 1: Status Tabs & Quick "New" toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Tabs value={statusTab} className="w-full sm:w-auto" onValueChange={setStatusTab}>
            <TabsList className="bg-slate-100 dark:bg-[#122b3b] border border-slate-200 dark:border-[#1a3d52] p-1 rounded-xl">
              <TabsTrigger value="all" className="rounded-lg text-xs font-semibold data-[state=active]:bg-teal-600 data-[state=active]:text-white">
                All ({complaints.length})
              </TabsTrigger>
              <TabsTrigger value="open" className="rounded-lg text-xs font-semibold data-[state=active]:bg-rose-600 data-[state=active]:text-white">
                Open ({complaints.filter(c => c.status === 'open').length})
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="rounded-lg text-xs font-semibold data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                In Progress ({complaints.filter(c => c.status === 'in_progress').length})
              </TabsTrigger>
              <TabsTrigger value="resolved" className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                Resolved ({complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Quick "Only New Complaints" toggle button */}
          <button
            type="button"
            onClick={() => setOnlyNew(!onlyNew)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer shrink-0 self-start sm:self-auto",
              onlyNew
                ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                : "bg-slate-50 dark:bg-[#122b3b] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#1a3d52] hover:bg-slate-100 dark:hover:bg-[#16364a]"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Only New Issues</span>
            {newComplaintsCount > 0 && (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold",
                onlyNew ? "bg-white text-rose-600" : "bg-rose-500 text-white animate-pulse"
              )}>
                {newComplaintsCount}
              </span>
            )}
          </button>
        </div>

        {/* Row 2: Search + Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input 
              placeholder="Search student, title, issue..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 border-slate-200 dark:border-[#1a3d52] bg-slate-50/70 dark:bg-[#122b3b] rounded-xl text-xs dark:text-slate-100"
            />
          </div>

          {/* Hostel Filter */}
          <div className="relative">
            <select
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(e.target.value)}
              className="w-full h-9 rounded-xl border border-slate-200 dark:border-[#1a3d52] bg-slate-50/70 dark:bg-[#122b3b] px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
            >
              <option value="all">All Hostels ({uniqueHostels.length})</option>
              {uniqueHostels.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-9 rounded-xl border border-slate-200 dark:border-[#1a3d52] bg-slate-50/70 dark:bg-[#122b3b] px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer capitalize"
            >
              <option value="all">All Categories</option>
              {Object.keys(CATEGORY_CONFIG).map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="relative">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full h-9 rounded-xl border border-slate-200 dark:border-[#1a3d52] bg-slate-50/70 dark:bg-[#122b3b] px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="1">High Priority Only</option>
              <option value="2">Medium Priority Only</option>
              <option value="3">Low Priority Only</option>
            </select>
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-medium">Active filters:</span>
              {statusTab !== 'all' && (
                <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-semibold capitalize">
                  Status: {statusTab.replace('_', ' ')}
                </span>
              )}
              {selectedHostel !== 'all' && (
                <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-semibold">
                  Hostel: {selectedHostel}
                </span>
              )}
              {selectedCategory !== 'all' && (
                <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-semibold capitalize">
                  Category: {CATEGORY_CONFIG[selectedCategory]?.label || selectedCategory}
                </span>
              )}
              {selectedPriority !== 'all' && (
                <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-semibold">
                  Priority: {selectedPriority === '1' ? 'High' : selectedPriority === '2' ? 'Medium' : 'Low'}
                </span>
              )}
              {onlyNew && (
                <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold">
                  New Issues Only
                </span>
              )}
              {searchQuery && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium">
                  &ldquo;{searchQuery}&rdquo;
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 h-7 px-2 cursor-pointer"
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Complaints List */}
      <div className="grid grid-cols-1 gap-3 sm:gap-3.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white dark:bg-[#0e222e] rounded-2xl border border-slate-200/90 dark:border-[#1a3d52]">
            <Clock className="h-8 w-8 text-teal-600 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">Loading complaints...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-dashed border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e]">
            <div className="rounded-full bg-slate-100 dark:bg-[#122b3b] p-3 text-slate-400">
              <MessageSquare size={28} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">No complaints found</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-0.5">
                {hasActiveFilters
                  ? "No complaints match your active filters or search terms." 
                  : "Everything is quiet! No maintenance issues reported."}
              </p>
            </div>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters} className="border-slate-200 dark:border-[#1a3d52] text-xs rounded-xl h-8">
                Reset filters
              </Button>
            )}
          </div>
        ) : filteredComplaints.map((complaint) => {
          const isNew = isNewComplaint(complaint.created_at, complaint.status);
          const cat = CATEGORY_CONFIG[complaint.category] || CATEGORY_CONFIG.other;
          const CatIcon = cat.icon;
          const timeAgo = formatTimeAgo(complaint.created_at);

          return (
            <div 
              key={complaint.id} 
              className={cn(
                "group rounded-2xl border bg-white dark:bg-[#0e222e] p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer relative",
                isNew
                  ? "border-rose-300 dark:border-rose-900/80 border-l-4 border-l-rose-500 bg-rose-50/15 dark:bg-rose-950/20"
                  : complaint.status === 'in_progress'
                  ? "border-slate-200/90 dark:border-[#1a3d52] border-l-4 border-l-amber-500"
                  : complaint.status === 'resolved' || complaint.status === 'closed'
                  ? "border-slate-200/90 dark:border-[#1a3d52] border-l-4 border-l-emerald-500 opacity-90 hover:opacity-100"
                  : "border-slate-200/90 dark:border-[#1a3d52] border-l-4 border-l-slate-400"
              )}
              onClick={() => setSelectedComplaint(complaint)}
            >
              {/* Top Header Row: Badges, New Marker & Status */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* High Visibility NEW Marker */}
                  {isNew && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500 text-white shadow-xs animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                      NEW COMPLAINT
                    </span>
                  )}

                  {/* Priority */}
                  {getPriorityBadge(complaint.priority)}

                  {/* Category */}
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border",
                    cat.bg, cat.color
                  )}>
                    <CatIcon className="h-3 w-3" />
                    <span>{cat.label}</span>
                  </span>

                  {/* Status Badge */}
                  {getStatusBadge(complaint.status)}
                </div>

                {/* Relative timestamp */}
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{timeAgo}</span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1 mb-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {complaint.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                  {complaint.description}
                </p>
              </div>

              {/* Bottom Footer: Student Info + Quick Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-[#1a3d52]">
                {/* Student Identity Chip */}
                <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="h-7 w-7 rounded-full bg-teal-100 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-[11px] text-teal-800 dark:text-teal-300 font-bold shrink-0 overflow-hidden">
                    {complaint.student_avatar ? (
                      <img src={complaint.student_avatar} alt={complaint.student_full_name || 'Student'} className="h-full w-full object-cover" />
                    ) : (
                      complaint.student_full_name?.[0]?.toUpperCase() || 'S'
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                      {complaint.student_full_name || 'Student resident'}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {complaint.hostels?.name || 'Hostel'}
                    </p>
                  </div>
                </div>

                {/* Right controls: View Details & Status Dropdown */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-xl text-xs font-semibold border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#122b3b] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#16364a] cursor-pointer"
                    onClick={() => setSelectedComplaint(complaint)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" />
                    View Details
                  </Button>

                  <select 
                    className="h-8 rounded-xl border border-slate-200 dark:border-[#1a3d52] bg-slate-50 dark:bg-[#122b3b] hover:bg-white dark:hover:bg-[#16364a] px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer"
                    value={complaint.status}
                    onChange={(e) => updateStatus(complaint.id, e.target.value)}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Complaint Details Dialog */}
      <Dialog open={!!selectedComplaint} onOpenChange={(open) => { if (!open) setSelectedComplaint(null); }}>
        {selectedComplaint && (
          <DialogContent className="sm:max-w-lg rounded-2xl p-5 sm:p-6 bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] shadow-2xl text-slate-900 dark:text-slate-100">
            <DialogHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {isNewComplaint(selectedComplaint.created_at, selectedComplaint.status) && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500 text-white shadow-xs animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                      NEW COMPLAINT
                    </span>
                  )}
                  {getPriorityBadge(selectedComplaint.priority)}
                  {getStatusBadge(selectedComplaint.status)}
                </div>
              </div>

              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-display text-left">
                {selectedComplaint.title}
              </DialogTitle>
            </DialogHeader>

            {/* Clear Status State Notice Banner */}
            {isNewComplaint(selectedComplaint.created_at, selectedComplaint.status) ? (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5">
                <AlertCircle className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-rose-900 dark:text-rose-200">NEW UNADDRESSED COMPLAINT</p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-normal">
                    This issue was submitted {formatTimeAgo(selectedComplaint.created_at)} and is awaiting owner review or staff assignment.
                  </p>
                </div>
              </div>
            ) : selectedComplaint.status === 'in_progress' ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 flex items-start gap-2.5">
                <Clock className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">IN PROGRESS</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-normal">
                    This complaint has been acknowledged and repairs or maintenance are underway.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">RESOLVED</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-normal">
                    This issue has been resolved and closed.
                  </p>
                </div>
              </div>
            )}

            {/* Student & Hostel Metadata */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Student Name</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedComplaint.student_full_name || 'Student resident'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Hostel Property</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-teal-600" />
                  {selectedComplaint.hostels?.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Submitted</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {new Date(selectedComplaint.created_at).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })} ({formatTimeAgo(selectedComplaint.created_at)})
                </span>
              </div>
              {selectedComplaint.student_phone && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-[#1a3d52]">
                  <span className="text-slate-500 dark:text-slate-400">Phone Contact</span>
                  <a href={`tel:${selectedComplaint.student_phone}`} className="font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {selectedComplaint.student_phone}
                  </a>
                </div>
              )}
              {selectedComplaint.student_email && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Email Contact</span>
                  <a href={`mailto:${selectedComplaint.student_email}`} className="font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {selectedComplaint.student_email}
                  </a>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Issue Description
              </h4>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed p-3 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] whitespace-pre-wrap">
                {selectedComplaint.description}
              </p>
            </div>

            {/* Quick Status Change Action Buttons */}
            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-[#1a3d52]">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status:</span>
                <select
                  value={selectedComplaint.status}
                  onChange={(e) => updateStatus(selectedComplaint.id, e.target.value)}
                  className="h-8.5 rounded-xl border border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#122b3b] px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {selectedComplaint.status !== 'in_progress' && selectedComplaint.status !== 'resolved' && (
                  <Button
                    size="sm"
                    className="h-8.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                    onClick={() => updateStatus(selectedComplaint.id, 'in_progress')}
                  >
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    Mark In Progress
                  </Button>
                )}

                {selectedComplaint.status !== 'resolved' ? (
                  <Button
                    size="sm"
                    className="h-8.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    onClick={() => updateStatus(selectedComplaint.id, 'resolved')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Mark Resolved
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8.5 rounded-xl text-xs font-semibold border-slate-200 dark:border-[#1a3d52] cursor-pointer"
                    onClick={() => updateStatus(selectedComplaint.id, 'open')}
                  >
                    Reopen Complaint
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedComplaint(null)}
                  className="h-8.5 rounded-xl text-xs font-semibold border-slate-200 dark:border-[#1a3d52] cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}