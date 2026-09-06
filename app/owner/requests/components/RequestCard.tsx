import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Building2, Clock, Eye } from 'lucide-react';
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
  occupancy?: number;
  capacity?: number;
  freeSlots?: number;
  emergencyContact?: string;
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
  occupancy,
  capacity,
  freeSlots,
  emergencyContact,
  statusLabel,
  statusColorClass,
  financialRows,
  actions,
}) => {
  const freeSlotLabel = freeSlots && freeSlots > 0 ? `${freeSlots} free` : 'Full';
  const freeSlotColor = freeSlots && freeSlots > 0 ? 'text-emerald-600' : 'text-rose-600';

  return (
    <Card className="w-full bg-white border border-teal-200/80 hover:border-teal-300 shadow-sm rounded-xl p-4 transition-all">
      {/* Summary Strip */}
      <div className="flex flex-col md:flex-row md:items-center md:gap-4">
        {/* Student */}
        <div className="flex items-center gap-2 min-w-0 md:w-1/5">
          {studentPhotoUrl ? (
            <div className="relative group shrink-0">
              <img
                src={studentPhotoUrl}
                alt="Student passport photo"
                className="h-10 w-10 rounded-xl object-cover border border-teal-200 cursor-pointer group-hover:ring-2 group-hover:ring-teal-500 transition-all"
              />
              <div
                className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white"
                onClick={() => {}}
              >
                <Eye size={14} />
              </div>
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 font-bold border border-teal-100">
              {studentName.charAt(0)}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <h3 className="font-semibold text-gray-900 truncate" title={studentName}>
              {studentName}
            </h3>
            <div className="flex items-center text-xs text-gray-500 space-x-1 truncate mt-0.5" title={studentEmail}>
              <Mail size={12} className="shrink-0 text-gray-400" />
              <span className="truncate">{studentEmail}</span>
            </div>
            {studentPhone && studentPhone !== '-' && (
              <div className="flex items-center text-xs text-gray-500 space-x-1 truncate mt-0.5">
                <Phone size={12} className="shrink-0 text-gray-400" />
                <span>{studentPhone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Hostel / Room */}
        <div className="flex flex-col min-w-0 md:w-1/5">
          <div className="flex items-center text-sm font-medium text-gray-900">
            <Building2 size={14} className="text-teal-600 shrink-0 mr-1" />
            <span className="truncate" title={hostelName}>{hostelName}</span>
          </div>
          <div className="flex items-center text-xs text-gray-500 space-x-1 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-semibold">
              Room {roomNumber}
            </span>
            {bookingType && <span className="text-xs text-gray-500">{bookingType}</span>}
          </div>
          {rent && (
            <div className="text-xs font-medium text-gray-600 mt-1">
              ₹{Number(rent).toLocaleString()}/mo
            </div>
          )}
        </div>

        {/* Request Information */}
        <div className="flex flex-col min-w-0 md:w-2/5 text-sm text-gray-600 space-y-1">
          {createdAt && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <Clock size={12} className="text-gray-400 shrink-0" />
              <span>{new Date(createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
            </div>
          )}
          {occupancy !== undefined && capacity !== undefined && (
            <div>
              <span className="text-gray-500">Occupancy: </span>
              <span className="font-semibold text-gray-800">{occupancy}/{capacity}</span>
              <span className={`ml-1 font-medium ${freeSlotColor}`}>({freeSlotLabel})</span>
            </div>
          )}
          {emergencyContact && emergencyContact !== 'N/A' && (
            <div className="text-xs text-gray-500 truncate" title={emergencyContact}>Emg: {emergencyContact}</div>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center md:justify-center md:w-1/5">
          <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold', statusColorClass)}>
            <Clock size={12} /> {statusLabel}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-2 md:mt-0 md:w-1/5 md:justify-end">
          {actions.map((action, idx) => (
            <Button
              key={idx}
              onClick={action.onClick}
              variant={action.variant as any}
              size="sm"
              className={cn('h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5', action.className)}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Financial (optional) */}
      {financialRows && financialRows.length > 0 && (
        <div className="mt-3 border-t pt-2">
          {financialRows.map((row, idx) => (
            <div key={idx} className="flex items-center justify-between py-1 text-sm">
              <span className="font-medium text-gray-700">{row.label}</span>
              <span className="font-semibold text-gray-900">{row.amount}</span>
              {row.status === 'pending' && row.onMarkPaid && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 bg-teal-100 hover:bg-teal-200 text-teal-800"
                  onClick={row.onMarkPaid}
                >
                  Mark Paid
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export type { ActionButton, FinancialRow };
