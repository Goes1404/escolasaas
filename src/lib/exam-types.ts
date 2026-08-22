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
  /** Chip/badge do tipo, em superfície neutra com traço da cor. */
  chip: string;
  /** Cor chapada de destaque (faixa do card, botão). */
  accent: string;
  /** Tinta que se lê SOBRE `accent`. Amarelo pede texto escuro; sem isto o
      botão do tipo ETEC nascia branco sobre amarelo, ilegível. */
  onAccent: string;
  /** Rótulo de exibição. */
  label: string;
};

/**
 * Cor por tipo de prova.
 *
 * Aqui a cor é CATEGÓRICA — diz de que exame é a prova —, então ela fica; o que
 * saiu foram os gradientes e as sombras coloridas, que eram decoração, e as
 * cores de fora da paleta (roxo/fúcsia, azul/índigo, esmeralda/teal).
 *
 * Havia ainda uma divergência silenciosa: `EXAM_TYPE_BADGE`, usado nas telas de
 * admin e professor, pintava ENEM de azul enquanto esta função pintava de roxo.
 * O mesmo exame mudava de cor conforme quem olhava. Agora as duas derivam do
 * mesmo mapa.
 */
const EXAM_TONE = {
  enem:    { accent: 'bg-primary',      onAccent: 'text-primary-foreground', chip: 'border-primary text-primary' },
  fuvest:  { accent: 'bg-brand-pink',   onAccent: 'text-white',              chip: 'border-brand-pink text-brand-pink' },
  etec:    { accent: 'bg-brand-yellow', onAccent: 'text-foreground',         chip: 'border-brand-yellow text-foreground' },
  unicamp: { accent: 'bg-brand-slate',  onAccent: 'text-white',              chip: 'border-brand-slate text-brand-slate' },
  outro:   { accent: 'bg-foreground',   onAccent: 'text-background',         chip: 'border-foreground text-foreground' },
} as const;

function toneKeyFor(type: string | null | undefined): keyof typeof EXAM_TONE {
  const t = (type || '').toLowerCase();
  if (t === 'enem') return 'enem';
  if (t.includes('fuvest') || t === 'usp') return 'fuvest';
  if (t.includes('etec') || t.includes('fatec')) return 'etec';
  if (t.includes('unicamp')) return 'unicamp';
  return 'outro';
}

export function examTypeStyles(type: string | null | undefined): ExamTypeStyles {
  const tone = EXAM_TONE[toneKeyFor(type)];
  return {
    chip: `bg-transparent border-2 ${tone.chip}`,
    accent: tone.accent,
    onAccent: tone.onAccent,
    label: examTypeLabel(type),
  };
}

/** Classes curtas de badge para as telas de gestão (admin/professor). */
export const EXAM_TYPE_BADGE: Record<ExamType, string> = {
  enem:    `bg-transparent border-2 ${EXAM_TONE.enem.chip}`,
  etec:    `bg-transparent border-2 ${EXAM_TONE.etec.chip}`,
  fuvest:  `bg-transparent border-2 ${EXAM_TONE.fuvest.chip}`,
  unicamp: `bg-transparent border-2 ${EXAM_TONE.unicamp.chip}`,
  usp:     `bg-transparent border-2 ${EXAM_TONE.fuvest.chip}`,
  outro:   `bg-transparent border-2 ${EXAM_TONE.outro.chip}`,
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

