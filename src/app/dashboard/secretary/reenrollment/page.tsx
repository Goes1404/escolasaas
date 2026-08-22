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
import {
  FileSignature, Loader2, Plus, Rocket, Printer, Megaphone, Search,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { esc, openPrintWindow, brl } from "@/lib/print-utils";
import { format } from "date-fns";

interface Campaign {
  id: string; school_year: number; title: string; contract_template: string;
  plan_id: string; status: string; starts_at: string | null; ends_at: string | null;
}
interface Plan { id: string; name: string; school_year: number; base_amount: number }
interface Agreement {
  id: string; campaign_id: string; student_id: string; status: string;
  decided_at: string | null; signer_name: string | null; signer_cpf: string | null;
  signed_via: string | null; ip_address: string | null; contract_snapshot: string | null;
  amount_snapshot: number | null; refusal_reason: string | null;
}
interface StudentLite { id: string; name: string | null; sala: string | null }

const AG_STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
  aceito:   { label: "Aceito",   cls: "bg-emerald-100 text-emerald-700" },
  recusado: { label: "Recusado", cls: "bg-red-100 text-red-700" },
};

const TEMPLATE_PADRAO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS — ANO LETIVO {{ano}}

Pelo presente instrumento, o(a) responsável abaixo assinado formaliza a rematrícula do(a) estudante {{aluno}} para o ano letivo de {{ano}}, pelo valor mensal de R$ {{valor}}.

O aceite eletrônico deste contrato, com nome completo e CPF do responsável, tem validade jurídica nos termos do art. 10, §2º, da MP 2.200-2/2001.`;

export default function ReenrollmentPage() {
  const { userRole, loading: isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState(false);

  // Form de campanha
  const [showForm, setShowForm] = useState(false);
  const [formYear, setFormYear] = useState(String(new Date().getFullYear() + 1));
  const [formTitle, setFormTitle] = useState("");
  const [formPlan, setFormPlan] = useState("");
  const [formTemplate, setFormTemplate] = useState(TEMPLATE_PADRAO);

  useEffect(() => {
    if (!isUserLoading && userRole !== "staff" && userRole !== "admin") {
      router.replace("/dashboard/home");
    }
  }, [userRole, isUserLoading, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, planRes, stRes] = await Promise.all([
        supabase.from("reenrollment_campaigns").select("*").order("school_year", { ascending: false }),
        supabase.from("tuition_plans").select("id, name, school_year, base_amount").order("school_year", { ascending: false }),
        supabase.from("profiles").select("id, name, sala").eq("role", "student"),
      ]);
      const camps = (campRes.data as Campaign[]) || [];
      setCampaigns(camps);
      setPlans((planRes.data as Plan[]) || []);
      setStudents((stRes.data as StudentLite[]) || []);
      if (camps.length > 0 && !selectedCampaign) setSelectedCampaign(camps[0].id);
    } catch (e: any) {
      toast({ title: "Erro ao carregar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedCampaign]);

  useEffect(() => { if (userRole === "staff" || userRole === "admin") fetchAll(); }, [fetchAll, userRole]);

  const fetchAgreements = useCallback(async () => {
    if (!selectedCampaign) { setAgreements([]); return; }
    const { data } = await supabase
      .from("reenrollment_agreements").select("*")
      .eq("campaign_id", selectedCampaign);
    setAgreements((data as Agreement[]) || []);
  }, [selectedCampaign]);

  useEffect(() => { fetchAgreements(); }, [fetchAgreements]);

  const studentById = useMemo(() => {
    const m: Record<string, StudentLite> = {};
    students.forEach((s) => { m[s.id] = s; });
    return m;
  }, [students]);

  const campaign = campaigns.find((c) => c.id === selectedCampaign) || null;

  const funil = useMemo(() => ({
    pendentes: agreements.filter((a) => a.status === "pendente").length,
    aceitos: agreements.filter((a) => a.status === "aceito").length,
    recusados: agreements.filter((a) => a.status === "recusado").length,
    total: agreements.length,
  }), [agreements]);

  const filtered = useMemo(() => agreements.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    const st = studentById[a.student_id];
    if (search && !(st?.name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [agreements, filterStatus, search, studentById]);

  const handleCreateCampaign = async () => {
    if (!formTitle || !formPlan || !formTemplate) {
      toast({ title: "Preencha título, plano e contrato", variant: "destructive" });
      return;
    }
    setActing(true);
    try {
      const { data, error } = await supabase.from("reenrollment_campaigns").insert({
        school_year: Number(formYear),
        title: formTitle,
        contract_template: formTemplate,
        plan_id: formPlan,
      }).select().single();
      if (error) throw error;
      toast({ title: "Campanha criada (rascunho)" });
      setShowForm(false);
      setSelectedCampaign((data as Campaign).id);
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erro ao criar campanha", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const handleOpenCampaign = async () => {
    if (!campaign) return;
    setActing(true);
    try {
      const { data, error } = await supabase.rpc("open_reenrollment_campaign", { p_campaign_id: campaign.id });
      if (error) throw error;
      toast({ title: "Campanha aberta", description: `${data?.novas_pendencias ?? 0} nova(s) pendência(s) criadas.` });
      fetchAll(); fetchAgreements();
    } catch (e: any) {
      toast({ title: "Erro ao abrir campanha", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const handleCloseCampaign = async () => {
    if (!campaign) return;
    const { error } = await supabase.from("reenrollment_campaigns")
      .update({ status: "encerrada" }).eq("id", campaign.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Campanha encerrada" }); fetchAll(); }
  };

  const handleNotify = async () => {
    if (!campaign) return;
    setActing(true);
    try {
      const res = await fetch("/api/admin/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Rematrícula ${campaign.school_year} aberta`,
          message: `A rematrícula para o ano letivo de ${campaign.school_year} está aberta. Acesse a plataforma (ou o portal do responsável) para ler o contrato e confirmar a vaga.`,
          priority: "high",
          target_group: "all",
          audience: "all",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Falha ao publicar aviso");
      toast({ title: "Aviso publicado para alunos e responsáveis 📣" });
    } catch (e: any) {
      toast({ title: "Erro ao avisar", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const printContract = (a: Agreement) => {
    const st = studentById[a.student_id];
    openPrintWindow({
      title: `Contrato de Rematrícula ${campaign?.school_year ?? ""}`,
      codePrefix: "CTR",
      signatureTitle: "Registro de aceite eletrônico",
      contentHtml: `
        <div style="white-space: pre-wrap;">${esc(a.contract_snapshot ?? "")}</div>
        <table>
          <tr><th>Aluno</th><td>${esc(st?.name ?? "")}</td></tr>
          <tr><th>Signatário</th><td>${esc(a.signer_name ?? "")} (CPF ${esc(a.signer_cpf ?? "")})</td></tr>
          <tr><th>Valor</th><td>${esc(brl(a.amount_snapshot))}</td></tr>
          <tr><th>Aceito em</th><td>${esc(a.decided_at ? format(new Date(a.decided_at), "dd/MM/yyyy HH:mm") : "")}</td></tr>
          <tr><th>Origem</th><td>${esc(a.signed_via === "guardian_portal" ? "Portal do responsável" : "Plataforma do aluno")} — IP ${esc(a.ip_address ?? "—")}</td></tr>
        </table>
      `,
    });
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
            <FileSignature className="h-8 w-8" /> Rematrícula
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Campanhas por ano letivo, contrato digital e funil de adesão.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {campaigns.length > 0 && (
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-64 rounded-xl"><SelectValue placeholder="Campanha" /></SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title} ({c.school_year}) — {c.status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setShowForm((v) => !v)} variant="outline" className="rounded-xl font-black">
            <Plus className="h-4 w-4 mr-2" /> Nova campanha
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="shadow-2xl rounded-[2.5rem]">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-black italic text-lg">Nova campanha de rematrícula</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-bold uppercase">Ano letivo (alvo)</Label>
                <Input type="number" value={formYear} onChange={(e) => setFormYear(e.target.value)} className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase">Título</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder={`Rematrícula ${Number(formYear)}`} className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase">Plano de mensalidade</Label>
                <Select value={formPlan} onValueChange={setFormPlan}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Plano do ano alvo" /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {brl(p.base_amount)} ({p.school_year})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase">Contrato (use {"{{aluno}}"}, {"{{valor}}"}, {"{{ano}}"})</Label>
              <Textarea value={formTemplate} onChange={(e) => setFormTemplate(e.target.value)} rows={8} className="rounded-xl font-mono text-xs" />
            </div>
            <Button onClick={handleCreateCampaign} disabled={acting} className="rounded-xl font-black">
              {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Criar campanha
            </Button>
          </CardContent>
        </Card>
      )}

      {campaign && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={`font-black ${campaign.status === "ativa" ? "bg-emerald-100 text-emerald-700" : campaign.status === "encerrada" ? "bg-gray-200 text-gray-500" : "bg-amber-100 text-amber-700"}`}>
              {campaign.status.toUpperCase()}
            </Badge>
            {campaign.status !== "encerrada" && (
              <Button onClick={handleOpenCampaign} disabled={acting} className="rounded-xl font-black">
                <Rocket className="h-4 w-4 mr-2" />
                {campaign.status === "ativa" ? "Reprocessar pendências" : "Abrir campanha"}
              </Button>
            )}
            {campaign.status === "ativa" && (
              <>
                <Button onClick={handleNotify} disabled={acting} variant="outline" className="rounded-xl font-black">
                  <Megaphone className="h-4 w-4 mr-2" /> Avisar alunos e responsáveis
                </Button>
                <Button onClick={handleCloseCampaign} variant="outline" className="rounded-xl font-black text-red-600">
                  Encerrar campanha
                </Button>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-2xl rounded-[2.5rem]"><CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-black uppercase tracking-widest"><FileSignature className="h-4 w-4" /> Total</div>
              <p className="text-2xl font-black mt-2">{funil.total}</p>
            </CardContent></Card>
            <Card className="shadow-2xl rounded-[2.5rem]"><CardContent className="p-6">
              <div className="flex items-center gap-2 text-amber-600 text-xs font-black uppercase tracking-widest"><Clock className="h-4 w-4" /> Pendentes</div>
              <p className="text-2xl font-black mt-2 text-amber-600">{funil.pendentes}</p>
            </CardContent></Card>
            <Card className="shadow-2xl rounded-[2.5rem]"><CardContent className="p-6">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-black uppercase tracking-widest"><CheckCircle2 className="h-4 w-4" /> Aceitos</div>
              <p className="text-2xl font-black mt-2 text-emerald-600">{funil.aceitos}</p>
              <p className="text-xs text-muted-foreground mt-1">{funil.total > 0 ? Math.round((funil.aceitos / funil.total) * 100) : 0}% de adesão</p>
            </CardContent></Card>
            <Card className="shadow-2xl rounded-[2.5rem]"><CardContent className="p-6">
              <div className="flex items-center gap-2 text-red-600 text-xs font-black uppercase tracking-widest"><XCircle className="h-4 w-4" /> Recusados</div>
              <p className="text-2xl font-black mt-2 text-red-600">{funil.recusados}</p>
            </CardContent></Card>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56 rounded-xl" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="aceito">Aceitos</SelectItem>
                <SelectItem value="recusado">Recusados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="shadow-2xl rounded-[2.5rem] overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Aluno</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Turma</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Status</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest">Decisão</th>
                      <th className="p-4 font-black uppercase text-xs tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                        {campaign.status === "rascunho"
                          ? 'Campanha em rascunho — clique em "Abrir campanha" para gerar as pendências.'
                          : "Nenhuma adesão com esse filtro."}
                      </td></tr>
                    )}
                    {filtered.map((a) => {
                      const st = studentById[a.student_id];
                      const meta = AG_STATUS[a.status];
                      return (
                        <tr key={a.id} className="border-b hover:bg-muted/20">
                          <td className="p-4 font-semibold">{st?.name ?? "—"}</td>
                          <td className="p-4">{st?.sala ?? "—"}</td>
                          <td className="p-4"><Badge className={`${meta.cls} font-black`}>{meta.label}</Badge></td>
                          <td className="p-4 text-muted-foreground">
                            {a.decided_at ? (
                              <>
                                {format(new Date(a.decided_at), "dd/MM/yyyy HH:mm")}
                                {a.signer_name ? ` — ${a.signer_name}` : ""}
                                {a.status === "recusado" && a.refusal_reason ? ` (${a.refusal_reason})` : ""}
                              </>
                            ) : "—"}
                          </td>
                          <td className="p-4 text-right">
                            {a.status === "aceito" && (
                              <Button size="sm" variant="outline" className="rounded-lg h-8" title="Imprimir contrato aceito" onClick={() => printContract(a)}>
                                <Printer className="h-4 w-4" />
                              </Button>
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
        </>
      )}

      {!campaign && !showForm && (
        <Card className="rounded-[2.5rem] shadow-2xl">
          <CardContent className="p-10 text-center text-muted-foreground">
            Nenhuma campanha ainda. Crie a primeira com "Nova campanha" — você precisa antes de um plano de mensalidade do ano alvo (aba Planos em Mensalidades).
          </CardContent>
        </Card>
      )}
    </div>
  );
}
