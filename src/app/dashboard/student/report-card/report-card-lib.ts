import {
  Atom,
  Binary,
  BookOpen,
  Compass,
  Dna,
  FlaskConical,
  Globe,
  Landmark,
  Languages,
  Users,
} from "lucide-react";

export type EtecReportCard = {
  id: string;
  track: "enem" | "etec";
  semester: number;
  classificatoria_score: number | null;
  classificatoria_max: number | null;
  simulado_score: number | null;
  simulado_max: number | null;
  redacao_score: number | null;
  redacao_max: number | null;
  absences_1sem: number | null;
  absences_2sem: number | null;
  sala: string | null;
  turno: string | null;
  colegio: string | null;
};

export type EnemReportCard = {
  id: string;
  semester: number;
  classificatoria_score: number | null;
  classificatoria_max: number | null;
  simulado_1_score: number | null;
  simulado_2_score: number | null;
  simulado_3_score: number | null;
  simulado_max: number | null;
  lingua_portuguesa: number | null;
  matematica: number | null;
  historia: number | null;
  geografia: number | null;
  biologia: number | null;
  quimica: number | null;
  fisica: number | null;
  filosofia: number | null;
  sociologia: number | null;
  ingles: number | null;
  redacao_score: number | null;
  redacao_max: number | null;
  absences_1sem: number | null;
  absences_2sem: number | null;
  early_departures_1sem: number | null;
  early_departures_2sem: number | null;
  sala: string | null;
  turno: string | null;
  colegio: string | null;
};

export const LABELS = {
  classificatoria: "Classificatória",
  redacao: "Redação",
  fisica: "Física",
  quimica: "Química",
  matematica: "Matemática",
  historia: "História",
  linguaPortuguesa: "Língua Portuguesa",
  portugues: "Português",
  ingles: "Inglês",
  evolucao: "Evolução",
  materia: "matéria",
  materias: "matérias",
  pentagono: "Pentágono",
  saidas: "Saídas antecipadas",
  naoRealizado: "Ainda não realizado",
  versao: "versão",
  ultimo: "último semestre",
  media: "média atual",
  manha: "Manhã",
} as const;

export const ENEM_SUBJECTS = [
  { key: "lingua_portuguesa", label: LABELS.linguaPortuguesa, short: LABELS.portugues, icon: BookOpen },
  { key: "matematica", label: LABELS.matematica, short: LABELS.matematica, icon: Binary },
  { key: "historia", label: LABELS.historia, short: LABELS.historia, icon: Landmark },
  { key: "geografia", label: "Geografia", short: "Geografia", icon: Globe },
  { key: "biologia", label: "Biologia", short: "Biologia", icon: Dna },
  { key: "quimica", label: LABELS.quimica, short: LABELS.quimica, icon: FlaskConical },
  { key: "fisica", label: LABELS.fisica, short: LABELS.fisica, icon: Atom },
  { key: "filosofia", label: "Filosofia", short: "Filosofia", icon: Compass },
  { key: "sociologia", label: "Sociologia", short: "Sociologia", icon: Users },
  { key: "ingles", label: LABELS.ingles, short: LABELS.ingles, icon: Languages },
] as const;

export function pct(score: number | null | undefined, max: number | null | undefined) {
  if (score === null || score === undefined || !max) return null;
  return Math.round(Math.max(0, Math.min(100, (score / max) * 100)));
}

export function avg(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number");
  if (!valid.length) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;
}

export function subjectScores(enem: EnemReportCard | undefined) {
  if (!enem) return [];
  return ENEM_SUBJECTS.map((subject) => ({
    ...subject,
    score: typeof enem[subject.key] === "number" ? Number(enem[subject.key]) : null,
  })).filter((subject) => subject.score !== null) as Array<(typeof ENEM_SUBJECTS)[number] & { score: number }>;
}
