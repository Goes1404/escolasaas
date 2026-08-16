
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays,
  PlusCircle,
  Trash2,
  Loader2,
  Pencil,
  ShieldCheck,
  Lock,
  Inbox,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";

type AcademicEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string;
  target_group: string;
  created_by: string | null;
  is_official: boolean;
};

const EVENT_TYPES = [
  { value: "simulado",             label: "Simulado",                chip: "bg-blue-500/15 text-blue-400 border-blue-500/25",        dot: "bg-blue-500" },
  { value: "aulao",                label: "Aulão",                   chip: "bg-purple-500/15 text-purple-400 border-purple-500/25",  dot: "bg-purple-500" },
  { value: "entrega_redacao",      label: "Redação",                 chip: "bg-pink-500/15 text-pink-400 border-pink-500/25",        dot: "bg-pink-500" },
  { value: "inscricao",            label: "Inscrição",               chip: "bg-amber-500/15 text-amber-400 border-amber-500/25",     dot: "bg-amber-500" },
  { value: "feriado",              label: "Feriado",                 chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-500" },
  { value: "vestibular",           label: "Vestibular",              chip: "bg-red-500/15 text-red-400 border-red-500/25",           dot: "bg-red-500" },
  { value: "abertura_inscricao",   label: "Abre Inscrições",         chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-500" },
  { value: "fechamento_inscricao", label: "Fecha Inscrições",        chip: "bg-[#4CCCED]/15 text-orange-400 border-[#4CCCED]/25",  dot: "bg-[#4CCCED]" },
  { value: "resultado",            label: "Resultado",               chip: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",  dot: "bg-indigo-500" },
  { value: "matricula",            label: "Matrícula",               chip: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",        dot: "bg-cyan-500" },
  { value: "outro",                label: "Outro",                   chip: "bg-white/8 text-white/50 border-white/10",                dot: "bg-white/40" },
];

const TARGET_GROUPS = [
  { value: "all", label: "Todos" },
  { value: "enem", label: "ENEM" },
  { value: "etec", label: "ETEC/FATEC" },
];

const blankForm = { title: "", description: "", event_date: "", event_type: "outro", target_group: "all" };

export default function TeacherCalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from("academic_events")
      .select("*")
      .order("event_date", { ascending: true });
    setEvents(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.event_date || !user) return;
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase.from("academic_events").update({ ...form }).eq("id", editId);
        if (error) throw error;
        toast({ title: "Evento atualizado!" });
      } else {
        const { error } = await supabase
          .from("academic_events")
          .insert({ ...form, created_by: user.id });
        if (error) throw error;
        toast({ title: "Evento criado!" });
      }
      setForm(blankForm);
      setShowForm(false);
      setEditId(null);
      fetchEvents();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("academic_events").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Evento excluído." });
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const startEdit = (ev: AcademicEvent) => {
    setForm({
      title: ev.title,
      description: ev.description ?? "",
      event_date: ev.event_date,
      event_type: ev.event_type,
      target_group: ev.target_group,
    });
    setEditId(ev.id);
    setShowForm(true);
  };

  const canEdit = (ev: AcademicEvent) => !ev.is_official && ev.created_by === user?.id;

  const today = new Date(new Date().toDateString());
  const upcoming = events.filter((e) => new Date(e.event_date + "T00:00:00") >= today);
  const past = events.filter((e) => new Date(e.event_date + "T00:00:00") < today);

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Hero ── */}
      <div className="relative rounded-[2rem] overflow-hidden bg-[#0d0d0f] border border-white/5 p-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 80% 10%, rgba(76,204,237,0.13) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(99,102,241,0.10) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-3 w-3 text-orange-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400/85">
              Staff · Agenda
            </p>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">
            Calendário Acadêmico
          </h1>
          <p className="text-white/70 text-xs font-semibold mt-1">
            Cadastre prazos e datas importantes
          </p>

          <div className="grid grid-cols-2 gap-2 mt-5">
            <div className="flex flex-col items-center bg-[#4CCCED]/10 border border-[#4CCCED]/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-orange-400 leading-none">{upcoming.length}</span>
              <span className="text-[8px] font-bold text-orange-400/80 uppercase tracking-wider mt-0.5">Futuros</span>
            </div>
            <div className="flex flex-col items-center bg-white/5 border border-white/8 rounded-2xl py-2.5">
              <span className="text-lg font-black text-white/60 leading-none">{past.length}</span>
              <span className="text-[8px] font-bold text-white/55 uppercase tracking-wider mt-0.5">Passados</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      {!showForm && (
        <Button
          onClick={() => {
            setShowForm(true);
            setEditId(null);
            setForm(blankForm);
          }}
          className="w-full h-12 bg-[#4CCCED] hover:bg-orange-600 text-slate-800 font-black rounded-2xl shadow-xl shadow-orange-500/20 text-xs uppercase tracking-widest border-none"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Novo Evento
        </Button>
      )}

      {/* ── Form ── */}
      {showForm && (
        <div className="bg-white shadow-sm border border-slate-200 rounded-[1.5rem] overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-white shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-orange-400/85" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
                {editId ? "Editar Evento" : "Criar Evento"}
              </p>
            </div>
            <button
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-500 uppercase tracking-wider"
            >
              Fechar
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Título *</Label>
              <input
                type="text"
                placeholder="Ex: Aulão de Revisão — Matemática"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full h-11 bg-white shadow-sm border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-[#4CCCED]/40 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Data *</Label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                  className="w-full h-11 bg-white shadow-sm border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 outline-none focus:border-[#4CCCED]/40 transition-all [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Público</Label>
                <Select value={form.target_group} onValueChange={(val) => setForm((f) => ({ ...f, target_group: val }))}>
                  <SelectTrigger className="h-11 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 bg-white">
                    {TARGET_GROUPS.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="font-bold text-slate-600 text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Tipo</Label>
              <Select value={form.event_type} onValueChange={(val) => setForm((f) => ({ ...f, event_type: val }))}>
                <SelectTrigger className="h-11 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 bg-white">
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="font-bold text-slate-600 text-xs">
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Descrição (opcional)</Label>
              <Textarea
                placeholder="Detalhes adicionais..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 placeholder:text-slate-500 font-medium text-sm resize-none focus-visible:ring-orange-500/30 focus-visible:border-[#4CCCED]/30 min-h-[80px]"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={saving || !form.title || !form.event_date}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-800 font-black rounded-2xl shadow-xl shadow-orange-500/30 border-none text-xs uppercase tracking-widest disabled:opacity-40"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editId ? "Salvar Alterações" : "Criar Evento"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Type legend (compact horizontal scroll) ── */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600 px-1 mb-2">
          Tipos
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {EVENT_TYPES.map((t) => (
            <Badge
              key={t.value}
              className={`${t.chip} border font-black text-[9px] uppercase px-2 h-5 shrink-0 flex items-center gap-1`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
              {t.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* ── Lists ── */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
        </div>
      ) : events.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-[1.5rem]">
          <Inbox className="h-8 w-8 mx-auto mb-2 text-white/15" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Nenhum evento cadastrado
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
                  Próximos eventos ({upcoming.length})
                </p>
              </div>
              {upcoming.map((ev) => (
                <EventRow
                  key={ev.id}
                  ev={ev}
                  canEdit={canEdit(ev)}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                  Eventos passados ({past.length})
                </p>
              </div>
              {past.map((ev) => (
                <EventRow
                  key={ev.id}
                  ev={ev}
                  canEdit={canEdit(ev)}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                  past
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventRow({
  ev,
  canEdit,
  onEdit,
  onDelete,
  past = false,
}: {
  ev: AcademicEvent;
  canEdit: boolean;
  onEdit: (ev: AcademicEvent) => void;
  onDelete: (id: string) => void;
  past?: boolean;
}) {
  const meta = EVENT_TYPES.find((t) => t.value === ev.event_type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
  const d = new Date(ev.event_date + "T00:00:00");
  const dayNum = d.getDate();
  const monthShort = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();

  return (
    <div
      className={`group bg-white shadow-sm border border-slate-200 hover:border-white/15 rounded-2xl p-3.5 transition-all ${past ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Date anchor */}
        <div className="flex flex-col items-center justify-center min-w-[42px] py-1 px-2 bg-white shadow-sm border border-slate-200 rounded-xl shrink-0">
          <span className="text-xl font-black italic leading-none text-slate-800">
            {String(dayNum).padStart(2, "0")}
          </span>
          <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${past ? "text-slate-500" : "text-orange-400/85"}`}>
            {monthShort}
          </span>
        </div>

        {/* Color bar */}
        <div className={`w-0.5 self-stretch ${meta.dot} rounded-full shrink-0`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-black text-slate-800 italic leading-snug line-clamp-2 flex-1">
              {ev.title}
            </p>
            {ev.is_official && (
              <ShieldCheck className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Badge className={`${meta.chip} border font-black text-[8px] uppercase px-1.5 h-4`}>
              {meta.label}
            </Badge>
            {ev.is_official && (
              <Badge className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 font-black text-[8px] uppercase px-1.5 h-4 flex items-center gap-1">
                <ShieldCheck className="h-2 w-2" /> Oficial
              </Badge>
            )}
          </div>
          {ev.description && (
            <p className="text-[11px] text-slate-600 font-medium italic mt-1.5 line-clamp-2 leading-tight">
              {ev.description}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-slate-100">
        {canEdit ? (
          <>
            <button
              onClick={() => onEdit(ev)}
              className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all active:scale-95 touch-manipulation"
            >
              <Pencil className="h-3 w-3" />
              Editar
            </button>
            <button
              onClick={() => onDelete(ev.id)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all active:scale-95 touch-manipulation"
              title="Excluir"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white shadow-sm">
            <Lock className="h-3 w-3" />
            Coordenação
          </div>
        )}
      </div>
    </div>
  );
}
