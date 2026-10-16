'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { 
  Bell, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  ReceiptIndianRupee, 
  DoorOpen, 
  Megaphone,
  ArrowRight,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface StudentNotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'bill' | 'request' | 'notice' | 'complaint' | 'system';
  link: string;
  created_at: string;
  read?: boolean;
}

export function StudentNotifications() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Load dismissed notifications from localStorage
  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(`hostelhub_dismissed_student_notifs_${user.id}`);
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, [user?.id]);

  // Fetch student actionable notifications
  const { data: rawNotifications = [], isLoading } = useQuery<StudentNotificationItem[]>({
    queryKey: ['student-actionable-notifications', user?.id, profile?.id],
    enabled: !!user?.id,
    refetchInterval: 25000,
    queryFn: async () => {
      if (!user?.id) return [];

      const candidateIds: string[] = Array.from(
        new Set([user.id, profile?.id, profile?.user_id].filter(Boolean) as string[])
      );

      // Check if there is a student record
      const { data: studentRec } = await supabase
        .from('students')
        .select('id')
        .in('profile_id', candidateIds)
        .maybeSingle();

      if (studentRec?.id && !candidateIds.includes(studentRec.id)) {
        candidateIds.push(studentRec.id);
      }

      const items: StudentNotificationItem[] = [];

      // 1. Fetch pending / overdue bills
      try {
        const { data: fees } = await supabase
          .from('student_fees')
          .select('id, month_year, amount_due, amount, due_date, status, created_at')
          .in('student_id', candidateIds)
          .in('status', ['pending', 'overdue'])
          .order('due_date', { ascending: false })
          .limit(5);

        (fees || []).forEach((fee: any) => {
          const amt = Number(fee.amount_due ?? fee.amount ?? 0);
          const isOverdue = fee.status === 'overdue';
          items.push({
            id: `fee-${fee.id}`,
            title: isOverdue ? 'Fee Payment Overdue' : 'Fee Payment Due',
            message: `Payment of ₹${amt.toLocaleString('en-IN')} for ${fee.month_year || 'Current Month'} is ${isOverdue ? 'overdue' : 'due'}.`,
            type: 'bill',
            link: '/student/bills',
            created_at: fee.due_date || fee.created_at || new Date().toISOString(),
            read: false,
          });
        });
      } catch (err) {
        console.warn('[StudentNotifications] Error querying fees:', err);
      }

      // 2. Fetch room request status updates
      try {
        const { data: requests } = await supabase
          .from('room_requests')
          .select(`
            id,
            status,
            created_at,
            hostel:hostels(name),
            room:rooms(room_number)
          `)
          .in('student_id', candidateIds)
          .order('created_at', { ascending: false })
          .limit(5);

        (requests || []).forEach((req: any) => {
          const hostelName = req.hostel?.name || 'Hostel';
          const roomNum = req.room?.room_number ? `Room ${req.room.room_number}` : 'room';
          
          if (req.status === 'approved') {
            items.push({
              id: `req-${req.id}`,
              title: 'Room Allocation Approved 🎉',
              message: `Your request for ${roomNum} at ${hostelName} has been approved!`,
              type: 'request',
              link: '/student/room',
              created_at: req.created_at || new Date().toISOString(),
              read: false,
            });
          } else if (req.status === 'rejected') {
            items.push({
              id: `req-${req.id}`,
              title: 'Room Request Update',
              message: `Your request for ${roomNum} at ${hostelName} was not approved.`,
              type: 'request',
              link: '/student/room',
              created_at: req.created_at || new Date().toISOString(),
              read: false,
            });
          }
        });
      } catch (err) {
        console.warn('[StudentNotifications] Error querying requests:', err);
      }

      // 3. Fetch active allocation to get announcements/notices
      try {
        const { data: alloc } = await supabase
          .from('room_allocations')
          .select('hostel_id')
          .in('student_id', candidateIds)
          .eq('active', true)
          .limit(1)
          .maybeSingle();

        if (alloc?.hostel_id) {
          const { data: notices } = await supabase
            .from('notices')
            .select('id, title, body, created_at')
            .eq('hostel_id', alloc.hostel_id)
            .order('created_at', { ascending: false })
            .limit(3);

          (notices || []).forEach((n: any) => {
            items.push({
              id: `notice-${n.id}`,
              title: n.title || 'Hostel Announcement',
              message: n.body || 'New announcement posted by warden/owner.',
              type: 'notice',
              link: '/student/dashboard',
              created_at: n.created_at || new Date().toISOString(),
              read: false,
            });
          });
        }
      } catch (err) {
        console.warn('[StudentNotifications] Error querying notices:', err);
      }

      // 4. Fetch direct notifications from notifications table
      try {
        const { data: userNotifs } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        (userNotifs || []).forEach((n: any) => {
          items.push({
            id: `notif-${n.id}`,
            title: n.title || 'Notification',
            message: n.message || '',
            type: 'system',
            link: '/student/dashboard',
            created_at: n.created_at || new Date().toISOString(),
            read: Boolean(n.read),
          });
        });
      } catch (err) {
        console.warn('[StudentNotifications] Error querying notifications table:', err);
      }

      // Sort newest first
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return items;
    },
  });

  // Filter out dismissed notifications
  const notifications = rawNotifications.filter((n) => !dismissedIds.includes(n.id));
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Dismiss an individual notification
  const handleDismiss = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDismissedIds((prev) => {
        const next = Array.from(new Set([...prev, id]));
        if (user?.id && typeof window !== 'undefined') {
          try {
            localStorage.setItem(`hostelhub_dismissed_student_notifs_${user.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      if (id.startsWith('notif-')) {
        const rawId = id.replace('notif-', '');
        supabase.from('notifications').update({ read: true }).eq('id', rawId).then(() => {});
      }
    },
    [user?.id]
  );

  // Clear all notifications
  const handleClearAll = useCallback(async () => {
    const allIds = rawNotifications.map((n) => n.id);
    const updated = Array.from(new Set([...dismissedIds, ...allIds]));
    setDismissedIds(updated);

    if (user?.id && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`hostelhub_dismissed_student_notifs_${user.id}`, JSON.stringify(updated));
      } catch {}

      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .eq('read', false);
      } catch (err) {
        // Non-critical
      }
    }

    qc.invalidateQueries({ queryKey: ['student-actionable-notifications', user?.id] });
  }, [rawNotifications, dismissedIds, user?.id, qc]);

  const getIcon = (type: StudentNotificationItem['type']) => {
    switch (type) {
      case 'bill':
        return (
          <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
            <ReceiptIndianRupee className="h-4 w-4" />
          </div>
        );
      case 'request':
        return (
          <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center shrink-0">
            <DoorOpen className="h-4 w-4" />
          </div>
        );
      case 'notice':
        return (
          <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0">
            <Megaphone className="h-4 w-4" />
          </div>
        );
      case 'complaint':
        return (
          <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <Info className="h-4 w-4" />
          </div>
        );
    }
  };

  const handleItemClick = (item: StudentNotificationItem) => {
    setOpen(false);
    router.push(item.link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 active:scale-95"
          aria-label="Student notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#07212b] shadow-xs animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 p-0 border-slate-200 shadow-2xl rounded-2xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900 font-display">Student Alerts</h3>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
                {unreadCount} new
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="text-xs text-teal-600 hover:text-teal-700 font-semibold cursor-pointer transition-colors hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
        
        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center">
              <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
              Checking notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="font-semibold text-slate-700 text-sm">All caught up!</p>
              <p className="text-slate-400">No overdue fees, pending requests, or unread notices.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={cn(
                  "p-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer group relative",
                  !notif.read ? "bg-teal-50/20" : "opacity-80"
                )}
                onClick={() => handleItemClick(notif)}
              >
                {getIcon(notif.type)}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center justify-between gap-1">
                    <p className={cn("text-xs text-slate-900 mb-0.5 truncate", !notif.read && "font-bold text-slate-900")}>
                      {notif.title}
                    </p>
                    <ArrowRight className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-teal-600 transition-all shrink-0" />
                  </div>
                  <p className="text-xs text-slate-600 leading-snug line-clamp-2 mb-1">
                    {notif.message}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </p>
                </div>

                {/* Individual dismiss button */}
                <button
                  type="button"
                  onClick={(e) => handleDismiss(e, notif.id)}
                  title="Dismiss notification"
                  className="absolute top-3 right-3 h-6 w-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs">
          <Link
            href="/student/bills"
            onClick={() => setOpen(false)}
            className="text-teal-600 hover:text-teal-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            My Bills <ArrowRight size={12} />
          </Link>
          <Link
            href="/student/room"
            onClick={() => setOpen(false)}
            className="text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            Room Details <ArrowRight size={12} />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
