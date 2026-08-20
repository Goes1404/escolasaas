import type { ReportCardImportRow, ReportCardTrack } from "@/app/api/admin/report-card-import/route";

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ºª]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type FieldKey = keyof ReportCardImportRow;

// Cada campo aceita algumas variações de cabeçalho (já normalizadas: sem acento, minúsculas).
const COMMON_FIELDS: Array<{ key: FieldKey; variants: string[] }> = [
  { key: "colegio", variants: ["colegio", "escola", "instituicao"] },
  { key: "sala", variants: ["sala", "turma"] },
  { key: "turno", variants: ["turno", "periodo"] },
  { key: "classificatoria_score", variants: ["classificatoria", "nota classificatoria", "prova classificatoria"] },
  { key: "classificatoria_max", variants: ["classificatoria max", "classificatoria maxima", "nota maxima"] },
  { key: "redacao_score", variants: ["redacao", "nota redacao"] },
  { key: "redacao_max", variants: ["redacao max", "redacao maxima"] },
  { key: "absences_1sem", variants: ["faltas 1 sem", "faltas 1", "faltas1", "faltas primeiro semestre"] },
  { key: "absences_2sem", variants: ["faltas 2 sem", "faltas 2", "faltas2", "faltas segundo semestre"] },
];

const ETEC_FIELDS: Array<{ key: FieldKey; variants: string[] }> = [
  { key: "simulado_score", variants: ["simulado", "nota simulado"] },
  { key: "simulado_max", variants: ["simulado max", "simulado maximo"] },
];

const ENEM_FIELDS: Array<{ key: FieldKey; variants: string[] }> = [
  { key: "simulado_1_score", variants: ["simulado 1", "simulado1"] },
  { key: "simulado_2_score", variants: ["simulado 2", "simulado2"] },
  { key: "simulado_3_score", variants: ["simulado 3", "simulado3"] },
  { key: "simulado_max", variants: ["simulado max", "simulado maximo"] },
  { key: "lingua_portuguesa", variants: ["portugues", "lingua portuguesa"] },
  { key: "matematica", variants: ["matematica"] },
  { key: "historia", variants: ["historia"] },
  { key: "geografia", variants: ["geografia"] },
  { key: "biologia", variants: ["biologia"] },
  { key: "quimica", variants: ["quimica"] },
  { key: "fisica", variants: ["fisica"] },
  { key: "filosofia", variants: ["filosofia"] },
  { key: "sociologia", variants: ["sociologia"] },
  { key: "ingles", variants: ["ingles"] },
  { key: "early_departures_1sem", variants: ["saidas 1 sem", "saidas 1", "saidas antecipadas 1"] },
  { key: "early_departures_2sem", variants: ["saidas 2 sem", "saidas 2", "saidas antecipadas 2"] },
];

const NAME_VARIANTS = ["nome", "aluno", "estudante", "nome do aluno"];

export const NUMERIC_FIELDS = new Set<FieldKey>([
  "classificatoria_score", "classificatoria_max", "redacao_score", "redacao_max",
  "simulado_score", "simulado_1_score", "simulado_2_score", "simulado_3_score", "simulado_max",
  "lingua_portuguesa", "matematica", "historia", "geografia", "biologia", "quimica", "fisica",
  "filosofia", "sociologia", "ingles", "absences_1sem", "absences_2sem",
  "early_departures_1sem", "early_departures_2sem",
]);

export function fieldsForTrack(track: ReportCardTrack) {
  return [...COMMON_FIELDS, ...(track === "etec" ? ETEC_FIELDS : ENEM_FIELDS)];
}

export function templateColumns(track: ReportCardTrack): string[] {
  const base = ["Nome", "Colégio", "Sala", "Turno", "Classificatória", "Classificatória Máx", "Redação", "Redação Máx"];
  const trackCols = track === "etec"
    ? ["Simulado", "Simulado Máx"]
    : ["Simulado 1", "Simulado 2", "Simulado 3", "Simulado Máx", "Português", "Matemática", "..."];
  return [...base, ...trackCols, "Faltas 1º Sem", "Faltas 2º Sem"];
}

export function parseReportCardSheet(raw: unknown[][], track: ReportCardTrack): ReportCardImportRow[] {
  const headerRow = (raw[0] || []) as unknown[];
  const normalizedHeaders = headerRow.map(normalizeHeader);

  const findCol = (variants: string[]): number => {
    for (const variant of variants) {
      const idx = normalizedHeaders.findIndex((h) => h === variant);
      if (idx !== -1) return idx;
    }
    // fallback: contém a variante mais específica (mais longa primeiro)
    const sorted = [...variants].sort((a, b) => b.length - a.length);
    for (const variant of sorted) {
      const idx = normalizedHeaders.findIndex((h) => h.includes(variant));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const nameIdx = findCol(NAME_VARIANTS);
  const fields = fieldsForTrack(track);
  const colIndex: Partial<Record<FieldKey, number>> = {};
  for (const f of fields) colIndex[f.key] = findCol(f.variants);

  const readNumber = (row: unknown[], idx: number | undefined): number | null => {
    if (idx === undefined || idx === -1) return null;
    const raw = row[idx];
    if (raw === undefined || raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const readText = (row: unknown[], idx: number | undefined): string | null => {
    if (idx === undefined || idx === -1) return null;
    const raw = row[idx];
    if (raw === undefined || raw === null || raw === "") return null;
    return String(raw).trim();
  };

  return raw
    .slice(1)
    .filter((row) => nameIdx !== -1 && row[nameIdx])
    .map((row) => {
      const out: ReportCardImportRow = {
        full_name: String(row[nameIdx]).trim(),
        colegio: readText(row, colIndex.colegio),
        sala: readText(row, colIndex.sala),
        turno: readText(row, colIndex.turno),
        classificatoria_score: readNumber(row, colIndex.classificatoria_score),
        classificatoria_max: readNumber(row, colIndex.classificatoria_max),
        redacao_score: readNumber(row, colIndex.redacao_score),
        redacao_max: readNumber(row, colIndex.redacao_max),
        simulado_score: readNumber(row, colIndex.simulado_score),
        simulado_1_score: readNumber(row, colIndex.simulado_1_score),
        simulado_2_score: readNumber(row, colIndex.simulado_2_score),
        simulado_3_score: readNumber(row, colIndex.simulado_3_score),
        simulado_max: readNumber(row, colIndex.simulado_max),
        lingua_portuguesa: readNumber(row, colIndex.lingua_portuguesa),
        matematica: readNumber(row, colIndex.matematica),
        historia: readNumber(row, colIndex.historia),
        geografia: readNumber(row, colIndex.geografia),
        biologia: readNumber(row, colIndex.biologia),
        quimica: readNumber(row, colIndex.quimica),
        fisica: readNumber(row, colIndex.fisica),
        filosofia: readNumber(row, colIndex.filosofia),
        sociologia: readNumber(row, colIndex.sociologia),
        ingles: readNumber(row, colIndex.ingles),
        absences_1sem: readNumber(row, colIndex.absences_1sem),
        absences_2sem: readNumber(row, colIndex.absences_2sem),
        early_departures_1sem: readNumber(row, colIndex.early_departures_1sem),
        early_departures_2sem: readNumber(row, colIndex.early_departures_2sem),
      };
      return out;
    });
}
