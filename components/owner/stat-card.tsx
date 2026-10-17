import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
  color?: 'teal' | 'blue' | 'violet' | 'purple' | 'amber' | 'emerald' | 'rose' | 'indigo';
  onClick?: () => void;
  href?: string;
}

const colorMap = {
  teal: { bg: 'bg-teal-50/90 dark:bg-teal-950/40', border: 'border-teal-100 dark:border-teal-800', text: 'text-teal-600 dark:text-teal-400' },
  blue: { bg: 'bg-blue-50/90 dark:bg-blue-950/40', border: 'border-blue-100 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400' },
  violet: { bg: 'bg-violet-50/90 dark:bg-violet-950/40', border: 'border-violet-100 dark:border-violet-800', text: 'text-violet-600 dark:text-violet-400' },
  purple: { bg: 'bg-purple-50/90 dark:bg-purple-950/40', border: 'border-purple-100 dark:border-purple-800', text: 'text-purple-600 dark:text-purple-400' },
  amber: { bg: 'bg-amber-50/90 dark:bg-amber-950/40', border: 'border-amber-100 dark:border-amber-800', text: 'text-amber-600 dark:text-amber-400' },
  emerald: { bg: 'bg-emerald-50/90 dark:bg-emerald-950/40', border: 'border-emerald-100 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400' },
  rose: { bg: 'bg-rose-50/90 dark:bg-rose-950/40', border: 'border-rose-100 dark:border-rose-800', text: 'text-rose-600 dark:text-rose-400' },
  indigo: { bg: 'bg-indigo-50/90 dark:bg-indigo-950/40', border: 'border-indigo-100 dark:border-indigo-800', text: 'text-indigo-600 dark:text-indigo-400' },
};

export function StatCard({ 
  title, 
  value, 
  icon, 
  subtitle, 
  trend, 
  className, 
  color = 'teal',
  onClick,
  href
}: StatCardProps) {
  const iconTheme = colorMap[color] || colorMap.teal;
  const isClickable = Boolean(onClick || href);

  const cardContent = (
    <div className="flex flex-col justify-between h-full">
      {/* 1. TITLE + ICON */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-snug">
          {title}
        </p>
        {icon && (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 shadow-2xs",
              iconTheme.bg,
              iconTheme.border,
              iconTheme.text
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {/* 2. FULL VALUE */}
      <div className="mb-1.5 min-w-0">
        <div 
          className="text-xl sm:text-2xl lg:text-[22px] xl:text-[26px] font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight truncate" 
          title={typeof value === 'string' ? value : String(value)}
        >
          {value}
        </div>
      </div>

      {/* 3. SHORT SUPPORTING DESCRIPTION */}
      <div className="flex-1 flex flex-col justify-end min-w-0">
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed truncate" title={subtitle}>
            {subtitle}
          </p>
        )}

        {/* 4. STATUS/SECONDARY INFORMATION */}
        {trend && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1a3d52] flex items-center min-w-0">
            <span
              className={cn(
                "text-[11px] font-semibold leading-tight truncate",
                trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
              )}
              title={trend.value}
            >
              {trend.value}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const cardClasses = cn(
    "rounded-2xl border border-sky-100/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] p-4.5 sm:p-5 shadow-[0_4px_20px_-2px_rgba(14,42,71,0.07),0_2px_6px_-1px_rgba(14,42,71,0.04)] relative z-10 transition-all duration-200 flex flex-col justify-between h-full min-w-0 overflow-hidden",
    isClickable
      ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-4px_rgba(14,42,71,0.12),0_4px_8px_-2px_rgba(14,42,71,0.06)] hover:border-sky-300 dark:hover:border-teal-700 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
      : "cursor-default",
    className
  );

  if (href) {
    return (
      <Link href={href} className={cardClasses}>
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button 
        type="button" 
        onClick={onClick} 
        className={cn(cardClasses, "text-left w-full")}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div className={cardClasses}>
      {cardContent}
    </div>
  );
}
