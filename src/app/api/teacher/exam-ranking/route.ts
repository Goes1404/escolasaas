import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireTeacherOrAdmin } from "@/lib/server-auth";

// Ranking de alunos por prova (professor/admin). Passa por sessão + papel
// (requireTeacherOrAdmin) porque exam_attempts tem RLS de dono — o service
// role é necessário para agregar as tentativas de todos os alunos.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

type AttemptRow = {
  user_id: string;
  exam_id: string;
  score: number | null;
  total_questions: number | null;
  tri_score: number | null;
  duration_seconds: number | null;
  completed_at: string;
  forfeited: boolean | null;
  attempt_number: number | null;
  source: string | null;
  exams: { title: string | null; exam_type: string | null; year: number | null; tri_score_calculated: boolean | null } | null;
};

type RankedStudent = {
  userId: string;
  name: string;
  score: number;
  total: number;
  pct: number;
  tri: number | null;
  durationSeconds: number | null;
  date: string;
  forfeited: boolean;
  attempts: number;
};

// Métrica de ordenação: nota TRI quando existir, senão nº de acertos; desempata
// pela % de acerto e depois pela conclusão mais rápida.
function isBetter(a: AttemptRow, b: AttemptRow): boolean {
  const at = a.tri_score ?? -1;
  const bt = b.tri_score ?? -1;
  if (at !== bt) return at > bt;
  const as = a.score ?? 0;
  const bs = b.score ?? 0;
  if (as !== bs) return as > bs;
  return new Date(a.completed_at).getTime() < new Date(b.completed_at).getTime();
}

export async function GET() {
  const user = await requireTeacherOrAdmin();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const db = admin();

  // Sem a coluna answers (pesada) — só o necessário para ranquear.
  const { data: attempts, error } = await db
    .from("exam_attempts")
    .select(
      "user_id, exam_id, score, total_questions, tri_score, duration_seconds, completed_at, forfeited, attempt_number, source, exams!inner(title, exam_type, year, tri_score_calculated)"
    )
    .order("completed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Falha ao carregar tentativas." }, { status: 500 });
  }

  const rows = (attempts ?? []) as unknown as AttemptRow[];

  // Nomes dos alunos envolvidos.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const namesById: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await db.from("profiles").select("id, name, full_name").in("id", userIds);
    (profiles ?? []).forEach((p: { id: string; name: string | null; full_name: string | null }) => {
      namesById[p.id] = p.name || p.full_name || "Aluno";
    });
  }

  // Agrupa por prova e, dentro dela, guarda a melhor tentativa de cada aluno.
  type ExamGroup = {
    examId: string;
    title: string;
    examType: string;
    year: number | null;
    isTri: boolean;
    lastActivity: string;
    best: Record<string, AttemptRow>;
    countByUser: Record<string, number>;
  };
  const groups: Record<string, ExamGroup> = {};

  // Tamanho "cheio" de cada prova = maior total_questions visto. Tentativas
  // parciais (aluno entregou com poucas questões, ou registros de teste) não
  // devem competir no ranking — exigimos ao menos 60% do tamanho cheio.
  const fullLen: Record<string, number> = {};
  for (const r of rows) {
    const t = r.total_questions ?? 0;
    if (t > (fullLen[r.exam_id] ?? 0)) fullLen[r.exam_id] = t;
  }
  const isFullEnough = (r: AttemptRow) => {
    const full = fullLen[r.exam_id] ?? 0;
    // Provas sem tamanho registrado (ex.: simulados importados só com a nota,
    // total_questions = 0) não têm como medir "parcial" — entram todas.
    if (full <= 0) return true;
    const t = r.total_questions ?? 0;
    return t >= full * 0.6;
  };

  for (const r of rows) {
    if (!isFullEnough(r)) continue;
    const g = (groups[r.exam_id] ??= {
      examId: r.exam_id,
      title: r.exams?.title ?? "Prova",
      examType: r.exams?.exam_type ?? "",
      year: r.exams?.year ?? null,
      isTri: !!(r.exams?.tri_score_calculated || (r.exams?.exam_type ?? "").toLowerCase() === "enem"),
      lastActivity: r.completed_at,
      best: {},
      countByUser: {},
    });
    if (new Date(r.completed_at) > new Date(g.lastActivity)) g.lastActivity = r.completed_at;
    g.countByUser[r.user_id] = (g.countByUser[r.user_id] ?? 0) + 1;
    const cur = g.best[r.user_id];
    if (!cur || isBetter(r, cur)) g.best[r.user_id] = r;
  }

  const exams = Object.values(groups)
    .map((g) => {
      const ranked: RankedStudent[] = Object.values(g.best)
        .map((r) => {
          const total = r.total_questions ?? 0;
          return {
            userId: r.user_id,
            name: namesById[r.user_id] ?? "Aluno",
            score: r.score ?? 0,
            total,
            pct: total > 0 ? Math.round(((r.score ?? 0) / total) * 100) : 0,
            tri: r.tri_score ?? null,
            durationSeconds: r.duration_seconds ?? null,
            date: r.completed_at,
            forfeited: !!r.forfeited,
            attempts: g.countByUser[r.user_id] ?? 1,
          };
        })
        .sort((a, b) => {
          if (a.tri !== null && b.tri !== null && a.tri !== b.tri) return b.tri - a.tri;
          if (a.tri !== null && b.tri === null) return -1;
          if (a.tri === null && b.tri !== null) return 1;
          if (a.score !== b.score) return b.score - a.score;
          return b.pct - a.pct;
        });

      return {
        examId: g.examId,
        title: g.title,
        examType: g.examType,
        year: g.year,
        isTri: g.isTri,
        lastActivity: g.lastActivity,
        students: ranked,
      };
    })
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

  return NextResponse.json({ exams });
}
