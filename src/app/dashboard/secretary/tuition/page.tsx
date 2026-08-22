"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Receipt, Loader2, DollarSign, TrendingUp, AlertTriangle, Wallet, Plus,
  Printer, CheckCircle2, XCircle, CalendarClock, History, Search, BadgePercent,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { esc, openPrintWindow, brl } from "@/lib/print-utils";
import { format } from "date-fns";

interface Plan {
  id: string; name: string; school_year: number; base_amount: number;
  due_day: number; installments_per_year: number; active: boolean;
}
interface Subscription {
  id: string; student_id: string; plan_id: string; school_year: number;
  custom_amount: number | null; status: string;
}
interface Discount {
  id: string; student_id: string; kind: string; value: number; reason: string;
  active: boolean; valid_from: string | null; valid_until: string | null;
}
interface Invoice {
  id: string; student_id: string; competence: string; base_amount: number;
  discount_amount: number; final_amount: number; due_date: string; status: string;
  payment_method: string | null; paid_at: string | null; paid_amount: number | null;
  notes: string | null;
}
interface StudentLite { id: string; name: string | null; email: string | null; sala: string | null; status: string | null }
interface InvoiceEvent { id: string; action: string; details: Record<string, unknown>; created_at: string }

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta", paga: "Paga", vencida: "Vencida", cancelada: "Cancelada", negociada: "Negociada",
};
const STATUS_STYLE: Record<string, string> = {
  aberta: "bg-blue-100 text-blue-700",
  paga: "bg-emerald-100 text-emerald-700",
  vencida: "bg-red-100 text-red-700",
  cancelada: "bg-gray-200 text-gray-500",
  negociada: "bg-amber-100 text-amber-700",
};
const METODO_LABEL: Record<string, string> = {
  pix: "PIX", dinheiro: "Dinheiro", cartao: "Cartão", transferencia: "Transferência", boleto: "Boleto",
};

/** Status exibido: deriva "vencida" na tela mesmo antes do cron rodar. */
const displayStatus = (inv: Invoice) =>
  inv.status === "aberta" && inv.due_date < format(new Date(), "yyyy-MM-dd") ? "vencida" : inv.status;

export default function TuitionPage() {
  const { userRole, loading: isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [competence, setCompetence] = useState(format(new Date(), "yyyy-MM"));
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [filterSala, setFilterSala] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);

  // Dialogs
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payMethod, setPayMethod] = useState("pix");
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [renegInvoice, setRenegInvoice] = useState<Invoice | null>(null);
  const [renegDue, setRenegDue] = useState("");
  const [renegAmount, setRenegAmount] = useState("");
  const [renegNotes, setRenegNotes] = useState("");
  const [historyInvoice, setHistoryInvoice] = useState<Invoice | null>(null);
  const [historyEvents, setHistoryEvents] = useState<InvoiceEvent[]>([]);
  const [acting, setActing] = useState(false);

  // Planos (CRUD)
  const [planForm, setPlanForm] = useState({ name: "", school_year: String(new Date().getFullYear()), base_amount: "", due_day: "10" });
  const [savingPlan, setSavingPlan] = useState(false);

  // Vínculo aluno-plano
  const [subStudent, setSubStudent] = useState("");
  const [subPlan, setSubPlan] = useState("");
  const [subCustom, setSubCustom] = useState("");
  const [savingSub, setSavingSub] = useState(false);

  // Desconto
  const [discStudent, setDiscStudent] = useState("");
  const [discKind, setDiscKind] = useState("percent");
  const [discValue, setDiscValue] = useState("");
  const [discReason, setDiscReason] = useState("");
  const [savingDisc, setSavingDisc] = useState(false);

  useEffect(() => {
    if (!isUserLoading && userRole !== "staff" && userRole !== "admin") {
      router.replace("/dashboard/home");
    }
  }, [userRole, isUserLoading, router]);

  const compDate = `${competence}-01`;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [plRes, subRes, discRes, invRes, stRes] = await Promise.all([
        supabase.from("tuition_plans").select("*").order("school_year", { ascending: false }),
        supabase.from("student_plan_subscriptions").select("*"),
        supabase.from("student_discounts").select("*").eq("active", true),
        supabase.from("invoices").select("*").eq("competence", compDate).order("due_date"),
        supabase.from("profiles").select("id, name, email, sala, status").eq("role", "student").order("name"),
      ]);
      setPlans((plRes.data as Plan[]) || []);
      setSubs((subRes.data as Subscription[]) || []);
      setDiscounts((discRes.data as Discount[]) || []);
      setInvoices((invRes.data as Invoice[]) || []);
      setStudents((stRes.data as StudentLite[]) || []);
    } catch (e: any) {
      toast({ title: "Erro ao carregar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, compDate]);

  useEffect(() => { if (userRole === "staff" || userRole === "admin") fetchAll(); }, [fetchAll, userRole]);

  const studentById = useMemo(() => {
    const m: Record<string, StudentLite> = {};
    students.forEach((s) => { m[s.id] = s; });
    return m;
  }, [students]);

  const salas = useMemo(
    () => Array.from(new Set(students.map((s) => s.sala).filter(Boolean))).sort() as string[],
    [students]
  );

  // KPIs da competência (canceladas fora da base)
  const kpi = useMemo(() => {
    const ativos = invoices.filter((i) => i.status !== "cancelada");
    const previsto = ativos.reduce((acc, i) => acc + Number(i.final_amount), 0);
    const pagas = ativos.filter((i) => i.status === "paga");
    const recebido = pagas.reduce((acc, i) => acc + Number(i.paid_amount ?? i.final_amount), 0);
    const emAberto = previsto - pagas.reduce((acc, i) => acc + Number(i.final_amount), 0);
    const vencidas = ativos.filter((i) => displayStatus(i) === "vencida").length;
    const inadimplencia = ativos.length > 0 ? Math.round((vencidas / ativos.length) * 100) : 0;
    return { previsto, recebido, emAberto, inadimplencia, total: ativos.length, pagas: pagas.length };
  }, [invoices]);

  const filteredInvoices = useMemo(() => invoices.filter((inv) => {
    const st = studentById[inv.student_id];
    if (filterSala !== "all" && st?.sala !== filterSala) return false;
    if (filterStatus !== "all" && displayStatus(inv) !== filterStatus) return false;
    if (search && !(st?.name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [invoices, studentById, filterSala, filterStatus, search]);

  // Alunos ativos sem plano no ano da competência — ficam fora da geração.
  const semPlano = useMemo(() => {
    const year = Number(competence.slice(0, 4));
    const comSub = new Set(subs.filter((s) => s.school_year === year && s.status === "ativa").map((s) => s.student_id));
    return students.filter((s) => (s.status ?? "active") === "active" && !comSub.has(s.id));
  }, [students, subs, competence]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc("generate_monthly_invoices", { p_competence: compDate });
      if (error) throw error;
      toast({
        title: "Mensalidades geradas",
        description: `${data?.criadas ?? 0} criadas, ${data?.puladas ?? 0} já existiam. Previsto: ${brl(data?.total_previsto)}`,
      });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handlePay = async () => {
    if (!payInvoice) return;
    setActing(true);
    try {
      const { error } = await supabase.rpc("register_invoice_payment", {
        p_invoice_id: payInvoice.id,
        p_method: payMethod,
        p_paid_at: new Date().toISOString(),
        p_paid_amount: payAmount ? Number(payAmount) : null,
        p_notes: payNotes || null,
      });
      if (error) throw error;
      toast({ title: "Pagamento registrado", description: `${studentById[payInvoice.student_id]?.name ?? "Aluno"} — ${brl(payAmount || payInvoice.final_amount)}` });
      setPayInvoice(null); setPayNotes(""); setPayAmount("");
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erro ao registrar pagamento", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async (inv: Invoice) => {
    const motivo = window.prompt("Motivo do cancelamento:");
    if (motivo === null) return;
    try {
      const { error } = await supabase.rpc("cancel_invoice", { p_invoice_id: inv.id, p_reason: motivo });
      if (error) throw error;
      toast({ title: "Fatura cancelada" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erro ao cancelar", description: e.message, variant: "destructive" });
    }
  };

  const handleReneg = async () => {
    if (!renegInvoice || !renegDue) return;
    setActing(true);
    try {
      const { error } = await supabase.rpc("renegotiate_invoice", {
        p_invoice_id: renegInvoice.id,
        p_new_due_date: renegDue,
        p_new_amount: renegAmount ? Number(renegAmount) : null,
        p_notes: renegNotes || null,
      });
      if (error) throw error;
      toast({ title: "Fatura renegociada" });
      setRenegInvoice(null); setRenegDue(""); setRenegAmount(""); setRenegNotes("");
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erro ao renegociar", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const openHistory = async (inv: Invoice) => {
    setHistoryInvoice(inv);
    const { data } = await supabase
      .from("invoice_events").select("id, action, details, created_at")
      .eq("invoice_id", inv.id).order("created_at", { ascending: false });
    setHistoryEvents((data as InvoiceEvent[]) || []);
  };

  const printReceipt = (inv: Invoice) => {
    const st = studentById[inv.student_id];
    const compLabel = format(new Date(inv.competence + "T12:00:00"), "MM/yyyy");
    openPrintWindow({
      title: "Recibo de Pagamento de Mensalidade",
      codePrefix: "REC",
      contentHtml: `
        <p>Recebemos de <strong>${esc(st?.name ?? "").toUpperCase()}</strong> a importância de
        <strong>${esc(brl(inv.paid_amount ?? inv.final_amount))}</strong>, referente à mensalidade da
        competência <strong>${esc(compLabel)}</strong>.</p>
        <table>
          <tr><th>Competência</th><th>Valor base</th><th>Desconto</th><th>Valor pago</th><th>Forma</th><th>Data do pagamento</th></tr>
          <tr>
            <td>${esc(compLabel)}</td>
            <td>${esc(brl(inv.base_amount))}</td>
            <td>${esc(brl(inv.discount_amount))}</td>
            <td>${esc(brl(inv.paid_amount ?? inv.final_amount))}</td>
            <td>${esc(inv.payment_method ? METODO_LABEL[inv.payment_method] : "—")}</td>
            <td>${esc(inv.paid_at ? format(new Date(inv.paid_at), "dd/MM/yyyy") : "—")}</td>
          </tr>
        </table>
        <p>Para clareza, firmamos o presente recibo.</p>
      `,
    });
  };

  const handleCreatePlan = async () => {
    if (!planForm.name || !planForm.base_amount) {
      toast({ title: "Preencha nome e valor do plano", variant: "destructive" });
      return;
    }
    setSavingPlan(true);
    try {
      const { error } = await supabase.from("tuition_plans").insert({
        name: planForm.name,
        school_year: Number(planForm.school_year),
        base_amount: Number(planForm.base_amount),
        due_day: Number(planForm.due_day),
      });
      if (error) throw error;
      toast({ title: "Plano criado" });
      setPlanForm({ name: "", school_year: String(new Date().getFullYear()), base_amount: "", due_day: "10" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erro ao criar plano", description: e.message, variant: "destructive" });
    } finally {
      setSavingPlan(false);
    }
  };

  const handleTogglePlan = async (plan: Plan) => {
    const { error } = await supabase.from("tuition_plans").update({ active: !plan.active }).eq("id", plan.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const handleSubscribe = async () => {
    if (!subStudent || !subPlan) {
      toast({ title: "Selecione aluno e plano", variant: "destructive" });
      return;
    }
    const plan = plans.find((p) => p.id === subPlan);
    setSavingSub(true);
    try {
      const { error } = await supabase.from("student_plan_subscriptions").upsert({
        student_id: subStudent,
        plan_id: subPlan,
        school_year: plan?.school_year ?? new Date().getFullYear(),
        custom_amount: subCustom ? Number(subCustom) : null,
        status: "ativa",
      }, { onConflict: "student_id,school_year" });
      if (error) throw error;
      toast({ title: "Aluno vinculado ao plano" });
      setSubStudent(""); setSubPlan(""); setSubCustom("");
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erro ao vincular", description: e.message, variant: "destructive" });
    } finally {
      setSavingSub(false);
    }
  };

  const handleAddDiscount = async () => {
    if (!discStudent || !discValue || !discReason) {
      toast({ title: "Preencha aluno, valor e motivo", variant: "destructive" });
      return;
    }
    setSavingDisc(true);
    try {
      const { error } = await supabase.from("student_discounts").insert({
        student_id: discStudent,
        kind: discKind,
        value: Number(discValue),
        reason: discReason,
      });
      if (error) throw error;
      toast({ title: "Desconto adicionado" });
      setDiscStudent(""); setDiscValue(""); setDiscReason("");
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erro ao adicionar desconto", description: e.message, variant: "destructive" });
    } finally {
      setSavingDisc(false);
    }
  };

  const handleRemoveDiscount = async (id: string) => {
    const { error } = await supabase.from("student_discounts").update({ active: false }).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  if (isUserLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-primary flex items-center gap-3">
            <Receipt className="h-8 w-8" /> Mensalidades
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cobrança, bolsas e inadimplência — registro manual de pagamentos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={competence}
            onChange={(e) => setCompetence(e.target.value)}
            className="w-44 rounded-xl"
          />
          <Button onClick={handleGenerate} disabled={generating} className="rounded-xl font-black">
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Gerar mensalidades
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-2xl rounded-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-black uppercase tracking-widest"><DollarSign className="h-4 w-4" /> Previsto</div>
            <p className="text-2xl font-black mt-2">{brl(kpi.previsto)}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.total} fatura(s)</p>
          </CardContent>
        </Card>
        <Card className="shadow-2xl rounded-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-black uppercase tracking-widest"><TrendingUp className="h-4 w-4" /> Recebido</div>
            <p className="text-2xl font-black mt-2 text-emerald-600">{brl(kpi.recebido)}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.pagas} paga(s)</p>
          </CardContent>
        </Card>
        <Card className="shadow-2xl rounded-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-blue-600 text-xs font-black uppercase tracking-widest"><Wallet className="h-4 w-4" /> Em aberto</div>
            <p className="text-2xl font-black mt-2 text-blue-600">{brl(kpi.emAberto)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-2xl rounded-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600 text-xs font-black uppercase tracking-widest"><AlertTriangle className="h-4 w-4" /> Inadimplência</div>
            <p className="text-2xl font-black mt-2 text-red-600">{kpi.inadimplencia}%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="faturas">
        <TabsList className="rounded-xl">
          <TabsTrigger value="faturas" className="font-bold">Faturas</TabsTrigger>
          <TabsTrigger value="planos" className="font-bold">Planos</TabsTrigger>
          <TabsTrigger value="bolsas" className="font-bold">Alunos & Bolsas</TabsTrigger>
        </TabsList>

        {/* ── FATURAS ── */}
        <TabsContent value="faturas" className="space-y-4 mt-4">
          {semPlano.length > 0 && (
            <Card className="rounded-2xl border-amber-300 bg-amber-50">
              <CardContent className="p-4 text-sm text-amber-800 font-semibold">
                ⚠️ {semPlano.length} aluno(s) ativo(s) sem plano em {competence.slice(0, 4)} — eles ficam fora da geração de mensalidades. Vincule na aba "Alunos & Bolsas".
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56 rounded-xl" />
            </div>
            <Select value={filterSala} onValueChange={setFilterSala}>
              <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="Turma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as turmas</SelectItem>
                {salas.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card className="shadow-2xl rounded-card overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Aluno</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Turma</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Valor</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Vencimento</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Status</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Nenhuma fatura nesta competência. Use "Gerar mensalidades" após vincular alunos a um plano.
                      </td></tr>
                    )}
                    {filteredInvoices.map((inv) => {
                      const st = studentById[inv.student_id];
                      const ds = displayStatus(inv);
                      const podeReceber = ["aberta", "vencida", "negociada"].includes(inv.status);
                      return (
                        <tr key={inv.id} className="border-b hover:bg-muted/20">
                          <td className="p-4 font-semibold">{st?.name ?? "—"}</td>
                          <td className="p-4">{st?.sala ?? "—"}</td>
                          <td className="p-4 font-bold">
                            {brl(inv.final_amount)}
                            {Number(inv.discount_amount) > 0 && (
                              <span className="text-xs text-emerald-600 ml-1">(-{brl(inv.discount_amount)})</span>
                            )}
                          </td>
                          <td className="p-4">{format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy")}</td>
                          <td className="p-4"><Badge className={`${STATUS_STYLE[ds]} font-black`}>{STATUS_LABEL[ds]}</Badge></td>
                          <td className="p-4">
                            <div className="flex justify-end gap-1">
                              {podeReceber && (
                                <Button size="sm" variant="outline" className="rounded-lg h-8" title="Registrar pagamento"
                                  onClick={() => { setPayInvoice(inv); setPayAmount(String(inv.final_amount)); setPayMethod("pix"); }}>
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                </Button>
                              )}
                              {podeReceber && (
                                <Button size="sm" variant="outline" className="rounded-lg h-8" title="Renegociar"
                                  onClick={() => { setRenegInvoice(inv); setRenegDue(inv.due_date); setRenegAmount(""); }}>
                                  <CalendarClock className="h-4 w-4 text-amber-600" />
                                </Button>
                              )}
                              {inv.status === "paga" && (
                                <Button size="sm" variant="outline" className="rounded-lg h-8" title="Imprimir recibo" onClick={() => printReceipt(inv)}>
                                  <Printer className="h-4 w-4" />
                                </Button>
                              )}
                              {inv.status !== "paga" && inv.status !== "cancelada" && (
                                <Button size="sm" variant="outline" className="rounded-lg h-8" title="Cancelar" onClick={() => handleCancel(inv)}>
                                  <XCircle className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="rounded-lg h-8" title="Histórico" onClick={() => openHistory(inv)}>
                                <History className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PLANOS ── */}
        <TabsContent value="planos" className="space-y-4 mt-4">
          <Card className="shadow-2xl rounded-card">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-black italic text-lg">Novo plano</h3>
              <div className="grid md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-bold uppercase">Nome</Label>
                  <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Mensalidade 2026" className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase">Ano letivo</Label>
                  <Input type="number" value={planForm.school_year} onChange={(e) => setPlanForm({ ...planForm, school_year: e.target.value })} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase">Valor base (R$)</Label>
                  <Input type="number" step="0.01" value={planForm.base_amount} onChange={(e) => setPlanForm({ ...planForm, base_amount: e.target.value })} placeholder="850.00" className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase">Dia de vencimento</Label>
                  <Input type="number" min={1} max={28} value={planForm.due_day} onChange={(e) => setPlanForm({ ...planForm, due_day: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <Button onClick={handleCreatePlan} disabled={savingPlan} className="rounded-xl font-black">
                {savingPlan ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Criar plano
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-2xl rounded-card overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-4 font-black uppercase text-xs tracking-widest">Plano</th>
                    <th className="p-4 font-black uppercase text-xs tracking-widest">Ano</th>
                    <th className="p-4 font-black uppercase text-xs tracking-widest">Valor</th>
                    <th className="p-4 font-black uppercase text-xs tracking-widest">Vencimento</th>
                    <th className="p-4 font-black uppercase text-xs tracking-widest">Alunos</th>
                    <th className="p-4 font-black uppercase text-xs tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum plano criado ainda.</td></tr>
                  )}
                  {plans.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/20">
                      <td className="p-4 font-semibold">{p.name}</td>
                      <td className="p-4">{p.school_year}</td>
                      <td className="p-4 font-bold">{brl(p.base_amount)}</td>
                      <td className="p-4">dia {p.due_day}</td>
                      <td className="p-4">{subs.filter((s) => s.plan_id === p.id).length}</td>
                      <td className="p-4 text-right">
                        <Button size="sm" variant={p.active ? "outline" : "default"} className="rounded-lg h-8 font-bold" onClick={() => handleTogglePlan(p)}>
                          {p.active ? "Desativar" : "Reativar"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ALUNOS & BOLSAS ── */}
        <TabsContent value="bolsas" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="shadow-2xl rounded-card">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-black italic text-lg flex items-center gap-2"><Wallet className="h-5 w-5" /> Vincular aluno a plano</h3>
                <div className="space-y-3">
                  <Select value={subStudent} onValueChange={setSubStudent}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Aluno" /></SelectTrigger>
                    <SelectContent>
                      {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={subPlan} onValueChange={setSubPlan}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Plano" /></SelectTrigger>
                    <SelectContent>
                      {plans.filter((p) => p.active).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {brl(p.base_amount)} ({p.school_year})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" step="0.01" placeholder="Valor negociado (opcional)" value={subCustom} onChange={(e) => setSubCustom(e.target.value)} className="rounded-xl" />
                  <Button onClick={handleSubscribe} disabled={savingSub} className="rounded-xl font-black w-full">
                    {savingSub ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Vincular
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-2xl rounded-card">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-black italic text-lg flex items-center gap-2"><BadgePercent className="h-5 w-5" /> Bolsa / desconto</h3>
                <div className="space-y-3">
                  <Select value={discStudent} onValueChange={setDiscStudent}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Aluno" /></SelectTrigger>
                    <SelectContent>
                      {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-3">
                    <Select value={discKind} onValueChange={setDiscKind}>
                      <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">% do valor</SelectItem>
                        <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" step="0.01" placeholder={discKind === "percent" ? "Ex.: 50" : "Ex.: 200.00"} value={discValue} onChange={(e) => setDiscValue(e.target.value)} className="rounded-xl" />
                  </div>
                  <Input placeholder="Motivo (bolsa social, irmão, mérito...)" value={discReason} onChange={(e) => setDiscReason(e.target.value)} className="rounded-xl" />
                  <Button onClick={handleAddDiscount} disabled={savingDisc} className="rounded-xl font-black w-full">
                    {savingDisc ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-2xl rounded-card overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Aluno</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Plano</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Valor</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Bolsas/Descontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhum aluno vinculado a plano ainda.</td></tr>
                    )}
                    {subs.map((s) => {
                      const st = studentById[s.student_id];
                      const plan = plans.find((p) => p.id === s.plan_id);
                      const ds = discounts.filter((d) => d.student_id === s.student_id);
                      return (
                        <tr key={s.id} className="border-b hover:bg-muted/20">
                          <td className="p-4 font-semibold">{st?.name ?? "—"}</td>
                          <td className="p-4">{plan?.name ?? "—"} ({s.school_year})</td>
                          <td className="p-4 font-bold">{brl(s.custom_amount ?? plan?.base_amount ?? 0)}</td>
                          <td className="p-4">
                            {ds.length === 0 ? <span className="text-muted-foreground">—</span> : (
                              <div className="flex flex-wrap gap-1">
                                {ds.map((d) => (
                                  <Badge key={d.id} variant="outline" className="font-bold cursor-pointer" title={`${d.reason} — clique para remover`}
                                    onClick={() => handleRemoveDiscount(d.id)}>
                                    {d.kind === "percent" ? `${Number(d.value)}%` : brl(d.value)} ✕
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog: registrar pagamento ── */}
      <Dialog open={!!payInvoice} onOpenChange={(o) => !o && setPayInvoice(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black italic">Registrar pagamento</DialogTitle>
            <DialogDescription>
              {payInvoice && `${studentById[payInvoice.student_id]?.name ?? "Aluno"} — competência ${format(new Date(payInvoice.competence + "T12:00:00"), "MM/yyyy")}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold uppercase">Forma de pagamento</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METODO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase">Valor pago (R$)</Label>
              <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase">Observação</Label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="rounded-xl" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setPayInvoice(null)}>Cancelar</Button>
            <Button onClick={handlePay} disabled={acting} className="rounded-xl font-black">
              {acting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: renegociar ── */}
      <Dialog open={!!renegInvoice} onOpenChange={(o) => !o && setRenegInvoice(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black italic">Renegociar fatura</DialogTitle>
            <DialogDescription>Novo vencimento e, se necessário, novo valor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold uppercase">Novo vencimento</Label>
              <Input type="date" value={renegDue} onChange={(e) => setRenegDue(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase">Novo valor (opcional)</Label>
              <Input type="number" step="0.01" value={renegAmount} onChange={(e) => setRenegAmount(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase">Observação</Label>
              <Textarea value={renegNotes} onChange={(e) => setRenegNotes(e.target.value)} className="rounded-xl" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setRenegInvoice(null)}>Cancelar</Button>
            <Button onClick={handleReneg} disabled={acting || !renegDue} className="rounded-xl font-black">
              {acting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Renegociar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: histórico ── */}
      <Dialog open={!!historyInvoice} onOpenChange={(o) => !o && setHistoryInvoice(null)}>
        <DialogContent className="rounded-3xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black italic">Histórico da fatura</DialogTitle>
            <DialogDescription>
              {historyInvoice && `${studentById[historyInvoice.student_id]?.name ?? ""} — ${format(new Date(historyInvoice.competence + "T12:00:00"), "MM/yyyy")}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {historyEvents.length === 0 && <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>}
            {historyEvents.map((ev) => (
              <div key={ev.id} className="border rounded-xl p-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-black uppercase text-xs tracking-widest">{ev.action}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(ev.created_at), "dd/MM/yyyy HH:mm")}</span>
                </div>
                {Object.keys(ev.details || {}).length > 0 && (
                  <pre className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap break-all">
                    {Object.entries(ev.details).map(([k, v]) => `${k}: ${String(v ?? "—")}`).join("\n")}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
