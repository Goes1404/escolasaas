-- report_card_pending já existe em produção (criada fora do histórico
-- de migrations, com 182 registros reais aguardando revisão). Só
-- falta um campo para guardar o motivo quando o admin/secretaria
-- rejeita um boletim importado.
ALTER TABLE public.report_card_pending
  ADD COLUMN IF NOT EXISTS rejection_reason text;
