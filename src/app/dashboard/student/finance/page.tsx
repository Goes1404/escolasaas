"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, BadgePercent, Receipt } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { brl } from "@/lib/print-utils";
import { format } from "date-fns";
import { fmtDate, fmtNumber, toNumber, txt } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';

interface Invoice {
  id: string; competence: string; base_amount: number; discount_amount: number;
  final_amount: number; due_date: string; status: string;
  payment_method: string | null; paid_at: string | null; paid_amount: number | null;
}
interface Subscription { id: string; plan_id: string; school_year: number; custom_amount: number | null; status: string }
interface Plan { id: string; name: string; base_amount: number; due_day: number }
interface Discount { id: string; kind: string; value: number; reason: string }

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta", paga: "Paga", vencida: "Vencida", cancelada: "Cancelada", negociada: "Negociada",
};
const STATUS_STYLE: Record<string, string> = {
  // Em aberto é ausência de estado, e ausência é neutra (ver secretary/tuition).
  aberta: "bg-muted text-foreground/70",
  paga: "bg-emerald-100 text-emerald-700",
  vencida: "bg-red-100 text-red-700",
  cancelada: "bg-gray-200 text-gray-500",
  negociada: "bg-amber-100 text-amber-700",
};
const METODO_LABEL: Record<string, string> = {
  pix: "PIX", dinheiro: "Dinheiro", cartao: "Cartão", transferencia: "Transferência", boleto: "Boleto",
};

const statusLabel = (s: string) => STATUS_LABEL[s] ?? txt(s);
const statusStyle = (s: string) => STATUS_STYLE[s] ?? "bg-muted text-foreground/70";
const metodoLabel = (m: string) => METODO_LABEL[m] ?? txt(m, "");

const displayStatus = (inv: Invoice) =>
  inv.status === "aberta" && inv.due_date < format(new Date(), "yyyy-MM-dd") ? "vencida" : inv.status;

export default function StudentFinancePage() {
  const { user, loading: isUserLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // RLS garante que só as linhas do próprio aluno voltam.
      const [invRes, subRes, discRes] = await Promise.all([
        supabase.from("invoices").select("*").order("competence", { ascending: false }),
        supabase.from("student_plan_subscriptions").select("*").eq("status", "ativa")
          .order("school_year", { ascending: false }).limit(1),
        supabase.from("student_discounts").select("id, kind, value, reason").eq("active", true),
      ]);
      setInvoices((invRes.data as Invoice[]) || []);
      const sub = (subRes.data?.[0] as Subscription) || null;
      setSubscription(sub);
      setDiscounts((discRes.data as Discount[]) || []);
      if (sub) {
        const { data: pl } = await supabase.from("tuition_plans")
          .select("id, name, base_amount, due_day").eq("id", sub.plan_id).maybeSingle();
        setPlan((pl as Plan) || null);
      }
    } catch (e: any) {
      toast({ title: "Não conseguimos carregar suas mensalidades", description: "Confira sua internet e abra a página de novo. Se continuar, fale com a secretaria.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const emAberto = useMemo(
    () => invoices.filter((i) => ["aberta", "vencida", "negociada"].includes(i.status)),
    [invoices]
  );

  if (isUserLoading || loading) {
    return (
      <div className="space-y-8" aria-label="Carregando…">
        <Skeleton className="h-14 w-64 rounded-control" />
        <div className="grid md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-card" />)}
        </div>
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="u-page-title text-3xl flex items-center gap-3">
          <Wallet className="h-8 w-8" /> Financeiro
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Suas mensalidades e o plano vigente. Pagamentos são registrados pela secretaria.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-2xl rounded-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-black uppercase tracking-widest">
              <Receipt className="h-4 w-4" /> Plano
            </div>
            <p className="text-lg font-black mt-2">{plan ? txt(plan.name, "Seu plano") : "Você ainda não tem um plano"}</p>
            {plan ? (
              <p className="text-sm text-muted-foreground mt-1">
                {brl(subscription?.custom_amount ?? plan.base_amount)}/mês
                {toNumber(plan.due_day) !== null && <> — vence dia {plan.due_day}</>}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">A secretaria vincula o plano quando faz sua matrícula.</p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-2xl rounded-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-black uppercase tracking-widest">
              <BadgePercent className="h-4 w-4" /> Bolsas e descontos
            </div>
            {discounts.length === 0 ? (
              <p className="text-sm mt-2 text-muted-foreground">Você não tem bolsa nem desconto ativo agora.</p>
            ) : (
              <div className="mt-2 space-y-1">
                {discounts.map((d) => (
                  <p key={d.id} className="text-sm font-bold">
                    {d.kind === "percent" ? `${fmtNumber(d.value)}%` : brl(d.value)}
                    {d.reason && <span className="text-muted-foreground font-normal"> ({d.reason})</span>}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-2xl rounded-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-black uppercase tracking-widest">
              <Wallet className="h-4 w-4" /> Em aberto
            </div>
            <p className="text-2xl font-black mt-2">
              {brl(emAberto.reduce((acc, i) => acc + (toNumber(i.final_amount) ?? 0), 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {emAberto.length === 0 ? "Nenhuma mensalidade em aberto" : `${emAberto.length} ${emAberto.length === 1 ? "mensalidade" : "mensalidades"}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-2xl rounded-card overflow-hidden">
        <CardContent className="p-0">
          {/* Celular: uma fatura por cartão. A tabela de cinco colunas não
              cabia em 360px e precisava rolar para o lado. */}
          <ul className="sm:hidden divide-y">
            {invoices.length === 0 && (
              <li className="p-4">
                <EmptyState
                  icon={Receipt}
                  title="Ainda não há mensalidades por aqui"
                  description="Quando a secretaria gerar suas mensalidades, cada uma aparece aqui com valor, vencimento e situação."
                  compact
                  className="border-none bg-transparent"
                />
              </li>
            )}
            {invoices.map((inv) => {
              const ds = displayStatus(inv);
              return (
                <li key={inv.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="u-label">{fmtDate(inv.competence, "MM/yyyy")}</span>
                    <Badge className={`${statusStyle(ds)} font-black shrink-0`}>{statusLabel(ds)}</Badge>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="u-num text-lg tabular-nums whitespace-nowrap">{brl(inv.final_amount)}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">vence {fmtDate(inv.due_date, "dd/MM/yyyy")}</span>
                  </div>
                  {Number(inv.discount_amount) > 0 && (
                    <p className="text-xs text-emerald-600">Desconto de {brl(inv.discount_amount)}</p>
                  )}
                  {inv.status === "paga" && inv.paid_at && (
                    <p className="text-xs text-muted-foreground">
                      Pago{inv.payment_method ? ` via ${metodoLabel(inv.payment_method)}` : ""} em {fmtDate(inv.paid_at, "dd/MM/yyyy")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-4 font-black uppercase text-xs tracking-widest">Mês</th>
                  <th className="p-4 font-black uppercase text-xs tracking-widest">Valor</th>
                  <th className="p-4 font-black uppercase text-xs tracking-widest">Vencimento</th>
                  <th className="p-4 font-black uppercase text-xs tracking-widest">Situação</th>
                  <th className="p-4 font-black uppercase text-xs tracking-widest">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={5} className="p-4">
                    <EmptyState
                      icon={Receipt}
                      title="Ainda não há mensalidades por aqui"
                      description="Quando a secretaria gerar suas mensalidades, cada uma aparece aqui com valor, vencimento e situação."
                      compact
                      className="border-none bg-transparent"
                    />
                  </td></tr>
                )}
                {invoices.map((inv) => {
                  const ds = displayStatus(inv);
                  return (
                    <tr key={inv.id} className="border-b hover:bg-muted/20">
                      <td className="p-4 font-semibold">{fmtDate(inv.competence, "MM/yyyy")}</td>
                      <td className="p-4 font-bold">
                        {brl(inv.final_amount)}
                        {Number(inv.discount_amount) > 0 && (
                          <span className="text-xs text-emerald-600 ml-1">(-{brl(inv.discount_amount)})</span>
                        )}
                      </td>
                      <td className="p-4">{fmtDate(inv.due_date, "dd/MM/yyyy")}</td>
                      <td className="p-4"><Badge className={`${statusStyle(ds)} font-black`}>{statusLabel(ds)}</Badge></td>
                      <td className="p-4 text-muted-foreground">
                        {inv.status === "paga" && inv.paid_at
                          ? `${inv.payment_method ? metodoLabel(inv.payment_method) : "Pago"} em ${fmtDate(inv.paid_at, "dd/MM/yyyy")}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
