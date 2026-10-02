import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Building2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionButton {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  className?: string;
  icon?: React.ReactNode;
}

interface FinancialRow {
  label: string;
  amount: string | number;
  status: 'paid' | 'pending' | 'overdue';
  onMarkPaid?: () => void;
}

interface RequestCardProps {
  // Student section
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  studentPhotoUrl?: string;
  // Accommodation section
  hostelName: string;
  roomNumber?: string;
  bookingType?: string;
  rent?: string | number;
  // Request Info section
  createdAt?: string;
  // Status badge
  statusLabel: string;
  statusColorClass: string; // e.g. 'bg-amber-100 text-amber-800'
  // Financial rows (optional)
  financialRows?: FinancialRow[];
  // Action buttons
  actions: ActionButton[];
}

export const RequestCard: React.FC<RequestCardProps> = ({
  studentName,
  studentEmail,
  studentPhone,
  studentPhotoUrl,
  hostelName,
  roomNumber,
  bookingType,
  rent,
  createdAt,
  statusLabel,
  statusColorClass,
  financialRows,
  actions,
}) => {
  return (
    <Card className="w-full bg-white border border-slate-200/90 hover:border-sky-300 shadow-xs hover:shadow-md rounded-2xl p-5 transition-all">
      <div className="flex flex-col xl:flex-row items-start xl:items-center gap-6">
        
        {/* Primary: Student Identity & Status */}
        <div className="flex items-center gap-4 min-w-0 flex-1 w-full border-b xl:border-b-0 xl:border-r border-slate-100 pb-4 xl:pb-0 xl:pr-6">
          {studentPhotoUrl ? (
            <img src={studentPhotoUrl} alt="Student" className="h-14 w-14 rounded-full object-cover border-2 border-slate-100 shadow-xs shrink-0" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-50 text-violet-700 font-bold text-lg border border-violet-100 shadow-xs">
              {studentName.charAt(0)}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <h3 className="font-bold text-slate-900 text-lg truncate mb-1" title={studentName}>
              {studentName}
            </h3>
            <span className={cn('inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs', statusColorClass)}>
              <Clock size={12} className="mr-1.5" /> {statusLabel}
            </span>
          </div>
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-[2.5] w-full">
          
          {/* Contact */}
          <div className="flex flex-col min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Contact</p>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700 truncate flex items-center gap-1.5" title={studentEmail}>
                <Mail size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{studentEmail}</span>
              </p>
              {studentPhone && studentPhone !== '-' && (
                <p className="text-sm font-medium text-slate-500 truncate flex items-center gap-1.5" title={studentPhone}>
                  <Phone size={13} className="text-slate-400 shrink-0" />
                  <span>{studentPhone}</span>
                </p>
              )}
            </div>
          </div>

          {/* Residence */}
          <div className="flex flex-col min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Accommodation</p>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5" title={hostelName}>
                <Building2 size={13} className="text-teal-600 shrink-0" />
                <span className="truncate">{hostelName}</span>
              </p>
              <p className="text-sm font-semibold text-blue-600 truncate flex items-center gap-1.5">
                <span>Room {roomNumber}</span>
                {bookingType && <span className="text-slate-400 font-medium ml-1">({bookingType})</span>}
              </p>
              {createdAt && (
                <p className="text-xs font-medium text-slate-500">
                  Req: {new Date(createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </p>
              )}
            </div>
          </div>

          {/* Financial summary inline if provided */}
          <div className="flex flex-col min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Financial</p>
            <div className="space-y-1">
              {rent && (
                <p className="text-sm font-bold text-emerald-700">
                  ₹{Number(rent).toLocaleString()}/mo
                </p>
              )}
              {financialRows?.map((row, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-1 text-xs">
                  <span className="text-slate-500">{row.label}:</span>
                  <span className="font-semibold text-slate-900">{row.amount}</span>
                  <span className={cn(
                    "ml-1 text-[10px] font-bold uppercase tracking-wider",
                    row.status === 'paid' ? "text-emerald-600" :
                    row.status === 'overdue' ? "text-rose-600" : "text-amber-600"
                  )}>
                    ({row.status})
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Actions Grid */}
        <div className="flex flex-wrap sm:flex-col gap-2 shrink-0 w-full sm:w-auto pt-4 xl:pt-0 border-t xl:border-t-0 xl:border-l border-slate-100 xl:pl-6">
          {actions.map((action, idx) => (
            <Button
              key={idx}
              onClick={action.onClick}
              variant={action.variant as any}
              size="sm"
              className={cn(
                'flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-sm font-medium shadow-xs', 
                action.className,
                !action.variant && 'bg-teal-600 hover:bg-teal-700 text-white' // default solid
              )}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
          {/* Also expose the Mark Paid buttons from financialRows as primary actions if needed */}
          {financialRows?.filter(r => r.status === 'pending' && r.onMarkPaid).map((row, idx) => (
            <Button
              key={`pay-${idx}`}
              onClick={row.onMarkPaid}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-sm font-medium border-teal-200 text-teal-700 hover:bg-teal-50 shadow-xs"
            >
              Mark {row.label} Paid
            </Button>
          ))}
        </div>

      </div>
    </Card>
  );
};

export type { ActionButton, FinancialRow };
