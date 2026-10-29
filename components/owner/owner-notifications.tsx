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
  FileText, 
  CreditCard, 
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

export interface ActionNotification {
  id: string;
  title: string;
  message: string;
  type: 'request' | 'payment' | 'complaint' | 'system';
  link: string;
  created_at: string;
  read?: boolean;
}

export function OwnerNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Initialize dismissed IDs from localStorage once user is known
  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(`hostelhub_dismissed_owner_notifs_${user.id}`);
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, [user?.id]);

  // Fetch real actionable notifications for owner
  const { data: rawNotifications = [], isLoading } = useQuery<ActionNotification[]>({
    queryKey: ['owner-actionable-notifications', user?.id],
    enabled: !!user?.id,
    refetchInterval: 20000, // Refresh every 20s
    queryFn: async () => {
      if (!user?.id) return [];

      // 1. Get owner's hostels
      const { data: hostels } = await supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', user.id);

      const hostelIds = (hostels || []).map((h) => h.id);
      const hostelMap = new Map((hostels || []).map((h) => [h.id, h.name]));

      const items: ActionNotification[] = [];

      if (hostelIds.length > 0) {
        // 2. Fetch pending room requests / new student allocations
        try {
          const { data: requests } = await supabase
            .from('room_requests')
            .select(`
              id,
              created_at,
              status,
              hostel_id,
              room:rooms(room_number)
            `)
            .in('hostel_id', hostelIds)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(10);

          (requests || []).forEach((req: any) => {
            const hName = hostelMap.get(req.hostel_id) || 'Hostel';
            const rNum = req.room?.room_number ? `Room ${req.room.room_number}` : 'a room';
            items.push({
              id: `req-${req.id}`,
              title: 'New Room Allocation Request',
              message: `Student requested ${rNum} at ${hName}. Review and approve.`,
              type: 'request',
              link: '/owner/requests',
              created_at: req.created_at || new Date().toISOString(),
              read: false,
            });
          });
        } catch (err) {
          console.warn('[OwnerNotifications] Error querying room_requests:', err);
        }

        // 3. Fetch pending payment verifications
        try {
          const { data: payments } = await supabase
            .from('payments')
            .select(`
              id,
              amount_paid,
              paid_date,
              created_at,
              payment_status,
              allocation:room_allocations(
                room:rooms(room_number),
                hostel:hostels(name)
              )
            `)
            .in('allocation.hostel_id', hostelIds)
            .eq('payment_status', 'pending')
            .order('created_at', { ascending: false })
            .limit(10);

          (payments || []).forEach((pay: any) => {
            const amt = pay.amount_paid ? `₹${Number(pay.amount_paid).toLocaleString()}` : 'Payment';
            const rNum = pay.allocation?.room?.room_number ? ` (Room ${pay.allocation.room.room_number})` : '';
            items.push({
              id: `pay-${pay.id}`,
              title: 'Payment Verification Required',
              message: `New student payment of ${amt}${rNum} awaits your approval.`,
              type: 'payment',
              link: '/owner/payments',
              created_at: pay.paid_date || pay.created_at || new Date().toISOString(),
              read: false,
            });
          });
        } catch (err) {
          console.warn('[OwnerNotifications] Error querying payments:', err);
        }

        // 4. Fetch open/active complaints (without invalid rooms join)
        try {
          const { data: complaints, error: compErr } = await supabase
            .from('complaints')
            .select('id, title, created_at, status, hostel_id')
            .in('hostel_id', hostelIds)
            .in('status', ['open', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(5);

          if (compErr) {
            console.warn('[OwnerNotifications] Complaints query error:', compErr);
          } else {
            (complaints || []).forEach((c: any) => {
              const hName = hostelMap.get(c.hostel_id) || 'Hostel';
              items.push({
                id: `comp-${c.id}`,
                title: 'Active Student Complaint',
                message: `"${c.title}" reported at ${hName}.`,
                type: 'complaint',
                link: '/owner/complaints',
                created_at: c.created_at || new Date().toISOString(),
                read: false,
              });
            });
          }
        } catch (err) {
          console.warn('[OwnerNotifications] Error querying complaints:', err);
        }
      }

      // 5. Fetch direct user notifications from notifications table
      try {
        const { data: userNotifs, error: notifErr } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (notifErr) {
          console.warn('[OwnerNotifications] Notifications query warning:', notifErr.message);
        } else {
          (userNotifs || []).forEach((n: any) => {
            items.push({
              id: `notif-${n.id}`,
              title: n.title || 'Notification',
              message: n.message || '',
              type: 'system',
              link: '/owner/dashboard',
              created_at: n.created_at || new Date().toISOString(),
              read: Boolean(n.read),
            });
          });
        }
      } catch (err) {
        console.warn('[OwnerNotifications] Error querying notifications table:', err);
      }

      // Sort newest first
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return items;
    },
  });

  // Filter out any dismissed IDs
  const notifications = rawNotifications.filter((n) => !dismissedIds.includes(n.id));
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Dismiss a single notification
  const handleDismiss = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDismissedIds((prev) => {
        const next = Array.from(new Set([...prev, id]));
        if (user?.id && typeof window !== 'undefined') {
          try {
            localStorage.setItem(`hostelhub_dismissed_owner_notifs_${user.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      // If it's a real record in notifications table, mark read in DB as well
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
        localStorage.setItem(`hostelhub_dismissed_owner_notifs_${user.id}`, JSON.stringify(updated));
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

    qc.invalidateQueries({ queryKey: ['owner-actionable-notifications', user?.id] });
  }, [rawNotifications, dismissedIds, user?.id, qc]);

  const getIcon = (type: ActionNotification['type']) => {
    switch (type) {
      case 'request':
        return (
          <div className="h-8 w-8 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4" />
          </div>
        );
      case 'payment':
        return (
          <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
            <CreditCard className="h-4 w-4" />
          </div>
        );
      case 'complaint':
        return (
          <div className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
            <Info className="h-4 w-4" />
          </div>
        );
    }
  };

  const handleItemClick = (item: ActionNotification) => {
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
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#07212b] shadow-xs animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 p-0 border border-slate-200 dark:border-[#1a3d52] shadow-2xl rounded-2xl bg-white dark:bg-[#0e222e] overflow-hidden text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25]">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 font-display">Notifications & Actions</h3>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                {unreadCount} pending
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold cursor-pointer transition-colors hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
        
        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-[#1a3d52]">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center">
              <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
              Checking notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">All caught up!</p>
              <p className="text-slate-400 dark:text-slate-500">No pending room requests, payments, or unread alerts.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={cn(
                  "p-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-[#122b3b] transition-colors cursor-pointer group relative",
                  !notif.read ? "bg-teal-50/20 dark:bg-teal-950/30" : "opacity-80"
                )}
                onClick={() => handleItemClick(notif)}
              >
                {getIcon(notif.type)}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center justify-between gap-1">
                    <p className={cn("text-xs text-slate-900 dark:text-slate-100 mb-0.5 truncate", !notif.read && "font-bold text-slate-900 dark:text-white")}>
                      {notif.title}
                    </p>
                    <ArrowRight className="h-3 w-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-all shrink-0" />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug line-clamp-2 mb-1">
                    {notif.message}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </p>
                </div>

                {/* Individual dismiss button */}
                <button
                  type="button"
                  onClick={(e) => handleDismiss(e, notif.id)}
                  title="Dismiss notification"
                  className="absolute top-3 right-3 h-6 w-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#16364a] transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/60 dark:bg-[#0b1b25] flex items-center justify-between text-xs">
          <Link
            href="/owner/requests"
            onClick={() => setOpen(false)}
            className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            Room Requests <ArrowRight size={12} />
          </Link>
          <Link
            href="/owner/payments"
            onClick={() => setOpen(false)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            Payments <ArrowRight size={12} />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
