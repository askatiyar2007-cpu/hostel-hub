'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface AccountAlreadyExistsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'email' | 'google';
  onSignIn: () => void;
}

export function AccountAlreadyExistsDialog({
  open,
  onOpenChange,
  type,
  onSignIn,
}: AccountAlreadyExistsDialogProps) {
  const isGoogle = type === 'google';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isGoogle ? 'Google Account Already Exists' : 'Account Already Exists'}
          </DialogTitle>
          <DialogDescription className="text-base text-foreground">
            {isGoogle
              ? 'This Google account is already connected to a HostelHub account. Please sign in to continue.'
              : 'An account with this email address already exists. Please sign in to continue.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onSignIn();
            }}
            className="w-full sm:w-auto"
          >
            Sign In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}