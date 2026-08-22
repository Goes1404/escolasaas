"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Card, CardFooter, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  Loader2,
  ChevronRight,
  Zap,
  TrendingUp,
  Pin,
  CheckCircle2,
  Film,
  ListVideo,
  BookOpen,
  SlidersHorizontal,
  X,
  Folder,
  FolderOpen,
  ArrowLeft,
  Calculator,
  BookOpenText,
  Globe,
  Atom,
  Dna,
  Compass,
  HelpCircle,
  Users as UsersIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { trackAcao, trackFalha } from "@/lib/telemetry";
import { medirCarregamentoDeTela } from "@/lib/perf";
import { getTrailCoverUrl, isPlaceholderImage } from "@/lib/trail-cover";

const TRAIL_CATEGORIES = ["Todos", "Matemática", "Linguagens", "Física", "Biologia", "História", "Geografia", "Atualidades", "Literatura", "Química", "Filosofia", "Sociologia"];

function getSafeTrailImage(url: string | null | undefined, title: string, category: string) {
  if (!url || isPlaceholderImage(url)) {
    return getTrailCoverUrl(title, category);
  }
  return url;
}

const SUBJECT_CONFIGS: Record<string, { color: string, bg: string, border: string, glow: string, icon: any }> = {
  "Matemática": { 
    color: "text-orange-500", 
    bg: "bg-orange-500/10", 
    border: "border-orange-500/20 hover:border-orange-500/40", 
    glow: "group-hover:shadow-orange-500/10", 
    icon: Calculator 
  },
  "Linguagens": { 
    color: "text-indigo-500", 
    bg: "bg-indigo-500/10", 
    border: "border-indigo-500/20 hover:border-indigo-500/40", 
    glow: "group-hover:shadow-indigo-500/10", 
    icon: BookOpenText 
  },
  "Física": { 
    color: "text-blue-500", 
    bg: "bg-blue-500/10", 
    border: "border-blue-500/20 hover:border-blue-500/40", 
    glow: "group-hover:shadow-blue-500/10", 
    icon: Atom 
  },
  "Biologia": { 
    color: "text-emerald-500", 
    bg: "bg-emerald-500/10", 
    border: "border-emerald-500/20 hover:border-emerald-500/40", 
    glow: "group-hover:shadow-emerald-500/10", 
    icon: Dna 
  },
  "História": { 
    color: "text-amber-500", 
    bg: "bg-amber-500/10", 
    border: "border-amber-500/20 hover:border-amber-500/40", 
    glow: "group-hover:shadow-amber-500/10", 
    icon: Compass 
  },
  "Geografia": { 
    color: "text-teal-500", 
    bg: "bg-teal-500/10", 
    border: "border-teal-500/20 hover:border-teal-500/40", 
    glow: "group-hover:shadow-teal-500/10", 
    icon: Globe 
  },
  "Atualidades": { 
    color: "text-rose-500", 
    bg: "bg-rose-500/10", 
    border: "border-rose-500/20 hover:border-rose-500/40", 
    glow: "group-hover:shadow-rose-500/10", 
    icon: Zap 
  },
  "Literatura": { 
    color: "text-pink-500", 
    bg: "bg-pink-500/10", 
    border: "border-pink-500/20 hover:border-pink-500/40", 
    glow: "group-hover:shadow-pink-500/10", 
    icon: BookOpen 
  },
  "Química": { 
    color: "text-cyan-500", 
    bg: "bg-cyan-500/10", 
    border: "border-cyan-500/20 hover:border-cyan-500/40", 
    glow: "group-hover:shadow-cyan-500/10", 
    icon: Atom 
  },
  "Filosofia": { 
    color: "text-violet-500", 
    bg: "bg-violet-500/10", 
    border: "border-violet-500/20 hover:border-violet-500/40", 
    glow: "group-hover:shadow-violet-500/10", 
    icon: HelpCircle 
  },
  "Sociologia": { 
    color: "text-yellow-600", 
    bg: "bg-yellow-500/10", 
    border: "border-yellow-500/20 hover:border-yellow-500/40", 
    glow: "group-hover:shadow-yellow-500/10", 
    icon: UsersIcon 
  },
};

function getSubjectConfig(subject: string) {
  return SUBJECT_CONFIGS[subject] || {
    color: "text-slate-500",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20 hover:border-slate-500/40",
    glow: "group-hover:shadow-slate-500/10",
    icon: Folder
  };
}

const AUDIENCE_FILTERS = [
  { id: "all", label: "Toda a Comunidade" },
  { id: "etec", label: "Perfil ETEC" },
  { id: "uni", label: "Perfil Enem e Vestibulares" }
];

export default function LearningTrailsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const dataFetchedRef = useRef(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [activeAudience, setActiveAudience] = useState("all");
  const [typeFilter, setTypeFilter] = useState<'all' | 'standalone' | 'serie'>('all');

  const [dbTrails, setDbTrails] = useState<any[]>([]);
  const [allProgress, setAllProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinningId, setPinningId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // Proteção Industrial: Só busca dados se o perfil estiver carregado
    if (!user || !profile || dataFetchedRef.current) return;

    setLoading(true);
    // A marcação de "já buscou" só acontece DEPOIS do sucesso. Antes ela vinha
    // aqui, então uma falha de rede deixava a guarda ligada para sempre: a tela
    // ficava permanentemente vazia e nem trocar de aba refazia a busca — só
    // recarregar a página inteira.
    const inicioCarga = Date.now();

    try {
      const audience = (
        profile?.exam_target ||
        user?.user_metadata?.exam_target ||
        profile?.profile_type ||
        user?.user_metadata?.profile_type ||
        'enem'
      ).toLowerCase().trim();
      const userAudience = audience.includes('etec') ? 'etec' : 'enem';

      // Em paralelo: as duas consultas são independentes, e em série a tela
      // esperava a soma das duas latências.
      let [trailsResult, progressResult] = await Promise.all([
        supabase.from('trails')
          .select('*')
          .or('status.eq.active,status.eq.published')
          .order('created_at', { ascending: false }),
        supabase.from('user_progress').select('*').eq('user_id', user.id),
      ]);

      if (trailsResult.error) throw trailsResult.error;

      // Filtra por segmentação no front-end
      if (trailsResult.data) {
        trailsResult.data = trailsResult.data.filter(t => {
          if (!t.target_audience) return true;
          return t.target_audience === 'all' || t.target_audience === userAudience;
        });
      }

      if (trailsResult.data) {
        setDbTrails(trailsResult.data);
      }
      if (progressResult.data) setAllProgress(progressResult.data);

      dataFetchedRef.current = true;
      medirCarregamentoDeTela('trilhas', inicioCarga);
      trackAcao('trilhas_carregadas', { total: trailsResult.data?.length ?? 0 });
    } catch (e: any) {
      // Antes: `console.error` e nada mais. A tela caía no estado vazio, e
      // "não há trilhas" é indistinguível de "a busca falhou" para o aluno.
      trackFalha('trilhas_falha_carregar', e);
      toast({
        title: 'Não foi possível carregar as trilhas',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (user && profile) fetchData();
  }, [user, profile, fetchData]);

  const handlePinTrail = async (trailId: string) => {
    if (!user || pinningId) return;
    setPinningId(trailId);

    // Check if currently pinned (exists in progress)
    const isPinned = allProgress?.find(p => p.trail_id === trailId);

    try {
      if (isPinned) {
        // Unpin: Delete the record
        // Note: For simplicity, this removes progress too. 
        // In a complex app we'd use a 'pinned' column, but here progress is treated as 'active trails'.
        const { error } = await supabase.from('user_progress').delete().eq('user_id', user.id).eq('trail_id', trailId);
        if (error) throw error;
        toast({ title: "Trilha Removida da Home 📌", description: "O item saiu da sua lista de acesso rápido." });
        trackAcao('trilha_desafixada');
      } else {
        // Pin: Upsert the record
        const { error } = await supabase.from('user_progress').upsert({
          user_id: user.id,
          trail_id: trailId,
          last_accessed: new Date().toISOString()
        }, { onConflict: 'user_id,trail_id' });

        if (error) throw error;

        toast({
          title: "Trilha Fixada! 📌",
          description: "Acesse rapidamente pela Página Inicial."
        });
        trackAcao('trilha_fixada');
      }

      const { data: progressRes } = await supabase.from('user_progress').select('*').eq('user_id', user.id);
      if (progressRes) setAllProgress(progressRes);
    } catch (e: any) {
      trackFalha('trilha_falha_fixar', e);
      toast({
        title: "Não foi possível fixar a trilha",
        description: "Tente de novo em instantes.",
        variant: "destructive",
      });
    } finally {
      setPinningId(null);
    }
  };

  const filteredTrails = useMemo(() => {
    if (!Array.isArray(dbTrails)) return [];
    return dbTrails.filter(trail => {
      const trailTitle = (trail?.title || '').toLowerCase();
      const trailCategory = (trail?.category || '').toLowerCase();
      const query = searchTerm.toLowerCase();

      const matchesSearch = trailTitle.includes(query) || trailCategory.includes(query);
      const matchesCategory = activeCategory === "Todos" || trail?.category === activeCategory;
      const matchesAudience = activeAudience === "all" || trail?.target_audience === activeAudience || trail?.target_audience === "both" || !trail?.target_audience;
      const matchesType = typeFilter === 'all' || (trail?.trail_type ?? 'standalone') === typeFilter;

      return matchesSearch && matchesCategory && matchesAudience && matchesType;
    });
  }, [dbTrails, searchTerm, activeCategory, activeAudience, typeFilter]);

  const subjectFolders = useMemo(() => {
    if (!Array.isArray(dbTrails)) return [];
    
    const grouped: Record<string, { completedSum: number, total: number }> = {};
    
    dbTrails.forEach(trail => {
      const matchesAudience = activeAudience === "all" || trail?.target_audience === activeAudience || trail?.target_audience === "both" || !trail?.target_audience;
      const matchesType = typeFilter === 'all' || (trail?.trail_type ?? 'standalone') === typeFilter;
      
      if (matchesAudience && matchesType) {
        const cat = trail.category || "Outros";
        if (!grouped[cat]) {
          grouped[cat] = { completedSum: 0, total: 0 };
        }
        
        const userProgress = allProgress?.find(p => p.trail_id === trail.id);
        const percentage = userProgress?.percentage || 0;
        grouped[cat].completedSum += percentage;
        grouped[cat].total += 1;
      }
    });

    return Object.entries(grouped).map(([name, data]) => ({
      name,
      count: data.total,
      avgProgress: Math.round(data.completedSum / data.total)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [dbTrails, activeAudience, typeFilter, allProgress]);

  const hasActiveFilters = activeCategory !== "Todos" || activeAudience !== "all" || typeFilter !== "all" || searchTerm !== "";

  function clearFilters() {
    setActiveCategory("Todos");
    setActiveAudience("all");
    setTypeFilter("all");
    setSearchTerm("");
  }

  if (loading && !dataFetchedRef.current) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
        <p className="mt-6 text-primary font-black italic uppercase tracking-[0.3em] text-[10px] animate-pulse">Sintonizando Estúdio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1 md:px-4">
      {/* Hero Banner */}
      <section className="aurora-dark relative overflow-hidden rounded-card p-8 md:p-16 text-white shadow-2xl text-center border border-white/5">
        <div className="absolute inset-0 dot-grid-dark opacity-20 pointer-events-none rounded-card" />
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 md:w-96 md:h-96 bg-primary/20 rounded-full blur-[80px] hidden md:block" />
        <div className="absolute bottom-[-10%] left-[-5%] w-48 h-48 bg-primary/10 rounded-full blur-[60px] hidden md:block" />
        <div className="relative z-10 space-y-6 max-w-3xl mx-auto">
          <Badge className="bg-primary/10 text-primary border border-primary/20 font-black text-[9px] px-4 py-1.5 uppercase tracking-wider shadow-xl">PLATAFORMA EAD</Badge>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black italic tracking-tighter leading-[0.95] uppercase break-words px-2">
            Sua Rota de <br /><span className="text-gradient-brand italic">Alta Performance</span>
          </h1>
          <p className="text-sm md:text-xl text-gray-400 font-medium italic leading-relaxed max-w-xl mx-auto">
            Escolha um dos eixos temáticos e inicie sua jornada guiada rumo ao sucesso acadêmico.
          </p>
        </div>
      </section>

      {/* Barra de Filtros Unificada */}
      <div className="relative md:sticky md:top-2 z-20 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 bg-white/80 backdrop-blur-xl rounded-2xl p-3 shadow-xl border border-slate-100">
          {/* Busca */}
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-accent" />
            <Input
              placeholder="Pesquisar trilha..."
              className="pl-11 h-11 bg-slate-50 border-none shadow-none rounded-xl text-sm font-medium focus-visible:ring-accent focus-visible:bg-white transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtros inline */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar max-w-full pb-0.5">
            {/* Tipo */}
            <div className="flex items-center bg-slate-50 rounded-xl p-1 gap-1 shrink-0 whitespace-nowrap">
              {([
                { id: 'all' as const, label: 'Todos', icon: null as typeof Film | null },
                { id: 'standalone' as const, label: 'Aulas', icon: Film as typeof Film | null },
                { id: 'serie' as const, label: 'Séries', icon: ListVideo as typeof Film | null },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTypeFilter(id)}
                  aria-pressed={typeFilter === id}
                  className={`h-9 px-4 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5
                    ${typeFilter === id
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-500 hover:text-primary hover:bg-white'}`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {label}
                </button>
              ))}
            </div>

            {/* Público */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={`h-11 px-4 rounded-xl font-black text-[10px] uppercase gap-2 border-none shadow-none transition-all shrink-0 whitespace-nowrap
                    ${activeAudience !== 'all' ? 'bg-primary text-white hover:bg-primary/90' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {AUDIENCE_FILTERS.find(f => f.id === activeAudience)?.label ?? 'Perfil'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-40 px-3 py-2">Público-Alvo</DropdownMenuLabel>
                {AUDIENCE_FILTERS.map(filter => (
                  <DropdownMenuItem
                    key={filter.id}
                    onClick={() => setActiveAudience(filter.id)}
                    className={`rounded-xl px-3 py-2.5 font-bold text-xs cursor-pointer mb-1 ${activeAudience === filter.id ? 'bg-primary text-white' : ''}`}
                  >
                    {filter.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Limpar filtros */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="h-11 px-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors font-black text-[10px] uppercase flex items-center gap-1.5"
                aria-label="Limpar todos os filtros"
              >
                <X className="h-3.5 w-3.5" />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Categorias */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TRAIL_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className={`rounded-full px-6 h-10 text-[10px] font-black uppercase tracking-widest shrink-0 transition-all shadow-sm border-none
                ${activeCategory === cat
                  ? 'bg-primary text-white shadow-primary/20 shadow-md'
                  : 'bg-white text-primary hover:bg-primary/5'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Pasta Header */}
      {activeCategory !== "Todos" && !searchTerm && (
        <div className="flex flex-col gap-4 bg-slate-50/50 border border-slate-100 rounded-3xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveCategory("Todos")}
              className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para as matérias
            </button>
            <span className="text-[10px] font-black bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full uppercase tracking-wider">
              Pasta
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-2xl ${getSubjectConfig(activeCategory).bg} flex items-center justify-center`}>
              <FolderOpen className={`h-6 w-6 ${getSubjectConfig(activeCategory).color}`} />
            </div>
            <div>
              <h2 className="text-2xl font-black italic tracking-tighter text-slate-800 leading-none">
                {activeCategory}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Visualizando todas as trilhas contidas nesta pasta.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contagem de resultados */}
      {(activeCategory !== "Todos" || searchTerm) && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
            {filteredTrails.length === 0
              ? 'Nenhuma trilha encontrada'
              : `${filteredTrails.length} trilha${filteredTrails.length !== 1 ? 's' : ''}`}
          </p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-accent font-bold hover:underline">
              Ver todas
            </button>
          )}
        </div>
      )}

      {/* Folder or Trails Grid */}
      {activeCategory === "Todos" && !searchTerm ? (
        subjectFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="h-20 w-20 rounded-card bg-slate-100 flex items-center justify-center">
              <BookOpen className="h-9 w-9 text-slate-300" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-black text-primary italic">Nenhuma trilha cadastrada</p>
              <p className="text-sm text-muted-foreground">Novas aulas estarão disponíveis em breve.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {subjectFolders.map((folder) => {
              const config = getSubjectConfig(folder.name);
              const FolderIcon = config.icon;
              
              return (
                <div
                  key={folder.name}
                  onClick={() => setActiveCategory(folder.name)}
                  className="group relative cursor-pointer text-left"
                >
                  {/* Folder Top Tab */}
                  <div className="flex -mb-[1px] ml-4 transition-transform group-hover:translate-y-[-2px] duration-300">
                    <div className={`h-7 px-4 rounded-t-xl font-black text-[9px] uppercase tracking-widest flex items-center border-t border-x bg-white ${config.color} ${config.border} shadow-[0_-4px_10px_rgba(0,0,0,0.02)]`}>
                      {folder.name}
                    </div>
                    <div className="w-8 h-7 bg-slate-50 border-b border-transparent opacity-50" />
                  </div>
                  
                  {/* Folder Main Body */}
                  <div className={`rounded-2xl rounded-tl-none border bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-48 relative overflow-hidden ${config.border}`}>
                    <FolderIcon className={`absolute -right-8 -bottom-8 h-32 w-32 ${config.color} opacity-5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12 pointer-events-none`} />
                    
                    <div className="relative z-10 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className={`h-11 w-11 rounded-xl ${config.bg} flex items-center justify-center`}>
                          <Folder className={`h-6 w-6 ${config.color}`} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {folder.count} {folder.count === 1 ? 'trilha' : 'trilhas'}
                        </span>
                      </div>
                      
                      <h3 className="text-xl font-black text-slate-800 italic uppercase tracking-tight mt-2 truncate">
                        {folder.name}
                      </h3>
                    </div>

                    <div className="relative z-10 pt-4 border-t border-slate-100 mt-auto">
                      <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                        <span>Progresso Médio</span>
                        <span className={config.color}>{folder.avgProgress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${folder.avgProgress}%`, backgroundColor: 'currentColor', color: 'hsl(var(--primary))' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Trails Grid */
        filteredTrails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="h-20 w-20 rounded-card bg-slate-100 flex items-center justify-center">
              <BookOpen className="h-9 w-9 text-slate-300" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-black text-primary italic">Nenhuma trilha encontrada</p>
              <p className="text-sm text-muted-foreground">Tente ajustar os filtros ou pesquisar outro termo.</p>
            </div>
            <Button onClick={clearFilters} variant="outline" className="rounded-2xl font-black text-xs uppercase tracking-wider mt-2">
              Limpar filtros
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
            {filteredTrails.map((trail) => {
              const userProgress = allProgress?.find(p => p.trail_id === trail.id);
              const percentage = userProgress?.percentage || 0;
              const isPinned = !!userProgress;
              const teacherInitial = (trail.teacher_name || "M").charAt(0).toUpperCase();

              return (
                <Card key={trail.id} className="gradient-border group overflow-hidden border-none shadow-xl hover:shadow-2xl hover:glow-orange transition-[transform,box-shadow] duration-300 bg-white rounded-card flex flex-col h-full">
                  <div className="relative aspect-video overflow-hidden shrink-0">
                    <Image
                      src={getSafeTrailImage(trail.image_url, trail.title, trail.category)}
                      alt={trail.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getTrailCoverUrl(trail.title, trail.category);
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent opacity-60" />
                    <div className="absolute top-5 left-5 flex gap-2">
                      <Badge className="bg-white/95 backdrop-blur-md text-primary border-none shadow-lg px-4 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-accent fill-accent" />
                        {trail.category}
                      </Badge>
                      {trail.trail_type === 'serie' ? (
                        <Badge className="bg-purple-600/90 backdrop-blur-md text-white border-none shadow-lg px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5">
                          <ListVideo className="h-3 w-3" /> SÉRIE
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-500/90 backdrop-blur-md text-white border-none shadow-lg px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5">
                          <Film className="h-3 w-3" /> AULA
                        </Badge>
                      )}
                    </div>

                    <button
                      onClick={() => handlePinTrail(trail.id)}
                      disabled={pinningId === trail.id}
                      aria-label={isPinned ? "Remover da Home" : "Fixar na Home"}
                      className={`absolute top-5 right-5 h-10 w-10 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-90 ${isPinned
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-primary'
                        }`}
                    >
                      {pinningId === trail.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : isPinned ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Pin className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  <CardContent className="p-8 flex-1 flex flex-col">
                    <div className="space-y-3 flex-1">
                      <h3 className="text-2xl font-black text-primary italic leading-tight group-hover:text-accent transition-colors">
                        {trail.title}
                      </h3>
                      <p className="text-sm text-muted-foreground font-medium italic line-clamp-3 opacity-80 leading-relaxed">
                        {trail.description || "Inicie agora esta jornada técnica projetada para fortalecer sua base acadêmica e acelerar sua aprovação."}
                      </p>
                    </div>

                    <div className="mt-8 space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-black text-primary/40 uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-accent" />
                          {percentage}% Evoluído
                        </span>
                        <span>{percentage === 100 ? 'Finalizada' : percentage > 0 ? 'Em andamento' : 'Não iniciada'}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden shadow-inner border border-black/5">
                        <div
                          className="h-full bg-accent transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                          style={{ width: `${percentage}%` }}
                          role="progressbar"
                          aria-valuenow={percentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    </div>
                  </CardContent>

                  <div className="px-8 pb-8 pt-0 mt-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full pt-6 border-t border-muted/10 gap-4 sm:gap-0">
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        {/* Avatar baseado em inicial — sem dependência de URL externa */}
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-sm">
                          <span className="text-white font-black text-sm">{teacherInitial}</span>
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-[10px] font-black text-primary italic leading-none truncate">{trail.teacher_name || "Mentor da Rede"}</span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase mt-1">Especialista</span>
                        </div>
                      </div>
                      <Button asChild className="btn-shimmer w-full sm:w-auto bg-primary text-white font-black text-[10px] uppercase h-12 px-6 sm:px-8 rounded-2xl shadow-xl active:scale-95 transition-[transform,box-shadow] [touch-action:manipulation] group/btn border-none shrink-0">
                        <Link href={`/dashboard/classroom/${trail.id}`}>
                          Entrar <ChevronRight className="h-4 w-4 ml-2 text-accent group-hover/btn:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
