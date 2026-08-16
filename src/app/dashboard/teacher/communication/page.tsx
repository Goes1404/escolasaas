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

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: "low" | "medium" | "high";
  target_group?: string;
  created_at: string;
  author_name?: string;
}

const P = {
  low:    { icon: Info,         label: "Informativo", color: "text-blue-400",   bg: "bg-blue-500/12",  border: "border-blue-500/20",  bar: "bg-blue-500",   glow: "rgba(59,130,246,0.15)" },
  medium: { icon: Megaphone,    label: "Importante",  color: "text-amber-400",  bg: "bg-amber-500/12", border: "border-amber-500/20", bar: "bg-amber-500",  glow: "rgba(245,158,11,0.15)" },
  high:   { icon: AlertOctagon, label: "Urgente",     color: "text-red-400",    bg: "bg-red-500/12",   border: "border-red-500/20",   bar: "bg-red-500",    glow: "rgba(239,68,68,0.18)" },
} as const;

const TEMPLATES = [
  { title: "Live Ativa Agora",       message: "Nossa mentoria ao vivo está começando! Acesse o menu de Lives.",                          icon: MonitorPlay, priority: "medium" as const },
  { title: "Prazo de Documentação",  message: "Prazo Crítico: O envio de documentos para o SiSU encerra em 24h. Verifique o checklist.", icon: FileCheck,   priority: "high"   as const },
  { title: "Material no Acervo",     message: "Novos simulados e PDFs liberados na Biblioteca Digital. Bons estudos!",                   icon: Zap,         priority: "low"    as const },
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
      toast({ title: "Comunicado publicado!", description: "A rede foi notificada." });
    } catch (e: any) {
      toast({ title: "Falha", description: e.message, variant: "destructive" });
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

  return (
    <>
      <div className="pb-28 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* ── Hero ── */}
        <div className="relative rounded-[2rem] overflow-hidden bg-[#0d0d0f] border border-white/5 p-5">
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse at 80% 10%, rgba(76,204,237,0.14) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(245,158,11,0.07) 0%, transparent 60%)",
          }} />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="h-3 w-3 text-orange-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400/80">Push · Mural</p>
              </div>
              <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">Comunicados</h1>
              <p className="text-white/60 text-xs font-semibold mt-1">Alertas em tempo real para a rede</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <div className="flex flex-col items-center bg-white/5 border border-white/8 rounded-2xl px-3 py-2 min-w-[52px]">
                <span className="text-lg font-black text-white leading-none">{announcements.length}</span>
                <span className="text-[7px] font-bold text-white/50 uppercase tracking-wider mt-0.5">Ativos</span>
              </div>
              <div className="flex flex-col items-center bg-red-500/10 border border-red-500/20 rounded-2xl px-3 py-2 min-w-[52px]">
                <span className="text-lg font-black text-red-400 leading-none">{urgentCount}</span>
                <span className="text-[7px] font-bold text-red-400/70 uppercase tracking-wider mt-0.5">Urgente</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── CTA button ── */}
        {!showComposer && (
          <button
            onClick={() => setShowComposer(true)}
            className="w-full h-13 flex items-center justify-center gap-2 bg-[#4CCCED] hover:bg-orange-600 active:scale-[0.97] text-white font-black rounded-2xl shadow-xl shadow-orange-500/25 text-xs uppercase tracking-widest transition-all touch-manipulation"
            style={{ height: 52 }}
          >
            <PlusCircle className="h-4 w-4" />
            Novo Comunicado
          </button>
        )}

        {/* ── Quick templates ── */}
        {!showComposer && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 px-1 mb-2.5">Atalhos rápidos</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              {TEMPLATES.map((tpl, i) => {
                const s = P[tpl.priority];
                return (
                  <button
                    key={i}
                    onClick={() => applyTemplate(tpl)}
                    className={`shrink-0 flex items-center gap-2.5 bg-[#0d0d0f] border ${s.border} hover:border-white/20 rounded-2xl p-3 transition-all touch-manipulation active:scale-95 text-left min-w-[190px] max-w-[220px]`}
                  >
                    <div className={`h-8 w-8 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center shrink-0`}>
                      <tpl.icon className={`h-3.5 w-3.5 ${s.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-black italic leading-tight truncate ${s.color}`}>{tpl.title}</p>
                      <p className="text-[8px] font-bold text-white/35 uppercase tracking-wider mt-0.5">Usar template</p>
                    </div>
                    <ChevronRight className="h-3 w-3 text-white/20 shrink-0 ml-auto" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Composer ── */}
        {showComposer && (
          <div className="bg-[#0d0d0f] border border-white/8 rounded-[1.5rem] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/6">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-[#4CCCED]/15 border border-[#4CCCED]/25 flex items-center justify-center">
                  <PlusCircle className="h-3.5 w-3.5 text-orange-400" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/65">Nova Mensagem</p>
              </div>
              <button
                onClick={() => setShowComposer(false)}
                className="h-8 w-8 rounded-xl bg-white/5 text-white/40 hover:text-white/70 flex items-center justify-center transition-all active:scale-90 touch-manipulation"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-white/45 ml-1">Assunto</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Título do aviso..."
                  className="w-full h-12 bg-white/4 border border-white/10 rounded-xl px-4 text-sm font-bold italic text-white placeholder:text-white/25 outline-none focus:border-[#4CCCED]/40 focus:bg-white/6 transition-all"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-white/45 ml-1">Mensagem</label>
                <Textarea
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Detalhes do comunicado..."
                  className="min-h-[90px] bg-white/4 border border-white/10 rounded-xl text-white placeholder:text-white/25 text-sm italic resize-none focus-visible:ring-0 focus-visible:border-[#4CCCED]/40 focus-visible:bg-white/6 transition-all"
                />
              </div>

              {/* Priority + Audience — stacked on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/45 ml-1">Prioridade</label>
                  <Select value={formData.priority} onValueChange={(v: any) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger className="h-12 bg-white/4 border-white/10 text-white font-bold rounded-xl text-xs focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-white/10 bg-[#111113]">
                      <SelectItem value="low"    className="font-bold text-blue-400  text-xs">Informativo</SelectItem>
                      <SelectItem value="medium" className="font-bold text-amber-400 text-xs">Importante</SelectItem>
                      <SelectItem value="high"   className="font-bold text-red-400   text-xs">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/45 ml-1">Público</label>
                  <Select value={formData.target_group} onValueChange={v => setFormData({ ...formData, target_group: v })}>
                    <SelectTrigger className="h-12 bg-white/4 border-white/10 text-white font-bold rounded-xl text-xs focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-white/10 bg-[#111113] max-h-60">
                      <SelectGroup>
                        <SelectLabel className="text-[9px] font-black uppercase text-white/35 px-2 pt-2">Geral</SelectLabel>
                        <SelectItem value="all"     className="font-bold italic text-white/70 text-xs">Toda a Rede</SelectItem>
                        <SelectItem value="etec"    className="font-bold italic text-white/70 text-xs">ETEC</SelectItem>
                        <SelectItem value="enem"    className="font-bold italic text-white/70 text-xs">ENEM</SelectItem>
                        <SelectItem value="teacher" className="font-bold italic text-white/70 text-xs">Staff</SelectItem>
                      </SelectGroup>
                      {cohorts.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-[9px] font-black uppercase text-white/35 px-2 pt-3 border-t border-white/8 mt-1">Turmas</SelectLabel>
                          {cohorts.map(c => (
                            <SelectItem key={c.id} value={c.id} className="font-bold italic text-white/70 text-xs">{c.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Priority preview badge */}
              {formData.priority && (
                <div className={`flex items-center gap-2 ${P[formData.priority].bg} border ${P[formData.priority].border} rounded-xl px-3 py-2.5`}>
                  {(() => { const Icon = P[formData.priority].icon; return <Icon className={`h-3.5 w-3.5 ${P[formData.priority].color} shrink-0`} />; })()}
                  <p className={`text-[10px] font-black uppercase tracking-widest ${P[formData.priority].color}`}>
                    {P[formData.priority].label}
                    {formData.priority === "high" && " — aparecerá como alerta tela cheia"}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={() => handleCreate()}
                disabled={isCreating || !formData.title.trim()}
                className="w-full h-13 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-2xl shadow-xl shadow-orange-500/25 text-xs uppercase tracking-widest disabled:opacity-40 active:scale-[0.97] transition-all touch-manipulation"
                style={{ height: 52 }}
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isCreating ? "Publicando..." : "Fixar Comunicado"}
              </button>
            </div>
          </div>
        )}

        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35 pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar no histórico..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-11 bg-white/4 border border-white/8 rounded-2xl pl-11 pr-4 text-sm font-semibold text-white placeholder:text-white/25 outline-none focus:border-[#4CCCED]/30 focus:bg-white/5 transition-all"
          />
        </div>

        {/* ── List header ── */}
        {filtered.length > 0 && (
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/35 px-1">
            {filtered.length} comunicado{filtered.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* ── Announcements ── */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Sparkles className="h-7 w-7 text-orange-400 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Sincronizando...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-white/8 rounded-[1.5rem]">
              <Inbox className="h-8 w-8 mx-auto mb-2 text-white/20" />
              <p className="font-black italic text-xs text-white/30 uppercase tracking-widest">Nenhum aviso</p>
            </div>
          ) : (
            filtered.map(ann => {
              const s = P[ann.priority] || P.low;
              const Icon = s.icon;
              const cohort = cohorts.find(c => c.id === ann.target_group);

              return (
                <div
                  key={ann.id}
                  className="relative bg-[#0d0d0f] border border-white/6 rounded-2xl overflow-hidden group"
                  style={{ boxShadow: ann.priority === "high" ? `0 0 0 1px rgba(239,68,68,0.15), 0 4px 24px ${s.glow}` : undefined }}
                >
                  {/* Priority accent bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${s.bar}`} />

                  <div className="p-4 pl-5">
                    {/* Top row */}
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`h-4 w-4 ${s.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="font-black text-white italic text-sm leading-snug flex-1">{ann.title}</h3>
                          <button
                            onClick={() => handleDelete(ann.id)}
                            className="h-7 w-7 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center shrink-0 touch-manipulation"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Meta badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 ${s.bg} ${s.color} border ${s.border} font-black text-[8px] uppercase px-2 h-4 rounded-full`}>
                            {s.label}
                          </span>
                          {ann.target_group && (
                            <span className="inline-flex items-center gap-1 bg-white/5 text-white/50 border border-white/8 font-black text-[8px] uppercase px-2 h-4 rounded-full">
                              {cohort ? <Layers className="h-2 w-2" /> : <Target className="h-2 w-2" />}
                              {cohort ? cohort.name : ann.target_group === "all" ? "Toda Rede" : ann.target_group}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[8px] font-bold text-white/30 uppercase tracking-wider">
                            <Clock className="h-2.5 w-2.5" />
                            {format(new Date(ann.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Message body */}
                    <div className={`mt-3 p-3 rounded-xl ${s.bg} border ${s.border}`}>
                      <p className="text-xs text-white/60 leading-relaxed font-medium italic">"{ann.message}"</p>
                    </div>
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
