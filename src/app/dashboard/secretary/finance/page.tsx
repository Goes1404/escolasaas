"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Wallet, Search, Loader2, UserRound, Save, Receipt, Printer, CheckCircle2,
  Clock, DollarSign, Plus,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Teacher { id: string; name: string | null; email: string | null }
interface Rate { teacher_id: string; rate_type: string; amount: number; notes: string | null }
interface Payment {
  id: string; teacher_id: string; reference_month: string; amount: number;
  status: string; notes: string | null; created_at: string; paid_at: string | null;
}

const RATE_LABEL: Record<string, string> = { monthly: "Mensal", hourly: "Por hora", per_class: "Por aula" };
const fmtBRL = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export default function SecretaryFinancePage() {
  const { userRole, user, profile, loading: isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rates, setRates] = useState<Record<string, Rate>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // form: rate
  const [rateType, setRateType] = useState("monthly");
  const [rateAmount, setRateAmount] = useState("");
  const [savingRate, setSavingRate] = useState(false);

  // form: novo recibo
  const [refMonth, setRefMonth] = useState(format(new Date(), "yyyy-MM"));
  const [payAmount, setPayAmount] = useState("");
  const [creatingPay, setCreatingPay] = useState(false);

  useEffect(() => {
    if (!isUserLoading && userRole !== "staff" && userRole !== "admin") {
      router.replace("/dashboard/home");
    }
  }, [userRole, isUserLoading, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, rRes, pRes] = await Promise.all([
        supabase.from("profiles").select("id, name, email").eq("role", "teacher").order("name"),
        supabase.from("teacher_rates").select("teacher_id, rate_type, amount, notes"),
        supabase.from("teacher_payments").select("*").order("created_at", { ascending: false }),
      ]);
      setTeachers((tRes.data as Teacher[]) || []);
      const rateMap: Record<string, Rate> = {};
      (rRes.data || []).forEach((r: any) => { rateMap[r.teacher_id] = r; });
      setRates(rateMap);
      setPayments((pRes.data as Payment[]) || []);
    } catch (e: any) {
      toast({ title: "Erro ao carregar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (userRole === "staff" || userRole === "admin") fetchAll(); }, [fetchAll, userRole]);

  const selectTeacher = (t: Teacher) => {
    setSelectedId(t.id);
    const r = rates[t.id];
    setRateType(r?.rate_type || "monthly");
    setRateAmount(r ? String(r.amount) : "");
    setPayAmount(r ? String(r.amount) : "");
    setRefMonth(format(new Date(), "yyyy-MM"));
  };

  const selected = teachers.find(t => t.id === selectedId) || null;
  const selectedPayments = useMemo(
    () => payments.filter(p => p.teacher_id === selectedId),
    [payments, selectedId]
  );

  const filteredTeachers = teachers.filter(t =>
    (t.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveRate = async () => {
    if (!selected) return;
    const amount = Number(rateAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: "Valor inválido", variant: "destructive" }); return;
    }
    setSavingRate(true);
    try {
      const { error } = await supabase.from("teacher_rates").upsert({
        teacher_id: selected.id, rate_type: rateType, amount,
        updated_by: user?.id ?? null, updated_at: new Date().toISOString(),
      }, { onConflict: "teacher_id" });
      if (error) throw error;
      setRates(prev => ({ ...prev, [selected.id]: { teacher_id: selected.id, rate_type: rateType, amount, notes: null } }));
      if (!payAmount) setPayAmount(String(amount));
      toast({ title: "Valor salvo" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSavingRate(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!selected) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" }); return;
    }
    if (!refMonth) { toast({ title: "Informe o mês de referência", variant: "destructive" }); return; }
    setCreatingPay(true);
    try {
      const { data, error } = await supabase.from("teacher_payments").insert({
        teacher_id: selected.id, reference_month: refMonth, amount,
        status: "pending", created_by: user?.id ?? null,
      }).select().single();
      if (error) throw error;
      setPayments(prev => [data as Payment, ...prev]);
      toast({ title: "Recibo gerado" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar recibo", description: e.message, variant: "destructive" });
    } finally {
      setCreatingPay(false);
    }
  };

  const togglePaid = async (p: Payment) => {
    const paid = p.status !== "paid";
    const { error } = await supabase.from("teacher_payments")
      .update({ status: paid ? "paid" : "pending", paid_at: paid ? new Date().toISOString() : null })
      .eq("id", p.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setPayments(prev => prev.map(x => x.id === p.id ? { ...x, status: paid ? "paid" : "pending", paid_at: paid ? new Date().toISOString() : null } : x));
  };

  const printReceipt = (p: Payment) => {
    if (!selected) return;
    const monthLabel = (() => {
      const [y, m] = p.reference_month.split("-");
      return y && m ? format(new Date(Number(y), Number(m) - 1, 1), "MMMM 'de' yyyy", { locale: ptBR }) : p.reference_month;
    })();
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Recibo — ${esc(selected.name)}</title>
      <style>
        body{font-family:'Inter',system-ui,sans-serif;padding:50px;color:#1e293b;line-height:1.8;}
        .container{max-width:760px;margin:0 auto;border:1px solid #e2e8f0;padding:56px;border-radius:8px;}
        .header{text-align:center;border-bottom:2px solid #ea580c;padding-bottom:22px;margin-bottom:36px;}
        .logo{font-size:24px;font-weight:800;color:#ea580c;font-style:italic;}
        .sub{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#64748b;font-weight:800;margin-top:4px;}
        .title{text-align:center;font-size:20px;font-weight:800;text-transform:uppercase;margin-bottom:32px;letter-spacing:.5px;}
        .amount{font-size:30px;font-weight:800;color:#0f172a;text-align:center;margin:8px 0 28px;}
        .content{font-size:14px;text-align:justify;color:#334155;}
        .content p{margin-bottom:18px;text-indent:28px;}
        .meta{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;font-size:12px;color:#475569;margin:24px 0;}
        .sign{margin-top:80px;text-align:center;}
        .line{width:280px;border-top:1px solid #94a3b8;margin:0 auto 8px;}
        @media print{.noprint{display:none;}}
      </style></head><body>
        <div class="container">
          <div class="header"><div class="logo">Plataforma</div><div class="sub">Recibo de Pagamento</div></div>
          <div class="title">Recibo</div>
          <div class="amount">${esc(fmtBRL(Number(p.amount)))}</div>
          <div class="content">
            <p>Recebi da <strong>instituição</strong> a importância de
            <strong>${esc(fmtBRL(Number(p.amount)))}</strong>, referente aos serviços educacionais prestados
            como docente no mês de <strong>${esc(monthLabel)}</strong>.</p>
            <p>Para clareza e comprovação, firmo o presente recibo, dando plena e total quitação
            do valor referente ao período mencionado.</p>
          </div>
          <div class="meta">
            <div><strong>Professor(a):</strong> ${esc(selected.name)}</div>
            ${selected.email ? `<div><strong>E-mail:</strong> ${esc(selected.email)}</div>` : ""}
            <div><strong>Referência:</strong> ${esc(monthLabel)}</div>
            <div><strong>Situação:</strong> ${p.status === "paid" ? "PAGO" : "PENDENTE"}</div>
          </div>
          <div class="sign"><div class="line"></div><div>${esc(selected.name)}</div></div>
        </div>
        <script>window.onload=function(){window.print();}</script>
      </body></html>
    `);
    w.document.close();
  };

  if (isUserLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Carregando financeiro...</p>
      </div>
    );
  }

  const totalPending = payments.filter(p => p.status === "pending").reduce((a, p) => a + Number(p.amount), 0);
  const totalPaid = payments.filter(p => p.status === "paid").reduce((a, p) => a + Number(p.amount), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20 px-1">
      {/* Cabeçalho */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-primary italic leading-none flex items-center gap-2">
          <Wallet className="h-7 w-7 text-primary" /> Financeiro dos Professores
        </h1>
        <p className="text-muted-foreground font-medium italic text-sm">
          Defina o valor a pagar de cada professor e gere os recibos por período.
        </p>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-xl rounded-3xl bg-white p-5">
          <DollarSign className="h-5 w-5 text-slate-400 mb-2" />
          <p className="text-2xl font-black text-slate-900 tabular-nums">{teachers.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Professores</p>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl bg-white p-5">
          <Clock className="h-5 w-5 text-amber-500 mb-2" />
          <p className="text-2xl font-black text-amber-600 tabular-nums">{fmtBRL(totalPending)}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Recibos pendentes</p>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl bg-white p-5 col-span-2 sm:col-span-1">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 mb-2" />
          <p className="text-2xl font-black text-emerald-600 tabular-nums">{fmtBRL(totalPaid)}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Já pago</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Lista de professores */}
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-card bg-white p-5 space-y-4 h-fit">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar professor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-muted/30 border-none rounded-xl font-medium text-sm"
            />
          </div>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {loading ? (
              Array(4).fill(0).map((_, i) => <div key={i} className="h-[60px] rounded-2xl bg-slate-50 animate-pulse" />)
            ) : filteredTeachers.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400 italic">Nenhum professor encontrado.</p>
            ) : filteredTeachers.map((t) => {
              const r = rates[t.id];
              const isSel = selectedId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTeacher(t)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${isSel ? "border-primary bg-primary/5 shadow-md" : "border-slate-100 hover:bg-slate-50"}`}
                >
                  <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-800 truncate">{t.name || "Sem nome"}</p>
                    <p className="text-[10px] font-bold text-slate-400">
                      {r ? `${fmtBRL(Number(r.amount))} · ${RATE_LABEL[r.rate_type] || r.rate_type}` : "Sem valor definido"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Detalhe do professor */}
        <div className="lg:col-span-3 space-y-6">
          {!selected ? (
            <Card className="border-none shadow-2xl rounded-card bg-white p-12 text-center">
              <Wallet className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400 italic">Selecione um professor para definir o valor e gerar recibos.</p>
            </Card>
          ) : (
            <>
              {/* Valor a pagar */}
              <Card className="border-none shadow-2xl rounded-card bg-white p-6 space-y-4">
                <h2 className="text-lg font-black text-primary italic flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-500" /> Valor a Pagar — {selected.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Tipo</Label>
                    <Select value={rateType} onValueChange={setRateType}>
                      <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="monthly" className="font-bold text-xs">Mensal</SelectItem>
                        <SelectItem value="hourly" className="font-bold text-xs">Por hora</SelectItem>
                        <SelectItem value="per_class" className="font-bold text-xs">Por aula</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Valor (R$)</Label>
                    <Input
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={rateAmount} onChange={(e) => setRateAmount(e.target.value)}
                      placeholder="0,00"
                      className="h-12 bg-muted/30 border-none rounded-xl font-bold text-sm"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveRate} disabled={savingRate} className="w-full h-12 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest border-none">
                  {savingRate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Valor
                </Button>
              </Card>

              {/* Gerar recibo */}
              <Card className="border-none shadow-2xl rounded-card bg-white p-6 space-y-4">
                <h2 className="text-lg font-black text-primary italic flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-orange-500" /> Gerar Recibo
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Mês de referência</Label>
                    <Input type="month" value={refMonth} onChange={(e) => setRefMonth(e.target.value)} className="h-12 bg-muted/30 border-none rounded-xl font-bold text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Valor (R$)</Label>
                    <Input type="number" min="0" step="0.01" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0,00" className="h-12 bg-muted/30 border-none rounded-xl font-bold text-sm" />
                  </div>
                </div>
                <Button onClick={handleCreatePayment} disabled={creatingPay} className="w-full h-12 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest border-none">
                  {creatingPay ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Gerar Recibo
                </Button>
              </Card>

              {/* Histórico de recibos */}
              <Card className="border-none shadow-2xl rounded-card bg-white overflow-hidden">
                <div className="p-6 pb-2">
                  <h2 className="text-lg font-black text-primary italic flex items-center gap-2">
                    <Clock className="h-5 w-5 text-slate-400" /> Recibos ({selectedPayments.length})
                  </h2>
                </div>
                <div className="p-4 pt-2 space-y-2">
                  {selectedPayments.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-400 italic">Nenhum recibo gerado para este professor.</p>
                  ) : selectedPayments.map((p) => {
                    const [y, m] = p.reference_month.split("-");
                    const monthLabel = y && m ? format(new Date(Number(y), Number(m) - 1, 1), "MMM/yy", { locale: ptBR }) : p.reference_month;
                    const paid = p.status === "paid";
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-800 tabular-nums">{fmtBRL(Number(p.amount))}</span>
                            <Badge className={`border-none font-black text-[9px] uppercase px-2 h-4 ${paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {paid ? "Pago" : "Pendente"}
                            </Badge>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">Ref. {monthLabel}</p>
                        </div>
                        <button onClick={() => togglePaid(p)} title={paid ? "Marcar como pendente" : "Marcar como pago"} className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${paid ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"}`}>
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => printReceipt(p)} title="Imprimir recibo" className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors">
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
