"use client";

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { Input } from "@/components/ui/input";
import {
  Search,
  BookOpen,
  BookMarked,
  FileText,
  Sparkles,
  X,
  LayoutGrid,
  List,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Link from "next/link";

// ─── constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ["Todos", "Didáticos", "Literatura", "Técnicos", "Guias"];
const TYPES = ["Todos", "PDF", "E-book", "Interativo"];

const COVER_GRADIENTS = [
  "from-violet-600 to-indigo-700",
  "from-rose-500 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-cyan-500 to-blue-700",
  "from-fuchsia-600 to-purple-800",
  "from-lime-500 to-green-700",
  "from-red-500 to-rose-700",
];

function coverGradient(id: string) {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
}

const TYPE_BADGE: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  PDF:        { bg: "bg-rose-100",   text: "text-rose-700",   icon: FileText  },
  "E-book":   { bg: "bg-blue-100",   text: "text-blue-700",   icon: BookOpen  },
  Interativo: { bg: "bg-violet-100", text: "text-violet-700", icon: Sparkles  },
};
function typeMeta(type: string) {
  return TYPE_BADGE[type] ?? { bg: "bg-slate-100", text: "text-slate-700", icon: BookMarked };
}

// ─── skeletons ────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-[2rem] bg-white border border-slate-100 overflow-hidden animate-pulse flex flex-col">
      <div className="aspect-[3/4] bg-slate-100" />
      <div className="p-5 space-y-3 flex-1">
        <div className="h-3 w-16 bg-slate-100 rounded-full" />
        <div className="h-4 w-4/5 bg-slate-100 rounded-full" />
        <div className="h-3 w-full  bg-slate-100 rounded-full" />
        <div className="h-3 w-2/3  bg-slate-100 rounded-full" />
      </div>
      <div className="px-5 pb-5">
        <div className="h-10 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4 flex gap-4 items-center animate-pulse">
      <div className="w-14 h-[4.5rem] rounded-xl bg-slate-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-16 bg-slate-100 rounded-full" />
        <div className="h-4 w-2/3 bg-slate-100 rounded-full" />
        <div className="h-3 w-full bg-slate-100 rounded-full" />
      </div>
      <div className="w-9 h-9 bg-slate-100 rounded-xl shrink-0" />
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function BooksPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm]         = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [activeType, setActiveType]         = useState("Todos");
  const [resources, setResources]           = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [viewMode, setViewMode]             = useState<"grid" | "list">("grid");

  const loadResources = useCallback(async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("library_resources")
        .select("*")
        .ilike("category", "LIVRO|%")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setResources(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar livros", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, profile, toast]);

  useEffect(() => {
    if (user && profile) loadResources();
  }, [user, profile, loadResources]);

  const deferredSearch = useDeferredValue(searchTerm);
  const filtered = useMemo(() =>
    resources.filter(r => {
      const cat   = r.category?.replace("LIVRO|", "") || "";
      const title = (r.title || "").toLowerCase();
      return (
        title.includes(deferredSearch.toLowerCase()) &&
        (activeCategory === "Todos" || cat === activeCategory) &&
        (activeType === "Todos" || r.type === activeType)
      );
    }),
    [resources, deferredSearch, activeCategory, activeType]
  );

  const hasFilters = activeCategory !== "Todos" || activeType !== "Todos" || searchTerm !== "";
  function clearFilters() {
    setActiveCategory("Todos");
    setActiveType("Todos");
    setSearchTerm("");
  }

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── HERO ── */}
      <div className="aurora-dark rounded-[2.5rem] p-7 md:p-10 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <BookMarked className="h-5 w-5 text-accent" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Acervo Digital</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black italic text-white leading-none tracking-tight">
              Biblioteca de Livros
            </h1>
            <p className="text-white/60 font-medium text-sm leading-relaxed max-w-sm">
              Obras didáticas, literatura e guias curados para o seu ENEM e ETEC.
            </p>
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 shrink-0">
            {[
              { label: "Obras",       value: resources.length, icon: BookOpen  },
              { label: "Disponíveis", value: filtered.length,  icon: Sparkles  },
            ].map(s => (
              <div key={s.label} className="gradient-border flex items-center gap-2.5 bg-white/8 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3 shrink-0 min-w-[110px]">
                <s.icon className="h-4 w-4 text-accent shrink-0" />
                <div>
                  <p className="text-white font-black text-lg leading-none">{loading ? "–" : s.value}</p>
                  <p className="text-white/50 text-[9px] font-black uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STICKY FILTER BAR ── */}
      <div className="relative md:sticky md:top-2 z-20 space-y-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-2 bg-white/80 backdrop-blur-xl rounded-2xl p-3 shadow-xl border border-slate-100">
          {/* search */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-accent" />
            <Input
              placeholder="Buscar obra..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 h-10 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-accent focus-visible:ring-2 text-sm font-medium"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* type pills */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {TYPES.map(t => (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                aria-pressed={activeType === t}
                className={`shrink-0 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wide transition-all duration-200
                  ${activeType === t
                    ? "bg-primary text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* view toggle + clear */}
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => setViewMode(v => v === "grid" ? "list" : "grid")}
              className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all"
              aria-label="Alternar visualização"
            >
              {viewMode === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </button>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="h-10 px-3 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide transition-all"
              >
                <X className="h-3.5 w-3.5" /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* category pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5 px-0.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className={`shrink-0 h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200
                ${activeCategory === cat
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-primary/30 hover:text-primary"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* results count */}
      {!loading && (
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">
          {filtered.length} {filtered.length === 1 ? "obra encontrada" : "obras encontradas"}
          {hasFilters && " com filtros ativos"}
        </p>
      )}

      {/* ── CONTENT ── */}
      {loading ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white/60 animate-in zoom-in-95 duration-500">
          <BookOpen className="h-14 w-14 text-slate-200 mx-auto mb-4" />
          <p className="font-black italic text-xl text-slate-400">Nenhuma obra encontrada</p>
          <p className="text-sm text-slate-400 mt-1 mb-5">Tente ajustar os filtros ou a busca.</p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs font-black uppercase tracking-wider text-accent hover:underline">
              Limpar filtros
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map(item => <BookCard key={item.id} item={item} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => <BookRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

// ─── BookCard ─────────────────────────────────────────────────────────────────
function BookCard({ item }: { item: any }) {
  const cat      = item.category?.replace("LIVRO|", "") || "";
  const meta     = typeMeta(item.type);
  const Icon     = meta.icon;
  const grad     = coverGradient(item.id);
  const hasImage = !!item.image_url;

  return (
    <Link
      href={`/dashboard/library/book/${item.id}`}
      className="group flex flex-col rounded-[2rem] bg-white border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <div className={`aspect-[3/4] relative overflow-hidden shrink-0 bg-gradient-to-br ${grad}`}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.title || "Capa"}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 gap-2">
            <BookOpen className="h-10 w-10 text-white/60" />
            <p className="text-white/80 font-black italic text-center text-xs leading-tight line-clamp-4">{item.title}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
        <div className="absolute top-2.5 left-2.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide ${meta.bg} ${meta.text}`}>
            <Icon className="h-2.5 w-2.5" /> {item.type || "Livro"}
          </span>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-1">
        {cat && <span className="text-[9px] font-black uppercase tracking-widest text-accent">{cat}</span>}
        <p className="text-sm font-black text-slate-800 italic leading-snug line-clamp-2">{item.title}</p>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 flex-1 mt-0.5">
          {item.description || "Obra selecionada para ampliar seu repertório."}
        </p>
      </div>

      <div className="px-4 pb-4">
        <div className="h-9 bg-primary rounded-xl flex items-center justify-center gap-1.5 text-white text-[10px] font-black uppercase tracking-wide group-hover:bg-primary/90 transition-colors">
          <BookOpen className="h-3.5 w-3.5" /> Ler Agora
        </div>
      </div>
    </Link>
  );
}

// ─── BookRow ──────────────────────────────────────────────────────────────────
function BookRow({ item }: { item: any }) {
  const cat      = item.category?.replace("LIVRO|", "") || "";
  const meta     = typeMeta(item.type);
  const Icon     = meta.icon;
  const grad     = coverGradient(item.id);
  const hasImage = !!item.image_url;

  return (
    <Link
      href={`/dashboard/library/book/${item.id}`}
      className="group flex items-center gap-4 rounded-2xl bg-white border border-slate-100 p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <div className={`w-14 h-[4.5rem] rounded-xl shrink-0 relative overflow-hidden bg-gradient-to-br ${grad}`}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-white/50" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {cat && <span className="text-[9px] font-black uppercase tracking-widest text-accent">{cat}</span>}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide ${meta.bg} ${meta.text}`}>
            <Icon className="h-2.5 w-2.5" /> {item.type || "Livro"}
          </span>
        </div>
        <p className="text-sm font-black text-slate-800 italic leading-snug truncate">{item.title}</p>
        <p className="text-xs text-slate-400 line-clamp-1">
          {item.description || "Obra selecionada para ampliar seu repertório."}
        </p>
      </div>

      <div className="shrink-0 h-9 w-9 rounded-xl bg-slate-50 group-hover:bg-primary flex items-center justify-center transition-all duration-200">
        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
      </div>
    </Link>
  );
}
