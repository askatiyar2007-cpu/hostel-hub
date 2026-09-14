'use client';

import React from 'react';
import { GraduationCap, Building2, Check } from 'lucide-react';

export type RoleType = 'student' | 'owner';

interface RoleSelectorProps {
  selectedRole: RoleType | null;
  onSelectRole: (role: RoleType) => void;
  disabled?: boolean;
}

export function RoleSelector({ selectedRole, onSelectRole, disabled = false }: RoleSelectorProps) {
  const roles = [
    {
      id: 'student' as RoleType,
      title: 'Student',
      description: 'Find rooms, manage bills and connect with your hostel.',
      icon: GraduationCap,
    },
    {
      id: 'owner' as RoleType,
      title: 'Hostel Owner',
      description: 'Manage hostels, rooms, students and payments.',
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-2 text-left">
      <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-teal-100/90 mb-1.5">
        Choose your role <span className="text-[#2DD4BF]">*</span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {roles.map((role) => {
          const isSelected = selectedRole === role.id;
          const Icon = role.icon;

          return (
            <button
              key={role.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectRole(role.id)}
              className={`relative flex flex-col p-3.5 rounded-2xl text-left border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                isSelected
                  ? 'border-[#0D9488] bg-[#0A6762] shadow-sm ring-1 ring-[#0D9488]'
                  : 'border-teal-400/20 bg-[#075A56]/70 hover:border-teal-300/40 hover:bg-[#075A56]'
              } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-[#0D9488] text-white shadow-xs'
                      : 'bg-[#064E4A] text-teal-200 border border-teal-400/20'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>

                {isSelected ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0D9488] text-white shadow-xs">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border border-teal-400/30 bg-transparent" />
                )}
              </div>

              <span className="font-bold text-sm text-white tracking-tight">
                {role.title}
              </span>
              <p className="text-xs text-teal-100/75 mt-0.5 leading-snug">
                {role.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
