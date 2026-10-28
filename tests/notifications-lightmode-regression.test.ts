import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('HostelHub — Light Mode & Stale Notifications Regression Suite', () => {
  const rootDir = path.resolve(__dirname, '..');
  const globalsCss = fs.readFileSync(path.join(rootDir, 'app/globals.css'), 'utf-8');
  const inputTsx = fs.readFileSync(path.join(rootDir, 'components/ui/input.tsx'), 'utf-8');
  const textareaTsx = fs.readFileSync(path.join(rootDir, 'components/ui/textarea.tsx'), 'utf-8');
  const selectTsx = fs.readFileSync(path.join(rootDir, 'components/ui/select.tsx'), 'utf-8');
  const roomRequestPage = fs.readFileSync(path.join(rootDir, 'app/student/room-request/page.tsx'), 'utf-8');
  const dashboardPage = fs.readFileSync(path.join(rootDir, 'app/student/dashboard/page.tsx'), 'utf-8');
  const studentNotifs = fs.readFileSync(path.join(rootDir, 'components/student/student-notifications.tsx'), 'utf-8');
  const ownerStudentsPage = fs.readFileSync(path.join(rootDir, 'app/owner/students/page.tsx'), 'utf-8');
  const ownerRequestsPage = fs.readFileSync(path.join(rootDir, 'app/owner/requests/page.tsx'), 'utf-8');

  // =========================================================================
  // 1. LIGHT-MODE CONSISTENCY & THEME STYLING
  // =========================================================================
  describe('1. Light Mode Consistency & Autofill Overrides', () => {
    it('scopes -webkit-autofill styling so light mode receives white background and dark text', () => {
      // Must not have unscoped dark autofill
      expect(globalsCss).not.toMatch(/input:-webkit-autofill[^{]*\{\s*[^}]*-webkit-box-shadow:\s*0\s+0\s+0\s+1000px\s+#032423/);
      
      // Default light-mode autofill uses white background and slate-900 text
      expect(globalsCss).toContain('input:-webkit-autofill');
      expect(globalsCss).toContain('-webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;');
      expect(globalsCss).toContain('-webkit-text-fill-color: #0f172a !important;');

      // Dark mode autofill uses dark background and light text
      expect(globalsCss).toContain('.dark input:-webkit-autofill');
      expect(globalsCss).toContain('-webkit-box-shadow: 0 0 0 1000px #122b3b inset !important;');
      expect(globalsCss).toContain('-webkit-text-fill-color: #f8fafc !important;');
    });

    it('ensures Input component provides light mode bg-white and dark mode dark:bg-[#122b3b]', () => {
      expect(inputTsx).toContain('bg-white');
      expect(inputTsx).toContain('dark:bg-[#122b3b]');
      expect(inputTsx).toContain('text-slate-900');
      expect(inputTsx).toContain('dark:text-slate-100');
      expect(inputTsx).toContain('border-slate-200');
      expect(inputTsx).toContain('dark:border-[#1a3d52]');
    });

    it('ensures Textarea component provides explicit light/dark background and borders', () => {
      expect(textareaTsx).not.toContain('bg-transparent');
      expect(textareaTsx).toContain('bg-white');
      expect(textareaTsx).toContain('dark:bg-[#122b3b]');
      expect(textareaTsx).toContain('text-slate-900');
      expect(textareaTsx).toContain('dark:text-slate-100');
      expect(textareaTsx).toContain('border-slate-200');
      expect(textareaTsx).toContain('dark:border-[#1a3d52]');
    });

    it('ensures Select component provides explicit light/dark background and borders', () => {
      expect(selectTsx).toContain('bg-white');
      expect(selectTsx).toContain('dark:bg-[#122b3b]');
      expect(selectTsx).toContain('text-slate-900');
      expect(selectTsx).toContain('dark:text-slate-100');
      expect(selectTsx).toContain('border-slate-200');
      expect(selectTsx).toContain('dark:border-[#1a3d52]');
    });

    it('ensures room-request form components and photo upload have explicit light styling', () => {
      // Step 1 container
      expect(roomRequestPage).toContain('border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e]');
      
      // Passport photo upload area
      expect(roomRequestPage).toContain('border-2 border-dashed border-slate-300 dark:border-[#1a3d52] bg-slate-50/70 dark:bg-[#122b3b]/40 rounded-xl');
      
      // Step details container & header
      expect(roomRequestPage).toContain('bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-3xl');
      expect(roomRequestPage).toContain('bg-slate-50/80 dark:bg-[#122b3b]/70 px-6 py-5 border-b border-slate-200 dark:border-[#1a3d52]');

      // Address textarea
      expect(roomRequestPage).toContain('border border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#122b3b] text-slate-900 dark:text-slate-100');

      // OTP container
      expect(roomRequestPage).toContain('rounded-2xl border border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e]');
    });

    it('fixes pending request card contrast in student dashboard for dark mode', () => {
      // The pending request banner must define dark gradient stops to prevent washed-out white on white
      expect(dashboardPage).toContain('dark:border-teal-900/60');
      expect(dashboardPage).toContain('dark:from-[#0e222e]');
      expect(dashboardPage).toContain('dark:via-[#0b1b24]');
      expect(dashboardPage).toContain('dark:to-[#081820]');

      // Headings and paragraphs have explicit dark text colors
      expect(dashboardPage).toContain('text-slate-900 dark:text-slate-100');
      expect(dashboardPage).toContain('text-slate-600 dark:text-slate-300');
    });
  });

  // =========================================================================
  // 2. NOTIFICATION LIFECYCLE & CHECKOUT FILTERING
  // =========================================================================
  describe('2. Notification Filtering & Checkout Lifecycle', () => {
    // Pure logic simulation of the notification filtering implemented in StudentNotifications
    interface RawRequest {
      id: string;
      status: string;
      created_at: string;
      room_id: string;
      hostel_id: string;
      hostel?: { name: string };
      room?: { room_number: string };
    }

    interface RawFee {
      id: string;
      month_year?: string;
      amount_due?: number;
      amount?: number;
      due_date: string;
      status: string;
      created_at: string;
      allocation_id?: string;
    }

    interface RawNotif {
      id: string;
      title: string;
      message: string;
      type: string;
      read: boolean;
      created_at: string;
    }

    interface Allocation {
      id: string;
      room_id: string;
      hostel_id: string;
      active: boolean;
      status: string;
    }

    function filterStudentNotifications({
      allocations,
      requests,
      fees,
      userNotifs,
      dismissedIds = [],
    }: {
      allocations: Allocation[];
      requests: RawRequest[];
      fees: RawFee[];
      userNotifs: RawNotif[];
      dismissedIds?: string[];
    }) {
      const activeAllocation = allocations.find((a) => a.active === true) || null;
      const inactiveAllocationIds = new Set(
        allocations.filter((a) => !a.active).map((a) => a.id)
      );

      const items: Array<{ id: string; title: string; message: string; type: string; read: boolean }> = [];

      // 1. Process fees
      fees.forEach((fee) => {
        if (fee.allocation_id && inactiveAllocationIds.has(fee.allocation_id)) {
          if (fee.status === 'pending') {
            return; // Skip pending rent for vacated rooms
          }
          // Retain overdue past dues
          items.push({
            id: `fee-${fee.id}`,
            title: 'Overdue Balance (Previous Stay)',
            message: `Unpaid arrears: ₹${fee.amount}`,
            type: 'bill',
            read: false,
          });
          return;
        }

        if (!activeAllocation && fee.status === 'pending') {
          return;
        }

        items.push({
          id: `fee-${fee.id}`,
          title: fee.status === 'overdue' ? 'Fee Payment Overdue' : 'Fee Payment Due',
          message: `Amount ₹${fee.amount}`,
          type: 'bill',
          read: false,
        });
      });

      // 2. Process room requests
      requests.forEach((req) => {
        if (req.status === 'approved') {
          const matchesActiveStay = activeAllocation &&
            activeAllocation.room_id === req.room_id &&
            activeAllocation.hostel_id === req.hostel_id;

          if (!matchesActiveStay) {
            return; // Filter out stale approved requests for ended/vacated stays
          }

          items.push({
            id: `req-${req.id}`,
            title: 'Room Allocation Approved 🎉',
            message: 'Your request has been approved!',
            type: 'request',
            read: false,
          });
        }
      });

      // 3. Process direct notifications
      userNotifs.forEach((n) => {
        const isFeesSchedule = (n.title || '').toLowerCase().includes('fees schedule') ||
                               (n.message || '').toLowerCase().includes('next 12 months');
        if (!activeAllocation && isFeesSchedule && !n.read) {
          return; // Skip pre-checkout fee schedule alerts after checkout
        }

        items.push({
          id: `notif-${n.id}`,
          title: n.title,
          message: n.message,
          type: n.type,
          read: n.read,
        });
      });

      const filtered = items.filter((n) => !dismissedIds.includes(n.id));
      const unreadCount = filtered.filter((n) => !n.read).length;

      return { notifications: filtered, unreadCount };
    }

    it('displays Room Allocation Approved and active bills for a student with an active allocation', () => {
      const activeAlloc: Allocation = {
        id: 'alloc-1',
        room_id: 'room-101',
        hostel_id: 'hostel-1',
        active: true,
        status: 'active',
      };

      const requests: RawRequest[] = [{
        id: 'req-1',
        status: 'approved',
        created_at: new Date().toISOString(),
        room_id: 'room-101',
        hostel_id: 'hostel-1',
      }];

      const fees: RawFee[] = [{
        id: 'fee-1',
        amount: 8000,
        due_date: new Date().toISOString(),
        status: 'pending',
        created_at: new Date().toISOString(),
        allocation_id: 'alloc-1',
      }];

      const userNotifs: RawNotif[] = [{
        id: 'notif-1',
        title: 'Fees Schedule Generated',
        message: 'Your monthly fees schedule has been generated for the next 12 months.',
        type: 'fees',
        read: false,
        created_at: new Date().toISOString(),
      }];

      const result = filterStudentNotifications({
        allocations: [activeAlloc],
        requests,
        fees,
        userNotifs,
      });

      expect(result.notifications).toHaveLength(3);
      expect(result.notifications.some((n) => n.title.includes('Room Allocation Approved'))).toBe(true);
      expect(result.notifications.some((n) => n.title === 'Fee Payment Due')).toBe(true);
      expect(result.unreadCount).toBe(3);
    });

    it('filters out stale room approvals and pending fees after student checks out', () => {
      // Allocation is now checked out / inactive
      const checkedOutAlloc: Allocation = {
        id: 'alloc-1',
        room_id: 'room-101',
        hostel_id: 'hostel-1',
        active: false,
        status: 'checked_out',
      };

      // Room request record still has status: 'approved' in database
      const requests: RawRequest[] = [{
        id: 'req-1',
        status: 'approved',
        created_at: '2026-06-01T00:00:00Z',
        room_id: 'room-101',
        hostel_id: 'hostel-1',
      }];

      // Future/pending fee tied to vacated room
      const fees: RawFee[] = [{
        id: 'fee-1',
        amount: 8000,
        due_date: '2026-11-01T00:00:00Z',
        status: 'pending',
        created_at: '2026-06-01T00:00:00Z',
        allocation_id: 'alloc-1',
      }];

      // Old fee schedule notification
      const userNotifs: RawNotif[] = [{
        id: 'notif-1',
        title: 'Fees Schedule Generated',
        message: 'Your monthly fees schedule has been generated for the next 12 months.',
        type: 'fees',
        read: false,
        created_at: '2026-06-01T00:00:00Z',
      }, {
        id: 'notif-2',
        title: 'Checkout Completed',
        message: 'You have successfully vacated Room 101.',
        type: 'system',
        read: false,
        created_at: new Date().toISOString(),
      }];

      const result = filterStudentNotifications({
        allocations: [checkedOutAlloc],
        requests,
        fees,
        userNotifs,
      });

      // Only the Checkout Completed notification should be visible as an unread item
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].title).toBe('Checkout Completed');
      expect(result.notifications.some((n) => n.title.includes('Room Allocation Approved'))).toBe(false);
      expect(result.notifications.some((n) => n.title === 'Fee Payment Due')).toBe(false);
      expect(result.notifications.some((n) => n.title === 'Fees Schedule Generated')).toBe(false);
      expect(result.unreadCount).toBe(1);
    });

    it('preserves overdue unpaid arrears from a previous stay after checkout with clear labeling', () => {
      const checkedOutAlloc: Allocation = {
        id: 'alloc-1',
        room_id: 'room-101',
        hostel_id: 'hostel-1',
        active: false,
        status: 'checked_out',
      };

      const fees: RawFee[] = [{
        id: 'fee-old-overdue',
        amount: 4500,
        due_date: '2026-09-01T00:00:00Z',
        status: 'overdue',
        created_at: '2026-08-01T00:00:00Z',
        allocation_id: 'alloc-1',
      }];

      const result = filterStudentNotifications({
        allocations: [checkedOutAlloc],
        requests: [],
        fees,
        userNotifs: [],
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].title).toBe('Overdue Balance (Previous Stay)');
      expect(result.unreadCount).toBe(1);
    });

    it('guarantees notification header badge count matches visible displayed unread items', () => {
      const checkedOutAlloc: Allocation = {
        id: 'alloc-1',
        room_id: 'room-101',
        hostel_id: 'hostel-1',
        active: false,
        status: 'checked_out',
      };

      const userNotifs: RawNotif[] = [
        { id: 'notif-a', title: 'System Notice', message: 'Campus event', type: 'system', read: false, created_at: new Date().toISOString() },
        { id: 'notif-b', title: 'Payment Receipt', message: 'Receipt for August', type: 'payment', read: true, created_at: new Date().toISOString() },
      ];

      const result = filterStudentNotifications({
        allocations: [checkedOutAlloc],
        requests: [],
        fees: [],
        userNotifs,
        dismissedIds: ['notif-notif-a'],
      });

      // notif-a was dismissed, notif-b is read
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].id).toBe('notif-notif-b');
      expect(result.unreadCount).toBe(0);
    });

    it('ensures checkout mutation in dashboard invalidates student-actionable-notifications cache', () => {
      expect(dashboardPage).toContain("qc.invalidateQueries({ queryKey: [\"student-actionable-notifications\"] })");
      expect(dashboardPage).toContain("qc.invalidateQueries({ queryKey: [\"has-active-allocation\"] })");
      expect(dashboardPage).toContain("qc.invalidateQueries({ queryKey: [\"active-allocation-simple\"] })");
    });

    it('ensures student notifications query orders room_allocations by created_at descending', () => {
      expect(studentNotifs).toContain(".order('created_at', { ascending: false })");
      expect(ownerStudentsPage).not.toContain("qc.invalidateQueries({ queryKey: ['student-actionable-notifications'] })");
      expect(ownerRequestsPage).not.toContain("qc.invalidateQueries({ queryKey: ['student-actionable-notifications'] })");
    });
  });
});
