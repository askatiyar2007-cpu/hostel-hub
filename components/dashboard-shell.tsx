'use client';

import React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardShell({
  title,
  subtitle,
  children,
  badge,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  badge?: string;
  className?: string;
}) {
  return (
    <div className={cn("p-4 sm:p-6 lg:p-8", className)}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            {badge ? (
              <span className="mb-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {badge}
              </span>
            ) : null}
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl font-display">{title}</h1>
            {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatCard({ 
  label, 
  value, 
  hint, 
  icon: Icon,
  trend,
}: { 
  label: string; 
  value: ReactNode; 
  hint?: string;
  icon?: React.ElementType;
  trend?: {
    value: string;
    label: string;
    positive?: boolean;
  };
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        {Icon && (
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight font-display">{value}</div>
      {(hint || trend) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && (
            <span className={cn(
              "text-xs font-medium",
              trend.positive ? "text-green-600" : "text-red-600"
            )}>
              {trend.value}
            </span>
          )}
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      )}
    </div>
  );
}

export function AnalyticsCard({
  title,
  children,
  description,
  className,
}: {
  title: string;
  children: ReactNode;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-6 shadow-sm", className)}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold font-display">{title}</h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="h-[300px] w-full">
        {children}
      </div>
    </div>
  );
}
