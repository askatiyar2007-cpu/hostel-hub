import React from 'react';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/design-tokens';

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
}

export function StatCard({ title, value, icon, subtitle, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
      style={{ borderColor: colors.neutral[200] }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}
            >
              {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: colors.primary.teal[50] }}
          >
            <div style={{ color: colors.primary.teal[600] }}>{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
}
