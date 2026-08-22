"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Loader2, AlertCircle, Flame, Trophy, CheckCircle2, GraduationCap,
  Wallet, Bell, CalendarCheck, MailCheck, FileSignature,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

/* ── Tipos do payload de get_guardian_portal ─────────────────────────────── */
interface PortalData {
  aluno: { nome: string; trilha: string | null; sala: string | null; turno: string | null };
  responsavel: { nome: string; parentesco: string | null };
  engajamento: {
    xp: number; ofensiva: number; recorde: number; dias_estudo: number;
    questoes_respondidas: number; questoes_certas: number; redacoes_enviadas: number;
    ultima_atividade: string | null;
  };
  frequencia: {
    presencas: number; faltas: number; total: number; pct: number | null;
    ultimas: { data: string; titulo: string | null; status: string }[];
  };
  boletim: { geral: any[]; enem: any[] };
  financeiro: {
    competencia: string; valor: number; desconto: number; vencimento: string;
    status: string; pago_em: string | null; forma: string | null;
  }[];
  comunicados: {
    id: string; titulo: string; mensagem: string; prioridade: string;
    criado_em: string; lido: boolean; lido_em: string | null;
  }[];
}

interface ReenrollmentData {
  agreement_id: string; status: string; decidido_em: string | null;
  campanha: string; ano: number; valor: number; contrato: string;
}

/* Payload da RPC legada (token antigo, por aluno). */
type LegacyEngagement = Record<string, unknown>;

const brl = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FIN_STATUS: Record<string, { label: string; cls: string }> = {
  aberta:    { label: "Aberta",    cls: "bg-blue-500/20 text-blue-300" },
  paga:      { label: "Paga",      cls: "bg-emerald-500/20 text-emerald-300" },
  vencida:   { label: "Vencida",   cls: "bg-red-500/20 text-red-300" },
  negociada: { label: "Negociada", cls: "bg-amber-500/20 text-amber-300" },
};

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm text-center">
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-indigo-300">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function GuardianPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [reenrollment, setReenrollment] = useState<ReenrollmentData | null>(null);
  const [legacy, setLegacy] = useState<LegacyEngagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [signerName, setSignerName] = useState("");
  const [signerCpf, setSignerCpf] = useState("");
  const [signing, setSigning] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Portal novo (token por responsável).
      const { data: portal, error } = await supabase.rpc("get_guardian_portal", { p_token: token });
      if (!error && portal) {
        setData(portal as PortalData);
        setLegacy(null);
        const { data: reen } = await supabase.rpc("get_guardian_reenrollment", { p_token: token });
        setReenrollment((reen as ReenrollmentData) || null);
        return;
      }
      // Fallback: token legado por aluno (só engajamento gamificado).
      const { data: resp } = await supabase.rpc("get_student_engagement_by_token", { token_val: token });
      if (resp && Array.isArray(resp) && resp.length > 0) {
        setLegacy(resp[0] as LegacyEngagement);
      } else {
        setLegacy(null);
      }
      setData(null);
    } catch (err: any) {
      toast({ title: "Erro ao obter dados", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const decideReenrollment = async (action: "accept" | "refuse") => {
    if (!reenrollment) return;
    if (action === "accept" && (!signerName.trim() || !signerCpf.trim())) {
      toast({ title: "Preencha seu nome completo e CPF", variant: "destructive" });
      return;
    }
    setSigning(true);
    try {
      const res = await fetch(`/api/guardian/${token}/reenrollment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId: reenrollment.agreement_id,
          action,
          signerName: signerName.trim(),
          signerCpf: signerCpf.trim(),
          reason: action === "refuse" ? "Recusado pelo responsável no portal" : undefined,
        }),
      });
      const resp = await res.json();
      if (!res.ok) throw new Error(resp.error || "Falha ao registrar");
      toast({
        title: action === "accept" ? "Rematrícula confirmada! 🎉" : "Recusa registrada",
      });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSigning(false);
    }
  };

  const ackAnnouncement = async (announcementId: string) => {
    const { data: ok, error } = await supabase.rpc("ack_guardian_announcement", {
      p_token: token, p_announcement_id: announcementId,
    });
    if (error || !ok) {
      toast({ title: "Não foi possível confirmar a leitura", variant: "destructive" });
      return;
    }
    toast({ title: "Leitura confirmada" });
    setData((prev) => prev ? {
      ...prev,
      comunicados: prev.comunicados.map((c) =>
        c.id === announcementId ? { ...c, lido: true, lido_em: new Date().toISOString() } : c
      ),
    } : prev);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-400" />
      </div>
    );
  }

  /* ── Fallback: token legado (por aluno) ─────────────────────────────────── */
  if (!data && legacy) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-12">
        <div className="max-w-3xl mx-auto px-4">
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-white/10 border-b border-white/20 p-8">
              <CardTitle className="text-3xl font-extrabold text-white tracking-tight">Acompanhamento do Aluno</CardTitle>
              <CardDescription className="text-sm text-gray-300">
                Métricas de engajamento (link antigo — peça à secretaria o novo link do portal para ver frequência, boletim e financeiro).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Stat label="XP" value={String(legacy.total_xp ?? legacy.xp ?? 0)} />
                <Stat label="Ofensiva" value={`${legacy.current_streak ?? 0} dias`} />
                <Stat label="Questões" value={String(legacy.total_answers ?? 0)} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl max-w-md w-full">
          <CardContent className="p-10 flex flex-col items-center text-gray-400 gap-3">
            <AlertCircle className="h-10 w-10" />
            <p className="text-center font-semibold">Link inválido, expirado ou revogado.</p>
            <p className="text-center text-sm">Peça à secretaria um novo link de acesso ao portal.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const naoLidos = data.comunicados.filter((c) => !c.lido).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-10">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-white/10 border-b border-white/20 p-8">
            <CardTitle className="text-3xl font-extrabold text-white tracking-tight">{data.aluno.nome}</CardTitle>
            <CardDescription className="text-sm text-gray-300">
              Portal do responsável — olá, {data.responsavel.nome}
              {data.responsavel.parentesco ? ` (${data.responsavel.parentesco})` : ""}.
              {data.aluno.sala ? ` Turma ${data.aluno.sala}` : ""}{data.aluno.turno ? ` · ${data.aluno.turno}` : ""}
              {data.aluno.trilha ? ` · Foco: ${data.aluno.trilha}` : ""}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            <Tabs defaultValue="desempenho">
              <TabsList className="bg-white/10 rounded-xl flex-wrap h-auto">
                <TabsTrigger value="desempenho" className="text-gray-200 data-[state=active]:bg-indigo-500 data-[state=active]:text-white rounded-lg">
                  <Trophy className="h-4 w-4 mr-1" /> Desempenho
                </TabsTrigger>
                <TabsTrigger value="frequencia" className="text-gray-200 data-[state=active]:bg-indigo-500 data-[state=active]:text-white rounded-lg">
                  <CalendarCheck className="h-4 w-4 mr-1" /> Frequência
                </TabsTrigger>
                <TabsTrigger value="boletim" className="text-gray-200 data-[state=active]:bg-indigo-500 data-[state=active]:text-white rounded-lg">
                  <GraduationCap className="h-4 w-4 mr-1" /> Boletim
                </TabsTrigger>
                <TabsTrigger value="financeiro" className="text-gray-200 data-[state=active]:bg-indigo-500 data-[state=active]:text-white rounded-lg">
                  <Wallet className="h-4 w-4 mr-1" /> Financeiro
                </TabsTrigger>
                <TabsTrigger value="comunicados" className="text-gray-200 data-[state=active]:bg-indigo-500 data-[state=active]:text-white rounded-lg">
                  <Bell className="h-4 w-4 mr-1" /> Comunicados
                  {naoLidos > 0 && <Badge className="ml-1 bg-red-500 text-white h-4 min-w-4 px-1 text-[9px]">{naoLidos}</Badge>}
                </TabsTrigger>
                {reenrollment && (
                  <TabsTrigger value="rematricula" className="text-gray-200 data-[state=active]:bg-indigo-500 data-[state=active]:text-white rounded-lg">
                    <FileSignature className="h-4 w-4 mr-1" /> Rematrícula
                    {reenrollment.status === "pendente" && <Badge className="ml-1 bg-amber-500 text-white h-4 px-1 text-[9px]">!</Badge>}
                  </TabsTrigger>
                )}
              </TabsList>

              {/* ── Desempenho ── */}
              <TabsContent value="desempenho" className="mt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="XP" value={data.engajamento.xp} />
                  <Stat label="Ofensiva" value={<span className="flex items-center justify-center gap-1"><Flame className="h-5 w-5 text-orange-400" />{data.engajamento.ofensiva}d</span>} sub={`Recorde: ${data.engajamento.recorde} dias`} />
                  <Stat label="Questões" value={data.engajamento.questoes_respondidas} sub={`${data.engajamento.questoes_certas} certas`} />
                  <Stat label="Redações" value={data.engajamento.redacoes_enviadas} />
                </div>
                {data.engajamento.ultima_atividade && (
                  <p className="text-xs text-gray-500 mt-4">
                    Último dia de estudo: {format(new Date(data.engajamento.ultima_atividade + "T12:00:00"), "dd/MM/yyyy")}
                    {" · "}{data.engajamento.dias_estudo} dia(s) de estudo acumulados
                  </p>
                )}
              </TabsContent>

              {/* ── Frequência ── */}
              <TabsContent value="frequencia" className="mt-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Stat label="Presenças" value={data.frequencia.presencas} />
                  <Stat label="Faltas" value={data.frequencia.faltas} />
                  <Stat label="Frequência" value={data.frequencia.pct != null ? `${data.frequencia.pct}%` : "—"} />
                </div>
                {data.frequencia.ultimas.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase text-gray-400 font-bold tracking-widest">Últimas aulas</p>
                    {data.frequencia.ultimas.map((r, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2 text-sm">
                        <span className="text-gray-300">
                          {format(new Date(r.data + "T12:00:00"), "dd/MM")} — {r.titulo || "Aula"}
                        </span>
                        {r.status === "present"
                          ? <Badge className="bg-emerald-500/20 text-emerald-300">Presente</Badge>
                          : <Badge className="bg-red-500/20 text-red-300">Falta</Badge>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Nenhum registro de presença ainda.</p>
                )}
              </TabsContent>

              {/* ── Boletim ── */}
              <TabsContent value="boletim" className="mt-6 space-y-4">
                {data.boletim.geral.length === 0 && data.boletim.enem.length === 0 && (
                  <p className="text-sm text-gray-500">Boletim ainda não importado pela secretaria.</p>
                )}
                {data.boletim.geral.map((b, i) => (
                  <div key={`g${i}`} className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs uppercase text-gray-400 font-bold tracking-widest mb-3">
                      {b.trilha ? `${b.trilha} — ` : ""}{b.semestre}º semestre
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <Stat label="Classificatória" value={b.classificatoria ?? "—"} sub={b.classificatoria_max ? `de ${b.classificatoria_max}` : undefined} />
                      <Stat label="Simulado" value={b.simulado ?? "—"} sub={b.simulado_max ? `de ${b.simulado_max}` : undefined} />
                      <Stat label="Redação" value={b.redacao ?? "—"} sub={b.redacao_max ? `de ${b.redacao_max}` : undefined} />
                    </div>
                  </div>
                ))}
                {data.boletim.enem.map((b, i) => (
                  <div key={`e${i}`} className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs uppercase text-gray-400 font-bold tracking-widest mb-3">ENEM — {b.semestre}º semestre</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                      <Stat label="Português" value={b.lingua_portuguesa ?? "—"} />
                      <Stat label="Matemática" value={b.matematica ?? "—"} />
                      <Stat label="Redação" value={b.redacao ?? "—"} />
                      <Stat label="Ciências" value={b.biologia ?? b.quimica ?? b.fisica ?? "—"} />
                    </div>
                  </div>
                ))}
              </TabsContent>

              {/* ── Financeiro ── */}
              <TabsContent value="financeiro" className="mt-6 space-y-2">
                {data.financeiro.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhuma mensalidade registrada.</p>
                )}
                {data.financeiro.map((f, i) => {
                  const st = FIN_STATUS[f.status] ?? { label: f.status, cls: "bg-white/10 text-gray-300" };
                  return (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 text-sm">
                      <div>
                        <p className="text-gray-200 font-semibold">
                          {format(new Date(f.competencia + "T12:00:00"), "MM/yyyy")} — {brl(f.valor)}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Vencimento {format(new Date(f.vencimento + "T12:00:00"), "dd/MM/yyyy")}
                          {f.pago_em ? ` · pago em ${format(new Date(f.pago_em), "dd/MM/yyyy")}` : ""}
                        </p>
                      </div>
                      <Badge className={st.cls}>{st.label}</Badge>
                    </div>
                  );
                })}
              </TabsContent>

              {/* ── Comunicados ── */}
              <TabsContent value="comunicados" className="mt-6 space-y-3">
                {data.comunicados.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhum comunicado para responsáveis ainda.</p>
                )}
                {data.comunicados.map((c) => (
                  <div key={c.id} className="bg-white/5 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-gray-100 font-bold">{c.titulo}</p>
                        <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{c.mensagem}</p>
                        <p className="text-[11px] text-gray-500 mt-2">{format(new Date(c.criado_em), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                      {c.lido ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 shrink-0">
                          <MailCheck className="h-3 w-3 mr-1" /> Lido
                        </Badge>
                      ) : (
                        <Button size="sm" onClick={() => ackAnnouncement(c.id)}
                          className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg shrink-0 h-8 text-xs font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirmar leitura
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </TabsContent>
              {/* ── Rematrícula ── */}
              {reenrollment && (
                <TabsContent value="rematricula" className="mt-6 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-gray-100 font-bold">{reenrollment.campanha} — ano {reenrollment.ano}</p>
                    {reenrollment.status === "aceito" && <Badge className="bg-emerald-500/20 text-emerald-300">Aceito</Badge>}
                    {reenrollment.status === "recusado" && <Badge className="bg-red-500/20 text-red-300">Recusado</Badge>}
                    {reenrollment.status === "pendente" && <Badge className="bg-amber-500/20 text-amber-300">Pendente</Badge>}
                  </div>
                  <p className="text-sm text-gray-400">Mensalidade: <strong className="text-gray-200">{brl(reenrollment.valor)}</strong></p>
                  <div className="bg-white/5 rounded-xl p-4 text-sm text-gray-300 whitespace-pre-wrap max-h-72 overflow-y-auto">
                    {reenrollment.contrato}
                  </div>
                  {reenrollment.status === "pendente" && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">
                        Seu nome completo e CPF valem como assinatura eletrônica do contrato acima.
                      </p>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Nome completo"
                          className="bg-white/10 border-white/10 text-white placeholder:text-gray-500 rounded-xl" />
                        <Input value={signerCpf} onChange={(e) => setSignerCpf(e.target.value)} placeholder="CPF"
                          className="bg-white/10 border-white/10 text-white placeholder:text-gray-500 rounded-xl" />
                      </div>
                      <div className="flex gap-3">
                        <Button onClick={() => decideReenrollment("accept")} disabled={signing}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex-1">
                          {signing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Aceitar e garantir a vaga
                        </Button>
                        <Button onClick={() => decideReenrollment("refuse")} disabled={signing} variant="outline"
                          className="rounded-xl font-bold border-white/20 text-gray-300 hover:bg-white/10">
                          Não renovar
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-gray-600">
          Este link é pessoal e intransferível. Em caso de perda, peça a revogação à secretaria.
        </p>
      </div>
    </div>
  );
}
