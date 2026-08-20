/**
 * Fonte única de verdade para os tipos de prova (`exams.exam_type`).
 *
 * `exam_type` é uma coluna TEXT livre no banco (sem CHECK nem enum), então a
 * enumeração vive aqui. Antes desta consolidação a lista existia em quatro
 * lugares divergentes (painel do admin, painel do professor, banco de questões e
 * a tela de provas do aluno), com cores e rótulos diferentes entre si.
 */

export const EXAM_TYPES = ['enem', 'etec', 'fuvest', 'unicamp', 'usp', 'outro'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

/**
 * Tipos que não são vestibulares e não devem aparecer nos seletores de cadastro.
 * `simulado_importado` é criado pela importação de simulados do cursinho
 * (`/api/admin/import-simulado`) e é exibido em telas próprias — nunca na lista
 * de provas completas.
 */
export const INTERNAL_EXAM_TYPES = ['simulado_importado'] as const;

/** Rótulo de exibição. Nunca mostre `exam_type` cru na interface. */
export function examTypeLabel(type: string | null | undefined): string {
  const t = (type || '').toLowerCase();
  if (t === 'enem') return 'ENEM';
  if (t.includes('fuvest')) return 'FUVEST';
  if (t.includes('unicamp')) return 'UNICAMP';
  if (t === 'usp') return 'USP';
  if (t.includes('etec')) return 'ETEC';
  if (t.includes('fatec')) return 'FATEC';
  if (t === 'simulado_importado') return 'Simulado';
  if (t === 'outro') return 'Outro';
  return (type || '').toUpperCase();
}

type ExamTypeStyles = {
  /** Classes do chip/badge. */
  chip: string;
  /** Sombra colorida do card. */
  glow: string;
  /** Gradiente do anel/realce. */
  ring: string;
  /** Rótulo de exibição. */
  label: string;
};

/**
 * Cores e rótulo por tipo, usados nos cards de prova do aluno.
 * FUVEST/USP compartilham a paleta azul; ETEC/FATEC a verde.
 */
export function examTypeStyles(type: string | null | undefined): ExamTypeStyles {
  const t = (type || '').toLowerCase();
  const label = examTypeLabel(type);

  if (t === 'enem') {
    return {
      chip: 'bg-purple-100 text-purple-700 border-purple-200',
      glow: 'shadow-purple-500/20',
      ring: 'from-purple-600 to-fuchsia-600',
      label,
    };
  }
  if (t.includes('fuvest') || t === 'usp') {
    return {
      chip: 'bg-blue-100 text-blue-700 border-blue-200',
      glow: 'shadow-blue-500/20',
      ring: 'from-blue-600 to-indigo-600',
      label,
    };
  }
  if (t.includes('etec') || t.includes('fatec')) {
    return {
      chip: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      glow: 'shadow-emerald-500/20',
      ring: 'from-emerald-600 to-teal-600',
      label,
    };
  }
  return {
    chip: 'bg-orange-100 text-orange-700 border-orange-200',
    glow: 'shadow-orange-500/20',
    ring: 'from-orange-500 to-amber-500',
    label,
  };
}

/** Classes curtas de badge para as telas de gestão (admin/professor). */
export const EXAM_TYPE_BADGE: Record<ExamType, string> = {
  enem: 'bg-blue-100 text-blue-700',
  etec: 'bg-purple-100 text-purple-700',
  fuvest: 'bg-orange-100 text-orange-700',
  unicamp: 'bg-green-100 text-green-700',
  usp: 'bg-rose-100 text-rose-700',
  outro: 'bg-zinc-100 text-zinc-600',
};

/**
 * Traduz o objetivo do aluno (`profiles.exam_target`, texto livre) nos tipos de
 * prova que ele pode ver na tela de Provas Completas.
 *
 * Regra de produto: o aluno de ETEC vê apenas provas de ETEC. O aluno da trilha
 * ENEM vê ENEM e FUVEST — a FUVEST faz parte da trilha ENEM, não é uma trilha
 * separada.
 *
 * `simulado_importado` fica fora de propósito: esses simulados internos são
 * exibidos em `/dashboard/student/simulados` e na home, não aqui.
 */
export function allowedExamTypesFor(rawTarget: string | null | undefined): ExamType[] {
  const target = (rawTarget || '').toLowerCase();
  if (target.includes('etec')) return ['etec'];
  return ['enem', 'fuvest'];
}

