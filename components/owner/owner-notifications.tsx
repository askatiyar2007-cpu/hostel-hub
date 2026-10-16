'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { 
  Bell, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  CreditCard, 
  ArrowRight
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

  // Fetch real actionable notifications for owner
  const { data: notifications = [], isLoading } = useQuery<ActionNotification[]>({
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

        // 4. Fetch pending complaints
        try {
          const { data: complaints } = await supabase
            .from('complaints')
            .select(`
              id,
              title,
              created_at,
              status,
              hostel_id,
              room:rooms(room_number)
            `)
            .in('hostel_id', hostelIds)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5);

          (complaints || []).forEach((c: any) => {
            const hName = hostelMap.get(c.hostel_id) || 'Hostel';
            items.push({
              id: `comp-${c.id}`,
              title: 'New Student Complaint',
              message: `"${c.title}" reported at ${hName}.`,
              type: 'complaint',
              link: '/owner/complaints',
              created_at: c.created_at || new Date().toISOString(),
              read: false,
            });
          });
        } catch (err) {
          console.warn('[OwnerNotifications] Error querying complaints:', err);
        }
      }

      // 5. Fetch direct user notifications from notifications table
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
            link: '/owner/dashboard',
            created_at: n.created_at || new Date().toISOString(),
            read: Boolean(n.read),
          });
        });
      } catch (err) {
        console.warn('[OwnerNotifications] Error querying notifications table:', err);
      }

      // Sort newest first
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return items;
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user!.id)
          .eq('read', false);
      } catch (err) {
        // Non-critical
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner-actionable-notifications', user?.id] });
    },
  });

  const getIcon = (type: ActionNotification['type']) => {
    switch (type) {
      case 'request':
        return (
          <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4" />
          </div>
        );
      case 'payment':
        return (
          <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <CreditCard className="h-4 w-4" />
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
      <PopoverContent align="end" className="w-88 p-0 border-slate-200 shadow-2xl rounded-2xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900 font-display">Notifications & Actions</h3>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
                {unreadCount} pending
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button 
              onClick={() => markAllAsRead.mutate()}
              className="text-xs text-teal-600 hover:text-teal-700 font-semibold cursor-pointer transition-colors"
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
              <p className="text-slate-400">No pending room requests, payments, or unread alerts.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={cn(
                  "p-3.5 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer group",
                  !notif.read ? "bg-teal-50/20" : "opacity-80"
                )}
                onClick={() => handleItemClick(notif)}
              >
                {getIcon(notif.type)}
                <div className="flex-1 min-w-0">
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
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs">
          <Link
            href="/owner/requests"
            onClick={() => setOpen(false)}
            className="text-teal-600 hover:text-teal-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            Room Requests <ArrowRight size={12} />
          </Link>
          <Link
            href="/owner/payments"
            onClick={() => setOpen(false)}
            className="text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            Payments <ArrowRight size={12} />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
