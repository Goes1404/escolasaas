import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/lib/server-auth";

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export type ReportCardTrack = "enem" | "etec";

export type ReportCardImportRow = {
  full_name: string;
  colegio: string | null;
  sala: string | null;
  turno: string | null;
  classificatoria_score: number | null;
  classificatoria_max: number | null;
  redacao_score: number | null;
  redacao_max: number | null;
  simulado_score: number | null;
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
  absences_1sem: number | null;
  absences_2sem: number | null;
  early_departures_1sem: number | null;
  early_departures_2sem: number | null;
};

export type ReportCardImportResponse = { inserted: number; errors: string[] };

// POST /api/admin/report-card-import  { rows, track, semester }
// Cria registros pendentes em report_card_pending (mesma tabela/fluxo
// já usado pelas 182 importações anteriores). O casamento nome->aluno
// e a publicação no boletim final acontecem na tela de aprovação.
export async function POST(req: NextRequest) {
  const caller = await requireAdminUser();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { rows, track, semester } = await req.json();

  if (track !== "enem" && track !== "etec") {
    return NextResponse.json({ error: "Track inválido" }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Nenhuma linha enviada" }, { status: 400 });
  }
  if (!Number.isInteger(semester) || (semester !== 1 && semester !== 2)) {
    return NextResponse.json({ error: "Semestre inválido" }, { status: 400 });
  }

  const supabase = serviceClient();
  const typedRows = rows as ReportCardImportRow[];
  const errors: string[] = [];

  const payloadRows = typedRows
    .filter((row) => {
      if (!row.full_name?.trim()) {
        errors.push("Linha ignorada: sem nome de aluno.");
        return false;
      }
      return true;
    })
    .map((row) => ({
      track,
      full_name: row.full_name.trim(),
      sala: row.sala,
      turno: row.turno,
      colegio: row.colegio,
      semester,
      status: "pending",
      created_by: caller.id,
      payload: { ...row, semester },
    }));

  if (payloadRows.length === 0) {
    return NextResponse.json({ inserted: 0, errors } satisfies ReportCardImportResponse);
  }

  const { error } = await supabase.from("report_card_pending").insert(payloadRows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: payloadRows.length, errors } satisfies ReportCardImportResponse);
}
