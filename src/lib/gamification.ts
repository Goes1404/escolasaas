import { supabase } from '@/app/lib/supabase';
import { bumpStreak, getStreak } from '@/lib/streak';

// ⚠️ Cópias locais dos valores da tabela `xp_action_values`, mantidas só para
// texto de interface ("cada acerto vale 5 XP"). Quem concede é o servidor, em
// `award_xp()` — nenhum destes números influencia o XP de verdade. Se divergir
// da tabela, a tabela está certa.
export const XP_PER_CORRECT_QUESTION = 5;
export const XP_PER_SIMULADO_COMPLETE = 0;  // concluir simulado deixou de valer XP
export const XP_PER_EXAM_COMPLETE = 50;

export const XP_LEVELS = [
  { level: 1, minXP: 0, label: 'Iniciante' },
  { level: 2, minXP: 100, label: 'Estudante' },
  { level: 3, minXP: 300, label: 'Dedicado' },
  { level: 4, minXP: 600, label: 'Avançado' },
  { level: 5, minXP: 1000, label: 'Expert' },
  { level: 6, minXP: 1500, label: 'Mestre' },
  { level: 7, minXP: 2500, label: 'Lendário' },
];

export type BadgeType =
  | 'first_question'
  | 'questions_10'
  | 'questions_50'
  | 'questions_100'
  | 'perfect_simulado'
  | 'streak_7';

export const BADGE_META: Record<BadgeType, { label: string; description: string; icon: string }> = {
  first_question:  { label: 'Primeiro Passo',      description: 'Respondeu a 1ª questão',           icon: '🎯' },
  questions_10:    { label: 'Dez Questões',         description: 'Respondeu 10 questões no total',   icon: '📝' },
  questions_50:    { label: 'Meio Século',          description: 'Respondeu 50 questões no total',   icon: '⚡' },
  questions_100:   { label: 'Centenário',           description: 'Respondeu 100 questões no total',  icon: '🏆' },
  perfect_simulado:{ label: 'Gabarito Perfeito',    description: '100% de acerto em um simulado',    icon: '💎' },
  streak_7:        { label: '7 Dias Seguidos',      description: 'Estudou 7 dias consecutivos',      icon: '🔥' },
};

export function getLevel(xp: number) {
  let current = XP_LEVELS[0];
  for (const lvl of XP_LEVELS) {
    if (xp >= lvl.minXP) current = lvl;
  }
  const nextIdx = XP_LEVELS.findIndex(l => l.level === current.level) + 1;
  const next = XP_LEVELS[nextIdx] ?? null;
  const progressPct = next
    ? Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100)
    : 100;
  return { current, next, progressPct, xp };
}

/**
 * Concede XP. A pontuação é decidida pelo SERVIDOR — o cliente só informa a
 * ação e, quando ela é por volume (acertos de um simulado), a quantidade.
 *
 * Antes daqui saía um `update` em `profiles.xp_points` e um `insert` em
 * `student_xp_log` com o valor vindo do cliente. Como o ranking semanal passou
 * a valer prêmio, isso virou alvo: qualquer aluno podia mandar 999999 pelo
 * console e liderar na hora. Agora ambos os caminhos diretos estão fechados no
 * banco e a única via é a função `award_xp`, que consulta a tabela de valores,
 * ignora repetição da mesma referência e respeita o teto diário.
 *
 * Retorna o XP efetivamente concedido — 0 quando já havia sido contabilizado
 * ou quando o teto do dia foi atingido.
 */
export async function awardXP(
  _userId: string,
  points: number,
  action = 'generic',
  referenceId?: string,
  quantity?: number,
): Promise<number> {
  // `points` continua na assinatura por compatibilidade com as chamadas
  // existentes, mas é ignorado: quem define o valor é o servidor.
  void points;

  const { data, error } = await supabase.rpc('award_xp', {
    p_action: action,
    p_reference_id: referenceId ?? null,
    p_quantity: quantity ?? 1,
  });

  if (error) {
    console.error('[awardXP]', error.message);
    return 0;
  }

  // A ação vai junto: o servidor decide se ela sustenta ofensiva. `checkin`
  // continua valendo XP, mas entrar e clicar não é estudo — e é do estudo que a
  // ofensiva (e o bichinho preso a ela) se alimenta.
  bumpStreak(_userId, action).catch(() => undefined);
  return (data as number) ?? 0;
}

export async function checkAndAwardBadges(
  userId: string,
  opts: {
    totalAnswered?: number;
    isPerfectSimulado?: boolean;
  }
): Promise<BadgeType[]> {
  const earned: BadgeType[] = [];

  const badge = async (type: BadgeType) => {
    const { error } = await supabase
      .from('user_badges')
      .insert({ user_id: userId, badge_type: type })
      .select()
      .single();
    if (!error) earned.push(type);
  };

  const { totalAnswered = 0, isPerfectSimulado = false } = opts;

  if (totalAnswered >= 1)   await badge('first_question');
  if (totalAnswered >= 10)  await badge('questions_10');
  if (totalAnswered >= 50)  await badge('questions_50');
  if (totalAnswered >= 100) await badge('questions_100');
  if (isPerfectSimulado)    await badge('perfect_simulado');

  // Ofensiva de 7 dias consecutivos
  try {
    const streak = await getStreak(userId);
    if (streak.current_streak >= 7) await badge('streak_7');
  } catch {
    // ignora: badge é melhoria, não pode quebrar fluxo
  }

  return earned;
}

export async function getTotalAnswered(userId: string): Promise<number> {
  const { count } = await supabase
    .from('student_question_answers')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', userId);
  return count ?? 0;
}
