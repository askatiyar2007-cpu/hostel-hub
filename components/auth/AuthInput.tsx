'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, LucideIcon } from 'lucide-react';

export interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  icon?: LucideIcon;
  error?: string;
  isPassword?: boolean;
}

export function AuthInput({
  label,
  id,
  type = 'text',
  icon: Icon,
  error,
  isPassword = false,
  className = '',
  required,
  ...rest
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="space-y-1 text-left">
      <label
        htmlFor={id}
        className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-teal-100/90"
      >
        {label} {required && <span className="text-[#2DD4BF]">*</span>}
      </label>

      <div className="relative group">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-300/60 group-focus-within:text-teal-200 transition-colors pointer-events-none">
            <Icon className="h-4 w-4" />
          </div>
        )}

        <input
          id={id}
          type={inputType}
          required={required}
          className={`w-full h-10 rounded-xl bg-[#075A56] hover:bg-[#08625D] focus:bg-[#0A6762] border text-white text-sm placeholder:text-teal-200/40 transition-all duration-150 shadow-inner ${
            Icon ? 'pl-10' : 'pl-3.5'
          } ${isPassword ? 'pr-10' : 'pr-3.5'} ${
            error
              ? 'border-rose-400/80 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/25'
              : 'border-teal-400/20 hover:border-teal-300/35 focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/30'
          } focus:outline-none ${className}`}
          style={{ flex: '1 1 auto' }}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-teal-300/60 hover:text-teal-100 transition-colors p-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0D9488] rounded-md z-10"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-rose-300 font-medium pl-0.5 animate-in fade-in-50 duration-150">
          {error}
        </p>
      )}
    </div>
  );
}
