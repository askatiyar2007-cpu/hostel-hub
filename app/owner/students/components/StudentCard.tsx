import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StudentCardProps {
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  hostelName: string;
  roomNumber?: string;
  bookingType: string;
  rent: number | string;
  statusLabel: string; // e.g., 'Active' or 'Inactive'
  statusColorClass: string; // e.g., 'bg-green-100 text-green-800'
  studentPhotoUrl?: string;
  onViewProfile: () => void;
  onCheckout: () => void;
}

/**
 * Compact horizontal strip for a resident student.
 * Uses a minimal flex layout to keep vertical space low while preserving all columns:
 * Student | Contact | Hostel & Room | Booking & Rent | Actions.
 */
export const StudentCard: React.FC<StudentCardProps> = ({
  studentName,
  studentEmail,
  studentPhone,
  hostelName,
  roomNumber,
  bookingType,
  rent,
  statusLabel,
  statusColorClass: _statusColorClass,
  studentPhotoUrl,
  onViewProfile,
  onCheckout,
}) => {
  const isStatusActive = statusLabel.toLowerCase() === 'active';
  const badgeClass = isStatusActive 
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' 
    : 'bg-rose-50 text-rose-700 border border-rose-200/80';

  return (
    <Card className="bg-white border border-slate-200/90 hover:border-sky-300 rounded-2xl shadow-xs hover:shadow-md p-5 flex flex-col xl:flex-row items-start xl:items-center gap-6 transition-all">
      {/* Student (Primary) */}
      <div className="flex items-center gap-4 min-w-0 flex-1 w-full border-b xl:border-b-0 xl:border-r border-slate-100 pb-4 xl:pb-0 xl:pr-6">
        {studentPhotoUrl ? (
          <img src={studentPhotoUrl} alt={studentName} className="h-14 w-14 rounded-full object-cover border-2 border-slate-100 shadow-xs shrink-0" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-50 text-violet-700 font-bold text-lg border border-violet-100 shadow-xs">
            {studentName.charAt(0)}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <h4 className="font-bold text-slate-900 text-lg truncate mb-1" title={studentName}>{studentName}</h4>
          <span className={cn('inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs', badgeClass)}>
            {isStatusActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5" />}
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Grid for details on tablet/desktop, stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 flex-[2] w-full">
        {/* Contact */}
        <div className="flex flex-col min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Contact</p>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-700 truncate" title={studentEmail}>{studentEmail}</p>
            {studentPhone && studentPhone !== '-' && (
              <p className="text-sm font-medium text-slate-500 truncate" title={studentPhone}>{studentPhone}</p>
            )}
          </div>
        </div>

        {/* Residence */}
        <div className="flex flex-col min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Residence</p>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900 truncate" title={hostelName}>{hostelName}</p>
            <p className="text-sm font-semibold text-blue-600 truncate" title={roomNumber ?? '-'}>
              Room {roomNumber ?? '-'}
              <span className="text-slate-400 font-medium ml-1">({bookingType})</span>
            </p>
          </div>
        </div>

        {/* Financial */}
        <div className="flex flex-col min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Monthly Rent</p>
          <p className="text-lg font-bold text-emerald-700" title={String(rent)}>
            ₹{Number(rent).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto pt-4 xl:pt-0 border-t xl:border-t-0 xl:border-l border-slate-100 xl:pl-6">
        <Button 
          variant="outline" 
          onClick={onViewProfile} 
          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-sm font-medium border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
        >
          <Eye size={15} /> Profile
        </Button>
        <Button 
          variant="outline" 
          onClick={onCheckout} 
          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-sm font-medium text-rose-600 border-rose-200 hover:bg-rose-50 shadow-xs"
        >
          <LogOut size={15} /> Checkout
        </Button>
      </div>
    </Card>
  );
};


