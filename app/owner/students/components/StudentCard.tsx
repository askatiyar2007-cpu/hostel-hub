import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, LogOut, Mail, Phone, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StudentCardProps {
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  hostelName: string;
  roomNumber?: string;
  bookingType: string;
  rent: number | string;
  statusLabel: string; // e.g., 'Active', 'Inactive', 'Checked Out'
  statusColorClass: string;
  studentPhotoUrl?: string;
  stayDuration?: string;
  onViewProfile: () => void;
  onCheckout?: () => void;
}

/**
 * Compact horizontal strip for a resident student.
 * Uses a balanced, proportional flex layout with subtle dividers:
 * Student | Contact | Residence | Monthly Rent | Actions.
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
  stayDuration,
  onViewProfile,
  onCheckout,
}) => {
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [studentPhotoUrl]);

  const isStatusActive = statusLabel.toLowerCase() === 'active';
  const isCheckedOut = statusLabel.toLowerCase().includes('checked out');
  const badgeClass = isStatusActive 
    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800' 
    : isCheckedOut
      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800';

  // Distinct deterministic avatar gradients based on student's name
  const avatarGradientClass = React.useMemo(() => {
    const palettes = [
      'bg-gradient-to-br from-teal-500 to-emerald-600 text-white border-teal-200 dark:border-teal-700',
      'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-blue-200 dark:border-blue-700',
      'bg-gradient-to-br from-violet-500 to-purple-600 text-white border-purple-200 dark:border-purple-700',
      'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-200 dark:border-amber-700',
      'bg-gradient-to-br from-rose-500 to-pink-600 text-white border-rose-200 dark:border-rose-700',
      'bg-gradient-to-br from-sky-500 to-cyan-600 text-white border-sky-200 dark:border-sky-700',
    ];
    let hash = 0;
    const str = studentName || 'Student';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palettes[Math.abs(hash) % palettes.length];
  }, [studentName]);

  return (
    <Card className="bg-white dark:bg-[#0e222e] border border-slate-200/90 dark:border-[#1a3d52] hover:border-teal-500/40 dark:hover:border-teal-500/40 rounded-2xl shadow-xs hover:shadow-sm p-3.5 sm:p-4 transition-all">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 xl:gap-0">
        
        {/* 1. Student Identity (Avatar, Name, Status) */}
        <div className="flex items-center gap-3 min-w-0 xl:w-[220px] 2xl:w-[240px] shrink-0 xl:pr-4">
          {studentPhotoUrl && !imageError ? (
            <img 
              key={studentPhotoUrl}
              src={studentPhotoUrl} 
              alt={studentName} 
              onError={() => setImageError(true)}
              className="h-11 w-11 rounded-xl object-cover border border-slate-200 dark:border-[#1a3d52] shadow-xs shrink-0" 
            />
          ) : (
            <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-base border shadow-xs select-none", avatarGradientClass)}>
              {(studentName || 'S').trim().charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base truncate leading-tight" title={studentName}>
              {studentName}
            </h4>
            <span className={cn('inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[11px] font-semibold mt-1 shadow-2xs', badgeClass)}>
              {isStatusActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mr-1" />}
              {statusLabel}
            </span>
          </div>
        </div>

        {/* 2. Contact Details (Email, Phone) */}
        <div className="flex flex-col min-w-0 xl:w-[260px] 2xl:w-[280px] shrink-0 xl:px-4 xl:border-l border-slate-100 dark:border-[#1a3d52] pt-2 xl:pt-0 border-t xl:border-t-0">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            Contact
          </p>
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex items-center gap-1.5" title={studentEmail}>
              <Mail size={12} className="shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="truncate">{studentEmail}</span>
            </p>
            {studentPhone && studentPhone !== '-' && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5" title={studentPhone}>
                <Phone size={12} className="shrink-0 text-slate-400 dark:text-slate-500" />
                <span>{studentPhone}</span>
              </p>
            )}
          </div>
        </div>

        {/* 3. Residence Details (Hostel, Room, Booking Type) */}
        <div className="flex flex-col min-w-0 xl:flex-1 xl:px-4 xl:border-l border-slate-100 dark:border-[#1a3d52] pt-2 xl:pt-0 border-t xl:border-t-0">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            Residence
          </p>
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5" title={hostelName}>
              <Building2 size={13} className="shrink-0 text-teal-600 dark:text-teal-400" />
              <span className="truncate">{hostelName}</span>
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                Room {roomNumber ?? '-'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                ({bookingType})
              </span>
            </div>
            {stayDuration && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {stayDuration}
              </p>
            )}
          </div>
        </div>

        {/* 4. Financial (Monthly Rent) */}
        <div className="flex flex-col min-w-0 xl:w-[130px] shrink-0 xl:px-4 xl:border-l border-slate-100 dark:border-[#1a3d52] pt-2 xl:pt-0 border-t xl:border-t-0">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            {isStatusActive ? 'Monthly Rent' : 'Previous Rent'}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-extrabold text-emerald-700 dark:text-emerald-400 leading-none" title={String(rent)}>
              ₹{Number(rent).toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">/mo</span>
          </div>
        </div>

        {/* 5. Actions (Profile & Checkout) */}
        <div className="flex sm:flex-row xl:flex-col gap-1.5 shrink-0 w-full sm:w-auto xl:w-[125px] pt-3 xl:pt-0 border-t xl:border-t-0 xl:border-l border-slate-100 dark:border-[#1a3d52] xl:pl-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onViewProfile} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border-slate-200 dark:border-[#1a3d52] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#16364a] shadow-2xs cursor-pointer"
          >
            <Eye size={13} className="text-teal-600 dark:text-teal-400" /> {isStatusActive ? 'Profile' : 'Records'}
          </Button>
          {isStatusActive && onCheckout && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onCheckout} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 shadow-2xs cursor-pointer"
            >
              <LogOut size={13} /> Checkout
            </Button>
          )}
        </div>

      </div>
    </Card>
  );
};


