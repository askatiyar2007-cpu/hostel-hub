import React from 'react';


export function PageHeader({ label, title, description, icon, children }: {
  label?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
      <div className="space-y-2 flex-1">
        {label && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50/80 border border-teal-200/80 px-3 py-1 text-xs font-semibold text-teal-800 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
              {label}
            </span>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          {icon && (
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-teal-50 text-teal-600 border border-teal-100 shadow-xs shrink-0">
              {icon}
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            {title}
          </h1>
        </div>
        
        {description && (
          <p className="text-sm md:text-base text-slate-500 max-w-3xl">
            {description}
          </p>
        )}
      </div>

      {children && (
        <div className="flex flex-wrap items-center gap-3 shrink-0 mt-2 md:mt-0">
          {children}
        </div>
      )}
    </div>
  );
}
