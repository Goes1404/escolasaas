import { supabase } from '@/app/lib/supabase';

export type StreakData = {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  /** Dias perdidos que a ofensiva ainda aguenta sem zerar. */
  protections: number;
};

/**
 * O dia do aluno, não o do navegador.
 *
 * `new Date().toISOString()` devolve a data em UTC, e o Brasil é UTC-3. Quem
 * estuda às 21h vê o navegador dizer que já é amanhã — a ofensiva contava dois
 * dias onde houve um. O servidor calcula em `America/Sao_Paulo`; aqui é
 * preciso usar o mesmo relógio, senão a tela discorda do banco justamente na
 * faixa da noite, que é quando o aluno estuda.
 */
export function hojeNoBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function diasDesde(data: string): number {
  const [ay, am, ad] = data.split('-').map(Number);
  const [by, bm, bd] = hojeNoBrasil().split('-').map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86_400_000);
}

export async function getStreak(userId: string): Promise<StreakData> {
  const { data } = await supabase
    .from('study_streaks')
    .select('current_streak, longest_streak, last_activity_date, protections')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    current_streak: data?.current_streak ?? 0,
    longest_streak: data?.longest_streak ?? 0,
    last_activity_date: data?.last_activity_date ?? null,
    protections: data?.protections ?? 0,
  };
}

/**
 * Atualiza a ofensiva do aluno. Chame ao final de uma atividade de estudo.
 *
 * Quem decide é o servidor: `bump_streak()` calcula o dia no fuso de São Paulo,
 * aplica proteção quando há dia perdido e ignora ações que não são estudo. O
 * cliente informa apenas O QUE o aluno fez.
 *
 * A escrita direta na tabela foi fechada em 12/08 — antes disso, um `UPDATE
 * study_streaks SET current_streak = 999` pelo console punha o aluno no topo do
 * ranking semanal, que vale prêmio.
 */
export async function bumpStreak(_userId: string, action?: string): Promise<StreakData> {
  const { data, error } = await supabase.rpc('bump_streak', { p_action: action ?? null });

  if (error || !data) {
    if (error) console.warn('[streak] bump falhou:', error.message);
    return getStreak(_userId);
  }

  const r = data as Record<string, unknown>;
  return {
    current_streak: Number(r.current_streak ?? 0),
    longest_streak: Number(r.longest_streak ?? 0),
    last_activity_date: (r.last_activity_date as string) ?? null,
    protections: Number(r.protections ?? 0),
  };
}

export type EstadoOfensiva =
  /** Estudou hoje: está mantida. */
  | 'mantida'
  /** Estudou ontem e ainda não hoje — hoje é o último dia para manter. */
  | 'ultimo_dia'
  /** Perdeu dia(s), mas a proteção cobre: volta a contar de onde parou. */
  | 'protegida'
  /** Perdeu além do que a proteção cobre: recomeça do 1. */
  | 'perdida'
  /** Nunca começou. */
  | 'nenhuma';

/**
 * Em que pé está a ofensiva.
 *
 * Substitui o antigo `isStreakAtRisk`, que dizia "em risco" quando a última
 * atividade **não** foi nem hoje nem ontem — ou seja, quando a ofensiva já
 * tinha morrido. O widget então prometia "estude hoje para não perder seus 3
 * dias" para alguém que ia recomeçar do 1 de qualquer jeito. Risco de verdade é
 * o dia seguinte ao último estudo, que é quando ainda dá para salvar.
 */
export function estadoOfensiva(s: {
  /** Dias sem estudar. `null` quando o aluno nunca estudou. */
  dias_sem_estudar: number | null;
  current_streak: number;
  protections: number;
}): EstadoOfensiva {
  if (s.dias_sem_estudar == null || s.current_streak === 0) return 'nenhuma';
  if (s.dias_sem_estudar <= 0) return 'mantida';
  if (s.dias_sem_estudar === 1) return 'ultimo_dia';

  const perdidos = s.dias_sem_estudar - 1;
  return perdidos <= s.protections ? 'protegida' : 'perdida';
}

/** Conveniência para quem tem a data em vez da contagem de dias. */
export function estadoOfensivaPorData(s: Pick<StreakData, 'last_activity_date' | 'current_streak' | 'protections'>): EstadoOfensiva {
  return estadoOfensiva({
    dias_sem_estudar: s.last_activity_date ? diasDesde(s.last_activity_date) : null,
    current_streak: s.current_streak,
    protections: s.protections,
  });
}

/**
 * Mantido por compatibilidade com chamadas existentes, agora com o significado
 * correto: hoje é o último dia para não perder a ofensiva.
 */
export function isStreakAtRisk(lastActivity: string | null): boolean {
  if (!lastActivity) return false;
  return diasDesde(lastActivity) === 1;
}
