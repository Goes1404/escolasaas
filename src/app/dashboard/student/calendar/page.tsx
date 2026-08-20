"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Loader2,
  ShieldCheck,
  Flame,
  ChevronRight,
  Grid3x3,
  List as ListIcon,
  Clock3,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";

type AcademicEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string;
  is_official: boolean;
};

const EVENT_TYPE_META: Record<string, { label: string; chip: string; dot: string; light: string }> = {
  simulado:             { label: "Simulado",         chip: "bg-blue-100 text-blue-700 border-blue-200",         dot: "bg-blue-500",     light: "bg-blue-50" },
  inscricao:            { label: "Inscrição",        chip: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-500",    light: "bg-amber-50" },
  aulao:                { label: "Aulão",            chip: "bg-purple-100 text-purple-700 border-purple-200",    dot: "bg-purple-500",   light: "bg-purple-50" },
  entrega_redacao:      { label: "Redação",          chip: "bg-pink-100 text-pink-700 border-pink-200",          dot: "bg-pink-500",     light: "bg-pink-50" },
  feriado:              { label: "Feriado",          chip: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500",  light: "bg-emerald-50" },
  vestibular:           { label: "Vestibular",       chip: "bg-red-100 text-red-700 border-red-200",             dot: "bg-red-500",      light: "bg-red-50" },
  abertura_inscricao:   { label: "Abre Inscrições",  chip: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500",  light: "bg-emerald-50" },
  fechamento_inscricao: { label: "Fecha Inscrições", chip: "bg-orange-100 text-orange-700 border-orange-200",    dot: "bg-orange-500",   light: "bg-orange-50" },
  resultado:            { label: "Resultado",        chip: "bg-indigo-100 text-indigo-700 border-indigo-200",    dot: "bg-indigo-500",   light: "bg-indigo-50" },
  matricula:            { label: "Matrícula",        chip: "bg-cyan-100 text-cyan-700 border-cyan-200",          dot: "bg-cyan-500",     light: "bg-cyan-50" },
  outro:                { label: "Evento",           chip: "bg-slate-100 text-slate-600 border-slate-200",       dot: "bg-slate-400",    light: "bg-slate-50" },
};

const getMeta = (type: string) => EVENT_TYPE_META[type] ?? EVENT_TYPE_META.outro;

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function daysBetween(target: string) {
  const targetDate = new Date(target + "T12:00:00");
  return Math.ceil((targetDate.getTime() - Date.now()) / 86400000);
}

function urgencyTone(days: number) {
  if (days < 0)   return { label: "Passou",   color: "text-slate-400",  bg: "bg-slate-100",  emoji: "✓" };
  if (days === 0) return { label: "Hoje",     color: "text-red-600",    bg: "bg-red-100",    emoji: "•" };
  if (days === 1) return { label: "Amanhã",   color: "text-orange-600", bg: "bg-orange-100", emoji: "→" };
  if (days <= 7)  return { label: `${days}d`, color: "text-amber-600",  bg: "bg-amber-100",  emoji: "→" };
  if (days <= 30) return { label: `${days}d`, color: "text-yellow-600", bg: "bg-yellow-100", emoji: "→" };
  return           { label: `${days}d`,        color: "text-slate-500",  bg: "bg-slate-100",  emoji: "→" };
}

export default function StudentCalendarPage() {
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [view, setView] = useState<"timeline" | "grid">("timeline");

  useEffect(() => {
    supabase
      .from("academic_events")
      .select("id, title, description, event_date, event_type, is_official")
      .order("event_date")
      .then(({ data }) => {
        setEvents(data ?? []);
        setLoading(false);
      });
  }, []);

  const today = new Date().toISOString().split("T")[0];

  const upcoming = useMemo(
    () => events.filter((e) => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events, today]
  );

  const nextEvent = upcoming[0];
  const nextDays  = nextEvent ? daysBetween(nextEvent.event_date) : null;
  const nextMeta  = nextEvent ? getMeta(nextEvent.event_type) : null;

  const urgentTypes   = new Set(["vestibular", "abertura_inscricao", "fechamento_inscricao"]);
  const upcomingUrgent = upcoming.filter((e) => urgentTypes.has(e.event_type)).slice(0, 4);

  const eventDates     = new Set(events.map((e) => e.event_date));
  const selectedDateStr = selectedDate?.toISOString().split("T")[0];
  const eventsOnSelected = events.filter((e) => e.event_date === selectedDateStr);

  const groupedByMonth = useMemo(() => {
    const groups: Record<string, AcademicEvent[]> = {};
    upcoming.forEach((ev) => {
      const d = new Date(ev.event_date + "T12:00:00");
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    });
    return Object.entries(groups);
  }, [upcoming]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-9 w-9 animate-spin text-orange-500" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
          Carregando calendário acadêmico...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-2 md:px-4 pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── HERO ── */}
      <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-orange-500 via-rose-500 to-red-600 p-6 shadow-2xl shadow-orange-200">
        <div className="absolute -right-10 -top-10 opacity-10 pointer-events-none">
          <CalendarDays className="h-48 w-48 text-white" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-3.5 w-3.5 text-white/80" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">
              Calendário Acadêmico
            </p>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">
            Sua Jornada
          </h1>
          <p className="text-white/75 text-xs font-semibold mt-1">
            Vestibulares, prazos e marcos importantes
          </p>

          {nextEvent && nextDays !== null && nextMeta && (
            <div className="mt-5 flex items-end gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/70 leading-none mb-1">
                  Próximo evento
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-[5rem] sm:text-[6rem] font-black italic leading-[0.85] tracking-tighter text-white drop-shadow-lg">
                    {nextDays}
                  </span>
                  <span className="text-xl font-black italic tracking-tighter text-white/80">
                    {nextDays === 1 ? "dia" : "dias"}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <Badge className="bg-white/20 text-white border-white/30 font-black text-[8px] uppercase tracking-widest mb-2 inline-flex items-center gap-1 px-2 h-5">
                  <Flame className="h-2.5 w-2.5" />
                  {nextMeta.label}
                </Badge>
                <p className="text-sm font-black italic text-white leading-snug line-clamp-2">
                  {nextEvent.title}
                </p>
                <p className="text-[10px] font-bold text-white/75 mt-1 uppercase tracking-wider">
                  {new Date(nextEvent.event_date + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long", day: "2-digit", month: "long",
                  })}
                </p>
              </div>
            </div>
          )}

          {!nextEvent && (
            <p className="mt-4 text-sm font-bold text-white/70 italic">Nenhum evento futuro cadastrado.</p>
          )}
        </div>
      </div>

      {/* ── PRAZOS CRÍTICOS ── */}
      {upcomingUrgent.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-1 mb-3">
            <Flame className="h-3.5 w-3.5 text-red-500 animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-600">
              Prazos críticos
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {upcomingUrgent.map((ev) => {
              const meta = getMeta(ev.event_type);
              const days = daysBetween(ev.event_date);
              const u = urgencyTone(days);
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedDate(new Date(ev.event_date + "T12:00:00"))}
                  className="shrink-0 w-[200px] text-left bg-white border border-red-100 rounded-2xl p-3.5 hover:border-red-300 hover:shadow-md transition-all active:scale-95 touch-manipulation shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`h-2 w-2 rounded-full ${meta.dot} animate-pulse`} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${u.color}`}>
                      {u.label}
                    </span>
                  </div>
                  <p className="text-[11px] font-black text-primary italic leading-tight line-clamp-2 mb-1.5">
                    {ev.title}
                  </p>
                  <Badge className={`${meta.chip} border font-black text-[8px] uppercase px-1.5 h-4`}>
                    {meta.label}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TOGGLE VISUALIZAÇÃO ── */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setView("timeline")}
          className={`h-11 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all touch-manipulation active:scale-95 flex items-center justify-center gap-1.5 ${
            view === "timeline"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-200"
              : "bg-white border border-slate-200 text-slate-500 hover:border-orange-300 hover:text-orange-600"
          }`}
        >
          <ListIcon className="h-3.5 w-3.5" />
          Linha do Tempo
        </button>
        <button
          onClick={() => setView("grid")}
          className={`h-11 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all touch-manipulation active:scale-95 flex items-center justify-center gap-1.5 ${
            view === "grid"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-200"
              : "bg-white border border-slate-200 text-slate-500 hover:border-orange-300 hover:text-orange-600"
          }`}
        >
          <Grid3x3 className="h-3.5 w-3.5" />
          Grade
        </button>
      </div>

      {/* ── TIMELINE ── */}
      {view === "timeline" ? (
        <div className="space-y-6">
          {groupedByMonth.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Nenhum evento agendado
              </p>
            </div>
          ) : (
            groupedByMonth.map(([key, monthEvents]) => {
              const [yearStr, monthStr] = key.split("-");
              const monthIdx = parseInt(monthStr, 10);
              return (
                <section key={key} className="space-y-2.5">
                  {/* Cabeçalho do mês */}
                  <div className="flex items-end justify-between gap-3 px-1">
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-3xl font-black italic tracking-tighter text-primary leading-none">
                        {MONTHS_FULL[monthIdx]}
                      </h2>
                      <span className="text-base font-black italic text-muted-foreground tracking-tighter">
                        {yearStr}
                      </span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground pb-1">
                      {monthEvents.length} {monthEvents.length === 1 ? "evento" : "eventos"}
                    </span>
                  </div>
                  <div className="h-px bg-gradient-to-r from-slate-200 to-transparent" />

                  <div className="space-y-2">
                    {monthEvents.map((ev) => {
                      const meta = getMeta(ev.event_type);
                      const days = daysBetween(ev.event_date);
                      const u = urgencyTone(days);
                      const d = new Date(ev.event_date + "T12:00:00");
                      const dayNum = d.getDate();
                      const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

                      return (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedDate(d)}
                          className="w-full text-left bg-white border border-slate-100 hover:border-slate-200 hover:shadow-md rounded-2xl p-3.5 transition-all active:scale-[0.99] touch-manipulation group shadow-sm"
                        >
                          <div className="flex items-center gap-3.5">
                            {/* Âncora do dia */}
                            <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl ${meta.light} shrink-0`}>
                              <span className="text-2xl font-black italic leading-none tracking-tighter text-primary">
                                {String(dayNum).padStart(2, "0")}
                              </span>
                              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                                {weekday}
                              </span>
                            </div>

                            {/* Linha colorida */}
                            <div className="self-stretch w-1 rounded-full shrink-0" style={{}}>
                              <div className={`w-1 h-full ${meta.dot} rounded-full`} />
                            </div>

                            {/* Conteúdo */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-black text-primary italic leading-snug line-clamp-2">
                                  {ev.title}
                                </p>
                                {ev.is_official && (
                                  <ShieldCheck className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <Badge className={`${meta.chip} border font-black text-[8px] uppercase px-1.5 h-4`}>
                                  {meta.label}
                                </Badge>
                                <span className={`${u.bg} ${u.color} font-black text-[8px] uppercase tracking-widest px-2 h-4 rounded-full flex items-center gap-1`}>
                                  <Clock3 className="h-2 w-2" />
                                  {u.label}
                                </span>
                              </div>
                              {ev.description && (
                                <p className="text-[11px] text-slate-500 font-medium italic mt-1.5 line-clamp-2 leading-tight">
                                  {ev.description}
                                </p>
                              )}
                            </div>

                            <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>
      ) : (
        /* ── GRADE (calendário) ── */
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden p-4 shadow-md">
            <style jsx global>{`
              .rdp { color: #1e293b; }
              .rdp-day { color: #475569; border-radius: 0.5rem; font-weight: 600; }
              .rdp-day:hover:not([disabled]) { background-color: #f1f5f9 !important; }
              .rdp-day_selected,
              .rdp-day_selected:focus-visible,
              .rdp-day_selected:hover { background-color: #f97316 !important; color: white !important; }
              .rdp-day_today { color: #f97316 !important; font-weight: 800; }
              .rdp-head_cell { color: #94a3b8; font-weight: 800; text-transform: uppercase; font-size: 0.6rem; letter-spacing: 0.1em; }
              .rdp-caption_label { color: #1e293b; font-weight: 800; font-style: italic; letter-spacing: -0.025em; }
              .rdp-nav_button { color: #94a3b8; }
              .rdp-nav_button:hover { background-color: #f1f5f9 !important; color: #1e293b !important; }
            `}</style>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{ hasEvent: (day) => eventDates.has(day.toISOString().split("T")[0]) }}
              modifiersClassNames={{
                hasEvent:
                  "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-orange-400",
              }}
              className="mx-auto"
            />
          </div>

          {/* Eventos do dia selecionado */}
          {eventsOnSelected.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground px-1">
                {selectedDate?.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </p>
              {eventsOnSelected.map((ev) => {
                const meta = getMeta(ev.event_type);
                return (
                  <div
                    key={ev.id}
                    className="flex gap-3 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"
                  >
                    <div className={`w-1 rounded-full shrink-0 ${meta.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-primary text-sm italic">{ev.title}</p>
                        {ev.is_official && (
                          <ShieldCheck className="h-3.5 w-3.5 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Badge className={`${meta.chip} border font-black text-[8px] uppercase px-1.5 h-4`}>
                          {meta.label}
                        </Badge>
                      </div>
                      {ev.description && (
                        <p className="text-xs text-slate-500 font-medium italic mt-2 leading-relaxed">
                          {ev.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {eventsOnSelected.length === 0 && selectedDate && (
            <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Nenhum evento neste dia
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
