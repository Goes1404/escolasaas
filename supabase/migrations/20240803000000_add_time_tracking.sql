
-- 1. Adicionar coluna para rastreio de tempo acumulado (em segundos)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_time_spent BIGINT DEFAULT 0;

-- 2. Função para incrementar o tempo de forma atômica, evitando race conditions
CREATE OR REPLACE FUNCTION public.increment_time_spent(p_user_id UUID, p_seconds INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET total_time_spent = COALESCE(total_time_spent, 0) + p_seconds,
      last_access = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
