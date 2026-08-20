-- Códigos OTP de recuperação de senha via SMS.
-- Guarda só o hash SHA-256 do código de 6 dígitos, nunca o valor em claro.

CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  consumed    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user_id
  ON public.password_reset_otps (user_id, created_at DESC);

-- RLS ligado e SEM policies => ninguém acessa pelo cliente.
-- Apenas a service role (rota server-side) lê/escreve.
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;
