-- Migration: Add payment gateway fields to payments table
-- Target: public.payments

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS gateway_order_id text,
ADD COLUMN IF NOT EXISTS gateway_payment_id text,
ADD COLUMN IF NOT EXISTS gateway_signature text;

-- Add index on gateway_order_id for faster lookups
CREATE INDEX IF NOT EXISTS payments_gateway_order_id_idx ON public.payments(gateway_order_id);
