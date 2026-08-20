-- Registro de tentativas de recuperação self-service de senha.
-- Usado APENAS para rate-limit (anti-brute-force). Não guarda PII:
-- o alvo é gravado como hash SHA-256 do nome normalizado, não o nome em si.

CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip          text,
  identifier  text,                                  -- hash do nome do alvo (não o nome)
  success     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índices para a contagem por janela de 1h (IP e alvo)
CREATE INDEX IF NOT EXISTS idx_prattempts_ip_time
  ON public.password_reset_attempts (ip, created_at);
CREATE INDEX IF NOT EXISTS idx_prattempts_identifier_time
  ON public.password_reset_attempts (identifier, created_at);

-- RLS ligado e SEM policies => ninguém acessa pelo cliente.
-- Apenas a service role (rotas server-side) lê/escreve.
ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;
