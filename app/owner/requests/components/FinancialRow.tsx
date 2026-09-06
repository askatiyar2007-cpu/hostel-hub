import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FinancialRowProps {
  label: string;
  amount: string | number;
  status: 'paid' | 'pending' | 'overdue';
  onMarkPaid?: () => void;
}

export const FinancialRow: React.FC<FinancialRowProps> = ({ label, amount, status, onMarkPaid }) => {
  const statusColor =
    status === 'paid' ? 'bg-green-100 text-green-800' :
    status === 'pending' ? 'bg-amber-100 text-amber-800' :
    'bg-red-100 text-red-800';

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{amount}</span>
      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', statusColor)}>{status}</span>
      {status === 'pending' && onMarkPaid && (
        <Button
          size="sm"
          variant="secondary"
          className="h-7 px-2 bg-gray-100 hover:bg-gray-200 text-teal-600"
          onClick={onMarkPaid}
        >
          Mark Paid
        </Button>
      )}
    </div>
  );
};

export type { FinancialRowProps };
