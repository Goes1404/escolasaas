
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
import { EmptyState } from "@/components/EmptyState";
import { toDate, fmtDate } from "@/lib/format";

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

// Cor categórica: diz o que o evento é. Aparece só no ponto/faixa — o chip é
// neutro, porque a tela é de trabalho (nível baixo).
const EVENT_TYPES = [
  { value: "simulado",             label: "Simulado",         dot: "bg-blue-500" },
  { value: "aulao",                label: "Aulão",            dot: "bg-purple-500" },
  { value: "entrega_redacao",      label: "Redação",          dot: "bg-pink-500" },
  { value: "inscricao",            label: "Inscrição",        dot: "bg-amber-500" },
  { value: "feriado",              label: "Feriado",          dot: "bg-emerald-500" },
  { value: "vestibular",           label: "Vestibular",       dot: "bg-red-500" },
  { value: "abertura_inscricao",   label: "Abre inscrições",  dot: "bg-emerald-500" },
  { value: "fechamento_inscricao", label: "Fecha inscrições", dot: "bg-primary" },
  { value: "resultado",            label: "Resultado",        dot: "bg-indigo-500" },
  { value: "matricula",            label: "Matrícula",        dot: "bg-cyan-500" },
  { value: "outro",                label: "Outro",            dot: "bg-muted-foreground" },
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
  const upcoming = events.filter((e) => { const d = toDate(e.event_date); return !d || d >= today; });
  const past = events.filter((e) => { const d = toDate(e.event_date); return !!d && d < today; });

  const openNew = () => {
    setShowForm(true);
    setEditId(null);
    setForm(blankForm);
  };
  const labelCls = "u-label ml-0.5";
  const inputCls = "w-full h-11 bg-background border border-border rounded-control px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors";
  const triggerCls = "h-11 rounded-control bg-background border-border text-foreground text-sm";

  return (
    <div className="pb-24 space-y-6">

      {/* ── Cabeçalho (nível médio) ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Professor · agenda</p>
          <h1 className="u-page-title text-3xl mt-1">Calendário</h1>
          <p className="text-muted-foreground text-sm mt-2">Cadastre prazos, aulões e datas importantes para os alunos.</p>
        </div>
        {!showForm && (
          <Button onClick={openNew} variant="arcade" className="h-11 rounded-control font-bold w-full sm:w-auto">
            <PlusCircle className="h-4 w-4 mr-2" />
            Novo evento
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:max-w-md">
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Próximos</p>
          <p className="u-num text-xl sm:text-2xl mt-1.5">{upcoming.length}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Já passaram</p>
          <p className="u-num text-xl sm:text-2xl mt-1.5">{past.length}</p>
        </div>
      </div>

      {/* ── Formulário ── */}
      {showForm && (
        <div className="u-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <p className="u-label flex items-center gap-1.5"><PlusCircle className="h-3.5 w-3.5" /> {editId ? "Editar evento" : "Novo evento"}</p>
            <button
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Fechar
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className={labelCls}>Título *</Label>
              <input
                type="text"
                placeholder="Ex.: Aulão de revisão — Matemática"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelCls}>Data *</Label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Público</Label>
                <Select value={form.target_group} onValueChange={(val) => setForm((f) => ({ ...f, target_group: val }))}>
                  <SelectTrigger className={triggerCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    {TARGET_GROUPS.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-sm">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={labelCls}>Tipo</Label>
              <Select value={form.event_type} onValueChange={(val) => setForm((f) => ({ ...f, event_type: val }))}>
                <SelectTrigger className={triggerCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-control">
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-sm">
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
              <Label className={labelCls}>Descrição (opcional)</Label>
              <Textarea
                placeholder="Detalhes adicionais…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="rounded-control bg-background border-border text-sm resize-none min-h-[80px]"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={saving || !form.title || !form.event_date}
              className="w-full h-11 rounded-control font-bold"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editId ? "Salvar alterações" : "Criar evento"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Legenda dos tipos ── */}
      <div>
        <p className="u-label px-1 mb-2">Tipos de evento</p>
        <div className="flex gap-x-3 gap-y-1.5 flex-wrap px-1">
          {EVENT_TYPES.map((t) => (
            <span key={t.value} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${t.dot}`} />
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Listas ── */}
      {loading ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="u-label">Carregando eventos…</p>
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhum evento no calendário"
          description="Cadastre o próximo simulado, aulão ou prazo de inscrição para os alunos verem na agenda."
          action={!showForm ? { label: "Novo evento", onClick: openNew, icon: PlusCircle } : undefined}
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="u-label px-1">Próximos eventos · <span className="tabular-nums">{upcoming.length}</span></p>
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
              <p className="u-label px-1">Eventos passados · <span className="tabular-nums">{past.length}</span></p>
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
  const d = toDate(ev.event_date);
  const dayNum = d ? String(d.getDate()).padStart(2, "0") : "—";
  const monthShort = fmtDate(ev.event_date, "MMM", "").replace(".", "");

  return (
    <div className={`u-surface p-3.5 ${past ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center justify-center min-w-[48px] py-1.5 px-2 border border-border rounded-control shrink-0">
          <span className="u-num text-xl leading-none">{dayNum}</span>
          <span className="u-label mt-1">{monthShort}</span>
        </div>

        <div className={`w-0.5 self-stretch ${meta.dot} rounded-full shrink-0`} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {ev.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Badge variant="outline" className="font-semibold text-[10px] px-1.5 h-5 rounded-control flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </Badge>
            {ev.is_official && (
              <Badge variant="outline" className="font-semibold text-[10px] px-1.5 h-5 rounded-control flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Oficial
              </Badge>
            )}
          </div>
          {ev.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-snug">
              {ev.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-border">
        {canEdit ? (
          <>
            <Button variant="outline" size="sm" onClick={() => onEdit(ev)} className="h-8 rounded-control text-xs font-semibold">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Button>
            <button
              onClick={() => onDelete(ev.id)}
              className="h-8 w-8 rounded-control flex items-center justify-center text-red-600 border border-border hover:bg-red-500/10 transition-colors touch-manipulation"
              title="Excluir evento"
              aria-label="Excluir evento"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <span className="h-8 px-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground" title="Só a coordenação pode editar este evento">
            <Lock className="h-3.5 w-3.5" />
            Cadastrado pela coordenação
          </span>
        )}
      </div>
    </div>
  );
}
