
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  FolderOpen, FileText, Video, Link2, Image, File,
  CheckCircle2, Circle, BookOpen, Loader2, Calendar,
  Search, LayoutGrid, List, Zap, TrendingUp, X,
  ExternalLink, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/lib/AuthProvider';
import { trackAcao, trackFalha } from '@/lib/telemetry';
import { medirCarregamentoDeTela } from '@/lib/perf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ClassMaterial = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  file_url: string;
  file_type: string;
  target_group: string;
  teacher_name: string | null;
  created_at: string;
};

const FILE_TYPES: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  ring: string;
  bar: string;
  btnFrom: string;
  btnTo: string;
  glow: string;
  badgeBg: string;
  badgeText: string;
}> = {
  pdf: {
    label: 'PDF', icon: FileText,
    color: 'text-rose-500', bg: 'bg-rose-50', ring: 'ring-rose-200',
    bar: 'bg-rose-500', btnFrom: 'from-rose-500', btnTo: 'to-red-600',
    glow: 'shadow-rose-500/25', badgeBg: 'bg-rose-100', badgeText: 'text-rose-700',
  },
  video: {
    label: 'Vídeo', icon: Video,
    color: 'text-blue-500', bg: 'bg-blue-50', ring: 'ring-blue-200',
    bar: 'bg-blue-500', btnFrom: 'from-blue-500', btnTo: 'to-indigo-600',
    glow: 'shadow-blue-500/25', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700',
  },
  link: {
    label: 'Link', icon: Link2,
    color: 'text-violet-500', bg: 'bg-violet-50', ring: 'ring-violet-200',
    bar: 'bg-violet-500', btnFrom: 'from-violet-500', btnTo: 'to-fuchsia-600',
    glow: 'shadow-violet-500/25', badgeBg: 'bg-violet-100', badgeText: 'text-violet-700',
  },
  imagem: {
    label: 'Imagem', icon: Image,
    color: 'text-emerald-500', bg: 'bg-emerald-50', ring: 'ring-emerald-200',
    bar: 'bg-emerald-500', btnFrom: 'from-emerald-500', btnTo: 'to-teal-600',
    glow: 'shadow-emerald-500/25', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700',
  },
  outro: {
    label: 'Outro', icon: File,
    color: 'text-slate-500', bg: 'bg-slate-50', ring: 'ring-slate-200',
    bar: 'bg-slate-400', btnFrom: 'from-slate-500', btnTo: 'to-slate-700',
    glow: 'shadow-slate-500/20', badgeBg: 'bg-slate-100', badgeText: 'text-slate-600',
  },
};

const SUBJECT_COLORS: Record<string, string> = {
  'Matemática': 'bg-blue-100 text-blue-700',
  'Física': 'bg-cyan-100 text-cyan-700',
  'Química': 'bg-lime-100 text-lime-700',
  'Biologia': 'bg-emerald-100 text-emerald-700',
  'História': 'bg-amber-100 text-amber-700',
  'Geografia': 'bg-orange-100 text-orange-700',
  'Português': 'bg-rose-100 text-rose-700',
  'Literatura': 'bg-pink-100 text-pink-700',
  'Filosofia': 'bg-purple-100 text-purple-700',
  'Sociologia': 'bg-violet-100 text-violet-700',
  'Linguagens': 'bg-teal-100 text-teal-700',
  'Atualidades': 'bg-indigo-100 text-indigo-700',
};

function subjectColor(s: string | null) {
  if (!s) return 'bg-slate-100 text-slate-600';
  return SUBJECT_COLORS[s] ?? 'bg-primary/10 text-primary';
}

/* Anel de progresso SVG */
function ProgressRing({ value, size = 96 }: { value: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.95)" strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }}
      />
    </svg>
  );
}

/* Skeleton de card */
function CardSkeleton() {
  return (
    <div className="rounded-[2rem] bg-white border border-slate-100 overflow-hidden animate-pulse">
      <div className="h-1.5 bg-slate-100 w-full" />
      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <div className="h-11 w-11 rounded-2xl bg-slate-100 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-slate-100 rounded-full" />
            <div className="h-4 w-2/3 bg-slate-100 rounded-full" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-slate-100 rounded-full w-full" />
          <div className="h-3 bg-slate-100 rounded-full w-4/5" />
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex justify-between">
          <div className="h-3 w-1/4 bg-slate-100 rounded-full" />
          <div className="h-9 w-28 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function StudentMaterialsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [materials, setMaterials] = useState<ClassMaterial[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'viewed'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [justChecked, setJustChecked] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Determina o grupo do aluno: etec ou enem
      const rawTarget = (
        profile?.exam_target ||
        user?.user_metadata?.exam_target ||
        profile?.profile_type ||
        user?.user_metadata?.profile_type ||
        'enem'
      ).toLowerCase();
      const tg = rawTarget.includes('etec') ? 'etec' : 'enem';

      const inicioCarga = Date.now();
      const [matRes, viewRes] = await Promise.all([
        supabase
          .from('class_materials')
          .select('id, title, description, subject, file_url, file_type, target_group, teacher_name, created_at')
          .eq('is_published', true)
          .or(`target_group.eq.all,target_group.eq.${tg}`)
          .order('created_at', { ascending: false }),
        supabase.from('material_views').select('material_id').eq('student_id', user.id),
      ]);
      // `.data ?? []` sozinho engolia o erro: uma query que falha devolve
      // data=null sem lançar, e a tela mostrava "nenhum material" — um estado
      // vazio indistinguível de falha, que é exatamente o que faz o aluno
      // achar que a plataforma não tem conteúdo.
      if (matRes.error) throw matRes.error;
      if (viewRes.error) throw viewRes.error;

      setMaterials(matRes.data ?? []);
      setViewedIds(new Set((viewRes.data ?? []).map(v => v.material_id)));
      medirCarregamentoDeTela('materiais', inicioCarga);
      trackAcao('materiais_carregados', { total: matRes.data?.length ?? 0, trilha: tg });
    } catch (e) {
      trackFalha('materiais_falha_carregar', e);
      toast({
        title: 'Não foi possível carregar os materiais',
        description: 'Verifique sua conexão e toque em atualizar.',
        variant: 'destructive',
      });
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleOpen(material: ClassMaterial) {
    let url = material.file_url;
    
    // Remove query params that force download if any
    url = url.replace(/[\?&]download=[^&]+/, '');
    url = url.replace(/[\?&]$/, '');
    
    // Force inline viewing for documents via Google Docs Viewer
    const isDocument = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx)$/i.test(url) || material.file_type === 'pdf';
    if (isDocument && !url.includes('docs.google.com/viewer')) {
      url = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
    }

    // `window.open` devolve null quando o navegador bloqueia o pop-up —
    // comum no Chrome de Android quando a abertura não é reconhecida como
    // gesto direto. Sem esta checagem o aluno toca no material e nada
    // acontece, sem nenhuma pista do motivo.
    const janela = window.open(url, '_blank', 'noopener,noreferrer');
    if (!janela) {
      trackFalha('material_popup_bloqueado', 'window.open devolveu null', {
        tipo: material.file_type ?? 'desconhecido',
      });
      toast({
        title: 'Seu navegador bloqueou a abertura',
        description: 'Toque e segure no material para abrir em nova aba, ou libere pop-ups para este site.',
        variant: 'destructive',
      });
      return;
    }

    trackAcao('material_aberto', {
      tipo: material.file_type ?? 'desconhecido',
      via_viewer: isDocument,
    });
    if (!viewedIds.has(material.id)) await markViewed(material.id);
  }

  async function markViewed(materialId: string) {
    if (!user) return;
    setToggling(materialId);
    const { error } = await supabase
      .from('material_views')
      .upsert({ material_id: materialId, student_id: user.id }, { onConflict: 'material_id,student_id' });
    if (!error) {
      setViewedIds(prev => new Set([...prev, materialId]));
      setJustChecked(materialId);
      setTimeout(() => setJustChecked(null), 800);
    } else {
      // Antes o `if (!error)` simplesmente não fazia nada quando dava erro: o
      // aluno abria o material e a marca de "visto" nunca aparecia.
      trackFalha('material_visto_nao_gravado', error);
    }
    setToggling(null);
  }

  async function unmarkViewed(materialId: string) {
    if (!user) return;
    setToggling(materialId);
    const { error } = await supabase
      .from('material_views')
      .delete()
      .eq('material_id', materialId)
      .eq('student_id', user.id);
    if (!error) {
      setViewedIds(prev => { const s = new Set(prev); s.delete(materialId); return s; });
    } else {
      toast({ title: 'Erro ao desmarcar', description: error.message, variant: 'destructive' });
    }
    setToggling(null);
  }

  const subjects = Array.from(new Set(materials.map(m => m.subject).filter(Boolean))) as string[];
  const totalStudied = materials.filter(m => viewedIds.has(m.id)).length;
  const progressPercent = materials.length > 0 ? Math.round((totalStudied / materials.length) * 100) : 0;
  const pending = materials.length - totalStudied;

  const hasActiveFilters = filterSubject !== 'all' || statusFilter !== 'all' || searchQuery !== '';

  const filtered = materials.filter(m => {
    if (filterSubject !== 'all' && m.subject !== filterSubject) return false;
    const isViewed = viewedIds.has(m.id);
    if (statusFilter === 'pending' && isViewed) return false;
    if (statusFilter === 'viewed' && !isViewed) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !m.title.toLowerCase().includes(q) &&
        !(m.description?.toLowerCase().includes(q)) &&
        !(m.subject?.toLowerCase().includes(q)) &&
        !(m.teacher_name?.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-700 max-w-5xl mx-auto px-1 md:px-0">

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="aurora-dark relative overflow-hidden rounded-[2.5rem] p-7 md:p-10 text-white shadow-2xl border border-white/5"
      >
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none rounded-[2.5rem]" />
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/20 rounded-full blur-[80px] hidden md:block" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-accent/10 rounded-full blur-[60px] hidden md:block" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <Badge className="bg-white/10 text-white border border-white/20 font-black text-[9px] px-4 py-1.5 uppercase tracking-wider">
              <Zap className="h-3 w-3 mr-1.5 fill-accent text-accent" />
              Biblioteca Pessoal
            </Badge>
            <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter leading-[0.9] uppercase">
              Materiais <br />
              <span className="text-gradient-brand">de Aula</span>
            </h1>
            <p className="text-white/50 text-sm font-medium max-w-sm leading-relaxed">
              Todos os conteúdos compartilhados pelos seus professores, organizados para você.
            </p>
          </div>

          {/* Anel de progresso */}
          {!loading && materials.length > 0 && (
            <div className="flex items-center gap-5 shrink-0">
              <div className="relative">
                <ProgressRing value={progressPercent} size={100} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black leading-none">{progressPercent}<span className="text-sm font-bold opacity-70">%</span></span>
                  <span className="text-[8px] font-black uppercase tracking-widest opacity-50 mt-0.5">Concluído</span>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Total', val: materials.length, icon: FolderOpen },
                  { label: 'Estudados', val: totalStudied, icon: CheckCircle2 },
                  { label: 'Pendentes', val: pending, icon: Calendar },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <s.icon className="h-3.5 w-3.5 opacity-50 shrink-0" />
                    <span className="text-lg font-black leading-none">{s.val}</span>
                    <span className="text-[10px] font-bold opacity-40 uppercase tracking-wider">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Barra de progresso linear no rodapé do hero */}
        {!loading && materials.length > 0 && (
          <div className="relative z-10 mt-6 space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/65">
              <span className="flex items-center gap-1.5"><TrendingUp className="h-3 w-3" /> Progresso Geral</span>
              <span>{totalStudied} / {materials.length} materiais</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-amber-400 transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── BARRA DE FILTROS STICKY ── */}
      {!loading && materials.length > 0 && (
        <div className="relative md:sticky md:top-2 z-20">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-100/80 p-2.5 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">

            {/* Busca */}
            <div className="relative flex-1 group min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Buscar por título, professor, matéria..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-8 rounded-xl bg-slate-50 focus:bg-white border border-transparent focus:border-primary/20 text-xs font-semibold placeholder-slate-400 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
              {/* Tabs de status */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'pending', label: 'Pendentes' },
                  { id: 'viewed', label: 'Estudados' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all whitespace-nowrap ${
                      statusFilter === tab.id
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-slate-500 hover:text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Select de matéria */}
              {subjects.length > 0 && (
                <Select value={filterSubject} onValueChange={setFilterSubject}>
                  <SelectTrigger className="h-9 w-36 rounded-xl bg-slate-50 border-transparent shadow-none font-bold text-[11px] focus:ring-0">
                    <SelectValue placeholder="Matéria" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="all" className="font-bold text-xs">Todas as matérias</SelectItem>
                    {subjects.map(s => (
                      <SelectItem key={s} value={s} className="font-bold text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Limpar filtros */}
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearchQuery(''); setFilterSubject('all'); setStatusFilter('all'); }}
                  className="h-9 px-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap"
                >
                  <X className="h-3 w-3" /> Limpar
                </button>
              )}

              {/* Toggle de visualização */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl ml-auto sm:ml-0">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grade"
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="Lista"
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTAGEM ── */}
      {!loading && materials.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            {filtered.length === 0
              ? 'Nenhum material encontrado'
              : `${filtered.length} material${filtered.length !== 1 ? 'is' : ''}`}
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearchQuery(''); setFilterSubject('all'); setStatusFilter('all'); }}
              className="text-xs text-accent font-bold hover:underline"
            >
              Ver todos
            </button>
          )}
        </div>
      )}

      {/* ── CONTEÚDO ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {Array(4).fill(0).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center flex flex-col items-center gap-4">
          <div className="h-20 w-20 rounded-[2rem] bg-slate-100 flex items-center justify-center">
            <FolderOpen className="h-9 w-9 text-slate-300" />
          </div>
          <div>
            <p className="font-black italic text-primary text-lg">Nenhum material encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters ? 'Tente ajustar os filtros.' : 'Nenhum material disponível ainda.'}
            </p>
          </div>
          {hasActiveFilters && (
            <Button
              onClick={() => { setSearchQuery(''); setFilterSubject('all'); setStatusFilter('all'); }}
              variant="outline"
              className="rounded-2xl font-black text-xs uppercase tracking-wider"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {filtered.map((m, idx) => {
            const meta = FILE_TYPES[m.file_type] ?? FILE_TYPES.outro;
            const Icon = meta.icon;
            const isViewed = viewedIds.has(m.id);
            const isBusy = toggling === m.id;
            const wasJustChecked = justChecked === m.id;

            return (
              <article
                key={m.id}
                className={`group relative bg-white rounded-[2rem] border overflow-hidden transition-all duration-300
                  ${isViewed
                    ? 'border-emerald-200 shadow-md hover:shadow-lg'
                    : 'border-slate-100 shadow-md hover:shadow-xl hover:-translate-y-1'
                  }`}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                {/* Barra colorida superior */}
                <div className={`h-1 w-full ${meta.bar} ${!isViewed ? 'opacity-100' : 'opacity-30'} transition-opacity`} />

                {/* Overlay sutil quando estudado */}
                {isViewed && (
                  <div className="absolute inset-0 bg-emerald-500/[0.03] pointer-events-none rounded-[2rem]" />
                )}

                <div className="p-5 md:p-6 space-y-4">
                  {/* Header: ícone + matéria + tipo + botão de marcar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`h-11 w-11 rounded-2xl ${meta.bg} flex items-center justify-center shrink-0 ring-1 ring-inset ${meta.ring}`}>
                        <Icon className={`h-5 w-5 ${meta.color}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.badgeBg} ${meta.badgeText}`}>
                            {meta.label}
                          </span>
                          {m.subject && (
                            <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${subjectColor(m.subject)}`}>
                              {m.subject}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botão marcar estudado */}
                    <button
                      onClick={() => isViewed ? unmarkViewed(m.id) : markViewed(m.id)}
                      disabled={isBusy}
                      aria-label={isViewed ? 'Desmarcar como estudado' : 'Marcar como estudado'}
                      className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 border-2
                        ${wasJustChecked ? 'scale-125' : 'scale-100'}
                        ${isViewed
                          ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-rose-500 hover:border-rose-500'
                          : 'bg-white border-slate-200 text-slate-300 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50'
                        }`}
                    >
                      {isBusy
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : isViewed
                          ? <CheckCircle2 className="h-4 w-4" />
                          : <Circle className="h-4 w-4" />
                      }
                    </button>
                  </div>

                  {/* Título + descrição */}
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <h3 className={`font-black text-base leading-snug tracking-tight flex-1 transition-colors duration-200 ${isViewed ? 'text-slate-400' : 'text-slate-800 group-hover:text-primary'}`}>
                        {m.title}
                      </h3>
                      {!isViewed && (
                        <span className="shrink-0 mt-0.5 flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                          Novo
                        </span>
                      )}
                    </div>
                    {m.description ? (
                      <p className={`text-xs font-medium leading-relaxed line-clamp-2 ${isViewed ? 'text-slate-300' : 'text-slate-500'}`}>
                        {m.description}
                      </p>
                    ) : (
                      <p className="text-xs italic text-slate-300">Sem descrição.</p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-slate-100" />

                  {/* Footer: professor + data + botão */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-600 truncate">{m.teacher_name || 'Professor'}</p>
                      <p className="text-[9px] text-slate-400 font-medium">
                        {format(new Date(m.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </p>
                    </div>

                    <Button
                      onClick={() => handleOpen(m)}
                      className={`h-9 px-4 rounded-2xl bg-gradient-to-br ${meta.btnFrom} ${meta.btnTo} text-white font-black text-[10px] uppercase tracking-wide shadow-md ${meta.glow} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-none shrink-0 flex items-center gap-1.5`}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Abrir
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* ── VIEW LISTA ── */
        <div className="space-y-2">
          {filtered.map(m => {
            const meta = FILE_TYPES[m.file_type] ?? FILE_TYPES.outro;
            const Icon = meta.icon;
            const isViewed = viewedIds.has(m.id);
            const isBusy = toggling === m.id;

            return (
              <div
                key={m.id}
                className={`group flex items-center gap-3 md:gap-4 bg-white rounded-2xl px-4 py-3 border transition-all duration-200 hover:shadow-md
                  ${isViewed ? 'border-emerald-100 bg-emerald-50/20' : 'border-slate-100 hover:border-slate-200'}`}
              >
                {/* Ícone */}
                <div className={`h-10 w-10 rounded-xl ${meta.bg} flex items-center justify-center shrink-0 ring-1 ring-inset ${meta.ring}`}>
                  <Icon className={`h-4 w-4 ${meta.color}`} />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={`font-bold text-sm truncate ${isViewed ? 'text-slate-400' : 'text-slate-800'}`}>
                      {m.title}
                    </h4>
                    {m.subject && (
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${subjectColor(m.subject)}`}>
                        {m.subject}
                      </span>
                    )}
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${meta.badgeBg} ${meta.badgeText}`}>
                      {meta.label}
                    </span>
                    {isViewed && (
                      <span className="text-[9px] font-black text-emerald-600 shrink-0">✓ Estudado</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                    <span className="truncate">{m.teacher_name || 'Professor'}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0">{format(new Date(m.created_at), "dd/MM/yy", { locale: ptBR })}</span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => isViewed ? unmarkViewed(m.id) : markViewed(m.id)}
                    disabled={isBusy}
                    aria-label={isViewed ? 'Desmarcar' : 'Marcar como estudado'}
                    className={`h-8 w-8 rounded-full flex items-center justify-center transition-all border-2
                      ${isViewed
                        ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-rose-500 hover:border-rose-500'
                        : 'bg-white border-slate-200 text-slate-300 hover:border-emerald-400 hover:text-emerald-500'
                      }`}
                  >
                    {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isViewed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  </button>
                  <Button
                    onClick={() => handleOpen(m)}
                    className={`h-8 px-3 rounded-xl bg-gradient-to-br ${meta.btnFrom} ${meta.btnTo} text-white font-black text-[10px] border-none shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center gap-1`}
                  >
                    <BookOpen className="h-3 w-3" />
                    Abrir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
