"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Sparkles,
  BookOpen,
  Loader2,
  TrendingUp,
  ChevronRight,
  ArrowRight,
  PenTool,
  AlertCircle,
  Lightbulb,
  Target,
  Link as LinkIcon,
  Zap,
  History,
  ShieldCheck,
  Star,
  FileSearch,
  MessageSquareQuote,
  Calendar,
  CheckSquare2,
  Square,
  Camera,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { trackMissionProgress } from "@/lib/missions";
import { EssayHighlightedText, BancaMirror, AnulacaoAviso } from "@/components/EssayMirror";
import { trackAcao, trackFalha } from "@/lib/telemetry";
import { medir, TempoEsgotado } from "@/lib/perf";

const EssayChart = dynamic(
  () =>
    import("recharts").then(({ AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer }) => {
      function Chart({ data }: { data: { date: string; score: number; theme?: string }[] }) {
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorScoreEssay" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb923c" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.4)" />
              <XAxis dataKey="date" stroke="rgba(100,116,139,0.5)" fontSize={10} tickLine={false} axisLine={false} dy={6} />
              <YAxis stroke="rgba(100,116,139,0.5)" fontSize={10} tickLine={false} axisLine={false} domain={[0, 1000]} />
              <Tooltip
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-lg flex flex-col gap-1 max-w-[200px]">
                      <p className="font-bold text-slate-500 text-[10px]">{label}</p>
                      <p className="font-black text-orange-500 text-lg">{payload[0].value} pts</p>
                      {payload[0].payload.theme && (
                        <p className="text-[9px] font-bold text-slate-500 leading-tight italic line-clamp-3 mt-1">
                          "{payload[0].payload.theme}"
                        </p>
                      )}
                    </div>
                  ) : null
                }
              />
              <Area type="monotone" dataKey="score" stroke="#fb923c" strokeWidth={2.5} fillOpacity={1} fill="url(#colorScoreEssay)" />
            </AreaChart>
          </ResponsiveContainer>
        );
      }
      return { default: Chart };
    }),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-2xl" />,
  }
);

const COMPETENCY_LABELS: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  c1: { label: "C1: Norma Culta", icon: PenTool, color: "text-blue-600", bg: "bg-blue-100 border-blue-200" },
  c2: { label: "C2: Estrutura", icon: FileSearch, color: "text-purple-600", bg: "bg-purple-100 border-purple-200" },
  c3: { label: "C3: Argumentação", icon: Target, color: "text-orange-500", bg: "bg-orange-100 border-orange-200" },
  c4: { label: "C4: Coesão", icon: LinkIcon, color: "text-cyan-600", bg: "bg-cyan-100 border-cyan-200" },
  c5: { label: "C5: Intervenção", icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-100 border-emerald-200" },
};

type FullEntry = {
  id: string;
  theme: string;
  content: string;
  score: number | null;
  feedback: string | null;
  result_data: any;
  created_at: string;
};

function scoreColor(score: number | null) {
  if (!score) return { badge: "bg-slate-100 text-slate-500", ring: "#94a3b8" };
  if (score >= 800) return { badge: "bg-emerald-100 text-emerald-700", ring: "#10b981" };
  if (score >= 600) return { badge: "bg-blue-100 text-blue-700", ring: "#3b82f6" };
  if (score >= 400) return { badge: "bg-amber-100 text-amber-700", ring: "#f59e0b" };
  return { badge: "bg-red-100 text-red-700", ring: "#ef4444" };
}

export default function StudentEssayPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  // ⚠️ O tema COMEÇA VAZIO, de propósito.
  //
  // Antes ele vinha pré-preenchido com "Os impactos da Inteligência Artificial
  // na educação brasileira contemporânea". Como o tema é o critério de fuga
  // ao tema, quem abrisse a tela e escrevesse sobre outro assunto — inclusive
  // quem fotografava uma redação feita no papel — era anulado por não atender
  // a um tema que nunca escolheu. Foi o que aconteceu com 2 das 3 redações
  // reais já enviadas: as duas gravadas com este tema exato, sobre outro
  // assunto, e zeradas por fuga.
  const [theme, setTheme] = useState("");
  const [supportingTexts, setSupportingTexts] = useState<any[]>([]);
  const [customTheme, setCustomTheme] = useState(false);
  const [text, setText] = useState("");
  const [loadingTopic, setLoadingTopic] = useState(false);
  const [loadingGrading, setLoadingGrading] = useState(false);
  const [loadingOcr, setLoadingOcr] = useState(false);
  // Sinaliza que o texto atual veio (ao menos em parte) de transcrição por foto,
  // para a IA não punir C1 por ruído de OCR.
  const [fromPhoto, setFromPhoto] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [charCount, setCharCount] = useState(0);
  const [chartData, setChartData] = useState<{ date: string; score: number; theme?: string }[]>([]);
  const [fullHistory, setFullHistory] = useState<FullEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<FullEntry | null>(null);
  const [weeklyTheme, setWeeklyTheme] = useState<{ title: string; description: string | null; source: string | null } | null>(null);
  const [checklist, setChecklist] = useState({
    hasIntro: false,
    hasDev:   false,
    hasConclusion: false,
    hasMinLines: false,
  });

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("essay_submissions")
        .select("id, theme, content, score, feedback, result_data, created_at")
        .eq("user_id", user.id)
        .not("score", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const entries = (data || []) as FullEntry[];
      setFullHistory(entries);

      // Build chart data (ascending order)
      const sorted = [...entries].reverse();
      if (sorted.length > 0) {
        if (sorted.length === 1) {
          setChartData([
            { date: "Início", score: 0, theme: "" },
            { date: format(new Date(sorted[0].created_at), "dd/MM"), score: Number(sorted[0].score), theme: sorted[0].theme },
          ]);
        } else {
          setChartData(
            sorted.map((d) => ({
              date: format(new Date(d.created_at), "dd/MM"),
              score: Number(d.score),
              theme: d.theme,
            }))
          );
        }
      } else {
        setChartData([]);
      }
    } catch (e) {
      console.error("Erro ao buscar histórico de redações:", e);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setCharCount(text.length);
  }, [text]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Buscar tema da semana
  useEffect(() => {
    const fetchWeeklyTheme = async () => {
      try {
        const weekStart = (() => {
          const d = new Date();
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const mon = new Date(d);
          mon.setDate(diff);
          return mon.toISOString().slice(0, 10);
        })();
        const rawTarget = (profile?.exam_target || 'enem').toLowerCase();
        const audience  = rawTarget.includes('etec') ? 'etec' : 'enem';
        const { data } = await supabase
          .from('essay_weekly_themes')
          .select('title, description, source')
          .eq('week_start', weekStart)
          .or(`target.eq.all,target.eq.${audience}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setWeeklyTheme(data);
          // Aplica o tema da semana quando o aluno ainda não escolheu nenhum.
          // Antes o card mostrava o tema em destaque mas só o aplicava se o
          // aluno clicasse em "Usar este tema" — quem lia o tema ali e escrevia
          // sobre ele era corrigido contra outro tema, e anulado por fuga.
          setTheme(atual => (atual.trim() ? atual : data.title));
        }
      } catch (e) {
        // Sem o tema da semana o aluno precisa gerar ou digitar um tema. Não
        // quebra a tela, mas remove o caminho mais curto para escrever — e a
        // tela fica exigindo uma escolha que ele não sabe que precisa fazer.
        trackFalha('tema_da_semana_falhou', e);
      }
    };
    fetchWeeklyTheme();
  }, [profile]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reenviar o mesmo arquivo
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Envie uma foto (JPEG, PNG ou WEBP).", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Use uma foto de até 8MB.", variant: "destructive" });
      return;
    }

    setLoadingOcr(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
      });

      // Era um Promise.race escrito à mão; passa pelo helper para o tempo
      // gasto também virar telemetria — a transcrição de foto é a operação
      // mais pesada da tela depois da própria correção.
      const res = await medir(
        "ocr_redacao",
        () => fetch("/api/essay-ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        }),
        { timeoutMs: 60_000, limiarLentoMs: 20_000 },
      );

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Falha ao digitalizar a imagem.");

      setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${data.text}` : data.text));
      setFromPhoto(true);

      // Quem fotografa já escreveu a redação no papel, sobre um tema que a
      // plataforma não conhece. Sem perguntar, a correção usaria o tema que
      // estivesse na tela e anularia o texto por fuga — foi assim que uma
      // redação de 2.652 caracteres tirou zero.
      if (!theme.trim()) {
        setCustomTheme(true);
        toast({
          title: "Redação digitalizada! 📸",
          description: "Agora escreva o tema da proposta que você respondeu — sem ele, a correção não tem como avaliar fuga ao tema.",
        });
      } else {
        toast({
          title: "Redação digitalizada! 📸",
          description: `Revise o texto e confirme o tema: "${theme}".`,
        });
      }
    } catch (err: any) {
      trackFalha("redacao_falha_ocr", err);
      toast({ title: "Erro ao digitalizar", description: err.message, variant: "destructive" });
    } finally {
      setLoadingOcr(false);
    }
  };

  const handleGenerateTopic = async () => {
    setLoadingTopic(true);
    setResult(null);
    setCustomTheme(false);
    try {
      const res = await medir(
        "gerar_tema",
        () => fetch("/api/essay-theme", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
        { timeoutMs: 30_000 },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setTheme(data.result.title);
        setSupportingTexts(data.result.supporting_texts || []);
        toast({ title: "Proposta ENEM Gerada!", description: "A Aurora carregou os textos motivadores." });
      } else {
        throw new Error(data.error || "IA falhou");
      }
    } catch {
      const etecThemes = [
        {
          theme: "A importância da qualificação técnica profissional para a juventude no mercado atual",
          texts: [
            { id: 1, content: "Os cursos técnicos favorecem o contato com a prática profissional e aceleram a empregabilidade.", source: "Censo Inep" },
            { id: 2, content: "A demanda por profissionais de tecnologia e indústria se mantém alta no interior paulista.", source: "Guia do Estudante" },
          ],
        },
        {
          theme: "O papel do jovem na construção de mobilidade urbana sustentável nas grandes cidades",
          texts: [{ id: 1, content: "O planejamento urbano frequentemente negligencia o transporte coletivo sustentável.", source: "Mobilize Brasil" }],
        },
      ];
      const enemThemes = [
        {
          theme: "O desafio de democratizar o acesso à tecnologia e informação no Brasil",
          texts: [
            { id: 1, content: "O acesso à internet no Brasil ainda é desigual, afetando principalmente as áreas rurais e as classes D e E.", source: "TIC Domicílios" },
            { id: 2, content: "A educação mediada pela tecnologia exige infraestrutura e capacitação docente contínua.", source: "Portal Educação" },
          ],
        },
        {
          theme: "Caminhos para combater a insegurança alimentar no Brasil contemporâneo",
          texts: [{ id: 1, content: "O desperdício na cadeia logística de alimentos agrava as crises sociais.", source: "ONU Brasil" }],
        },
      ];
      const audience = (profile?.exam_target || user?.user_metadata?.exam_target || profile?.profile_type || "enem").toLowerCase().trim();
      const isEtec = audience.includes("etec");
      const pool = isEtec ? etecThemes : enemThemes;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      toast({ title: "Banco de Apoio", description: `Tema padrão ${isEtec ? "ETEC" : "ENEM"}` });
      setTheme(pick.theme);
      setSupportingTexts(pick.texts);
    } finally {
      setLoadingTopic(false);
    }
  };

  const handleSubmitEssay = async () => {
    // Antes o envio era bloqueado abaixo de 100 caracteres com um toast seco.
    // Agora o piso é só para não mandar texto vazio: entre isso e as 7 linhas
    // do INEP, a correção devolve a explicação de "texto insuficiente" — que
    // ensina a regra em vez de apenas recusar. Esse caso não chama a IA, então
    // deixar passar não custa nada.
    if (text.trim().length < 40) {
      trackAcao("redacao_bloqueada_curta", { chars: text.trim().length });
      toast({ title: "Escreva um pouco mais", description: "Precisamos de pelo menos algumas linhas para avaliar.", variant: "destructive" });
      return;
    }

    // Sem tema não há como avaliar C2 — e corrigir contra um tema errado anula
    // a redação por fuga. Melhor barrar aqui do que devolver zero.
    if (!theme.trim()) {
      trackAcao("redacao_bloqueada_sem_tema", { chars: text.trim().length });
      toast({
        title: "Qual é o tema?",
        description: "Escolha um tema acima (ou escreva o seu em 'Tema Manual') antes de enviar. A correção usa o tema para avaliar fuga.",
        variant: "destructive",
      });
      return;
    }
    setLoadingGrading(true);
    try {
      // Medido em produção: 6-7s com os dois corretores de acordo, 18s quando
      // é preciso chamar o terceiro. A rota declara maxDuration = 60s, então
      // 75s é folga suficiente para a rede do aluno sem deixar o botão girando
      // indefinidamente se a rota travar.
      const res = await medir(
        "corrigir_redacao",
        () => fetch("/api/essay-evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme,
            text,
            supporting_texts: supportingTexts,
            origin: fromPhoto ? "ocr" : "typed",
          }),
        }),
        { timeoutMs: 75_000, limiarLentoMs: 15_000, props: { chars: text.length } },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        const aiOutput = data.result;
        setResult(aiOutput);
        if (user) {
          try {
            // Timeout curto de propósito: aqui já não há IA no caminho, é só
            // um insert. Se demorar 20s, algo está errado — e pendurar sem
            // limite reproduziria o sintoma que investigamos por dois meses:
            // o aluno vê a nota na tela e a redação nunca chega ao histórico.
            const saveRes = await medir(
              "salvar_redacao",
              () => fetch("/api/essay-save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  user_id: user.id,
                  theme,
                  content: text,
                  score: aiOutput.total_score,
                  feedback: aiOutput.general_feedback,
                  result_data: aiOutput,
                }),
              }),
              { timeoutMs: 20_000, props: { chars: text.length } },
            );
            const saveData = await saveRes.json();
            if (!saveRes.ok || !saveData.success) throw new Error(saveData.error || "Erro ao salvar");
            trackAcao("redacao_salva", { nota: aiOutput.total_score, chars: text.length });
            
            // Incrementa missão de redação
            trackMissionProgress(supabase, user.id, 'submit_essay', 1).then(() => {});

            fetchHistory();
          } catch (insertError) {
            // Este catch escondeu por dois meses que o CHECK (score <= 100)
            // barrava toda redação com nota real. Agora o erro é registrado.
            trackFalha("redacao_falha_salvar", insertError, { nota: aiOutput.total_score });
            console.error("Erro insert", insertError);
            toast({ title: "Erro na Evolução", description: "Avaliação finalizada, mas houve falha ao salvar no histórico.", variant: "destructive" });
          }
        }
        toast({ title: "Avaliação Concluída!" });
        setTimeout(() => {
          document.getElementById("audit-results")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        throw new Error(data.error || "IA offline");
      }
    } catch (e) {
      trackFalha("redacao_falha_corrigir", e, { chars: text.length });
      const demorou = e instanceof TempoEsgotado;
      toast({
        title: demorou ? "A correção demorou demais" : "Não foi possível corrigir agora",
        description: demorou
          ? "Seu texto continua salvo aqui na tela. Tente enviar de novo em alguns minutos."
          : "Houve uma falha ao falar com o corretor. Seu texto não foi perdido — tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoadingGrading(false);
    }
  };

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── Hero ── */}
      <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 shadow-2xl shadow-orange-200 p-6">
        <div className="absolute top-[-10%] right-[-5%] w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-3 w-3 text-white/80" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">Aurora IA Ativa</p>
              </div>
              <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">Lab de Redação</h1>
              <p className="text-white/80 text-xs font-semibold mt-1">Auditoria por IA · critérios INEP</p>
            </div>
            <div className="relative shrink-0">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="3" />
                <circle cx="28" cy="28" r="24" fill="none"
                  stroke={charCount >= 1000 ? "#a7f3d0" : charCount >= 500 ? "#fed7aa" : "#fde68a"}
                  strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 24}
                  strokeDashoffset={(2 * Math.PI * 24) * (1 - Math.min(charCount, 1500) / 1500)}
                  style={{ transition: "stroke-dashoffset 0.4s ease-out, stroke 0.3s" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-black text-white leading-none italic">{charCount}</span>
                <span className="text-[7px] font-bold text-white/70 uppercase tracking-wider mt-0.5">/ 1500</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button
              onClick={() => { setCustomTheme(!customTheme); setTheme(""); setSupportingTexts([]); setResult(null); setFromPhoto(false); }}
              className={`h-11 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                customTheme ? "bg-white/20 border-white/30 text-white" : "bg-transparent border-white/20 text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              {customTheme ? "Sair do Manual" : "Tema Manual"}
            </Button>
            <Button
              onClick={handleGenerateTopic}
              disabled={loadingTopic || loadingGrading}
              className="h-11 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black text-[10px] uppercase tracking-widest border border-white/25 disabled:opacity-40"
            >
              {loadingTopic ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              Gerar com IA
            </Button>
          </div>
        </div>
      </div>

      {/* ── Banner Tema da Semana ── */}
      {weeklyTheme && (
        <div className="relative overflow-hidden rounded-[1.5rem] border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-200/30 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Tema da Semana</p>
              <p className="text-sm font-black italic text-amber-900 leading-snug mt-0.5">{weeklyTheme.title}</p>
              {weeklyTheme.description && (
                <p className="text-[11px] text-amber-700/70 font-medium mt-1 leading-snug">{weeklyTheme.description}</p>
              )}
              {weeklyTheme.source && (
                <p className="text-[10px] text-amber-600 font-bold mt-1">Fonte: {weeklyTheme.source}</p>
              )}
              <button
                onClick={() => { setTheme(weeklyTheme.title); setCustomTheme(false); }}
                className="mt-2 h-7 px-3 rounded-xl bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-amber-700 transition-colors"
              >
                Usar este tema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Theme + Editor ── */}
      <div className="glow-orange bg-white border border-slate-100 shadow-sm rounded-[1.5rem] overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50">
          {customTheme ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <PenTool className="h-3 w-3 text-orange-500" />
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sua proposta</label>
              </div>
              <input type="text" value={theme} onChange={(e) => setTheme(e.target.value)}
                placeholder="Ex: A inteligência artificial na educação..."
                className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold italic text-primary placeholder:text-slate-400 outline-none focus:border-orange-400 transition-all"
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3 w-3 text-orange-500" />
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#0F7A95]">Tema Sintonizado</p>
              </div>
              <h2 className="text-base font-black italic text-primary leading-snug">
                {theme || "Aguardando geração de tema..."}
              </h2>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            Digite ou envie uma foto da redação à mão
          </p>
          <label
            className={`flex items-center gap-1.5 cursor-pointer text-[10px] font-black uppercase tracking-widest px-3 h-8 rounded-xl border transition-all ${
              loadingOcr || loadingGrading
                ? "opacity-50 pointer-events-none border-slate-200 text-slate-400"
                : "border-orange-200 text-[#0F7A95] hover:bg-orange-50 active:scale-95"
            }`}
          >
            {loadingOcr ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Digitalizando...</>
            ) : (
              <><Camera className="h-3.5 w-3.5" /> Foto da redação</>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              disabled={loadingOcr || loadingGrading}
              className="hidden"
            />
          </label>
        </div>
        <Textarea
          placeholder="Inicie seu texto aqui... Desenvolva sua tese com clareza."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loadingGrading || loadingOcr}
          className="min-h-[280px] sm:min-h-[400px] border-none p-5 font-medium text-sm leading-relaxed italic resize-none focus-visible:ring-0 bg-transparent text-primary placeholder:text-slate-400 scrollbar-hide rounded-none"
        />
        {/* ── Checklist pré-envio ── */}
        <div className="px-5 pb-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <CheckSquare2 className="h-3.5 w-3.5 text-orange-500" />
            Checklist antes de enviar
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'hasIntro',      label: 'Introdução com tese?' },
              { key: 'hasDev',        label: '2 parágrafos de desenvolvimento?' },
              { key: 'hasConclusion', label: 'Proposta de intervenção?' },
              { key: 'hasMinLines',   label: 'Acima de 25 linhas?' },
            ].map(item => {
              const checked = checklist[item.key as keyof typeof checklist];
              return (
                <button
                  key={item.key}
                  onClick={() => setChecklist(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof checklist] }))}
                  className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                    checked
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {checked
                    ? <CheckSquare2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    : <Square className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />}
                  <span className="text-[11px] font-bold leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
          {Object.values(checklist).every(Boolean) && (
            <p className="text-center text-[10px] font-black text-emerald-600 animate-in fade-in duration-500">
              ✅ Tudo certo! Sua redação está pronta para avaliação.
            </p>
          )}
        </div>
        <div className="border-t border-slate-100 p-4 space-y-3">
          {/* Confirmação do tema logo acima do botão.
              O critério de fuga ao tema é este texto — se ele não for o que o
              aluno respondeu, a redação é anulada por inteiro. Mostrar aqui é a
              última chance de perceber a troca antes de perder a nota. */}
          {theme.trim() ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Será corrigida com este tema
              </p>
              <p className="text-xs font-black italic text-primary leading-snug mt-1">{theme}</p>
              <p className="text-[10px] font-medium text-slate-500 mt-1.5 leading-snug">
                Escreveu sobre outro assunto? Troque o tema antes de enviar — fugir do tema zera a redação.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] font-black text-amber-800 leading-snug">
                Escolha um tema antes de enviar.
              </p>
              <p className="text-[10px] font-medium text-amber-700/80 mt-1 leading-snug">
                Use o tema da semana, gere uma proposta ou escreva o seu em "Tema Manual".
              </p>
            </div>
          )}

          <Button
            onClick={handleSubmitEssay}
            disabled={loadingGrading || !text || !theme.trim()}
            className="btn-shimmer w-full h-13 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-2xl shadow-xl shadow-orange-500/30 border-none text-xs uppercase tracking-widest disabled:opacity-40 group"
          >
            {loadingGrading ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando Auditoria...</span>
            ) : (
              <span className="flex items-center gap-2">Submeter para Aurora IA<ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></span>
            )}
          </Button>
          <div className="flex items-center justify-center gap-1.5">
            <AlertCircle className="h-3 w-3 text-slate-400" />
            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Aurora é uma IA · correção pode ter imprecisões</p>
          </div>
        </div>
      </div>

      {/* ── Current Result ── */}
      {result && (
        <div id="audit-results" className="space-y-5 animate-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Diagnóstico</p>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200" />
          </div>

          {/* Score Card */}
          <div className="relative bg-[#0d0d0f] border border-[#4CCCED]/20 rounded-[1.5rem] overflow-hidden p-6 animate-in zoom-in-95 duration-500">
            <div className="absolute inset-0 pointer-events-none animate-pulse" style={{ background: "radial-gradient(ellipse at 100% 0%, rgba(76,204,237,0.25) 0%, transparent 60%)", animationDuration: "3s" }} />
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none opacity-40" style={{ background: "radial-gradient(circle, rgba(76,204,237,0.4) 0%, transparent 60%)", filter: "blur(40px)" }} />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-3 w-3 text-orange-400 fill-orange-400 animate-pulse" />
                  <Badge className="bg-[#4CCCED]/20 text-orange-400 border-none font-black text-[9px] px-2 py-0.5 uppercase tracking-widest">Pontuação Final</Badge>
                </div>
                <h2 className="text-6xl sm:text-7xl font-black italic tracking-tighter leading-[0.85] text-white drop-shadow-xl">{result.total_score}</h2>
                <p className="text-[10px] font-bold text-white/55 uppercase tracking-widest mt-2">de 1000 pontos</p>
              </div>
              <div className="relative shrink-0">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#fb923c" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={(2 * Math.PI * 34) * (1 - (result.total_score || 0) / 1000)}
                    style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-black text-orange-400 leading-none italic">{Math.round(((result.total_score || 0) / 1000) * 100)}</span>
                  <span className="text-[7px] font-bold text-white/55 uppercase tracking-wider mt-0.5">%</span>
                </div>
              </div>
            </div>
            <div className="relative z-10 mt-5 pt-5 border-t border-white/8">
              <MessageSquareQuote className="h-4 w-4 text-orange-400 mb-2" />
              <p className="text-xs font-medium italic text-white/70 leading-relaxed">"{result.general_feedback}"</p>
            </div>
          </div>

          {/* Anulação: explica por que tudo ficou zero antes de mostrar as
              competências zeradas, senão o aluno lê cinco zeros sem contexto. */}
          {result.anulacao && (
            <AnulacaoAviso motivo={result.anulacao} explicacao={result.general_feedback} />
          )}

          {/* Competencies */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(result.competencies || {}).map(([key, comp]: any, idx) => {
              const info = COMPETENCY_LABELS[key];
              if (!info) return null;
              const Icon = info.icon;
              return (
                <div key={key} className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 fill-mode-both" style={{ animationDelay: `${idx * 80}ms`, animationDuration: "500ms" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-xl border ${info.bg}`}><Icon className={`h-4 w-4 ${info.color}`} /></div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nota</p>
                      <p className="text-2xl font-black italic text-primary leading-none">{comp.score}</p>
                    </div>
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${info.color}`}>{info.label}</p>
                  <p className="text-xs font-medium italic text-slate-500 leading-relaxed">{comp.feedback}</p>
                </div>
              );
            })}
          </div>

          {/* Redação com os desvios grifados no lugar onde foram escritos. */}
          {result.detailed_corrections?.some((c: any) => typeof c?.start === 'number') && (
            <EssayHighlightedText texto={text} correcoes={result.detailed_corrections} />
          )}

          {/* Espelho da banca: quantas correções, se divergiram, como fechou. */}
          {result._banca && <BancaMirror banca={result._banca} />}

          {/* Corrections — lista completa, inclusive os trechos que não foi
              possível localizar no texto (o modelo citou de forma aproximada). */}
          {result.detailed_corrections?.length > 0 && (
            <div className="bg-white border border-slate-100 shadow-sm rounded-[1.5rem] overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-red-50">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center">
                    <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                  </div>
                  <h3 className="text-sm font-black italic text-red-700 uppercase tracking-wide">Raio-X de Desvios</h3>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {result.detailed_corrections.map((corr: any, i: number) => (
                  <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge className="bg-red-100 text-red-600 border-none font-black text-[9px] px-2 line-through opacity-70">{corr.original}</Badge>
                      <ChevronRight className="h-3 w-3 text-slate-400" />
                      <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[9px] px-2">{corr.suggestion}</Badge>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 italic leading-relaxed flex items-start gap-2">
                      <Lightbulb className="h-3 w-3 text-orange-500 shrink-0 mt-0.5" />{corr.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions?.length > 0 && (
            <div className="bg-[#0d0d0f] border border-[#4CCCED]/15 rounded-[1.5rem] overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl bg-[#4CCCED]/20 border border-[#4CCCED]/30 flex items-center justify-center">
                    <Zap className="h-3.5 w-3.5 text-orange-400" />
                  </div>
                  <h3 className="text-sm font-black italic text-orange-400 uppercase tracking-wide">Plano de Evolução</h3>
                </div>
              </div>
              <div className="p-4 space-y-2.5">
                {result.suggestions.map((sug: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/3 border border-white/5">
                    <div className="h-6 w-6 rounded-lg bg-[#4CCCED] text-white flex items-center justify-center font-black text-[10px] shrink-0">{i + 1}</div>
                    <p className="text-xs font-medium italic text-white/70 leading-relaxed">{sug}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Support texts ── */}
      {supportingTexts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-orange-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Textos Motivadores</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {supportingTexts.map((st) => (
              <div key={st.id} className="bg-white border border-slate-100 border-l-2 border-l-orange-500 shadow-sm rounded-2xl p-4">
                <p className="text-xs font-medium italic text-slate-600 leading-relaxed">"{st.content}"</p>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Fonte: {st.source}</span>
                  <Badge className="bg-orange-100 text-[#0F7A95] border border-orange-200 font-black text-[7px] uppercase px-1.5 h-4">Motivador</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Evolution Chart ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Evolução de Notas</p>
        </div>
        <div className="bg-white border border-slate-100 shadow-sm rounded-[1.5rem] overflow-hidden p-4">
          {chartData.length > 0 ? (
            <div className="h-[220px] w-full">
              <EssayChart data={chartData} />
            </div>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                <History className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Radar de Evolução</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Aguardando seu primeiro envio</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── History ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <History className="h-4 w-4 text-orange-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Histórico de Redações</p>
          {fullHistory.length > 0 && (
            <Badge className="bg-orange-100 text-orange-700 border-none font-black text-[9px] px-2 ml-auto">{fullHistory.length}</Badge>
          )}
        </div>

        {historyLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : fullHistory.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
            <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="font-black text-slate-400 italic">Sem redações ainda</p>
            <p className="text-xs text-slate-400 mt-1">Escreva sua primeira redação acima.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fullHistory.map((entry, idx) => {
              const colors = scoreColor(entry.score);
              return (
                <div
                  key={entry.id}
                  className="gradient-border bg-white border-none shadow-sm rounded-2xl p-4 md:p-5 animate-in fade-in slide-in-from-bottom-2 fill-mode-both cursor-pointer hover:shadow-md transition-all group active:scale-[0.99] touch-manipulation"
                  style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
                  onClick={() => setSelectedEntry(entry)}
                >
                  <div className="flex items-start gap-3">
                    {/* Score ring */}
                    <div className="relative shrink-0">
                      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="3" />
                        <circle cx="28" cy="28" r="22" fill="none"
                          stroke={colors.ring}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 22}
                          strokeDashoffset={(2 * Math.PI * 22) * (1 - (entry.score || 0) / 1000)}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-sm font-black text-primary leading-none italic">{entry.score}</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={`${colors.badge} border-none font-black text-[8px] uppercase px-2`}>
                          {entry.score} pts
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />
                          {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm font-black text-primary italic leading-snug line-clamp-1 mb-1">{entry.theme}</p>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-2">{entry.content}</p>
                    </div>

                    <div className="shrink-0 text-slate-300 group-hover:text-orange-400 transition-colors mt-1">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Essay Detail Sheet ── */}
      <Sheet open={!!selectedEntry} onOpenChange={(v) => { if (!v) setSelectedEntry(null); }}>
        <SheetContent side="bottom" className="h-[92dvh] w-full sm:side-right sm:max-w-2xl overflow-y-auto p-0 rounded-t-[2rem] sm:rounded-none">
          {selectedEntry && (() => {
            const colors = scoreColor(selectedEntry.score);
            const rd = selectedEntry.result_data;
            return (
              <>
                <SheetHeader className="p-4 md:p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-orange-500 to-amber-500 text-white sticky top-0 z-10">
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="3" />
                        <circle cx="28" cy="28" r="22" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 22}
                          strokeDashoffset={(2 * Math.PI * 22) * (1 - (selectedEntry.score || 0) / 1000)}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-base font-black text-white leading-none italic">{selectedEntry.score}</span>
                        <span className="text-[7px] font-bold text-white/70 mt-0.5">pts</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <SheetTitle className="text-white font-black italic text-base leading-snug line-clamp-2">{selectedEntry.theme}</SheetTitle>
                      <p className="text-white/75 text-[10px] font-bold mt-1 flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {format(new Date(selectedEntry.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </SheetHeader>

                <div className="p-4 md:p-6 space-y-5">
                  {/* Feedback geral */}
                  {selectedEntry.feedback && (
                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquareQuote className="h-4 w-4 text-orange-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#0F7A95]">Avaliação Geral</p>
                      </div>
                      <p className="text-sm font-medium italic text-slate-700 leading-relaxed">"{selectedEntry.feedback}"</p>
                    </div>
                  )}

                  {/* Competências */}
                  {rd?.competencies && Object.keys(rd.competencies).length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Competências</p>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(rd.competencies).map(([key, comp]: any) => {
                          const info = COMPETENCY_LABELS[key];
                          if (!info) return null;
                          const Icon = info.icon;
                          return (
                            <div key={key} className="bg-white border border-slate-100 rounded-2xl p-3 md:p-4 flex items-center gap-3">
                              <div className={`p-2 rounded-xl border shrink-0 ${info.bg}`}>
                                <Icon className={`h-4 w-4 ${info.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${info.color}`}>{info.label}</p>
                                <p className="text-[11px] font-medium text-slate-500 italic leading-relaxed mt-0.5 line-clamp-2">{comp.feedback}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xl font-black italic text-primary">{comp.score}</span>
                                <span className="text-[9px] font-bold text-slate-400 block">/ 200</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Texto completo */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Texto Enviado</p>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                      <p className="text-sm font-medium text-slate-700 leading-relaxed italic whitespace-pre-wrap">{selectedEntry.content}</p>
                    </div>
                  </div>

                  {/* Desvios */}
                  {rd?.detailed_corrections?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Desvios Identificados</p>
                      <div className="space-y-2">
                        {rd.detailed_corrections.map((corr: any, i: number) => (
                          <div key={i} className="bg-white border border-slate-100 rounded-xl p-3 space-y-1.5">
                            <div className="flex flex-wrap gap-2 items-center">
                              <Badge className="bg-red-100 text-red-600 border-none font-black text-[9px] px-2 line-through opacity-70">{corr.original}</Badge>
                              <ChevronRight className="h-3 w-3 text-slate-300" />
                              <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[9px] px-2">{corr.suggestion}</Badge>
                            </div>
                            <p className="text-[10px] font-medium text-slate-500 italic flex items-start gap-1.5">
                              <Lightbulb className="h-3 w-3 text-orange-400 shrink-0 mt-0.5" />{corr.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sugestões */}
                  {rd?.suggestions?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Plano de Melhoria</p>
                      <div className="space-y-2">
                        {rd.suggestions.map((sug: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl">
                            <div className="h-5 w-5 rounded-lg bg-[#4CCCED] text-white flex items-center justify-center font-black text-[9px] shrink-0">{i + 1}</div>
                            <p className="text-[11px] font-medium text-slate-600 italic leading-relaxed">{sug}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
