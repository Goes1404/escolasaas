"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ZoomIn, ZoomOut, Maximize2, ArrowLeft,
  Search, Network, Link2, BookOpen, X, Loader2,
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

  const REPULSION   = 20000;
  // Distância mínima entre nós: o rótulo tem ~120px. Sem ela, notas sem
  // conexão acabavam empilhadas no centro, um rótulo por cima do outro.
  const MIN_DIST    = 140;
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

    // Gravity — esfria junto com a repulsão; constante, ela vencia no fim
    // da simulação e puxava tudo para o mesmo ponto.
    nodeIds.forEach(id => {
      const p = pos[id];
      p.vx += (cx - p.x) * GRAVITY * cool;
      p.vy += (cy - p.y) * GRAVITY * cool;
    });

    // Integrate
    nodeIds.forEach(id => {
      const p = pos[id];
      p.vx *= DAMPING; p.vy *= DAMPING;
      p.x = Math.max(60, Math.min(W - 60, p.x + p.vx));
      p.y = Math.max(60, Math.min(H - 60, p.y + p.vy));
    });

    // Colisão: separa direto quem ficou perto demais.
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = pos[nodeIds[i]], b = pos[nodeIds[j]];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        if (dist >= MIN_DIST) continue;
        const push = (MIN_DIST - dist) / 2;
        const ux = dist > 0.1 ? dx / dist : Math.cos(i), uy = dist > 0.1 ? dy / dist : Math.sin(i);
        a.x = Math.max(60, Math.min(W - 60, a.x + ux * push));
        a.y = Math.max(60, Math.min(H - 60, a.y + uy * push));
        b.x = Math.max(60, Math.min(W - 60, b.x - ux * push));
        b.y = Math.max(60, Math.min(H - 60, b.y - uy * push));
      }
    }
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

  // Altura da tela = viewport menos o cabeçalho do app (4rem) e o padding do
  // <main> do dashboard (que muda por breakpoint). O canvas pega o que sobrar.
  const screenH = "h-[calc(100dvh-10rem)] md:h-[calc(100dvh-11rem)] lg:h-[calc(100dvh-8rem)] min-h-[480px]";

  if (loading) return (
    <div className={`flex flex-col items-center justify-center gap-3 ${screenH}`}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="u-label">Construindo grafo…</p>
    </div>
  );

  // Cores do SVG via variável do tema (em `style`, porque atributo de
  // apresentação não resolve var()). É o que deixa o rótulo legível no claro.
  const FG    = "hsl(var(--foreground))";
  const MUTED = "hsl(var(--muted-foreground))";
  const CARD  = "hsl(var(--card))";

  return (
    <div className={`flex flex-col gap-4 ${screenH}`}>

      {/* ── Cabeçalho (nível médio) + barra de controles ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between shrink-0">
        <div className="min-w-0">
          <p className="u-label flex items-center gap-2"><Network className="h-3.5 w-3.5" /> Caderno · grafo</p>
          <h1 className="u-page-title text-2xl md:text-3xl mt-1">Grafo do conhecimento</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {notes.length} nota{notes.length !== 1 ? "s" : ""} · {edges.length} conex{edges.length !== 1 ? "ões" : "ão"}
            {isolated > 0 && ` · ${isolated} isolada${isolated !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <Button asChild variant="outline" className="shrink-0 hover:bg-muted hover:text-foreground">
            <Link href="/dashboard/student/notes">
              <ArrowLeft /> <span className="hidden sm:inline">Caderno</span>
            </Link>
          </Button>

          <div className="relative flex-1 lg:flex-none lg:w-56 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar nota…"
              aria-label="Buscar nota no grafo"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-8 rounded-control border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center rounded-control border border-input bg-card shrink-0">
            <button type="button" onClick={zoomOut} title="Afastar" aria-label="Afastar"
              className="h-10 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="u-label !tracking-normal w-11 text-center hidden sm:block tabular-nums">{Math.round(transform.scale * 100)}%</span>
            <button type="button" onClick={zoomIn} title="Aproximar" aria-label="Aproximar"
              className="h-10 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-border" />
            <button type="button" onClick={resetView} title="Centralizar" aria-label="Centralizar"
              className="h-10 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Canvas: superfície do sistema, ocupa o resto da altura ── */}
      <div
        ref={containerRef}
        className={`relative flex-1 min-h-0 u-surface overflow-hidden select-none touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Grade de pontos: referência de pan/zoom, derivada do tema */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, hsl(var(--foreground) / 0.08) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Empty state */}
        {notes.length === 0 && (
          <div className="relative flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <Network className="h-12 w-12 text-muted-foreground/60" />
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground">Nenhuma nota ainda</p>
              <p className="text-muted-foreground text-sm max-w-xs">
                Crie notas no caderno e use <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs text-foreground">[[nome da nota]]</code> para criar conexões.
              </p>
            </div>
            <Button asChild variant="arcade">
              <Link href="/dashboard/student/notes">
                <BookOpen /> Abrir caderno
              </Link>
            </Button>
          </div>
        )}

        {/* SVG Graph */}
        {notes.length > 0 && Object.keys(positions).length > 0 && (
          <svg className="relative w-full h-full">
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
                    style={{
                      stroke: active ? srcColor : MUTED,
                      strokeWidth: active ? 2 : 1,
                      strokeOpacity: active ? 0.85 : 0.35,
                      transition: "stroke 0.15s, stroke-opacity 0.15s",
                    }}
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
                const marked = isHov || isHigh;

                return (
                  <g
                    key={note.id}
                    transform={`translate(${pos.x},${pos.y})`}
                    style={{ opacity: dimmed ? 0.2 : 1, transition: "opacity 0.2s", cursor: "pointer" }}
                    onMouseEnter={() => setHoveredId(note.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => router.push(`/dashboard/student/notes?open=${note.id}`)}
                  >
                    {/* Halo */}
                    <circle r={r + 4} fill={color} opacity={marked ? 0.22 : 0.12} />
                    {/* Body — anel na cor do texto marca hover/busca sem glow */}
                    <circle
                      r={r}
                      fill={color}
                      style={{ stroke: marked ? FG : "transparent", strokeWidth: marked ? 2.5 : 0 }}
                    />
                    {/* Initial letter */}
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      fill="white"
                      fontSize={Math.max(8, r * 0.75)}
                      fontWeight="700"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {note.title.charAt(0).toUpperCase()}
                    </text>
                    {/* Pinned dot */}
                    {note.is_pinned && (
                      <circle r={3.5} cx={r - 1} cy={-r + 1}
                        style={{ fill: "hsl(var(--brand-yellow))", stroke: FG, strokeWidth: 1.2 }} />
                    )}
                    {/* Label — contorno na cor da superfície para ler por cima das arestas */}
                    <text
                      y={r + 16}
                      textAnchor="middle"
                      fontSize={marked ? 12 : 11}
                      fontWeight={marked ? 700 : 500}
                      style={{
                        fill: marked ? FG : MUTED,
                        stroke: CARD, strokeWidth: 3, paintOrder: "stroke", strokeLinejoin: "round",
                        pointerEvents: "none", userSelect: "none",
                      }}
                    >
                      {note.title.length > 22 ? note.title.slice(0, 20) + "…" : note.title}
                    </text>
                    {/* Connection count badge */}
                    {isHov && (degree[note.id] ?? 0) > 0 && (
                      <text
                        y={r + 30}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        style={{ fill: MUTED, stroke: CARD, strokeWidth: 3, paintOrder: "stroke", pointerEvents: "none", userSelect: "none" }}
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
          <div className="relative flex items-center justify-center h-full gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Calculando layout…</span>
          </div>
        )}

        {/* ── Hub principal (canto superior esquerdo) ── */}
        {topNote && (degree[topNote.id] ?? 0) > 0 && (
          <div className="absolute top-3 left-3 z-20 bg-card/95 border border-border rounded-control px-3 py-2 flex items-center gap-2.5 pointer-events-none">
            <div className="h-7 w-7 rounded-control flex items-center justify-center font-bold text-sm text-white shrink-0"
              style={{ background: nodeColor(topNote) }}>
              {topNote.title.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="u-label">Nota mais conectada</p>
              <p className="text-sm font-semibold text-foreground leading-tight truncate max-w-[10rem]">{topNote.title}</p>
            </div>
            <span className="u-num text-sm text-foreground">{degree[topNote.id]}</span>
          </div>
        )}

        {/* ── Legenda compacta (canto superior direito) ── */}
        {usedSubjects.length > 0 && (
          <div className="hidden sm:block absolute top-3 right-3 z-20 w-48 bg-card/95 border border-border rounded-control p-3 max-h-[45%] overflow-y-auto">
            <p className="u-label mb-2">Matérias</p>
            <div className="space-y-1.5">
              {usedSubjects.map(s => (
                <div key={s.id} className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: SUBJECT_HEX[s.name] ?? DEFAULT_COLOR }} />
                  <span className="text-xs text-foreground/80 truncate">{s.name}</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 pt-2 border-t border-border text-[11px] leading-snug text-muted-foreground">
              Quanto maior o nó, mais conexões a nota tem.
            </p>
          </div>
        )}

        {/* ── Hover tooltip ── */}
        {hovNote && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-30
            bg-card border border-border rounded-control shadow-xl px-4 py-3 flex items-center gap-3 max-w-[calc(100%-2rem)]">
            <div
              className="h-9 w-9 rounded-control flex items-center justify-center font-bold text-white shrink-0"
              style={{ background: nodeColor(hovNote) }}
            >
              {hovNote.title.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground leading-tight truncate max-w-[16rem]">{hovNote.title}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {hovSubj && <span>{hovSubj.name}</span>}
                <span className="flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> {degree[hovNote.id] ?? 0} conex{(degree[hovNote.id] ?? 0) !== 1 ? "ões" : "ão"}
                </span>
              </div>
            </div>
            <span className="u-label shrink-0 hidden sm:block">Clique para abrir</span>
          </div>
        )}
      </div>
    </div>
  );
}
