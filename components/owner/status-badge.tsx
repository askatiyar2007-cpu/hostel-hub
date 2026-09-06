import React from 'react';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/design-tokens';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
  pending: { label: 'Pending', bgColor: '#fef3c7', textColor: '#d97706' },
  approved: { label: 'Approved', bgColor: '#d1fae5', textColor: '#059669' },
  rejected: { label: 'Rejected', bgColor: '#fee2e2', textColor: '#dc2626' },
  paid: { label: 'Paid', bgColor: '#d1fae5', textColor: '#059669' },
  unpaid: { label: 'Unpaid', bgColor: '#fee2e2', textColor: '#dc2626' },
  active: { label: 'Active', bgColor: '#d1fae5', textColor: '#059669' },
  inactive: { label: 'Inactive', bgColor: colors.neutral[200], textColor: colors.neutral[600] },
  available: { label: 'Available', bgColor: '#d1fae5', textColor: '#059669' },
  occupied: { label: 'Occupied', bgColor: '#dbeafe', textColor: '#2563eb' },
  maintenance: { label: 'Maintenance', bgColor: '#fef3c7', textColor: '#d97706' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    label: status,
    bgColor: colors.neutral[200],
    textColor: colors.neutral[600],
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      style={{ backgroundColor: config.bgColor, color: config.textColor }}
    >
      {config.label}
    </span>
  );
}
