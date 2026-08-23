'use client';

import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
}

export function AuthMessage({ variant, title, description, action, onDismiss }: AuthMessageProps) {
  const isError = variant === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'relative rounded-2xl border p-4 flex flex-col gap-2',
        isError ? 'border-destructive bg-destructive/5' : 'border-primary bg-primary/5',
      )}
    >
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex items-start gap-2 pr-6">
        {isError ? (
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        )}
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-sm text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {action && (
        <div className="pl-6">
          <Button
            type="button"
            size="sm"
            variant={isError ? 'outline' : 'default'}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
