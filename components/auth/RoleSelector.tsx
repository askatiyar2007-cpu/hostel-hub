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
      <label className="block text-[13px] sm:text-[14px] font-semibold text-teal-100/90 mb-1.5">
        Choose your role <span className="text-[#2DD4BF] font-bold">*</span>
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
              className={`relative flex flex-col p-4 rounded-xl text-left border transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                isSelected
                  ? 'border-[#0D9488] bg-[#053E3A] shadow-sm ring-1 ring-[#0D9488]'
                  : 'border-teal-500/20 bg-[#032B28]/80 hover:border-teal-400/35 hover:bg-[#043632]'
              } ${disabled ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div
                  className={`flex h-8.5 w-8.5 items-center justify-center rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-[#0D9488] text-white shadow-xs'
                      : 'bg-[#022421] text-teal-200 border border-teal-400/20'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>

                {isSelected ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0D9488] text-white shadow-xs">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border border-teal-400/30 bg-transparent" />
                )}
              </div>

              <span className="font-bold text-[15px] text-white tracking-tight">
                {role.title}
              </span>
              <p className="text-xs text-teal-100/75 mt-1 leading-relaxed">
                {role.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
