/**
 * xp.ts — Wrapper público sobre gamification.ts
 * Use este módulo para conceder XP em novos fluxos (questão do dia, etc.)
 * O sistema legado (simulados, provas) usa gamification.ts diretamente.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { awardXP, XP_PER_CORRECT_QUESTION, XP_LEVELS, getLevel } from '@/lib/gamification';

// ─── Valores de XP para cada ação ────────────────────────────
export const XP_VALUES = {
  correct_answer:          XP_PER_CORRECT_QUESTION,  // 5 (existente)
  wrong_answer:            2,
  simulado_complete:       0,                         // concluir não vale XP: só os acertos contam
  daily_question_correct:  25,
  daily_question_wrong:    5,
  essay_submit:            80,
  checkin:                 15,
  material_viewed:         5,
  streak_bonus:            20,
} as const;

export type XPAction = keyof typeof XP_VALUES;

// ─── Nomes de nível (usa XP_LEVELS de gamification) ──────────
export function getLevelProgress(totalXp: number) {
  const info      = getLevel(totalXp);
  const current   = info.current;
  const next      = info.next;
  return {
    level:           current.level,
    levelName:       current.label,
    progressPercent: info.progressPct,
    nextLevelXp:     next ? next.minXP - current.minXP : 0,
    currentXp:       totalXp - current.minXP,
    isMaxLevel:      !next,
  };
}

// ─── Conceder XP (wrapper sobre awardXP de gamification) ─────
export async function grantXP(
  _supabase: SupabaseClient,   // mantido por compatibilidade de assinatura
  studentId: string,
  action: XPAction,
  referenceId?: string,
): Promise<{ xpEarned: number; error?: string }> {
  const xp = XP_VALUES[action];
  try {
    await awardXP(studentId, xp, action, referenceId);
    return { xpEarned: xp };
  } catch (e: any) {
    console.error('[grantXP]', e.message);
    return { xpEarned: 0, error: e.message };
  }
}

// ─── Buscar XP total do aluno (via profiles.xp_points) ───────
export async function fetchStudentXP(
  supabase: SupabaseClient,
  studentId: string,
): Promise<{ totalXp: number; level: number; levelName: string }> {
  const { data } = await supabase
    .from('profiles')
    .select('xp_points')
    .eq('id', studentId)
    .maybeSingle();

  const totalXp = data?.xp_points ?? 0;
  const info    = getLevel(totalXp);
  return {
    totalXp,
    level:     info.current.level,
    levelName: info.current.label,
  };
}
