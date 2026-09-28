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
    <div className="space-y-2 text-left">
      {/* Readable Label: 13–14px, medium/semibold, ~8px above input */}
      <label
        htmlFor={id}
        className="block text-[13px] sm:text-[14px] font-semibold text-teal-100/90 tracking-normal"
      >
        {label} {required && <span className="text-[#2DD4BF] font-bold">*</span>}
      </label>

      {/* Large, comfortable input box: 48px mobile, 52px desktop */}
      <div className="relative group">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-200/60 group-focus-within:text-teal-100 transition-colors pointer-events-none">
            <Icon className="h-5 w-5" />
          </div>
        )}

        <input
          id={id}
          type={inputType}
          required={required}
          className={`w-full h-12 sm:h-[52px] rounded-xl bg-[#032B28] hover:bg-[#043632] focus:bg-[#053E3A] border text-white text-[15px] sm:text-[16px] placeholder:text-teal-200/50 transition-all duration-180 shadow-inner ${
            Icon ? 'pl-12' : 'pl-4'
          } ${isPassword ? 'pr-12' : 'pr-4'} ${
            error
              ? 'border-rose-400/80 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/25'
              : 'border-teal-500/25 hover:border-teal-400/40 focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/30'
          } focus:outline-none ${className}`}
          style={{ flex: '1 1 auto' }}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-teal-300/60 hover:text-teal-100 transition-colors p-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0D9488] rounded-md z-10 cursor-pointer"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-300 font-medium pl-0.5 animate-in fade-in-50 duration-150">
          {error}
        </p>
      )}
    </div>
  );
}
