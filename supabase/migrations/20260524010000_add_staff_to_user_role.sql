-- ALTER TYPE user_role TO ADD 'staff'
-- Compromisso 360 | Migration 20260524010000

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'staff';
