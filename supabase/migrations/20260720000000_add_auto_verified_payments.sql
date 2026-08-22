-- Migration: Add auto-verification support to payments
-- Target: public.payments table

-- 1. Add auto_verified column
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS auto_verified boolean DEFAULT false;

-- 2. Update payment_status check constraint to include new statuses
ALTER TABLE public.payments 
DROP CONSTRAINT IF EXISTS payments_payment_status_check;

ALTER TABLE public.payments 
ADD CONSTRAINT payments_payment_status_check 
CHECK (payment_status IN ('pending_verification', 'completed', 'failed', 'verified', 'pending', 'rejected', 'partial'));
