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
import { useTenant } from "@/components/TenantProvider";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtDate, fmtBRL as fmtBRLSafe, txt } from '@/lib/format';
import { EmptyState } from "@/components/EmptyState";

interface Teacher { id: string; name: string | null; email: string | null }
interface Rate { teacher_id: string; rate_type: string; amount: number; notes: string | null }
interface Payment {
  id: string; teacher_id: string; reference_month: string; amount: number;
  status: string; notes: string | null; created_at: string; paid_at: string | null;
}

const RATE_LABEL: Record<string, string> = { monthly: "Mensal", hourly: "Por hora", per_class: "Por aula" };
// Valor ausente vira R$ 0,00 (como antes); valor ilegível nunca vira "R$ NaN".
const fmtBRL = (v: unknown) => fmtBRLSafe(v, "R$ 0,00");
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export default function SecretaryFinancePage() {
  const { userRole, user, profile, loading: isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { tenant } = useTenant();

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
      const [y, m] = (p.reference_month || "").split("-");
      return y && m ? fmtDate(new Date(Number(y), Number(m) - 1, 1), "MMMM 'de' yyyy") : p.reference_month;
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
          <div class="header"><div class="logo">${esc(tenant.branding.appName)}</div><div class="sub">Recibo de Pagamento</div></div>
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
        <p className="u-label">Carregando financeiro…</p>
      </div>
    );
  }

  const totalPending = payments.filter(p => p.status === "pending").reduce((a, p) => a + Number(p.amount), 0);
  const totalPaid = payments.filter(p => p.status === "paid").reduce((a, p) => a + Number(p.amount), 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho */}
      <div>
        <p className="u-label flex items-center gap-2"><Wallet className="h-3.5 w-3.5" /> Secretaria · pagamento de professores</p>
        <h1 className="u-page-title text-3xl mt-1">Professores</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Defina o valor a pagar de cada professor e gere os recibos por período.
        </p>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Cor só como sinal: verde = pago. Pendente é ausência de estado → neutro. */}
        <Card className="rounded-card shadow-none p-5">
          <p className="u-label flex items-center gap-2"><DollarSign className="h-3.5 w-3.5" /> Professores</p>
          <p className="u-num text-2xl mt-2">{teachers.length}</p>
        </Card>
        <Card className="rounded-card shadow-none p-5">
          <p className="u-label flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Recibos pendentes</p>
          <p className="u-num text-xl sm:text-2xl mt-2 break-words">{fmtBRL(totalPending)}</p>
        </Card>
        <Card className="rounded-card shadow-none p-5 col-span-2 sm:col-span-1">
          <p className="u-label !text-emerald-600 flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Já pago</p>
          <p className="u-num text-xl sm:text-2xl mt-2 text-emerald-600 break-words">{fmtBRL(totalPaid)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Lista de professores */}
        <Card className="lg:col-span-2 rounded-card shadow-none p-5 space-y-4 h-fit">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar professor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-muted/30 border-none rounded-control text-sm"
            />
          </div>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {loading ? (
              Array(4).fill(0).map((_, i) => <div key={i} className="h-[60px] rounded-control bg-muted animate-pulse" />)
            ) : filteredTeachers.length === 0 ? (
              <EmptyState
                compact
                icon={UserRound}
                title={search ? "Nenhum professor com esse nome" : "Nenhum professor cadastrado"}
                description={search ? "Confira a grafia ou limpe a busca." : "Professores cadastrados pelo administrador aparecem aqui."}
                action={search ? { label: "Limpar busca", onClick: () => setSearch("") } : undefined}
              />
            ) : filteredTeachers.map((t) => {
              const r = rates[t.id];
              const isSel = selectedId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTeacher(t)}
                  className={`w-full flex items-center gap-3 p-3 rounded-control border transition-colors text-left ${isSel ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                >
                  <div className="h-9 w-9 rounded-control bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{txt(t.name, "Sem nome")}</p>
                    <p className="text-xs text-muted-foreground">
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
            <EmptyState
              icon={Wallet}
              title="Nenhum professor selecionado"
              description="Escolha um professor na lista para definir o valor a pagar e gerar recibos."
            />
          ) : (
            <>
              {/* Valor a pagar */}
              <Card className="rounded-card shadow-none p-6 space-y-4">
                <div>
                  <p className="u-label flex items-center gap-2"><DollarSign className="h-3.5 w-3.5" /> Valor a pagar</p>
                  <h2 className="text-lg font-bold mt-1 truncate">{txt(selected.name, "Sem nome")}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="u-label ml-1">Tipo</Label>
                    <Select value={rateType} onValueChange={setRateType}>
                      <SelectTrigger className="h-11 rounded-control bg-muted/30 border-none text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-control">
                        <SelectItem value="monthly" className="text-sm">Mensal</SelectItem>
                        <SelectItem value="hourly" className="text-sm">Por hora</SelectItem>
                        <SelectItem value="per_class" className="text-sm">Por aula</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="u-label ml-1">Valor (R$)</Label>
                    <Input
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={rateAmount} onChange={(e) => setRateAmount(e.target.value)}
                      placeholder="0,00"
                      className="h-11 bg-muted/30 border-none rounded-control text-sm"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveRate} disabled={savingRate} variant="outline" className="w-full h-11 rounded-control font-bold">
                  {savingRate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar valor
                </Button>
              </Card>

              {/* Gerar recibo */}
              <Card className="rounded-card shadow-none p-6 space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-muted-foreground" /> Gerar recibo
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="u-label ml-1">Mês de referência</Label>
                    <Input type="month" value={refMonth} onChange={(e) => setRefMonth(e.target.value)} className="h-11 bg-muted/30 border-none rounded-control text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="u-label ml-1">Valor (R$)</Label>
                    <Input type="number" min="0" step="0.01" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0,00" className="h-11 bg-muted/30 border-none rounded-control text-sm" />
                  </div>
                </div>
                <Button onClick={handleCreatePayment} disabled={creatingPay} variant="arcade" className="w-full h-11 rounded-control font-bold">
                  {creatingPay ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Gerar recibo
                </Button>
              </Card>

              {/* Histórico de recibos */}
              <Card className="rounded-card shadow-none overflow-hidden">
                <div className="p-6 pb-2">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" /> Recibos <span className="u-num text-base text-muted-foreground">{selectedPayments.length}</span>
                  </h2>
                </div>
                <div className="p-4 pt-2 space-y-2">
                  {selectedPayments.length === 0 ? (
                    <EmptyState compact icon={Receipt} title="Nenhum recibo gerado ainda" description="Use “Gerar recibo” acima para criar o primeiro deste professor." />
                  ) : selectedPayments.map((p) => {
                    const [y, m] = (p.reference_month || "").split("-");
                    const monthLabel = y && m ? fmtDate(new Date(Number(y), Number(m) - 1, 1), "MMM/yy") : txt(p.reference_month);
                    const paid = p.status === "paid";
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-control border border-border">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="u-num text-sm">{fmtBRL(p.amount)}</span>
                            <Badge className={`border-none font-bold text-[10px] px-2 h-5 ${paid ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                              {paid ? "Pago" : "Pendente"}
                            </Badge>
                          </div>
                          <p className="u-label mt-1">Ref. {monthLabel}</p>
                        </div>
                        <button onClick={() => togglePaid(p)} title={paid ? "Marcar como pendente" : "Marcar como pago"} aria-label={paid ? "Marcar como pendente" : "Marcar como pago"} className={`h-9 w-9 rounded-control flex items-center justify-center transition-colors ${paid ? "text-emerald-600 hover:bg-emerald-50" : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"}`}>
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => printReceipt(p)} title="Imprimir recibo" aria-label="Imprimir recibo" className="h-9 w-9 rounded-control flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
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
