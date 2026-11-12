'use client';

import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AuthMessageAction {
  label: string;
  onClick: () => void;
}

export interface AuthMessageProps {
  variant: 'error' | 'success';
  title: string;
  description: string;
  action?: AuthMessageAction;
  onDismiss?: () => void;
  className?: string;
}

export function AuthMessage({ variant, title, description, action, onDismiss, className }: AuthMessageProps) {
  const isError = variant === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'relative rounded-xl border p-3.5 flex flex-col gap-2 transition-all',
        isError
          ? 'border-rose-400/30 bg-rose-950/40 text-rose-100 shadow-sm'
          : 'border-emerald-400/30 bg-emerald-950/40 text-emerald-100 shadow-sm',
        className,
      )}
    >
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="absolute right-3 top-3 text-rose-300/80 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex items-start gap-2.5 pr-6">
        {isError ? (
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-rose-400" />
        ) : (
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5 text-emerald-400" />
        )}
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-sm text-white">{title}</p>
          <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed">{description}</p>
        </div>
      </div>

      {action && (
        <div className="pl-7 pt-1">
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center justify-center rounded-lg bg-white px-3.5 py-1.5 text-xs font-bold text-[#07534C] shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}
