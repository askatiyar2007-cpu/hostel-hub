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
  statusColorClass,
  studentPhotoUrl,
  onViewProfile,
  onCheckout,
}) => {
  return (
    <Card className="bg-white border border-gray-200 rounded-md shadow-sm p-2 flex items-center gap-4">
      {/* Student */}
      <div className="flex items-center gap-2 min-w-0 flex-1 lg:w-1/5">
        {studentPhotoUrl ? (
          <img src={studentPhotoUrl} alt="Student passport photo" className="h-10 w-10 rounded-full object-cover border border-gray-200" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-700 font-bold border border-teal-100">
            {studentName.charAt(0)}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <h4 className="font-semibold text-gray-900 truncate" title={studentName}>{studentName}</h4>
          <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', statusColorClass)}>{statusLabel}</span>
        </div>
      </div>

      {/* Contact */}
      <div className="flex flex-col min-w-0 flex-1 lg:w-1/5">
        <span className="text-xs text-gray-500">Email</span>
        <p className="text-sm text-gray-900 truncate" title={studentEmail}>{studentEmail}</p>
        {studentPhone && studentPhone !== '-' && (
          <>
            <span className="text-xs text-gray-500 mt-1">Phone</span>
            <p className="text-sm text-gray-900 truncate" title={studentPhone}>{studentPhone}</p>
          </>
        )}
      </div>

      {/* Hostel & Room */}
      <div className="flex flex-col min-w-0 flex-1 lg:w-1/5">
        <span className="text-xs text-gray-500">Hostel</span>
        <p className="text-sm text-gray-900 truncate" title={hostelName}>{hostelName}</p>
        <span className="text-xs text-gray-500 mt-1">Room</span>
        <p className="text-sm text-gray-900 truncate" title={roomNumber ?? '-'}>{roomNumber ?? '-'}</p>
      </div>

      {/* Booking & Rent */}
      <div className="flex flex-col min-w-0 flex-1 lg:w-1/5">
        <span className="text-xs text-gray-500">Booking</span>
        <p className="text-sm text-gray-900 truncate" title={bookingType}>{bookingType}</p>
        <span className="text-xs text-gray-500 mt-1">Monthly Rent</span>
        <p className="text-sm font-bold text-teal-700" title={String(rent)}>
          ₹{Number(rent).toLocaleString()}/mo
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-1 lg:w-1/5 justify-end">
        <Button variant="outline" size="sm" onClick={onViewProfile} className="flex items-center gap-1 h-8 text-xs font-medium">
          <Eye size={14} className="mr-1" /> View Profile
        </Button>
        <Button variant="outline" size="sm" onClick={onCheckout} className="flex items-center gap-1 h-8 text-xs font-medium text-red-600 border-red-200 hover:bg-red-50">
          <LogOut size={14} className="mr-1" /> Checkout
        </Button>
      </div>
    </Card>
  );
};


