"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSignature, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { brl } from "@/lib/print-utils";
import { format } from "date-fns";
import { fmtDate, txt } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';

interface Campaign {
  id: string; school_year: number; title: string; contract_template: string; plan_id: string;
}
interface Agreement {
  id: string; campaign_id: string; status: string; decided_at: string | null;
  signer_name: string | null; contract_snapshot: string | null; amount_snapshot: number | null;
}

export default function StudentReenrollmentPage() {
  const { user, profile, loading: isUserLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [planAmount, setPlanAmount] = useState<number | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerCpf, setSignerCpf] = useState("");
  const [acting, setActing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Campanha ativa (RLS libera SELECT de campanhas ativas para o aluno).
      const { data: camps } = await supabase
        .from("reenrollment_campaigns").select("*")
        .eq("status", "ativa").order("school_year", { ascending: false }).limit(1);
      const camp = (camps?.[0] as Campaign) || null;
      setCampaign(camp);
      if (camp) {
        const [{ data: ags }, { data: plan }] = await Promise.all([
          supabase.from("reenrollment_agreements").select("*")
            .eq("campaign_id", camp.id).eq("student_id", user.id).limit(1),
          supabase.from("tuition_plans").select("base_amount").eq("id", camp.plan_id).maybeSingle(),
        ]);
        setAgreement((ags?.[0] as Agreement) || null);
        setPlanAmount(plan ? Number((plan as { base_amount: number }).base_amount) : null);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const contratoRenderizado = (template: string) =>
    template
      .replaceAll("{{aluno}}", profile?.full_name || profile?.name || "")
      .replaceAll("{{valor}}", planAmount != null ? planAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—")
      .replaceAll("{{ano}}", String(campaign?.school_year ?? ""));

  const decide = async (action: "accept" | "refuse") => {
    if (!agreement) return;
    if (action === "accept" && (!signerName.trim() || !signerCpf.trim())) {
      toast({ title: "Faltou nome ou CPF", description: "Preencha o nome completo e o CPF do responsável para aceitar.", variant: "destructive" });
      return;
    }
    setActing(true);
    try {
      const res = await fetch("/api/reenrollment/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId: agreement.id,
          action,
          signerName: signerName.trim(),
          signerCpf: signerCpf.trim(),
          reason: action === "refuse" ? "Recusado pelo aluno na plataforma" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Só as validações do formulário viram texto na tela; erro de banco ou
        // de servidor cai na mensagem padrão.
        const amigavel = res.status === 401
          ? "Sua sessão expirou. Saia e entre de novo para continuar."
          : typeof data?.error === "string" && (data.error === "CPF inválido" || data.error.startsWith("Informe"))
            ? data.error
            : "";
        throw Object.assign(new Error(amigavel), { paraAluno: true });
      }
      toast({
        title: action === "accept" ? "Rematrícula confirmada! 🎉" : "Recusa registrada",
        description: action === "accept" ? "Sua vaga para o próximo ano está garantida." : undefined,
      });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Não deu para registrar sua resposta", description: (e?.paraAluno && e.message) || "Confira sua internet e tente de novo. Se continuar, fale com a secretaria.", variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  if (isUserLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="u-label">Carregando rematrícula…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="u-page-title text-3xl flex items-center gap-3">
          <FileSignature className="h-8 w-8" /> Rematrícula
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Garanta sua vaga para o próximo ano letivo.
        </p>
      </div>

      {!campaign && (
        <EmptyState
          icon={FileSignature}
          title="A rematrícula ainda não abriu"
          description="Quando a escola abrir a rematrícula do próximo ano, o contrato aparece aqui para seu responsável aceitar."
          action={{ label: "Voltar ao início", href: "/dashboard/home" }}
        />
      )}

      {campaign && !agreement && (
        <EmptyState
          icon={FileSignature}
          title="Seu contrato ainda não foi liberado"
          description={`A rematrícula "${txt(campaign.title, "do próximo ano")}" está aberta, mas o seu contrato ainda não foi gerado. Fale com a secretaria para liberar.`}
          action={{ label: "Falar com a secretaria", href: "/dashboard/chat" }}
        />
      )}

      {campaign && agreement && (
        <Card className="shadow-2xl rounded-card">
          <CardContent className="p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="u-display text-xl">{campaign.title}</h2>
              {agreement.status === "aceito" && (
                <Badge className="bg-emerald-100 text-emerald-700 font-black"><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aceito</Badge>
              )}
              {agreement.status === "recusado" && (
                <Badge className="bg-red-100 text-red-700 font-black"><XCircle className="h-3.5 w-3.5 mr-1" /> Recusado</Badge>
              )}
              {agreement.status === "pendente" && (
                <Badge className="bg-amber-100 text-amber-700 font-black">Pendente</Badge>
              )}
            </div>

            {planAmount != null && (
              <p className="text-sm text-muted-foreground">
                Mensalidade do ano {campaign.school_year}: <strong>{brl(planAmount)}</strong>
              </p>
            )}

            <div className="border rounded-2xl p-5 bg-muted/20 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">
              {agreement.status === "aceito" && agreement.contract_snapshot
                ? agreement.contract_snapshot
                : contratoRenderizado(campaign.contract_template)}
            </div>

            {agreement.status === "pendente" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  O aceite deve ser feito pelo seu responsável legal (nome completo + CPF valem como assinatura eletrônica).
                </p>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold uppercase">Nome do responsável</Label>
                    <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Nome completo" className="rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase">CPF do responsável</Label>
                    <Input value={signerCpf} onChange={(e) => setSignerCpf(e.target.value)} placeholder="000.000.000-00" className="rounded-xl" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => decide("accept")} disabled={acting} className="rounded-xl font-black flex-1">
                    {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Aceitar e garantir vaga
                  </Button>
                  <Button onClick={() => decide("refuse")} disabled={acting} variant="outline" className="rounded-xl font-black text-red-600">
                    Não vou renovar
                  </Button>
                </div>
              </div>
            )}

            {agreement.status === "aceito" && agreement.decided_at && (
              <p className="text-xs text-muted-foreground">
                Aceito por {txt(agreement.signer_name, "responsável")} em {fmtDate(agreement.decided_at, "dd/MM/yyyy 'às' HH:mm")}.
                Valor contratado: {brl(agreement.amount_snapshot)}.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
