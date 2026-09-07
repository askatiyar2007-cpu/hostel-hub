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
  teal: { bg: 'bg-teal-50/90', border: 'border-teal-100', text: 'text-teal-600' },
  blue: { bg: 'bg-blue-50/90', border: 'border-blue-100', text: 'text-blue-600' },
  violet: { bg: 'bg-violet-50/90', border: 'border-violet-100', text: 'text-violet-600' },
  purple: { bg: 'bg-purple-50/90', border: 'border-purple-100', text: 'text-purple-600' },
  amber: { bg: 'bg-amber-50/90', border: 'border-amber-100', text: 'text-amber-600' },
  emerald: { bg: 'bg-emerald-50/90', border: 'border-emerald-100', text: 'text-emerald-600' },
  rose: { bg: 'bg-rose-50/90', border: 'border-rose-100', text: 'text-rose-600' },
  indigo: { bg: 'bg-indigo-50/90', border: 'border-indigo-100', text: 'text-indigo-600' },
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
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{title}</p>
        <p className="mt-2 text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-tight truncate">{value}</p>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500 truncate">{subtitle}</p>
        )}
        {trend && (
          <p
            className={cn(
              "mt-1.5 text-xs font-medium truncate",
              trend.isPositive ? "text-emerald-600" : "text-rose-600"
            )}
          >
            {trend.value}
          </p>
        )}
      </div>
      {icon && (
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl border shrink-0 shadow-2xs",
            iconTheme.bg,
            iconTheme.border,
            iconTheme.text
          )}
        >
          {icon}
        </div>
      )}
    </div>
  );

  const cardClasses = cn(
    "rounded-2xl border border-sky-100/90 bg-white p-5 shadow-[0_4px_20px_-2px_rgba(14,42,71,0.07),0_2px_6px_-1px_rgba(14,42,71,0.04)] relative z-10 transition-all duration-200",
    isClickable
      ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-4px_rgba(14,42,71,0.12),0_4px_8px_-2px_rgba(14,42,71,0.06)] hover:border-sky-300 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
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
