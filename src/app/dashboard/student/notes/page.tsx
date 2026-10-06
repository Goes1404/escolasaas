"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus, Search, Trash2, List, ListOrdered, CheckSquare,
  Minus, Type, Heading1, Heading2, Heading3, Quote,
  BookOpen, Loader2, Pin, PinOff, ChevronLeft,
  StickyNote, Circle, CheckCircle2, Link2, Network, ArrowRight, FileText, X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type BlockType = "text" | "h1" | "h2" | "h3" | "bullet" | "numbered" | "todo" | "quote" | "divider";

interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
}

interface Note {
  id: string;
  title: string;
  blocks: Block[];
  subject_id: string | null;
  tags: string[];
  is_pinned: boolean;
  updated_at: string;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// A cor da matéria é categórica (diz o que a nota é), então fica — mas só no
// ponto. Chip inteiro colorido em tela de horas vira decoração. Os tons batem
// com os nós do grafo (notes/graph), para a mesma matéria ter a mesma cor.
const SUBJECT_DOT: Record<string, string> = {
  "Matemática":            "bg-blue-500",
  "Português":             "bg-violet-500",
  "Língua Portuguesa":     "bg-violet-500",
  "Linguagens":            "bg-violet-600",
  "História":              "bg-amber-500",
  "Ciências Humanas":      "bg-amber-600",
  "Geografia":             "bg-emerald-500",
  "Biologia":              "bg-green-500",
  "Ciências da Natureza":  "bg-teal-500",
  "Física":                "bg-cyan-500",
  "Química":               "bg-rose-500",
  "Redação":               "bg-pink-500",
};
const subjectDot = (name: string) => SUBJECT_DOT[name] ?? "bg-muted-foreground";

// Trecho de leitura do card: primeiro bloco com texto, sem a marcação crua
// (`**`, `[[ ]]`) que no card não seria renderizada.
const snippetOf = (note: Note) => {
  const b = note.blocks.find(x => x.type !== "divider" && x.content.trim());
  return (b?.content ?? "").replace(/\[\[([^\]]*)\]\]/g, "$1").replace(/[*`]/g, "").trim();
};

const SLASH_ITEMS = [
  { type: "text"     as BlockType, Icon: Type,        label: "Texto",          desc: "Parágrafo simples" },
  { type: "h1"       as BlockType, Icon: Heading1,    label: "Título 1",       desc: "Grande e em destaque" },
  { type: "h2"       as BlockType, Icon: Heading2,    label: "Título 2",       desc: "Subtítulo" },
  { type: "h3"       as BlockType, Icon: Heading3,    label: "Título 3",       desc: "Seção menor" },
  { type: "bullet"   as BlockType, Icon: List,        label: "Lista",          desc: "Marcadores" },
  { type: "numbered" as BlockType, Icon: ListOrdered, label: "Lista Numerada", desc: "Itens numerados" },
  { type: "todo"     as BlockType, Icon: CheckSquare, label: "Tarefa",         desc: "Checkbox interativo" },
  { type: "quote"    as BlockType, Icon: Quote,       label: "Citação",        desc: "Bloco de destaque" },
  { type: "divider"  as BlockType, Icon: Minus,       label: "Divisor",        desc: "Linha separadora" },
];

const PLACEHOLDER: Record<BlockType, string> = {
  text: "Escreva algo… ou pressione '/' para comandos",
  h1: "Título principal", h2: "Subtítulo", h3: "Seção",
  bullet: "Item da lista", numbered: "Item da lista", todo: "Tarefa…",
  quote: "Citação ou ideia importante", divider: "",
};

const newBlock = (type: BlockType = "text"): Block => ({ id: crypto.randomUUID(), type, content: "", checked: false });

// ── Inline content renderer ───────────────────────────────────────────────────

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
        if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="bg-muted text-foreground px-1 py-0.5 rounded text-[0.85em] font-mono">{p.slice(1, -1)}</code>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function renderContent(content: string, notes: Note[], onWikiClick: (id: string) => void) {
  const segments = content.split(/(\[\[[^\]]*\]\])/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("[[") && seg.endsWith("]]")) {
      const title = seg.slice(2, -2);
      const target = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
      // Ciano como texto não passa contraste no branco: o acento vai no
      // fundo e no sublinhado, o texto fica na cor de leitura.
      return (
        <button
          key={i} type="button"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); if (target) onWikiClick(target.id); }}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-[0.9em] font-medium transition-colors ${
            target ? "bg-primary/15 text-foreground underline decoration-primary underline-offset-2 hover:bg-primary/25" : "bg-muted text-muted-foreground line-through"
          }`}
        >
          <Link2 className="h-3 w-3 shrink-0" />{title}
        </button>
      );
    }
    return <InlineText key={i} text={seg} />;
  });
}

// ── BlockRow ──────────────────────────────────────────────────────────────────

function BlockRow({
  block, blockNumber, isFocused, notes,
  onFocus, onBlur, onChange, onToggleCheck, onKeyDown, textareaRef, onWikiClick,
}: {
  block: Block; blockNumber: number; isFocused: boolean; notes: Note[];
  onFocus: () => void; onBlur: () => void;
  onChange: (c: string) => void; onToggleCheck: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
  onWikiClick: (id: string) => void;
}) {
  if (block.type === "divider") {
    return <div className="py-3 px-2 cursor-pointer" onClick={onFocus}><div className="h-px bg-border" /></div>;
  }

  const prefix = (
    <>
      {block.type === "bullet" && <span className="pt-[3px] shrink-0 text-muted-foreground font-bold text-base leading-none select-none">•</span>}
      {block.type === "numbered" && <span className="pt-[2px] shrink-0 text-muted-foreground text-sm w-5 text-right select-none">{blockNumber}.</span>}
      {block.type === "todo" && (
        <button type="button"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onToggleCheck(); }}
          className="pt-[3px] shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {block.checked ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}
        </button>
      )}
      {block.type === "quote" && <div className="self-stretch w-0.5 bg-primary rounded-full shrink-0 my-1" />}
    </>
  );

  // Mesma tipografia na leitura e na edição: o bloco não pode "pular" de
  // tamanho quando recebe foco.
  const typeClass: Record<BlockType, string> = {
    text:     "text-[15px] text-foreground/85 leading-relaxed",
    h1:       "text-[2rem] font-bold text-foreground tracking-tight leading-tight",
    h2:       "text-[1.4rem] font-bold text-foreground leading-tight",
    h3:       "text-[1.1rem] font-semibold text-foreground",
    bullet:   "text-[15px] text-foreground/85 leading-relaxed",
    numbered: "text-[15px] text-foreground/85 leading-relaxed",
    todo:     "text-[15px] text-foreground/85 leading-relaxed",
    quote:    "text-[15px] text-muted-foreground italic",
    divider:  "",
  };
  const checkedClass = block.type === "todo" && block.checked ? "line-through !text-muted-foreground" : "";

  const wrap = "group flex items-start gap-2 px-2 py-0.5 rounded-control transition-colors";

  if (!isFocused) {
    const empty = !block.content.trim();
    return (
      <div className={`${wrap} cursor-text hover:bg-muted/40`} onClick={onFocus}>
        {prefix}
        <div className={`flex-1 min-w-0 ${typeClass[block.type]} ${checkedClass}`}>
          {empty
            ? <span className="text-muted-foreground/50 select-none">{PLACEHOLDER[block.type]}</span>
            : renderContent(block.content, notes, onWikiClick)
          }
        </div>
      </div>
    );
  }

  return (
    <div className={`${wrap} bg-muted/50`}>
      {prefix}
      <textarea
        ref={textareaRef} rows={1} value={block.content}
        placeholder={PLACEHOLDER[block.type]} autoFocus
        onFocus={onFocus} onBlur={onBlur}
        onChange={e => { onChange(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
        onKeyDown={onKeyDown}
        className={`w-full flex-1 bg-transparent resize-none outline-none placeholder:text-muted-foreground/50 ${typeClass[block.type]} ${checkedClass}`}
        style={{ minHeight: "28px", overflow: "hidden" }}
      />
    </div>
  );
}

// ── Cards ─────────────────────────────────────────────────────────────────────

/** Card da grade. Altura fixa: título em até 2 linhas e trecho em até 3,
 *  para a grade não virar uma escada de alturas diferentes. */
function NoteGridCard({ note, subject, onClick }: { note: Note; subject?: { id: string; name: string }; onClick: () => void }) {
  const snippet = snippetOf(note);
  return (
    <button
      type="button" onClick={onClick}
      className="lift group u-surface flex flex-col w-full h-48 p-4 text-left transition-[transform,border-color] hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-2">
        <h3 className="flex-1 min-w-0 font-semibold text-[15px] leading-snug text-foreground line-clamp-2">
          {note.title || "Sem título"}
        </h3>
        {note.is_pinned && <Pin className="h-3.5 w-3.5 mt-0.5 shrink-0 fill-current text-foreground/70" aria-label="Fixada" />}
      </div>
      <p className="mt-2 flex-1 min-h-0 text-sm leading-relaxed text-muted-foreground line-clamp-3">
        {snippet || <span className="italic text-muted-foreground/60">Nota vazia</span>}
      </p>
      <div className="mt-3 flex items-center gap-2 min-w-0">
        {subject && (
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-control bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${subjectDot(subject.name)}`} />
            <span className="truncate">{subject.name}</span>
          </span>
        )}
        {note.tags?.slice(0, 2).map(t => (
          <span key={t} className="hidden sm:inline truncate max-w-[6rem] text-[11px] text-muted-foreground">#{t}</span>
        ))}
        <span className="u-label ml-auto shrink-0 !tracking-[0.18em]">
          {format(new Date(note.updated_at), "d MMM yy", { locale: ptBR })}
        </span>
      </div>
    </button>
  );
}

/** Linha da lista lateral do editor (só no desktop): troca rápida de nota. */
function NoteListItem({ note, isActive, onClick }: { note: Note; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`w-full text-left px-2.5 py-2 rounded-control transition-colors ${isActive ? "bg-muted text-foreground" : "text-foreground/80 hover:bg-muted/50"}`}
    >
      <div className="flex items-center gap-2">
        <FileText className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
        <p className={`text-sm truncate flex-1 ${isActive ? "font-semibold" : "font-medium"}`}>{note.title || "Sem título"}</p>
        {note.is_pinned && <Pin className="h-3 w-3 shrink-0 fill-current text-muted-foreground" />}
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StudentNotesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([newBlock()]);
  const [noteSubjectId, setNoteSubjectId] = useState<string | null>(null);
  const [noteIsPinned, setNoteIsPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [filterSubject, setFilterSubject] = useState<string | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  const [slash, setSlash] = useState<{ open: boolean; blockId: string; y: number; x: number; filter: string; cursor: number }>
    ({ open: false, blockId: "", y: 0, x: 0, filter: "", cursor: 0 });
  const [wikiMenu, setWikiMenu] = useState<{ blockId: string; query: string; y: number; x: number } | null>(null);

  const saveTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const blurTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const titleRef   = useRef<HTMLTextAreaElement>(null);

  // ── Load ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("notes").select("*").eq("user_id", user.id).order("is_pinned", { ascending: false }).order("updated_at", { ascending: false }),
      supabase.from("subjects").select("id, name").order("name"),
    ]).then(([nr, sr]) => {
      if (nr.data) setNotes(nr.data as Note[]);
      if (sr.data) setSubjects(sr.data);
    }).finally(() => setLoading(false));
  }, [user]);

  // ── Backlinks & wiki suggestions ─────────────────────────────────────────────

  const backlinks = useMemo(() => {
    if (!noteTitle.trim() || !activeId) return [];
    const pat = `[[${noteTitle.trim().toLowerCase()}]]`;
    return notes.filter(n => n.id !== activeId && n.blocks.some(b => b.content.toLowerCase().includes(pat)));
  }, [notes, noteTitle, activeId]);

  const wikiSuggestions = useMemo(() => {
    if (!wikiMenu) return [];
    const q = wikiMenu.query.toLowerCase();
    return notes.filter(n => n.id !== activeId && n.title.toLowerCase().includes(q)).slice(0, 8);
  }, [wikiMenu, notes, activeId]);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const scheduleSave = useCallback((id: string, title: string, bks: Block[], subId: string | null, pinned: boolean) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        const { error } = await supabase.from("notes").upsert({
          id, user_id: user!.id, title: title || "Sem título",
          blocks: bks, subject_id: subId, is_pinned: pinned,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        setNotes(prev => prev.map(n => n.id === id ? { ...n, title: title || "Sem título", blocks: bks, subject_id: subId, is_pinned: pinned, updated_at: new Date().toISOString() } : n));
      } catch (e: unknown) {
        toast({ title: "Erro ao salvar", description: (e as Error).message, variant: "destructive" });
      } finally { setSaving(false); }
    }, 1200);
  }, [user, toast]);

  // ── Open / Create / Delete ────────────────────────────────────────────────────

  const openNote = useCallback((note: Note) => {
    setActiveId(note.id);
    setNoteTitle(note.title === "Sem título" ? "" : note.title);
    setBlocks(note.blocks.length > 0 ? note.blocks : [newBlock()]);
    setNoteSubjectId(note.subject_id);
    setNoteIsPinned(note.is_pinned);
    setFocusedBlockId(null);
    setTimeout(() => titleRef.current?.focus(), 80);
  }, []);

  // Volta para a grade. O salvamento pendente (debounce) segue sozinho.
  const closeNote = () => {
    setActiveId(null);
    setFocusedBlockId(null);
    setSlash(s => ({ ...s, open: false }));
    setWikiMenu(null);
  };

  // O grafo abre uma nota via `?open=<id>`. Lido do `window` (e não de
  // `useSearchParams`) para a página não precisar de um Suspense só por isso.
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (loading || openedFromUrl.current) return;
    openedFromUrl.current = true;
    const id = new URLSearchParams(window.location.search).get("open");
    const note = id ? notes.find(n => n.id === id) : undefined;
    if (note) openNote(note);
  }, [loading, notes, openNote]);

  const openNoteById = useCallback((id: string) => {
    const note = notes.find(n => n.id === id);
    if (note) openNote(note);
  }, [notes, openNote]);

  const createNote = async () => {
    if (!user) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const fresh: Note = { id, title: "Sem título", blocks: [newBlock()], subject_id: null, tags: [], is_pinned: false, updated_at: now, created_at: now };
    setNotes(prev => [fresh, ...prev]);
    openNote(fresh);
    await supabase.from("notes").insert({ id, user_id: user.id, title: "Sem título", blocks: fresh.blocks, updated_at: now, created_at: now });
  };

  const deleteNote = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeId === id) setActiveId(null);
    toast({ title: "Nota apagada" });
  };

  // ── Block ops ────────────────────────────────────────────────────────────────

  const updateBlock = (id: string, content: string) => {
    const next = blocks.map(b => b.id === id ? { ...b, content } : b);
    setBlocks(next);
    if (activeId) scheduleSave(activeId, noteTitle, next, noteSubjectId, noteIsPinned);
  };

  const toggleCheck = (id: string) => {
    const next = blocks.map(b => b.id === id ? { ...b, checked: !b.checked } : b);
    setBlocks(next);
    if (activeId) scheduleSave(activeId, noteTitle, next, noteSubjectId, noteIsPinned);
  };

  const changeBlockType = (id: string, type: BlockType) => {
    const next = blocks.map(b => b.id === id ? { ...b, type, content: b.content.replace(/^\/\S*\s?/, "").trimStart() } : b);
    setBlocks(next);
    setSlash(s => ({ ...s, open: false }));
    setTimeout(() => textareaRefs.current[id]?.focus(), 40);
    if (activeId) scheduleSave(activeId, noteTitle, next, noteSubjectId, noteIsPinned);
  };

  const addBlockAfter = (id: string, type: BlockType = "text") => {
    const idx = blocks.findIndex(b => b.id === id);
    const fresh = newBlock(type);
    const next = [...blocks.slice(0, idx + 1), fresh, ...blocks.slice(idx + 1)];
    setBlocks(next);
    setFocusedBlockId(fresh.id);
    setTimeout(() => textareaRefs.current[fresh.id]?.focus(), 40);
    if (activeId) scheduleSave(activeId, noteTitle, next, noteSubjectId, noteIsPinned);
  };

  const deleteBlock = (id: string) => {
    if (blocks.length <= 1) return;
    const idx = blocks.findIndex(b => b.id === id);
    const next = blocks.filter(b => b.id !== id);
    setBlocks(next);
    const prev = next[Math.max(0, idx - 1)];
    if (prev) setTimeout(() => { const el = textareaRefs.current[prev.id]; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 30);
    if (activeId) scheduleSave(activeId, noteTitle, next, noteSubjectId, noteIsPinned);
  };

  // ── Focus / blur ─────────────────────────────────────────────────────────────

  const handleBlockFocus = (id: string) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setFocusedBlockId(id);
    const el = textareaRefs.current[id];
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  };

  const handleBlockBlur = () => {
    blurTimer.current = setTimeout(() => { setFocusedBlockId(null); setSlash(s => ({ ...s, open: false })); setWikiMenu(null); }, 150);
  };

  // ── Keyboard ─────────────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, blockId: string) => {
    const block = blocks.find(b => b.id === blockId)!;
    const filtered = SLASH_ITEMS.filter(i => !slash.filter || i.label.toLowerCase().includes(slash.filter.toLowerCase()));

    if (slash.open) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlash(s => ({ ...s, cursor: Math.min(s.cursor + 1, filtered.length - 1) })); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSlash(s => ({ ...s, cursor: Math.max(s.cursor - 1, 0) })); return; }
      if (e.key === "Enter")     { e.preventDefault(); if (filtered[slash.cursor]) changeBlockType(blockId, filtered[slash.cursor].type); return; }
      if (e.key === "Escape")    { setSlash(s => ({ ...s, open: false })); return; }
    }
    if (wikiMenu) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); return; }
      if (e.key === "Enter" && wikiSuggestions.length > 0) { e.preventDefault(); insertWikilink(blockId, wikiSuggestions[0].title); return; }
      if (e.key === "Escape") { setWikiMenu(null); return; }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setSlash(s => ({ ...s, open: false }));
      const listType = block.type === "bullet" || block.type === "numbered" || block.type === "todo";
      if (listType && !block.content) { changeBlockType(blockId, "text"); return; }
      addBlockAfter(blockId, listType ? block.type : "text");
      return;
    }
    if (e.key === "Backspace" && block.content === "") {
      e.preventDefault();
      setSlash(s => ({ ...s, open: false }));
      if (block.type !== "text") changeBlockType(blockId, "text");
      else deleteBlock(blockId);
    }
  };

  // ── Wikilink insert ───────────────────────────────────────────────────────────

  const insertWikilink = (blockId: string, targetTitle: string) => {
    const block = blocks.find(b => b.id === blockId)!;
    updateBlock(blockId, block.content.replace(/\[\[[^\]]*$/, `[[${targetTitle}]] `));
    setWikiMenu(null);
    setTimeout(() => { const el = textareaRefs.current[blockId]; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 30);
  };

  // ── Block change ──────────────────────────────────────────────────────────────

  const handleBlockChange = (blockId: string, content: string) => {
    updateBlock(blockId, content);
    const rect = textareaRefs.current[blockId]?.getBoundingClientRect();
    if (content === "/") {
      if (rect) setSlash({ open: true, blockId, y: rect.bottom + 4, x: rect.left, filter: "", cursor: 0 });
    } else if (content.startsWith("/") && slash.open && slash.blockId === blockId) {
      setSlash(s => ({ ...s, filter: content.slice(1), cursor: 0 }));
    } else if (!content.startsWith("/")) {
      setSlash(s => ({ ...s, open: false }));
    }
    const wikiMatch = content.match(/\[\[([^\]]*)$/);
    if (wikiMatch) {
      if (rect) setWikiMenu({ blockId, query: wikiMatch[1], y: rect.bottom + 4, x: rect.left });
    } else {
      setWikiMenu(null);
    }
  };

  // ── Title / Subject / Pin ─────────────────────────────────────────────────────

  const handleTitleChange = (val: string) => {
    setNoteTitle(val);
    if (activeId) scheduleSave(activeId, val, blocks, noteSubjectId, noteIsPinned);
  };

  const handleSubjectChange = (subId: string) => {
    const next = noteSubjectId === subId ? null : subId;
    setNoteSubjectId(next);
    if (activeId) scheduleSave(activeId, noteTitle, blocks, next, noteIsPinned);
    setNotes(prev => prev.map(n => n.id === activeId ? { ...n, subject_id: next } : n));
  };

  const togglePin = () => {
    const next = !noteIsPinned;
    setNoteIsPinned(next);
    if (activeId) scheduleSave(activeId, noteTitle, blocks, noteSubjectId, next);
    setNotes(prev => prev.map(n => n.id === activeId ? { ...n, is_pinned: next } : n));
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const filtered = notes.filter(n =>
    (!search || n.title.toLowerCase().includes(search.toLowerCase())) &&
    (!filterSubject || n.subject_id === filterSubject)
  );
  const pinned  = filtered.filter(n =>  n.is_pinned);
  const recents = filtered.filter(n => !n.is_pinned);
  const activeNote    = notes.find(n => n.id === activeId);
  const activeSubject = subjects.find(s => s.id === noteSubjectId);
  const subjectById   = (id: string | null) => (id ? subjects.find(s => s.id === id) : undefined);
  // O filtro só oferece matérias que têm nota: chip que leva a lista vazia é ruído.
  const usedSubjects  = subjects.filter(s => notes.some(n => n.subject_id === s.id));
  const hasFilter     = !!search || !!filterSubject;

  let ctr = 0;
  const numMap: Record<string, number> = {};
  blocks.forEach(b => { if (b.type === "numbered") { ctr++; numMap[b.id] = ctr; } else ctr = 0; });

  const slashFiltered = SLASH_ITEMS.filter(i => !slash.filter || i.label.toLowerCase().includes(slash.filter.toLowerCase()));

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const searchBox = (className = "") => (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text" placeholder="Buscar pelo título…" value={search}
        onChange={e => setSearch(e.target.value)}
        aria-label="Buscar notas"
        className="w-full h-10 pl-9 pr-9 rounded-control border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {search && (
        <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  const subjectFilter = usedSubjects.length > 0 && (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1 min-w-0" role="group" aria-label="Filtrar por matéria">
      <button type="button" onClick={() => setFilterSubject(null)}
        className={`h-8 shrink-0 px-3 rounded-control border text-xs font-medium transition-colors ${!filterSubject ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"}`}>
        Todas
      </button>
      {usedSubjects.map(s => {
        const on = filterSubject === s.id;
        return (
          <button key={s.id} type="button" onClick={() => setFilterSubject(on ? null : s.id)}
            className={`h-8 shrink-0 inline-flex items-center gap-1.5 px-3 rounded-control border text-xs font-medium transition-colors ${on ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${subjectDot(s.name)}`} />
            {s.name}
          </button>
        );
      })}
    </div>
  );

  // Fora do editor: a grade usa a largura toda. Dentro dele, a lista vira
  // coluna lateral (só no desktop) para trocar de nota sem voltar.
  return (
    <>
      {!activeId ? (
        // ── GRADE ───────────────────────────────────────────────────────────
        <div className="space-y-6">
          {/* Cabeçalho em nível médio; o corpo abaixo é sóbrio (tela de horas). */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="u-label flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> Caderno · notas</p>
              <h1 className="u-page-title text-3xl mt-1">Minhas notas</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {notes.length} nota{notes.length !== 1 ? "s" : ""}
                {notes.some(n => n.is_pinned) && ` · ${notes.filter(n => n.is_pinned).length} fixada${notes.filter(n => n.is_pinned).length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className="hover:bg-muted hover:text-foreground">
                <Link href="/dashboard/student/notes/graph"><Network /> Grafo</Link>
              </Button>
              {/* Único CTA primário da tela: é o único com sombra dura. */}
              <Button variant="arcade" onClick={createNote}><Plus /> Nova nota</Button>
            </div>
          </div>

          {notes.length > 0 && (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              {searchBox("lg:w-80 shrink-0")}
              {subjectFilter}
            </div>
          )}

          {notes.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-card px-6 py-16 flex flex-col items-center text-center gap-4">
              <StickyNote className="h-10 w-10 text-muted-foreground/60" />
              <div className="space-y-1.5 max-w-sm">
                <p className="font-semibold text-foreground">Seu caderno está vazio</p>
                <p className="text-sm text-muted-foreground">
                  Anote resumos e fórmulas. Digite <kbd className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">/</kbd> para
                  trocar o tipo de bloco e <kbd className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">[[</kbd> para ligar uma nota a outra.
                </p>
              </div>
              <Button variant="outline" onClick={createNote} className="hover:bg-muted hover:text-foreground"><Plus /> Criar primeira nota</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-card border border-dashed border-border px-6 py-12 flex flex-col items-center text-center gap-3">
              <Search className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Nenhuma nota encontrada com esses filtros.</p>
              {hasFilter && (
                <Button variant="outline" size="sm" className="hover:bg-muted hover:text-foreground"
                  onClick={() => { setSearch(""); setFilterSubject(null); }}>
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {[{ label: "Fixadas", items: pinned }, { label: pinned.length > 0 ? "Outras notas" : "Notas", items: recents }]
                .filter(sec => sec.items.length > 0)
                .map(sec => (
                  <section key={sec.label}>
                    <p className="u-label mb-3">{sec.label} · {sec.items.length}</p>
                    {/* auto-fill: o número de colunas segue a largura real (com ou sem
                        sidebar aberta), sem cards espremidos nem faixas vazias. */}
                    <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
                      {/* Só a grade anima (anim-rise, CSS puro); o editor é tela
                          de horas e fica parado. Invólucro para o fill da
                          animação não anular o lift do card. */}
                      {sec.items.map((n, i) => (
                        <div key={n.id} className="anim-rise" style={{ '--i': Math.min(i, 10) } as React.CSSProperties}>
                          <NoteGridCard note={n} subject={subjectById(n.subject_id)} onClick={() => openNote(n)} />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          )}
        </div>
      ) : (
        // ── EDITOR ──────────────────────────────────────────────────────────
        // No desktop a altura é a da viewport menos o cabeçalho do app (4rem) e o
        // padding do <main> (2rem + 2rem): cada coluna rola por conta própria.
        <div className="flex flex-col gap-4 lg:h-[calc(100dvh-8rem)]">
          <div className="flex items-center gap-3 shrink-0">
            <button type="button" onClick={closeNote}
              className="inline-flex items-center gap-1 h-9 pl-1.5 pr-3 rounded-control text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" /> Todas as notas
            </button>
            <p className="u-label hidden sm:block">Caderno · nota</p>
            <div className="ml-auto flex items-center gap-1">
              {saving && <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground mr-2"><Loader2 className="h-3 w-3 animate-spin" /> Salvando</span>}
              <button type="button" onClick={togglePin} title={noteIsPinned ? "Desafixar" : "Fixar"} aria-pressed={noteIsPinned}
                className={`h-9 w-9 flex items-center justify-center rounded-control transition-colors ${noteIsPinned ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                {noteIsPinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button type="button" title="Apagar nota"
                    className="h-9 w-9 flex items-center justify-center rounded-control text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-bold">Apagar nota?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteNote(activeId!)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Apagar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex gap-4">
            {/* Lista lateral — só no desktop; no celular o "voltar" já leva à grade. */}
            <aside className="hidden lg:flex w-64 shrink-0 flex-col u-surface overflow-hidden">
              <div className="p-3 border-b border-border">{searchBox()}</div>
              <div className="flex-1 overflow-y-auto p-2 space-y-px">
                {filtered.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhuma nota</p>}
                {pinned.length > 0 && <p className="u-label px-2.5 pt-2 pb-1">Fixadas</p>}
                {pinned.map(n => <NoteListItem key={n.id} note={n} isActive={activeId === n.id} onClick={() => openNote(n)} />)}
                {recents.length > 0 && pinned.length > 0 && <p className="u-label px-2.5 pt-3 pb-1">Notas</p>}
                {recents.map(n => <NoteListItem key={n.id} note={n} isActive={activeId === n.id} onClick={() => openNote(n)} />)}
              </div>
              <div className="p-2 border-t border-border">
                <button type="button" onClick={createNote}
                  className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-control text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Plus className="h-4 w-4" /> Nova nota
                </button>
              </div>
            </aside>

            <section className="flex-1 min-w-0 u-surface flex flex-col overflow-hidden">
              {/* Matéria da nota: seletor discreto, ponto colorido como sinal. */}
              {subjects.length > 0 && (
                <div className="flex items-center gap-1.5 px-4 md:px-6 py-2.5 border-b border-border overflow-x-auto shrink-0">
                  <span className="u-label shrink-0 mr-1">Matéria</span>
                  {subjects.map(s => {
                    const on = noteSubjectId === s.id;
                    return (
                      <button key={s.id} type="button" onClick={() => handleSubjectChange(s.id)} aria-pressed={on}
                        className={`h-7 shrink-0 inline-flex items-center gap-1.5 px-2.5 rounded-control border text-xs font-medium transition-colors ${on ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${subjectDot(s.name)}`} />
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                <div className="max-w-[720px] mx-auto px-5 md:px-12 py-8 md:py-10">

                  <textarea
                    ref={titleRef} rows={1} value={noteTitle} placeholder="Sem título"
                    onChange={e => { handleTitleChange(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (blocks[0]) setTimeout(() => { handleBlockFocus(blocks[0].id); textareaRefs.current[blocks[0].id]?.focus(); }, 30); } }}
                    className="w-full bg-transparent resize-none outline-none text-[2rem] md:text-[2.5rem] font-bold tracking-tight text-foreground placeholder:text-muted-foreground/40 leading-tight mb-2"
                    style={{ minHeight: "52px", overflow: "hidden" }}
                  />

                  {activeNote && (
                    <p className="u-label mb-8 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {activeSubject && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${subjectDot(activeSubject.name)}`} />{activeSubject.name}
                        </span>
                      )}
                      <span>Editada em {format(new Date(activeNote.updated_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                    </p>
                  )}

                  <div className="space-y-0.5">
                    {blocks.map((block, idx) => (
                      <BlockRow
                        key={block.id} block={block}
                        blockNumber={numMap[block.id] ?? idx + 1}
                        isFocused={focusedBlockId === block.id}
                        notes={notes}
                        onFocus={() => handleBlockFocus(block.id)}
                        onBlur={handleBlockBlur}
                        onChange={c => handleBlockChange(block.id, c)}
                        onToggleCheck={() => toggleCheck(block.id)}
                        onKeyDown={e => handleKeyDown(e, block.id)}
                        textareaRef={el => { textareaRefs.current[block.id] = el; }}
                        onWikiClick={openNoteById}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addBlockAfter(blocks[blocks.length - 1].id)}
                    className="w-full mt-6 py-2.5 rounded-control border border-dashed border-border hover:border-foreground/30 hover:bg-muted/40 transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground text-sm">
                    <Plus className="h-4 w-4" /> Adicionar bloco
                  </button>

                  <div className="flex items-center justify-center gap-x-6 gap-y-2 mt-3 flex-wrap">
                    {(["/ tipos de bloco", "[[ linkar nota", "** negrito", "* itálico"] as const).map(hint => {
                      const [key, ...rest] = hint.split(" ");
                      return (
                        <p key={key} className="text-[11px] text-muted-foreground">
                          <kbd className="bg-muted text-foreground/70 px-1.5 py-0.5 rounded font-mono">{key}</kbd> {rest.join(" ")}
                        </p>
                      );
                    })}
                  </div>

                  {backlinks.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-border">
                      <p className="u-label mb-4 flex items-center gap-2">
                        <Link2 className="h-3.5 w-3.5" />
                        {backlinks.length} link{backlinks.length !== 1 ? "s" : ""} reverso{backlinks.length !== 1 ? "s" : ""}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {backlinks.map(note => {
                          const subj = subjectById(note.subject_id);
                          return (
                            <button key={note.id} type="button" onClick={() => openNote(note)}
                              className="flex items-center gap-3 p-3 rounded-control border border-border hover:border-foreground/30 hover:bg-muted/40 transition-colors text-left group">
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-foreground text-sm truncate">{note.title}</p>
                                {subj && (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <span className={`h-1.5 w-1.5 rounded-full ${subjectDot(subj.name)}`} />{subj.name}
                                  </span>
                                )}
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ── SLASH MENU ──────────────────────────────────────────────────────── */}
      {slash.open && slashFiltered.length > 0 && (
        <div className="fixed z-50 w-64 bg-popover text-popover-foreground rounded-control shadow-xl border border-border overflow-hidden py-1"
          style={{ top: Math.min(slash.y, window.innerHeight - 320), left: Math.min(slash.x, window.innerWidth - 270) }}>
          <p className="u-label px-3 pt-2 pb-1">
            Tipos de bloco {slash.filter && `· "${slash.filter}"`}
          </p>
          {slashFiltered.map((item, i) => (
            <button key={item.type} type="button" onMouseDown={e => { e.preventDefault(); changeBlockType(slash.blockId, item.type); }}
              className={`w-full flex items-center gap-3 px-3 py-2 transition-colors ${i === slash.cursor ? "bg-muted" : "hover:bg-muted/50"}`}>
              <div className={`h-7 w-7 rounded-control flex items-center justify-center shrink-0 ${i === slash.cursor ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                <item.Icon className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm leading-none">{item.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── WIKILINK MENU ───────────────────────────────────────────────────── */}
      {wikiMenu && wikiSuggestions.length > 0 && (
        <div className="fixed z-50 w-64 bg-popover text-popover-foreground rounded-control shadow-xl border border-border overflow-hidden py-1"
          style={{ top: Math.min(wikiMenu.y, window.innerHeight - 280), left: Math.min(wikiMenu.x, window.innerWidth - 270) }}>
          <p className="u-label px-3 pt-2 pb-1 flex items-center gap-1.5">
            <Link2 className="h-3 w-3" /> Linkar nota
            {wikiMenu.query && <span className="normal-case tracking-normal">· &quot;{wikiMenu.query}&quot;</span>}
          </p>
          {wikiSuggestions.map(note => {
            const subj = subjectById(note.subject_id);
            return (
              <button key={note.id} type="button" onMouseDown={e => { e.preventDefault(); insertWikilink(wikiMenu.blockId, note.title); }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="text-left min-w-0">
                  <p className="font-medium text-sm leading-tight truncate text-foreground">{note.title}</p>
                  {subj && (
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={`h-1.5 w-1.5 rounded-full ${subjectDot(subj.name)}`} />{subj.name}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          <p className="px-3 pt-1 pb-2 text-[11px] text-muted-foreground">Enter para inserir o primeiro</p>
        </div>
      )}
    </>
  );
}
