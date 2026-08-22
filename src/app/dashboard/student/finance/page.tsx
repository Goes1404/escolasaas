"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, BadgePercent, Receipt } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { brl } from "@/lib/print-utils";
import { format } from "date-fns";

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
  aberta: "bg-blue-100 text-blue-700",
  paga: "bg-emerald-100 text-emerald-700",
  vencida: "bg-red-100 text-red-700",
  cancelada: "bg-gray-200 text-gray-500",
  negociada: "bg-amber-100 text-amber-700",
};
const METODO_LABEL: Record<string, string> = {
  pix: "PIX", dinheiro: "Dinheiro", cartao: "Cartão", transferencia: "Transferência", boleto: "Boleto",
};

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
      toast({ title: "Erro ao carregar financeiro", description: e.message, variant: "destructive" });
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black italic text-primary flex items-center gap-3">
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
            <p className="text-lg font-black mt-2">{plan ? plan.name : "Nenhum plano vinculado"}</p>
            {plan && (
              <p className="text-sm text-muted-foreground mt-1">
                {brl(subscription?.custom_amount ?? plan.base_amount)}/mês — vence dia {plan.due_day}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-2xl rounded-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-black uppercase tracking-widest">
              <BadgePercent className="h-4 w-4" /> Bolsas e descontos
            </div>
            {discounts.length === 0 ? (
              <p className="text-lg font-black mt-2 text-muted-foreground">—</p>
            ) : (
              <div className="mt-2 space-y-1">
                {discounts.map((d) => (
                  <p key={d.id} className="text-sm font-bold">
                    {d.kind === "percent" ? `${Number(d.value)}%` : brl(d.value)}{" "}
                    <span className="text-muted-foreground font-normal">({d.reason})</span>
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-2xl rounded-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-blue-600 text-xs font-black uppercase tracking-widest">
              <Wallet className="h-4 w-4" /> Em aberto
            </div>
            <p className="text-2xl font-black mt-2 text-blue-600">
              {brl(emAberto.reduce((acc, i) => acc + Number(i.final_amount), 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{emAberto.length} fatura(s)</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-2xl rounded-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-4 font-black uppercase text-xs tracking-widest">Competência</th>
                  <th className="p-4 font-black uppercase text-xs tracking-widest">Valor</th>
                  <th className="p-4 font-black uppercase text-xs tracking-widest">Vencimento</th>
                  <th className="p-4 font-black uppercase text-xs tracking-widest">Status</th>
                  <th className="p-4 font-black uppercase text-xs tracking-widest">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Nenhuma mensalidade registrada ainda.
                  </td></tr>
                )}
                {invoices.map((inv) => {
                  const ds = displayStatus(inv);
                  return (
                    <tr key={inv.id} className="border-b hover:bg-muted/20">
                      <td className="p-4 font-semibold">{format(new Date(inv.competence + "T12:00:00"), "MM/yyyy")}</td>
                      <td className="p-4 font-bold">
                        {brl(inv.final_amount)}
                        {Number(inv.discount_amount) > 0 && (
                          <span className="text-xs text-emerald-600 ml-1">(-{brl(inv.discount_amount)})</span>
                        )}
                      </td>
                      <td className="p-4">{format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy")}</td>
                      <td className="p-4"><Badge className={`${STATUS_STYLE[ds]} font-black`}>{STATUS_LABEL[ds]}</Badge></td>
                      <td className="p-4 text-muted-foreground">
                        {inv.status === "paga" && inv.paid_at
                          ? `${inv.payment_method ? METODO_LABEL[inv.payment_method] : ""} em ${format(new Date(inv.paid_at), "dd/MM/yyyy")}`
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
