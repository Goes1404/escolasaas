
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  CalendarDays, PlusCircle, Trash2, Loader2, Pencil,
  ShieldCheck, Search, Filter,
} from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/lib/AuthProvider';
import { fmtDate, fmtLocale } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';

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
  { value: 'simulado',             label: 'Simulado',                color: 'bg-blue-100 text-blue-700' },
  { value: 'aulao',                label: 'Aulão de Revisão',         color: 'bg-purple-100 text-purple-700' },
  { value: 'entrega_redacao',      label: 'Entrega Redação',          color: 'bg-pink-100 text-pink-700' },
  { value: 'inscricao',            label: 'Inscrição (Cursinho)',      color: 'bg-amber-100 text-amber-700' },
  { value: 'feriado',              label: 'Feriado',                  color: 'bg-green-100 text-green-700' },
  { value: 'vestibular',           label: 'Prova de Vestibular',      color: 'bg-red-100 text-red-700' },
  { value: 'abertura_inscricao',   label: 'Abertura de Inscrições',   color: 'bg-emerald-100 text-emerald-700' },
  { value: 'fechamento_inscricao', label: 'Fechamento de Inscrições', color: 'bg-orange-100 text-orange-700' },
  { value: 'resultado',            label: 'Resultado / Gabarito',     color: 'bg-indigo-100 text-indigo-700' },
  { value: 'matricula',            label: 'Matrícula',                color: 'bg-cyan-100 text-cyan-700' },
  { value: 'outro',                label: 'Outro',                    color: 'bg-slate-100 text-slate-600' },
];

const TARGET_GROUPS = [
  { value: 'all',  label: 'Todos' },
  { value: 'enem', label: 'ENEM' },
  { value: 'etec', label: 'ETEC/FATEC' },
];

const blankForm = {
  title: '', description: '', event_date: '',
  event_type: 'outro', target_group: 'all', is_official: false,
};

export default function AdminCalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('academic_events')
      .select('*')
      .order('event_date', { ascending: true });
    setEvents(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.event_date || !user) return;
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase
          .from('academic_events')
          .update({
            title: form.title,
            description: form.description || null,
            event_date: form.event_date,
            event_type: form.event_type,
            target_group: form.target_group,
            is_official: form.is_official,
          })
          .eq('id', editId);
        if (error) throw error;
        toast({ title: 'Evento atualizado' });
      } else {
        const { error } = await supabase.from('academic_events').insert({
          title: form.title,
          description: form.description || null,
          event_date: form.event_date,
          event_type: form.event_type,
          target_group: form.target_group,
          is_official: form.is_official,
          created_by: user.id,
        });
        if (error) throw error;
        toast({ title: 'Evento criado' });
      }
      setForm(blankForm);
      setShowForm(false);
      setEditId(null);
      fetchEvents();
    } catch (e: any) {
      toast({ title: 'Não foi possível salvar o evento', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('academic_events').delete().eq('id', id);
    if (error) {
      toast({ title: 'Não foi possível excluir o evento', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Evento excluído' });
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const startEdit = (ev: AcademicEvent) => {
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      event_date: ev.event_date,
      event_type: ev.event_type,
      target_group: ev.target_group,
      is_official: ev.is_official,
    });
    setEditId(ev.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getTypeMeta = (type: string) =>
    EVENT_TYPES.find(t => t.value === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];

  const filtered = events.filter(ev => {
    if (filterType !== 'all' && ev.event_type !== filterType) return false;
    if (filterGroup !== 'all' && ev.target_group !== filterGroup) return false;
    if (search && !(ev.title || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const today = new Date().toISOString().split('T')[0];
  const upcoming = filtered.filter(e => e.event_date >= today);
  const past     = filtered.filter(e => e.event_date < today);

  const officialCount = events.filter(e => e.is_official).length;
  const teacherCount  = events.filter(e => !e.is_official).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Coordenação · calendário</p>
          <h1 className="u-page-title text-3xl mt-1">Calendário acadêmico</h1>
          <p className="text-muted-foreground text-sm mt-2">
            <span className="tabular-nums">{officialCount}</span> eventos oficiais · <span className="tabular-nums">{teacherCount}</span> criados por professores
          </p>
        </div>
        <Button
          variant="arcade"
          onClick={() => { setShowForm(true); setEditId(null); setForm(blankForm); }}
          className="h-11 px-5 rounded-control font-bold shrink-0"
        >
          <PlusCircle className="h-5 w-5 mr-2" /> Novo evento
        </Button>
      </header>

      {/* Formulário */}
      {showForm && (
        <Card className="rounded-card">
          <CardContent className="p-5 sm:p-8 space-y-5">
            <h2 className="text-lg font-bold text-foreground">
              {editId ? 'Editar evento' : 'Criar evento'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="u-label ml-1">Título</Label>
                <Input
                  placeholder="Ex: ENEM 2026 — Prova Dia 1"
                  className="h-11 rounded-control bg-muted/30 border-none font-bold"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Data</Label>
                <Input
                  type="date"
                  className="h-11 rounded-control bg-muted/30 border-none font-bold"
                  value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Tipo</Label>
                <Select value={form.event_type} onValueChange={val => setForm(f => ({ ...f, event_type: val }))}>
                  <SelectTrigger className="h-11 rounded-control bg-muted/30 border-none font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    {EVENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value} className="font-bold">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Público</Label>
                <Select value={form.target_group} onValueChange={val => setForm(f => ({ ...f, target_group: val }))}>
                  <SelectTrigger className="h-11 rounded-control bg-muted/30 border-none font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    {TARGET_GROUPS.map(t => (
                      <SelectItem key={t.value} value={t.value} className="font-bold">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex items-center gap-3 pt-5">
                <input
                  type="checkbox"
                  id="is_official"
                  checked={form.is_official}
                  onChange={e => setForm(f => ({ ...f, is_official: e.target.checked }))}
                  className="h-4 w-4 rounded accent-primary"
                />
                <Label htmlFor="is_official" className="text-sm font-semibold cursor-pointer flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  Marcar como evento oficial
                </Label>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="u-label ml-1">Descrição (opcional)</Label>
                <Textarea
                  placeholder="Detalhes, link do edital, instruções..."
                  className="rounded-control bg-muted/30 border-none font-medium"
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={saving || !form.title || !form.event_date}
                className="flex-1 h-11 rounded-control font-bold"
              >
                {saving && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
                {editId ? 'Salvar alterações' : 'Criar evento'}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowForm(false); setEditId(null); }}
                className="h-11 px-5 rounded-control font-bold"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-11 rounded-control bg-muted/30 border-none font-medium"
            placeholder="Buscar evento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-11 rounded-control bg-muted/30 border-none font-bold w-full sm:w-52">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent className="rounded-control">
            <SelectItem value="all" className="font-bold">Todos os tipos</SelectItem>
            {EVENT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value} className="font-bold">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterGroup} onValueChange={setFilterGroup}>
          <SelectTrigger className="h-11 rounded-control bg-muted/30 border-none font-bold w-full sm:w-44">
            <SelectValue placeholder="Público" />
          </SelectTrigger>
          <SelectContent className="rounded-control">
            <SelectItem value="all" className="font-bold">Todo público</SelectItem>
            {TARGET_GROUPS.map(t => (
              <SelectItem key={t.value} value={t.value} className="font-bold">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="u-label">Carregando eventos…</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={events.length === 0 ? 'Nenhum evento no calendário' : 'Nenhum evento encontrado'}
          description={events.length === 0
            ? 'Crie o primeiro evento — simulado, vestibular, feriado — e ele aparece para os alunos.'
            : 'Tente outra busca, outro tipo ou outro público.'}
          action={events.length === 0
            ? { label: 'Novo evento', icon: PlusCircle, onClick: () => { setShowForm(true); setEditId(null); setForm(blankForm); } }
            : { label: 'Limpar filtros', onClick: () => { setSearch(''); setFilterType('all'); setFilterGroup('all'); } }}
        />
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="u-label">
                Próximos eventos (<span className="tabular-nums">{upcoming.length}</span>)
              </h2>
              {upcoming.map(ev => (
                <AdminEventRow
                  key={ev.id}
                  ev={ev}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              ))}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="u-label">
                Eventos passados (<span className="tabular-nums">{past.length}</span>)
              </h2>
              {past.map(ev => (
                <AdminEventRow
                  key={ev.id}
                  ev={ev}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                  past
                />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function AdminEventRow({
  ev,
  onEdit,
  onDelete,
  past = false,
}: {
  ev: AcademicEvent;
  onEdit: (ev: AcademicEvent) => void;
  onDelete: (id: string) => void;
  past?: boolean;
}) {
  const meta = EVENT_TYPES.find(t => t.value === ev.event_type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
  const targetLabel = ev.target_group === 'enem' ? 'ENEM' : ev.target_group === 'etec' ? 'ETEC/FATEC' : null;

  return (
    <div
      className={`flex items-center gap-3 sm:gap-4 bg-card border rounded-card p-3 sm:p-4 group transition-colors hover:bg-muted/20 ${past ? 'opacity-60' : ''}`}
    >
      <div className="text-center w-12 sm:w-14 shrink-0">
        <p className="text-xs font-bold text-foreground">
          {fmtLocale(ev.event_date + 'T00:00:00', 'date', 'pt-BR', { day: '2-digit', month: 'short' })}
        </p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {fmtDate(ev.event_date, 'yyyy', '')}
        </p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-foreground text-sm truncate">{ev.title}</p>
          {ev.is_official && (
            <Badge className="text-[10px] font-bold border-none bg-amber-100 text-amber-800 gap-1 shrink-0">
              <ShieldCheck className="h-2.5 w-2.5" />
              Oficial
            </Badge>
          )}
          {targetLabel && (
            <Badge variant="outline" className="text-[10px] font-bold shrink-0">{targetLabel}</Badge>
          )}
          <Badge className={`sm:hidden text-[10px] font-bold border-none shrink-0 ${meta.color}`}>{meta.label}</Badge>
        </div>
        {ev.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{ev.description}</p>
        )}
      </div>

      <Badge className={`hidden sm:inline-flex text-[10px] font-bold border-none shrink-0 ${meta.color}`}>{meta.label}</Badge>

      {/* Ações — admin pode editar/excluir qualquer evento */}
      <div className="flex flex-col sm:flex-row gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(ev)}
          className="h-9 w-9 rounded-control bg-muted/50 flex items-center justify-center hover:bg-muted text-foreground transition-colors"
          title="Editar" aria-label="Editar evento"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(ev.id)}
          className="h-9 w-9 rounded-control bg-muted/50 flex items-center justify-center hover:bg-red-50 text-red-500 transition-colors"
          title="Excluir" aria-label="Excluir evento"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
