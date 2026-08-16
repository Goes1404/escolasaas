"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Crown,
  Medal,
  Clock,
  Loader2,
  AlertTriangle,
  Search,
  Users,
  FileDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

type ExamRanking = {
  examId: string;
  title: string;
  examType: string;
  year: number | null;
  isTri: boolean;
  lastActivity: string;
  students: RankedStudent[];
};

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

function positionStyle(index: number) {
  if (index === 0) return { ring: "border-amber-300 bg-amber-50", badge: "bg-amber-400 text-white", icon: Crown };
  if (index === 1) return { ring: "border-slate-300 bg-slate-50", badge: "bg-slate-400 text-white", icon: Medal };
  if (index === 2) return { ring: "border-orange-300 bg-orange-50", badge: "bg-orange-400 text-white", icon: Medal };
  return { ring: "border-slate-100 bg-white", badge: "bg-slate-200 text-slate-600", icon: null };
}

export default function ExamRankingPanel() {
  const [exams, setExams] = useState<ExamRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/teacher/exam-ranking", { cache: "no-store" });
        if (!res.ok) throw new Error("fail");
        const data = (await res.json()) as { exams: ExamRanking[] };
        if (!active) return;
        const list = data.exams ?? [];
        setExams(list);
        setSelectedExamId(list[0]?.examId ?? null);
      } catch {
        if (active) setError("Não foi possível carregar o ranking. Tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(
    () => exams.find((e) => e.examId === selectedExamId) ?? null,
    [exams, selectedExamId]
  );

  const filteredStudents = useMemo(() => {
    if (!selected) return [];
    const q = query.trim().toLowerCase();
    if (!q) return selected.students;
    return selected.students.filter((s) => s.name.toLowerCase().includes(q));
  }, [selected, query]);

  // Exporta o ranking da prova selecionada como um PDF de verdade (download
  // direto). Antes usávamos a impressão do navegador via iframe oculto, mas o
  // Chrome mostrava o preview correto e salvava o arquivo em branco. jsPDF é
  // carregado sob demanda para não pesar o bundle inicial.
  const handleExportPdf = async () => {
    if (!selected || exporting) return;
    setExporting(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;

      // Cabeçalho
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(217, 119, 6);
      doc.text("RANKING POR PROVA  ·  PLATAFORMA", margin, 46);

      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text(doc.splitTextToSize(selected.title, pageWidth - margin * 2), margin, 68);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      const info = [
        selected.examType || null,
        selected.year ? String(selected.year) : null,
        `${selected.students.length} aluno(s)`,
        `ordenado por ${selected.isTri ? "nota TRI" : "acertos"}`,
      ]
        .filter(Boolean)
        .join("  ·  ");
      doc.text(info, margin, 86);

      const head = [
        ["#", "Aluno", "Acertos", "%", ...(selected.isTri ? ["Nota TRI"] : []), "Tempo", "Tent."],
      ];
      const body = selected.students.map((s, i) => [
        `${i + 1}º`,
        s.name + (s.forfeited ? "  (saiu da prova)" : ""),
        s.total > 0 ? `${s.score}/${s.total}` : `${s.score} pts`,
        s.total > 0 ? `${s.pct}%` : "-",
        ...(selected.isTri ? [s.tri !== null ? String(s.tri) : "-"] : []),
        formatDuration(s.durationSeconds) ?? "-",
        String(s.attempts),
      ]);

      autoTable(doc, {
        head,
        body,
        startY: 100,
        margin: { left: margin, right: margin, bottom: 46 },
        styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: [15, 23, 42], lineColor: [226, 232, 240], lineWidth: 0.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 34, halign: "center", fontStyle: "bold" },
          1: { fontStyle: "bold" },
        },
        didParseCell: (data) => {
          // Destaca a nota TRI e o pódio.
          if (data.section === "body") {
            if (selected.isTri && data.column.index === 4) {
              data.cell.styles.textColor = [194, 65, 12];
              data.cell.styles.fontStyle = "bold";
            }
            if (data.column.index === 0 && data.row.index < 3) {
              data.cell.styles.textColor = [180, 83, 9];
            }
          }
        },
        didDrawPage: () => {
          const page = doc.getCurrentPageInfo().pageNumber;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Gerado em ${new Date().toLocaleString("pt-BR")}`,
            margin,
            doc.internal.pageSize.getHeight() - 24
          );
          doc.text(
            `Pagina ${page}`,
            pageWidth - margin,
            doc.internal.pageSize.getHeight() - 24,
            { align: "right" }
          );
        },
      });

      const slug = selected.title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      doc.save(`ranking-${slug || "prova"}.pdf`);
    } catch {
      toast({ title: "Erro ao gerar PDF", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-500" />
        <p className="text-sm font-semibold text-red-600">{error}</p>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
        <Trophy className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">
          Nenhuma prova com tentativas de alunos ainda. Assim que os alunos realizarem as provas, o ranking aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl">
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(ellipse at 100% 0%, rgba(245,158,11,0.5) 0%, transparent 55%)" }} />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
            <Trophy className="h-3 w-3" />
            Ranking por prova
          </span>
          <h1 className="mt-3 text-2xl font-black italic tracking-tighter md:text-3xl">Quem tirou a maior nota</h1>
          <p className="mt-1 text-sm font-semibold text-white/60">
            Classificação dos alunos em cada prova, pela melhor tentativa de cada um.
          </p>
        </div>
      </div>

      {/* Seletor de prova */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {exams.map((e) => {
          const isActive = e.examId === selectedExamId;
          return (
            <button
              key={e.examId}
              onClick={() => setSelectedExamId(e.examId)}
              className={`shrink-0 rounded-2xl border px-4 py-2.5 text-left transition-all ${
                isActive
                  ? "border-slate-950 bg-slate-950 text-white shadow-md"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <p className="max-w-[200px] truncate text-xs font-black italic">{e.title}</p>
              <p className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? "text-white/60" : "text-slate-400"}`}>
                {e.students.length} aluno{e.students.length !== 1 ? "s" : ""}
                {e.year ? ` · ${e.year}` : ""}
              </p>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-md sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black italic text-slate-900">{selected.title}</h2>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Users className="h-3.5 w-3.5" />
                {selected.students.length} aluno{selected.students.length !== 1 ? "s" : ""} · ordenado por{" "}
                {selected.isTri ? "nota TRI" : "acertos"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar aluno..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exporting}
                title="Baixar este ranking em PDF"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-black text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-60"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                <span className="hidden sm:inline">{exporting ? "Gerando..." : "Baixar PDF"}</span>
                <span className="sm:hidden">PDF</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {filteredStudents.map((s, i) => {
              // i é a posição na lista filtrada; a posição real usa o índice
              // original quando não há busca.
              const realIndex = query.trim() ? selected.students.indexOf(s) : i;
              const st = positionStyle(realIndex);
              const Icon = st.icon;
              const dur = formatDuration(s.durationSeconds);
              return (
                <div
                  key={s.userId}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${st.ring}`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${st.badge}`}>
                    {Icon ? <Icon className="h-4 w-4" /> : realIndex + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">
                      {realIndex + 1}. {s.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold text-slate-400">
                      <span>
                        {s.total > 0 ? `${s.score}/${s.total} acertos · ${s.pct}%` : `${s.score} pts`}
                      </span>
                      {dur && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {dur}
                        </span>
                      )}
                      {s.attempts > 1 && <span>{s.attempts} tentativas</span>}
                      {s.forfeited && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-red-500">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          saiu da prova
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {s.tri !== null ? (
                      <>
                        <p className="text-lg font-black italic tabular-nums text-slate-950 leading-none">{s.tri}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-orange-500">nota TRI</p>
                      </>
                    ) : s.total > 0 ? (
                      <>
                        <p className="text-lg font-black italic tabular-nums text-slate-950 leading-none">{s.pct}%</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">aproveitamento</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-black italic tabular-nums text-slate-950 leading-none">{s.score}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">pontos</p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredStudents.length === 0 && (
              <p className="py-8 text-center text-sm font-semibold text-slate-400">Nenhum aluno encontrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
