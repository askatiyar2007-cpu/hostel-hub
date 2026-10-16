'use client';

import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const COMMON_FACILITIES = [
  'High-Speed Wi-Fi',
  'Air Conditioning (AC)',
  'Attached Washroom',
  '24/7 Power Backup',
  'Geyser / Hot Water',
  'RO Purified Water',
  'CCTV Security',
  'Washing Machine / Laundry',
  'Mess / Food Included',
  'Study Table & Chair',
  'Daily Room Cleaning',
  'Two-Wheeler Parking',
  'Four-Wheeler Parking',
  'Gymnasium',
  'Refrigerator',
  'Biometric / Guard Entry',
  'Water Cooler',
  'Balcony',
  'Cupboard / Wardrobe',
  'TV / Common Lounge',
  'Lift / Elevator',
  'Fire Safety / Extinguisher'
];

interface FacilitiesSelectorProps {
  selectedFacilities: string[];
  onChange: (facilities: string[]) => void;
  className?: string;
}

export function FacilitiesSelector({
  selectedFacilities,
  onChange,
  className
}: FacilitiesSelectorProps) {
  const [customInput, setCustomInput] = useState('');

  const toggleFacility = (facility: string) => {
    const trimmed = facility.trim();
    if (!trimmed) return;

    if (selectedFacilities.includes(trimmed)) {
      onChange(selectedFacilities.filter((f) => f !== trimmed));
    } else {
      onChange([...selectedFacilities, trimmed]);
    }
  };

  const handleAddCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;

    // Check if comma-separated values were pasted
    if (trimmed.includes(',')) {
      const parts = trimmed
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      const combined = Array.from(new Set([...selectedFacilities, ...parts]));
      onChange(combined);
      setCustomInput('');
      return;
    }

    if (!selectedFacilities.includes(trimmed)) {
      onChange([...selectedFacilities, trimmed]);
    }
    setCustomInput('');
  };

  const removeFacility = (facility: string) => {
    onChange(selectedFacilities.filter((f) => f !== facility));
  };

  // Custom facilities added by user that are not in the predefined COMMON_FACILITIES list
  const customAdded = selectedFacilities.filter(
    (f) => !COMMON_FACILITIES.includes(f)
  );

  return (
    <div className={cn("space-y-3.5", className)}>
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Hostel Facilities & Amenities
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Click to select available facilities. Type any custom amenities below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedFacilities.length > 0 && (
            <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-teal-200 text-xs font-semibold">
              {selectedFacilities.length} selected
            </Badge>
          )}
          {selectedFacilities.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-slate-400 hover:text-rose-600 font-medium transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Pre-defined common facility chips */}
      <div className="flex flex-wrap gap-2">
        {COMMON_FACILITIES.map((facility) => {
          const isSelected = selectedFacilities.includes(facility);
          return (
            <button
              type="button"
              key={facility}
              onClick={() => toggleFacility(facility)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border select-none active:scale-95",
                isSelected
                  ? "bg-teal-600 text-white border-teal-600 shadow-xs font-semibold"
                  : "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
              )}
            >
              {isSelected ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Plus className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              )}
              <span>{facility}</span>
            </button>
          );
        })}
      </div>

      {/* User-added custom amenities tags */}
      {customAdded.length > 0 && (
        <div className="pt-1 border-t border-slate-100 space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Custom Added Facilities:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {customAdded.map((facility) => (
              <span
                key={facility}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
              >
                <span>{facility}</span>
                <button
                  type="button"
                  onClick={() => removeFacility(facility)}
                  className="h-4 w-4 rounded-full inline-flex items-center justify-center hover:bg-emerald-200/80 text-emerald-700 cursor-pointer"
                  title="Remove facility"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Custom typing input */}
      <div className="flex items-center gap-2 pt-1">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Type other facility (e.g. Table Tennis, Library, Solar Water)..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustom();
              }
            }}
            className="h-9 text-xs rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white pr-2"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleAddCustom()}
          disabled={!customInput.trim()}
          className="h-9 px-3 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 shrink-0 font-medium cursor-pointer disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Facility
        </Button>
      </div>
    </div>
  );
}
