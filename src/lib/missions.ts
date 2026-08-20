import { SupabaseClient } from '@supabase/supabase-js';

/**
 * missions.ts
 * Helpers para atualizar o progresso de missões semanais.
 * Chame após cada ação relevante do aluno.
 */

type MissionActionType =
  | 'answer_questions'
  | 'complete_simulados'
  | 'submit_essay'
  | 'daily_question'
  | 'checkin';

/**
 * Incrementa o progresso do aluno nas missões que correspondem
 * ao `actionType` da semana atual. Falha silenciosa — missões
 * são melhoria, não podem quebrar o fluxo principal.
 */
export async function trackMissionProgress(
  supabase: SupabaseClient,
  studentId: string,
  actionType: MissionActionType,
  increment = 1,
): Promise<void> {
  try {
    const weekStart = (() => {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(d);
      mon.setDate(diff);
      return mon.toISOString().slice(0, 10);
    })();

    // Busca missões ativas desta semana com este tipo de ação
    const { data: missions } = await supabase
      .from('weekly_missions')
      .select('id, goal')
      .eq('week_start', weekStart)
      .eq('action_type', actionType);

    if (!missions || missions.length === 0) return;

    for (const mission of missions) {
      // Busca progresso atual
      const { data: existing } = await supabase
        .from('mission_progress')
        .select('id, progress, completed')
        .eq('student_id', studentId)
        .eq('mission_id', mission.id)
        .maybeSingle();

      if (existing?.completed) continue; // Já completou, não incrementa

      const currentProgress = existing?.progress ?? 0;
      const newProgress     = Math.min(mission.goal, currentProgress + increment);
      const isNowComplete   = newProgress >= mission.goal;

      await supabase
        .from('mission_progress')
        .upsert(
          {
            student_id:   studentId,
            mission_id:   mission.id,
            progress:     newProgress,
            completed:    isNowComplete,
            completed_at: isNowComplete ? new Date().toISOString() : null,
          },
          { onConflict: 'student_id,mission_id' }
        );
    }
  } catch (e) {
    // Falha silenciosa — não pode quebrar o fluxo principal
    console.warn('[trackMissionProgress]', e);
  }
}
