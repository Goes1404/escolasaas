"use client";

import { useState, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import {
  Bell, PlusCircle, Megaphone, AlertOctagon, Info, Loader2,
  Trash2, Target, Zap, FileCheck, MonitorPlay, Clock,
  Search, Sparkles, Layers, Inbox, X, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtDate } from '@/lib/format';
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: "low" | "medium" | "high";
  target_group?: string;
  created_at: string;
  author_name?: string;
}

// Prioridade é sinal: vermelho = urgente, amarelo = importante, neutro = informativo.
const P = {
  low:    { icon: Info,         label: "Informativo", color: "text-muted-foreground", bar: "bg-border" },
  medium: { icon: Megaphone,    label: "Importante",  color: "text-foreground",       bar: "bg-brand-yellow" },
  high:   { icon: AlertOctagon, label: "Urgente",     color: "text-red-600",          bar: "bg-red-500" },
} as const;

const TEMPLATES = [
  { title: "Aula ao vivo agora",     message: "Nossa mentoria ao vivo está começando! Acesse o menu de Lives.",                          icon: MonitorPlay, priority: "medium" as const },
  { title: "Prazo de Documentação",  message: "Atenção: o envio de documentos para o SiSU encerra em 24h. Verifique o checklist.", icon: FileCheck,   priority: "high"   as const },
  { title: "Material novo",          message: "Novos simulados e PDFs liberados na biblioteca. Bons estudos!",                   icon: Zap,         priority: "low"    as const },
];

export default function CommunicationPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [cohorts, setCohorts]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [formData, setFormData] = useState({
    title: "", message: "",
    priority: "low" as "low" | "medium" | "high",
    target_group: "all",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: annData }, { data: classData }] = await Promise.all([
        supabase.from("announcements").select("*").order("created_at", { ascending: false }),
        supabase.from("classes").select("id, name").order("name"),
      ]);
      if (annData)   setAnnouncements(annData);
      if (classData) setCohorts(classData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (override?: any) => {
    const d = override || formData;
    if (!d.title?.trim() || !d.message?.trim() || !user) {
      toast({ title: "Dados incompletos", description: "Preencha título e mensagem.", variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      const payload: any = {
        title: d.title, message: d.message,
        priority: d.priority, target_group: d.target_group,
        author_id: user.id,
      };
      let { data, error } = await supabase.from("announcements").insert([payload]).select().single();
      if (error && (error.code === "42703" || error.message.includes("target_group"))) {
        const { target_group, ...fb } = payload;
        const retry = await supabase.from("announcements").insert([fb]).select().single();
        data = retry.data; error = retry.error;
      }
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        user_id: user.id,
        user_name: profile?.name || "Mentor",
        action: `Publicou aviso: ${d.title}`,
        entity_type: "announcement",
        entity_id: data.id,
      });
      fetch("/api/push/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "communication", announcementId: data.id }),
      }).catch(() => {});

      setAnnouncements(prev => [data, ...prev]);
      setFormData({ title: "", message: "", priority: "low", target_group: "all" });
      setShowComposer(false);
      toast({ title: "Comunicado publicado!", description: "Os alunos foram notificados." });
    } catch (e: any) {
      toast({ title: "Erro ao publicar", description: e.message, variant: "destructive" });
    } finally { setIsCreating(false); }
  };

  const applyTemplate = (tpl: any) => {
    setFormData({ title: tpl.title, message: tpl.message, priority: tpl.priority, target_group: "all" });
    setShowComposer(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (!error) {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast({ title: "Aviso removido." });
    }
  };

  const filtered = announcements.filter(a => {
    const q = searchTerm.toLowerCase();
    return (
      (a.title || "").toLowerCase().includes(q) ||
      (a.message || "").toLowerCase().includes(q) ||
      (cohorts.find(c => c.id === a.target_group)?.name || "").toLowerCase().includes(q)
    );
  });

  const urgentCount = announcements.filter(a => a.priority === "high").length;

  const audienceLabel = (g?: string) => {
    if (!g) return "";
    const c = cohorts.find(c => c.id === g);
    if (c) return c.name;
    return g === "all" ? "Todos" : g === "teacher" ? "Equipe" : g.toUpperCase();
  };
  const labelCls = "u-label ml-0.5";
  const inputCls = "w-full h-11 bg-background border border-border rounded-control px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors";
  const triggerCls = "h-11 bg-background border-border text-foreground rounded-control text-sm";

  return (
    <>
      <div className="pb-28 space-y-6">

        {/* ── Cabeçalho (nível médio) ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="u-label flex items-center gap-2"><Megaphone className="h-3.5 w-3.5" /> Professor · comunicados</p>
            <h1 className="u-page-title text-3xl mt-1">Comunicados</h1>
            <p className="text-muted-foreground text-sm mt-2">Avisos que aparecem no mural e chegam como notificação para os alunos.</p>
          </div>
          {!showComposer && (
            <Button onClick={() => setShowComposer(true)} variant="arcade" className="h-11 rounded-control font-bold w-full sm:w-auto">
              <PlusCircle className="h-4 w-4 mr-2" />
              Novo comunicado
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:max-w-md">
          <div className="u-surface p-3 sm:p-4">
            <p className="u-label">Publicados</p>
            <p className="u-num text-xl sm:text-2xl mt-1.5">{announcements.length}</p>
          </div>
          <div className="u-surface p-3 sm:p-4">
            <p className="u-label !text-red-600">Urgentes</p>
            <p className={`u-num text-xl sm:text-2xl mt-1.5 ${urgentCount > 0 ? "text-red-600" : ""}`}>{urgentCount}</p>
          </div>
        </div>

        {/* ── Modelos prontos ── */}
        {!showComposer && (
          <div>
            <p className="u-label px-1 mb-2">Modelos prontos</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => applyTemplate(tpl)}
                  className="flex items-center gap-2.5 u-surface hover:bg-muted/50 p-3 transition-colors touch-manipulation text-left min-w-0"
                >
                  <div className="h-8 w-8 rounded-control border border-border flex items-center justify-center shrink-0">
                    <tpl.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight truncate">{tpl.title}</p>
                    <p className={`text-[11px] mt-0.5 ${P[tpl.priority].color}`}>{P[tpl.priority].label} · usar modelo</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Novo comunicado ── */}
        {showComposer && (
          <div className="u-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="u-label flex items-center gap-1.5"><PlusCircle className="h-3.5 w-3.5" /> Novo comunicado</p>
              <button
                onClick={() => setShowComposer(false)}
                className="h-8 w-8 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors touch-manipulation"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Assunto</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Título do aviso…"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Mensagem</label>
                <Textarea
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Detalhes do comunicado…"
                  className="min-h-[90px] bg-background border-border rounded-control text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Prioridade</label>
                  <Select value={formData.priority} onValueChange={(v: any) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger className={triggerCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-control">
                      <SelectItem value="low"    className="text-sm">Informativo</SelectItem>
                      <SelectItem value="medium" className="text-sm">Importante</SelectItem>
                      <SelectItem value="high"   className="text-sm text-red-600">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Para quem</label>
                  <Select value={formData.target_group} onValueChange={v => setFormData({ ...formData, target_group: v })}>
                    <SelectTrigger className={triggerCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-control max-h-60">
                      <SelectGroup>
                        <SelectLabel className="u-label px-2 pt-2">Geral</SelectLabel>
                        <SelectItem value="all"     className="text-sm">Todos</SelectItem>
                        <SelectItem value="etec"    className="text-sm">Alunos ETEC</SelectItem>
                        <SelectItem value="enem"    className="text-sm">Alunos ENEM</SelectItem>
                        <SelectItem value="teacher" className="text-sm">Equipe</SelectItem>
                      </SelectGroup>
                      {cohorts.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="u-label px-2 pt-3 border-t border-border mt-1">Turmas</SelectLabel>
                          {cohorts.map(c => (
                            <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.priority === "high" && (
                <div className="flex items-center gap-2 border border-red-500/30 bg-red-500/5 rounded-control px-3 py-2.5">
                  <AlertOctagon className="h-4 w-4 text-red-600 shrink-0" />
                  <p className="text-xs font-semibold text-red-600">Urgente: o aviso aparece em tela cheia para os alunos.</p>
                </div>
              )}

              <Button
                onClick={() => handleCreate()}
                disabled={isCreating || !formData.title.trim()}
                className="w-full h-11 rounded-control font-bold"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {isCreating ? "Publicando…" : "Publicar comunicado"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Busca ── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar nos comunicados…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>

        {filtered.length > 0 && (
          <p className="u-label px-1">
            <span className="tabular-nums">{filtered.length}</span> comunicado{filtered.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* ── Lista ── */}
        <div className="space-y-2">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
              <p className="u-label">Carregando comunicados…</p>
            </div>
          ) : filtered.length === 0 ? (
            announcements.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Nenhum comunicado publicado"
                description="Publique um aviso para ele aparecer no mural dos alunos e chegar como notificação."
                action={!showComposer ? { label: "Criar comunicado", onClick: () => setShowComposer(true), icon: PlusCircle } : undefined}
              />
            ) : (
              <EmptyState
                icon={Search}
                title="Nenhum comunicado encontrado"
                description={`Nada corresponde a "${searchTerm}".`}
                secondary={{ label: "Limpar busca", onClick: () => setSearchTerm("") }}
              />
            )
          ) : (
            filtered.map(ann => {
              const s = P[ann.priority] || P.low;
              const Icon = s.icon;
              const cohort = cohorts.find(c => c.id === ann.target_group);

              return (
                <div key={ann.id} className="relative u-surface overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${s.bar}`} />

                  <div className="p-4 pl-5">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-control border border-border flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className={`h-4 w-4 ${s.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="font-semibold text-foreground text-sm leading-snug flex-1 break-words">{ann.title}</h3>
                          <button
                            onClick={() => handleDelete(ann.id)}
                            className="h-8 w-8 rounded-control text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors flex items-center justify-center shrink-0 touch-manipulation"
                            title="Excluir comunicado"
                            aria-label="Excluir comunicado"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                          <span className={`font-semibold ${s.color}`}>{s.label}</span>
                          {ann.target_group && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              {cohort ? <Layers className="h-3 w-3" /> : <Target className="h-3 w-3" />}
                              {audienceLabel(ann.target_group)}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
                            <Clock className="h-3 w-3" />
                            {fmtDate(ann.created_at, "dd/MM HH:mm")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line break-words">{ann.message}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
