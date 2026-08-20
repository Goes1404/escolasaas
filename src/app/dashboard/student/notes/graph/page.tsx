"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ZoomIn, ZoomOut, Maximize2, ArrowLeft,
  Search, Network, Link2, Unlink, BookOpen, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Note {
  id: string;
  title: string;
  blocks: { type: string; content: string }[];
  subject_id: string | null;
  is_pinned: boolean;
  updated_at: string;
}

interface Subject { id: string; name: string; }

// ── Force-directed layout ─────────────────────────────────────────────────────
// Pure JS spring simulation — no external library needed.

function computeLayout(
  nodeIds: string[],
  edges: { source: string; target: string }[],
  W: number,
  H: number,
): Record<string, { x: number; y: number }> {
  if (nodeIds.length === 0) return {};
  const cx = W / 2, cy = H / 2;

  const pos: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
  nodeIds.forEach((id, i) => {
    const angle = (i / nodeIds.length) * Math.PI * 2;
    const r = Math.min(W, H) * 0.32;
    pos[id] = {
      x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 40,
      y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 40,
      vx: 0, vy: 0,
    };
  });

  const REPULSION   = 5000;
  const SPRING_K    = 0.05;
  const REST_LEN    = 130;
  const DAMPING     = 0.78;
  const GRAVITY     = 0.006;
  const ITERATIONS  = 280;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cool = Math.pow(1 - iter / ITERATIONS, 1.8);

    // Repulsion
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = pos[nodeIds[i]], b = pos[nodeIds[j]];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const f = (REPULSION / (dist * dist)) * cool;
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }

    // Spring attraction
    edges.forEach(({ source, target }) => {
      const a = pos[source], b = pos[target];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const f = (dist - REST_LEN) * SPRING_K;
      const fx = (dx / dist) * f, fy = (dy / dist) * f;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    });

    // Gravity
    nodeIds.forEach(id => {
      const p = pos[id];
      p.vx += (cx - p.x) * GRAVITY;
      p.vy += (cy - p.y) * GRAVITY;
    });

    // Integrate
    nodeIds.forEach(id => {
      const p = pos[id];
      p.vx *= DAMPING; p.vy *= DAMPING;
      p.x = Math.max(60, Math.min(W - 60, p.x + p.vx));
      p.y = Math.max(60, Math.min(H - 60, p.y + p.vy));
    });
  }

  const out: Record<string, { x: number; y: number }> = {};
  Object.entries(pos).forEach(([id, p]) => { out[id] = { x: p.x, y: p.y }; });
  return out;
}

// ── Color palette (matches notes page) ───────────────────────────────────────

const SUBJECT_HEX: Record<string, string> = {
  "Matemática":           "#3b82f6",
  "Português":            "#8b5cf6",
  "Língua Portuguesa":    "#8b5cf6",
  "Linguagens":           "#7c3aed",
  "História":             "#f59e0b",
  "Ciências Humanas":     "#d97706",
  "Geografia":            "#10b981",
  "Biologia":             "#22c55e",
  "Ciências da Natureza": "#14b8a6",
  "Física":               "#06b6d4",
  "Química":              "#f43f5e",
  "Redação":              "#ec4899",
};
const DEFAULT_COLOR = "#6366f1";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotesGraphPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [notes, setNotes] = useState<Note[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Load data
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("notes").select("*").eq("user_id", user.id),
      supabase.from("subjects").select("id, name"),
    ]).then(([nr, sr]) => {
      if (nr.data) setNotes(nr.data as Note[]);
      if (sr.data) setSubjects(sr.data);
    }).finally(() => setLoading(false));
  }, [user]);

  // Parse wikilinks → undirected edges (deduplicated)
  const edges = useMemo(() => {
    const result: { source: string; target: string }[] = [];
    const seen = new Set<string>();
    notes.forEach(note => {
      const text = note.blocks.map(b => b.content ?? "").join(" ");
      for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
        const t = notes.find(n => n.title.toLowerCase() === m[1].trim().toLowerCase());
        if (t && t.id !== note.id) {
          const key = [note.id, t.id].sort().join("~~");
          if (!seen.has(key)) { seen.add(key); result.push({ source: note.id, target: t.id }); }
        }
      }
    });
    return result;
  }, [notes]);

  // Degree (connections per node)
  const degree = useMemo(() => {
    const d: Record<string, number> = {};
    edges.forEach(({ source, target }) => {
      d[source] = (d[source] ?? 0) + 1;
      d[target] = (d[target] ?? 0) + 1;
    });
    return d;
  }, [edges]);

  // Run layout after load
  useEffect(() => {
    if (notes.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const { width: W, height: H } = el.getBoundingClientRect();
      setPositions(computeLayout(notes.map(n => n.id), edges, W || 900, H || 650));
    });
  }, [notes, edges]);

  const nodeColor = useCallback((note: Note) => {
    const s = subjects.find(s => s.id === note.subject_id);
    return s ? (SUBJECT_HEX[s.name] ?? DEFAULT_COLOR) : DEFAULT_COLOR;
  }, [subjects]);

  const nodeR = (id: string) => Math.max(9, Math.min(24, 9 + (degree[id] ?? 0) * 3));

  const highlightId = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return notes.find(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))?.id ?? null;
  }, [searchQuery, notes]);

  // Pan/Zoom — mouse
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform(t => ({ ...t, scale: Math.max(0.25, Math.min(4, t.scale * (e.deltaY > 0 ? 0.9 : 1.1))) }));
  }, []);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest("circle, text")) return;
    setDragging(true);
    setDragOrigin({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  }, [transform]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setTransform(t => ({ ...t, x: e.clientX - dragOrigin.x, y: e.clientY - dragOrigin.y }));
  }, [dragging, dragOrigin]);
  const onMouseUp = useCallback(() => setDragging(false), []);

  // Pan/Zoom — touch
  const lastTouchRef = useRef<{ x: number; y: number; dist: number | null }>({ x: 0, y: 0, dist: null });
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      lastTouchRef.current = { x: t.clientX - transform.x, y: t.clientY - transform.y, dist: null };
      setDragging(true);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchRef.current = { ...lastTouchRef.current, dist: Math.hypot(dx, dy) };
      setDragging(false);
    }
  }, [transform]);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragging) {
      const t = e.touches[0];
      setTransform(prev => ({ ...prev, x: t.clientX - lastTouchRef.current.x, y: t.clientY - lastTouchRef.current.y }));
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastTouchRef.current.dist !== null) {
        const ratio = dist / lastTouchRef.current.dist;
        setTransform(prev => ({ ...prev, scale: Math.max(0.25, Math.min(4, prev.scale * ratio)) }));
      }
      lastTouchRef.current.dist = dist;
    }
  }, [dragging]);
  const onTouchEnd = useCallback(() => {
    setDragging(false);
    lastTouchRef.current.dist = null;
  }, []);

  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });
  const zoomIn    = () => setTransform(t => ({ ...t, scale: Math.min(4, t.scale * 1.25) }));
  const zoomOut   = () => setTransform(t => ({ ...t, scale: Math.max(0.25, t.scale / 1.25) }));

  const hovNote   = hoveredId ? notes.find(n => n.id === hoveredId) : null;
  const hovSubj   = hovNote ? subjects.find(s => s.id === hovNote.subject_id) : null;
  const isolated  = notes.filter(n => !degree[n.id]).length;
  const topNote   = [...notes].sort((a, b) => (degree[b.id] ?? 0) - (degree[a.id] ?? 0))[0];

  const usedSubjects = subjects.filter(s => notes.some(n => n.subject_id === s.id));

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[calc(100dvh-4rem)] bg-slate-950 gap-5">
      <div className="relative">
        <div className="h-16 w-16 rounded-[1.5rem] bg-primary/20 flex items-center justify-center">
          <Network className="h-8 w-8 text-primary" />
        </div>
        <div className="absolute -inset-2 rounded-[2rem] border-2 border-primary/20 animate-ping" />
      </div>
      <p className="text-sm font-black italic text-primary/60 uppercase tracking-widest animate-pulse">
        Construindo grafo...
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] -mx-4 md:-mx-8 overflow-hidden bg-slate-950">

      {/* ── Top bar ── */}
      <header className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-2.5 bg-slate-900/90 border-b border-slate-800/60 backdrop-blur-sm shrink-0 z-20">
        <Button asChild variant="ghost" size="sm"
          className="text-slate-400 hover:text-white hover:bg-slate-800/70 rounded-xl gap-1.5 font-bold h-9 px-2 md:px-3 shrink-0">
          <Link href="/dashboard/student/notes">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Caderno</span>
          </Link>
        </Button>

        <div className="h-4 w-px bg-slate-700 hidden sm:block" />

        <div className="flex items-center gap-2 shrink-0">
          <Network className="h-4 w-4 text-primary" />
          <h1 className="text-xs md:text-sm font-black italic text-white uppercase tracking-tight hidden sm:block">
            Grafo do Conhecimento
          </h1>
        </div>

        {/* Stats pills */}
        <div className="hidden md:flex items-center gap-2 ml-3">
          {[
            { dot: "bg-primary", label: `${notes.length} notas` },
            { dot: "bg-accent",  label: `${edges.length} conexões` },
            ...(isolated > 0 ? [{ dot: "bg-slate-600", label: `${isolated} isoladas` }] : []),
          ].map((s, i) => (
            <span key={i} className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-full">
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">{s.label}</span>
            </span>
          ))}
        </div>

        {/* Search — full-width on mobile */}
        <div className="ml-auto relative flex-1 md:flex-none md:w-44 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar nota..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 h-9 bg-slate-800 border border-slate-700 rounded-xl text-[13px] text-white placeholder-slate-600 outline-none focus:border-primary transition-colors font-medium"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Zoom — bigger tap targets on mobile */}
        <div className="flex items-center gap-0.5 bg-slate-800/60 border border-slate-700/50 rounded-xl p-0.5 shrink-0">
          <button onClick={zoomOut} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition-colors">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-black text-slate-500 w-9 text-center hidden sm:block">{Math.round(transform.scale * 100)}%</span>
          <button onClick={zoomIn} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition-colors">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button onClick={resetView} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition-colors">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ── Graph canvas ── */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Dot-grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        {/* Empty state */}
        {notes.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-8">
            <Network className="h-16 w-16 text-slate-700" />
            <div className="space-y-2">
              <p className="text-white font-black italic text-xl">Nenhuma nota ainda</p>
              <p className="text-slate-500 font-medium text-sm max-w-xs">
                Crie notas no caderno e use <code className="bg-slate-800 px-1.5 py-0.5 rounded text-primary font-mono text-xs">[[nome da nota]]</code> para criar conexões.
              </p>
            </div>
            <Button asChild className="rounded-2xl bg-primary border-none font-black gap-2 shadow-xl shadow-primary/30">
              <Link href="/dashboard/student/notes">
                <BookOpen className="h-4 w-4" /> Abrir Caderno
              </Link>
            </Button>
          </div>
        )}

        {/* SVG Graph */}
        {notes.length > 0 && Object.keys(positions).length > 0 && (
          <svg className="w-full h-full">
            <defs>
              {/* Glow filter */}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-strong" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>

              {/* ── Edges ── */}
              {edges.map(({ source, target }, i) => {
                const a = positions[source], b = positions[target];
                if (!a || !b) return null;
                const active = hoveredId === source || hoveredId === target;
                const srcColor = nodeColor(notes.find(n => n.id === source)!);
                return (
                  <line key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={active ? srcColor : "#334155"}
                    strokeWidth={active ? 2 : 1}
                    strokeOpacity={active ? 0.7 : 0.35}
                    style={{ transition: "stroke 0.15s, stroke-opacity 0.15s" }}
                  />
                );
              })}

              {/* ── Nodes ── */}
              {notes.map(note => {
                const pos = positions[note.id];
                if (!pos) return null;
                const r = nodeR(note.id);
                const color = nodeColor(note);
                const isHov = hoveredId === note.id;
                const isHigh = highlightId === note.id;
                const isAdj = hoveredId && edges.some(e =>
                  (e.source === hoveredId && e.target === note.id) ||
                  (e.target === hoveredId && e.source === note.id)
                );
                const dimmed = hoveredId && !isHov && !isAdj;

                return (
                  <g
                    key={note.id}
                    transform={`translate(${pos.x},${pos.y})`}
                    style={{ opacity: dimmed ? 0.2 : 1, transition: "opacity 0.2s", cursor: "pointer" }}
                    onMouseEnter={() => setHoveredId(note.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => router.push(`/dashboard/student/notes?open=${note.id}`)}
                  >
                    {/* Aura */}
                    {(isHov || isHigh) && (
                      <circle r={r + 14} fill={color} opacity={0.12}
                        filter="url(#glow-strong)" />
                    )}
                    {/* Halo */}
                    <circle r={r + 4} fill={color} opacity={0.1} />
                    {/* Body */}
                    <circle
                      r={r}
                      fill={color}
                      stroke={isHov || isHigh ? "#ffffff" : "transparent"}
                      strokeWidth={isHov || isHigh ? 2.5 : 0}
                      filter={isHov ? "url(#glow)" : undefined}
                    />
                    {/* Initial letter */}
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      fill="white"
                      fontSize={Math.max(8, r * 0.75)}
                      fontWeight="900"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {note.title.charAt(0).toUpperCase()}
                    </text>
                    {/* Pinned dot */}
                    {note.is_pinned && (
                      <circle r={3.5} cx={r - 1} cy={-r + 1} fill="#fbbf24"
                        stroke="#1e293b" strokeWidth={1.5} />
                    )}
                    {/* Label */}
                    <text
                      y={r + 16}
                      textAnchor="middle"
                      fill={isHov || isHigh ? "#f1f5f9" : "#64748b"}
                      fontSize={isHov ? 12 : 10}
                      fontWeight={isHov ? "900" : "600"}
                      style={{ pointerEvents: "none", userSelect: "none", transition: "fill 0.15s, font-size 0.15s" }}
                    >
                      {note.title.length > 22 ? note.title.slice(0, 20) + "…" : note.title}
                    </text>
                    {/* Connection count badge */}
                    {isHov && (degree[note.id] ?? 0) > 0 && (
                      <text
                        y={r + 30}
                        textAnchor="middle"
                        fill="#6366f1"
                        fontSize={9}
                        fontWeight="900"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {degree[note.id]} link{degree[note.id] !== 1 ? "s" : ""}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* Calculating state */}
        {notes.length > 0 && Object.keys(positions).length === 0 && (
          <div className="flex items-center justify-center h-full gap-3 text-slate-600">
            <Network className="h-5 w-5 animate-pulse" />
            <span className="text-sm font-bold">Calculando layout...</span>
          </div>
        )}

        {/* ── Hover tooltip ── */}
        {hovNote && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none z-30
            bg-slate-800/95 backdrop-blur-md border border-slate-700/60 rounded-2xl px-5 py-3.5
            shadow-2xl flex items-center gap-4 animate-in fade-in zoom-in-95 duration-100">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center font-black text-lg text-white shrink-0"
              style={{ background: nodeColor(hovNote) }}
            >
              {hovNote.title.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-black italic text-white text-base leading-tight truncate max-w-[200px]">{hovNote.title}</p>
              <div className="flex items-center gap-3 mt-1">
                {hovSubj && <span className="text-[10px] font-black uppercase text-slate-400">{hovSubj.name}</span>}
                <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> {degree[hovNote.id] ?? 0} conexões
                </span>
              </div>
            </div>
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest shrink-0">clique para abrir →</span>
          </div>
        )}

        {/* ── Legend ── */}
        {usedSubjects.length > 0 && (
          <div className="absolute bottom-6 right-5 z-20
            bg-slate-900/80 backdrop-blur-sm border border-slate-800/60 rounded-2xl p-4 space-y-2.5
            max-h-64 overflow-y-auto">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Matérias</p>
            {usedSubjects.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: SUBJECT_HEX[s.name] ?? DEFAULT_COLOR }} />
                <span className="text-[11px] font-bold text-slate-400">{s.name}</span>
              </div>
            ))}
            <div className="border-t border-slate-800 pt-2 mt-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-slate-700 shrink-0" />
                <span className="text-[10px] font-bold text-slate-600">Nó pequeno = poucas conexões</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 rounded-full bg-slate-500 shrink-0" />
                <span className="text-[10px] font-bold text-slate-600">Nó grande = hub central</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Most connected note badge ── */}
        {topNote && (degree[topNote.id] ?? 0) > 0 && (
          <div className="absolute top-4 left-5 z-20
            bg-slate-900/80 backdrop-blur-sm border border-slate-800/60 rounded-2xl px-4 py-2.5
            flex items-center gap-3">
            <div className="h-7 w-7 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0"
              style={{ background: nodeColor(topNote) }}>
              {topNote.title.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Hub Principal</p>
              <p className="text-xs font-black italic text-white leading-tight truncate max-w-[120px]">{topNote.title}</p>
            </div>
            <span className="text-[9px] font-black text-primary">{degree[topNote.id]}×</span>
          </div>
        )}
      </div>
    </div>
  );
}
