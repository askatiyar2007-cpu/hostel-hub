import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SemanticColor = 
  | 'teal' 
  | 'blue' 
  | 'violet' 
  | 'purple' 
  | 'amber' 
  | 'rose' 
  | 'emerald' 
  | 'indigo';

interface IconWrapperProps {
  color?: SemanticColor;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const colorStyles: Record<SemanticColor, { bg: string; border: string; text: string }> = {
  teal: {
    bg: 'bg-teal-50',
    border: 'border-teal-100/80',
    text: 'text-teal-600',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-100/80',
    text: 'text-blue-600',
  },
  violet: {
    bg: 'bg-violet-50',
    border: 'border-violet-100/80',
    text: 'text-violet-600',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-100/80',
    text: 'text-purple-600',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-100/80',
    text: 'text-amber-600',
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-100/80',
    text: 'text-rose-600',
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-100/80',
    text: 'text-emerald-600',
  },
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-100/80',
    text: 'text-indigo-600',
  },
};

const sizeStyles = {
  sm: 'h-7 w-7 rounded-lg text-xs [&_svg]:h-3.5 [&_svg]:w-3.5',
  md: 'h-9 w-9 rounded-xl text-sm [&_svg]:h-4 [&_svg]:w-4',
  lg: 'h-11 w-11 rounded-xl text-base [&_svg]:h-5 [&_svg]:w-5',
};

/**
 * Standardized icon container providing semantic visual tint, subtle border,
 * and icon coloring.
 */
export function IconWrapper({
  color = 'teal',
  size = 'md',
  className,
  children,
}: IconWrapperProps) {
  const styles = colorStyles[color] || colorStyles.teal;

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center shrink-0 border transition-colors',
        styles.bg,
        styles.border,
        styles.text,
        sizeStyles[size],
        className
      )}
    >
      {children}
    </div>
  );
}
