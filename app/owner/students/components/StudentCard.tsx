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
    <Card className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl shadow-xs hover:shadow-sm p-4 flex flex-col md:flex-row items-start md:items-center gap-4 transition-all">
      {/* Student */}
      <div className="flex items-center gap-3 min-w-0 flex-1 lg:w-1/5">
        {studentPhotoUrl ? (
          <img src={studentPhotoUrl} alt="Student passport photo" className="h-10 w-10 rounded-full object-cover border border-violet-200 shrink-0" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700 font-bold text-sm border border-violet-100">
            {studentName.charAt(0)}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <h4 className="font-bold text-slate-900 text-sm truncate" title={studentName}>{studentName}</h4>
          <span className={cn('inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[11px] font-semibold mt-0.5', badgeClass)}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Contact */}
      <div className="flex flex-col min-w-0 flex-1 lg:w-1/5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email</span>
        <p className="text-xs font-medium text-slate-800 truncate" title={studentEmail}>{studentEmail}</p>
        {studentPhone && studentPhone !== '-' && (
          <>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Phone</span>
            <p className="text-xs font-medium text-slate-800 truncate" title={studentPhone}>{studentPhone}</p>
          </>
        )}
      </div>

      {/* Hostel & Room */}
      <div className="flex flex-col min-w-0 flex-1 lg:w-1/5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hostel</span>
        <p className="text-xs font-medium text-slate-800 truncate" title={hostelName}>{hostelName}</p>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Room</span>
        <p className="text-xs font-bold text-blue-700 truncate" title={roomNumber ?? '-'}>
          Room {roomNumber ?? '-'}
        </p>
      </div>

      {/* Booking & Rent */}
      <div className="flex flex-col min-w-0 flex-1 lg:w-1/5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Booking</span>
        <p className="text-xs font-medium text-slate-700 truncate" title={bookingType}>{bookingType}</p>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Monthly Rent</span>
        <p className="text-xs font-bold text-emerald-700" title={String(rent)}>
          ₹{Number(rent).toLocaleString()}/mo
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-1 lg:w-1/5 justify-end w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
        <Button variant="outline" size="sm" onClick={onViewProfile} className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50">
          <Eye size={13} className="mr-1" /> Profile
        </Button>
        <Button variant="outline" size="sm" onClick={onCheckout} className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium text-rose-600 border-rose-200 hover:bg-rose-50">
          <LogOut size={13} className="mr-1" /> Checkout
        </Button>
      </div>
    </Card>
  );
};


