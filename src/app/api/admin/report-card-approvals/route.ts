import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/lib/server-auth";
import type { ReportCardTrack } from "@/app/api/admin/report-card-import/route";

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(name: string, n = 2): string[] {
  return normalizeName(name).split(" ").slice(0, n);
}

function tableFor(track: ReportCardTrack) {
  return track === "etec" ? "report_card_entries" : "report_card_entries_enem";
}

export type SuggestedMatch = {
  profileId: string | null;
  profileName: string | null;
  confidence: "high" | "low" | "none";
};

export type PendingEntry = {
  id: string;
  track: ReportCardTrack;
  full_name: string;
  sala: string | null;
  turno: string | null;
  colegio: string | null;
  semester: number;
  payload: Record<string, unknown>;
  imported_at: string;
  created_by_name: string | null;
  suggested_match: SuggestedMatch;
  suggested_has_report: boolean; // o aluno sugerido já tem boletim deste track+semestre?
};

// GET /api/admin/report-card-approvals → fila report_card_pending (status='pending')
// com sugestão de aluno por casamento de nome.
export async function GET() {
  const caller = await requireAdminUser();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const supabase = serviceClient();

  const [
    { data: pending, error: pendingErr },
    { data: students, error: studentsErr },
    { data: etecDone },
    { data: enemDone },
  ] = await Promise.all([
    supabase
      .from("report_card_pending")
      .select("id, track, full_name, sala, turno, colegio, semester, payload, created_at, created_by")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, name").eq("role", "student"),
    supabase.from("report_card_entries").select("student_id, semester"),
    supabase.from("report_card_entries_enem").select("student_id, semester"),
  ]);

  if (pendingErr) return NextResponse.json({ error: pendingErr.message }, { status: 500 });
  if (studentsErr) return NextResponse.json({ error: studentsErr.message }, { status: 500 });

  // Chaves "aluno já tem boletim publicado" por track+semestre (mesma tabela usada na aprovação).
  const existingKeys = new Set<string>();
  (etecDone || []).forEach((r: any) => existingKeys.add(`etec:${r.student_id}:${r.semester}`));
  (enemDone || []).forEach((r: any) => existingKeys.add(`enem:${r.student_id}:${r.semester}`));

  const studentList = (students || []).map((p) => ({ id: p.id, name: p.name ?? "", norm: normalizeName(p.name ?? "") }));

  const importerIds = Array.from(new Set((pending || []).map((p) => p.created_by).filter(Boolean) as string[]));
  const { data: importers } = importerIds.length
    ? await supabase.from("profiles").select("id, name").in("id", importerIds)
    : { data: [] };
  const importerMap = new Map((importers || []).map((p) => [p.id, p.name]));

  const entries: PendingEntry[] = (pending || []).map((row) => {
    const normRow = normalizeName(row.full_name);
    const tokens = nameTokens(row.full_name, 2);

    let match: SuggestedMatch = { profileId: null, profileName: null, confidence: "none" };
    const exact = studentList.find((s) => s.norm === normRow);
    if (exact) {
      match = { profileId: exact.id, profileName: exact.name, confidence: "high" };
    } else {
      const partial = studentList.filter((s) => tokens.every((t) => s.norm.includes(t)));
      if (partial.length === 1) {
        match = { profileId: partial[0].id, profileName: partial[0].name, confidence: "high" };
      } else if (partial.length > 1) {
        const allTokens = normRow.split(" ");
        const scored = partial
          .map((s) => ({ ...s, hits: allTokens.filter((t) => s.norm.includes(t)).length }))
          .sort((a, b) => b.hits - a.hits);
        match = { profileId: scored[0].id, profileName: scored[0].name, confidence: "low" };
      }
    }

    return {
      id: row.id,
      track: row.track,
      full_name: row.full_name,
      sala: row.sala,
      turno: row.turno,
      colegio: row.colegio,
      semester: row.semester,
      payload: row.payload || {},
      imported_at: row.created_at,
      created_by_name: row.created_by ? importerMap.get(row.created_by) || null : null,
      suggested_match: match,
      suggested_has_report: !!match.profileId && existingKeys.has(`${row.track}:${match.profileId}:${row.semester}`),
    };
  });

  return NextResponse.json({
    entries,
    students: studentList.map(({ id, name }) => ({ id, name })),
    existing_report_keys: Array.from(existingKeys),
  });
}

// POST { action: 'approve', id, student_id } | { action: 'reject', id, reason? }
export async function POST(req: NextRequest) {
  const caller = await requireAdminUser();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { action, id, student_id, reason } = await req.json();
  if (!id) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const supabase = serviceClient();

  if (action === "reject") {
    const { error } = await supabase
      .from("report_card_pending")
      .update({ status: "rejected", resolved_by: caller.id, resolved_at: new Date().toISOString(), rejection_reason: reason ?? null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "approve") {
    if (!student_id) return NextResponse.json({ error: "Selecione um aluno para aprovar." }, { status: 400 });

    const { data: pendingRow, error: fetchErr } = await supabase
      .from("report_card_pending")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !pendingRow) return NextResponse.json({ error: fetchErr?.message || "Registro não encontrado" }, { status: 404 });

    const track = pendingRow.track as ReportCardTrack;
    const table = tableFor(track);
    const payload = (pendingRow.payload || {}) as Record<string, unknown>;

    const basePayload: Record<string, unknown> = {
      student_id,
      semester: pendingRow.semester,
      colegio: pendingRow.colegio,
      sala: pendingRow.sala,
      turno: pendingRow.turno,
      classificatoria_score: payload.classificatoria_score ?? null,
      classificatoria_max: payload.classificatoria_max ?? null,
      redacao_score: payload.redacao_score ?? null,
      redacao_max: payload.redacao_max ?? null,
      absences_1sem: payload.absences_1sem ?? null,
      absences_2sem: payload.absences_2sem ?? null,
    };

    if (track === "etec") {
      basePayload.track = payload.redacao_score != null ? "enem" : "etec";
      basePayload.simulado_score = payload.simulado_score ?? null;
      basePayload.simulado_max = payload.simulado_max ?? null;
    } else {
      basePayload.simulado_1_score = payload.simulado_1_score ?? null;
      basePayload.simulado_2_score = payload.simulado_2_score ?? null;
      basePayload.simulado_3_score = payload.simulado_3_score ?? null;
      basePayload.simulado_max = payload.simulado_max ?? null;
      basePayload.lingua_portuguesa = payload.lingua_portuguesa ?? null;
      basePayload.matematica = payload.matematica ?? null;
      basePayload.historia = payload.historia ?? null;
      basePayload.geografia = payload.geografia ?? null;
      basePayload.biologia = payload.biologia ?? null;
      basePayload.quimica = payload.quimica ?? null;
      basePayload.fisica = payload.fisica ?? null;
      basePayload.filosofia = payload.filosofia ?? null;
      basePayload.sociologia = payload.sociologia ?? null;
      basePayload.ingles = payload.ingles ?? null;
      basePayload.early_departures_1sem = payload.early_departures_1sem ?? null;
      basePayload.early_departures_2sem = payload.early_departures_2sem ?? null;
    }

    const { data: existing, error: findErr } = await supabase
      .from(table)
      .select("id")
      .eq("student_id", student_id)
      .eq("semester", pendingRow.semester)
      .maybeSingle();
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });

    const writeErr = existing
      ? (await supabase.from(table).update(basePayload).eq("id", existing.id)).error
      : (await supabase.from(table).insert(basePayload)).error;
    if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });

    const { error: resolveErr } = await supabase
      .from("report_card_pending")
      .update({ status: "approved", resolved_student_id: student_id, resolved_by: caller.id, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (resolveErr) return NextResponse.json({ error: resolveErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
