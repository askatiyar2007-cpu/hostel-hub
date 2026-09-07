import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Emerald / Success
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
  resolved: { label: 'Resolved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
  occupied: { label: 'Occupied', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },

  // Amber / Warning / Pending
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200/80' },
  maintenance: { label: 'Maintenance', className: 'bg-amber-50 text-amber-700 border-amber-200/80' },
  due: { label: 'Due', className: 'bg-amber-50 text-amber-700 border-amber-200/80' },
  partial: { label: 'Partial', className: 'bg-amber-50 text-amber-700 border-amber-200/80' },
  in_progress: { label: 'In Progress', className: 'bg-amber-50 text-amber-700 border-amber-200/80' },

  // Rose / Destructive / Rejected
  rejected: { label: 'Rejected', className: 'bg-rose-50 text-rose-700 border-rose-200/80' },
  unpaid: { label: 'Unpaid', className: 'bg-rose-50 text-rose-700 border-rose-200/80' },
  overdue: { label: 'Overdue', className: 'bg-rose-50 text-rose-700 border-rose-200/80' },
  failed: { label: 'Failed', className: 'bg-rose-50 text-rose-700 border-rose-200/80' },
  critical: { label: 'Critical', className: 'bg-rose-50 text-rose-700 border-rose-200/80' },

  // Blue / Info / Accommodation
  available: { label: 'Available', className: 'bg-blue-50 text-blue-700 border-blue-200/80' },
  info: { label: 'Info', className: 'bg-blue-50 text-blue-700 border-blue-200/80' },

  // Neutral / Inactive
  inactive: { label: 'Inactive', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '_');
  const config = statusConfig[normalized] || {
    label: status || 'Unknown',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border shadow-2xs",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
