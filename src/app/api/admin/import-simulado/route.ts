import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/lib/server-auth";

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

// Normaliza nome para matching: lowercase, sem acentos, colapsa espaços
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Retorna os primeiros N tokens do nome (ex: "Maria Eduarda Polito" → ["maria","eduarda"])
function nameTokens(name: string, n = 2): string[] {
  return normalizeName(name).split(" ").slice(0, n);
}

export type ImportRow = {
  name: string;
  institution: string;
  sala: string;
  nota: number;
};

export type MatchResult = {
  row: ImportRow;
  profileId: string | null;
  profileName: string | null;
  confidence: "high" | "low" | "none";
};

export type PreviewResponse = {
  matches: MatchResult[];
  examId: string;
};

export type ApplyResponse = {
  updated: number;
  skipped: number;
  errors: string[];
};

// ── GET /api/admin/import-simulado?action=exam-id  ────────────────────────────
// Retorna o exam_id do Simulado ENEM 2026 (cria se não existir)
async function ensureExam(
  supabase: ReturnType<typeof serviceClient>,
  title: string,
  year: number
): Promise<string> {
  const { data: existing } = await supabase
    .from("exams")
    .select("id")
    .eq("title", title)
    .eq("year", year)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("exams")
    .insert({ title, year, exam_type: "simulado_importado" })
    .select("id")
    .single();

  if (error) throw new Error(`Erro ao criar exame: ${error.message}`);
  return created.id;
}

// ── POST ?action=preview ───────────────────────────────────────────────────────
async function handlePreview(rows: ImportRow[], supabase: ReturnType<typeof serviceClient>): Promise<Response> {
  const examId = await ensureExam(supabase, "Simulado ENEM 2026", 2026);

  // Fetch todos os alunos de uma vez (evita N queries)
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("role", "student");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profileList: { id: string; name: string; norm: string }[] =
    (profiles || []).map((p) => ({
      id: p.id,
      name: p.name ?? "",
      norm: normalizeName(p.name ?? ""),
    }));

  const matches: MatchResult[] = rows.map((row) => {
    const normRow = normalizeName(row.name);
    const tokens = nameTokens(row.name, 2);

    // Primeiro tenta match exato normalizado
    const exact = profileList.find((p) => p.norm === normRow);
    if (exact) {
      return { row, profileId: exact.id, profileName: exact.name, confidence: "high" };
    }

    // Depois tenta match por primeiros 2 tokens (nome + sobrenome)
    const partial = profileList.filter((p) =>
      tokens.every((t) => p.norm.includes(t))
    );

    if (partial.length === 1) {
      return { row, profileId: partial[0].id, profileName: partial[0].name, confidence: "high" };
    }
    if (partial.length > 1) {
      // Múltiplos candidatos — pega o mais parecido (mais tokens em comum)
      const scored = partial.map((p) => {
        const allTokens = normalizeName(row.name).split(" ");
        const hits = allTokens.filter((t) => p.norm.includes(t)).length;
        return { ...p, hits };
      }).sort((a, b) => b.hits - a.hits);
      return { row, profileId: scored[0].id, profileName: scored[0].name, confidence: "low" };
    }

    return { row, profileId: null, profileName: null, confidence: "none" };
  });

  return NextResponse.json({ matches, examId } satisfies PreviewResponse);
}

// ── POST ?action=apply ─────────────────────────────────────────────────────────
async function handleApply(
  matches: MatchResult[],
  examId: string,
  supabase: ReturnType<typeof serviceClient>
): Promise<Response> {
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  const valid = matches.filter((m) => m.profileId && m.confidence !== "none");

  for (const m of valid) {
    const { row, profileId } = m;

    // 1. Atualizar institution e sala no perfil
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        institution: row.institution.trim(),
        sala: String(row.sala).trim(),
      })
      .eq("id", profileId!);

    if (profileErr) {
      errors.push(`${row.name}: erro ao atualizar perfil — ${profileErr.message}`);
      skipped++;
      continue;
    }

    // 2. Upsert exam_attempt (evita duplicatas)
    const { error: attemptErr } = await supabase
      .from("exam_attempts")
      .upsert(
        {
          user_id: profileId!,
          exam_id: examId,
          score: row.nota,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,exam_id", ignoreDuplicates: false }
      );

    if (attemptErr) {
      errors.push(`${row.name}: erro ao salvar resultado — ${attemptErr.message}`);
      skipped++;
      continue;
    }

    updated++;
  }

  skipped += matches.filter((m) => !m.profileId).length;

  return NextResponse.json({ updated, skipped, errors } satisfies ApplyResponse);
}

// ── Entry point ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const caller = await requireAdminUser();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const supabase = serviceClient();
  const { action, rows, matches, examId } = await req.json();

  if (action === "preview") {
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha enviada" }, { status: 400 });
    }
    return handlePreview(rows as ImportRow[], supabase);
  }

  if (action === "apply") {
    if (!Array.isArray(matches) || !examId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return handleApply(matches as MatchResult[], examId as string, supabase);
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
