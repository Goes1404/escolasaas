"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus, Search, Trash2, List, ListOrdered, CheckSquare,
  Minus, Type, Heading1, Heading2, Heading3, Quote,
  BookOpen, Loader2, Pin, PinOff, ChevronLeft,
  StickyNote, Circle, CheckCircle2, Link2, Network, ArrowRight, FileText,
} from "lucide-react";
import Link from "next/link";
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

const SUBJECT_PALETTE: Record<string, { bg: string; text: string; dot: string }> = {
  "Matemática":            { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400" },
  "Português":             { bg: "bg-purple-50",  text: "text-purple-700",  dot: "bg-purple-400" },
  "Língua Portuguesa":     { bg: "bg-purple-50",  text: "text-purple-700",  dot: "bg-purple-400" },
  "Linguagens":            { bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-400" },
  "História":              { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
  "Ciências Humanas":      { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
  "Geografia":             { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  "Biologia":              { bg: "bg-green-50",   text: "text-green-700",   dot: "bg-green-400" },
  "Ciências da Natureza":  { bg: "bg-teal-50",    text: "text-teal-700",    dot: "bg-teal-400" },
  "Física":                { bg: "bg-cyan-50",    text: "text-cyan-700",    dot: "bg-cyan-400" },
  "Química":               { bg: "bg-rose-50",    text: "text-rose-700",    dot: "bg-rose-400" },
  "Redação":               { bg: "bg-pink-50",    text: "text-pink-700",    dot: "bg-pink-400" },
};
const DEFAULT_PAL = { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" };
const subjectPalette = (name: string) => SUBJECT_PALETTE[name] ?? DEFAULT_PAL;

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
        if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="bg-zinc-100 text-zinc-700 px-1 py-0.5 rounded text-[0.85em] font-mono">{p.slice(1, -1)}</code>;
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
      return (
        <button
          key={i} type="button"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); if (target) onWikiClick(target.id); }}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-[0.9em] font-medium transition-colors ${
            target ? "bg-violet-100 text-violet-700 hover:bg-violet-200" : "bg-zinc-100 text-zinc-400 line-through"
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
    return <div className="py-3 px-2 cursor-pointer" onClick={onFocus}><div className="h-px bg-zinc-200" /></div>;
  }

  const prefix = (
    <>
      {block.type === "bullet" && <span className="pt-[3px] shrink-0 text-zinc-400 font-bold text-base leading-none select-none">•</span>}
      {block.type === "numbered" && <span className="pt-[2px] shrink-0 text-zinc-400 text-sm w-5 text-right select-none">{blockNumber}.</span>}
      {block.type === "todo" && (
        <button type="button"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onToggleCheck(); }}
          className="pt-[3px] shrink-0 text-zinc-400 hover:text-violet-500 transition-colors">
          {block.checked ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4" />}
        </button>
      )}
      {block.type === "quote" && <div className="self-stretch w-0.5 bg-violet-400 rounded-full shrink-0 my-1" />}
    </>
  );

  const viewClass: Record<BlockType, string> = {
    text:     "text-[15px] text-zinc-700 leading-relaxed",
    h1:       "text-[2rem] font-bold text-zinc-900 tracking-tight leading-tight",
    h2:       "text-[1.4rem] font-bold text-zinc-800 leading-tight",
    h3:       "text-[1.1rem] font-semibold text-zinc-800",
    bullet:   "text-[15px] text-zinc-700 leading-relaxed",
    numbered: "text-[15px] text-zinc-700 leading-relaxed",
    todo:     "text-[15px] text-zinc-700 leading-relaxed",
    quote:    "text-[15px] text-zinc-500 italic",
    divider:  "",
  };

  const wrap = "group flex items-start gap-2 px-2 py-0.5 rounded-lg transition-colors";

  if (!isFocused) {
    const empty = !block.content.trim();
    return (
      <div className={`${wrap} cursor-text hover:bg-zinc-50/80`} onClick={onFocus}>
        {prefix}
        <div className={`flex-1 min-w-0 ${viewClass[block.type]} ${block.type === "todo" && block.checked ? "line-through text-zinc-400" : ""}`}>
          {empty
            ? <span className="text-zinc-300 select-none">{PLACEHOLDER[block.type]}</span>
            : renderContent(block.content, notes, onWikiClick)
          }
        </div>
      </div>
    );
  }

  const editClass: Record<BlockType, string> = {
    text:     "text-[15px] text-zinc-700 leading-relaxed",
    h1:       "text-[2rem] font-bold text-zinc-900 tracking-tight",
    h2:       "text-[1.4rem] font-bold text-zinc-800",
    h3:       "text-[1.1rem] font-semibold text-zinc-800",
    bullet:   "text-[15px] text-zinc-700 leading-relaxed",
    numbered: "text-[15px] text-zinc-700 leading-relaxed",
    todo:     "text-[15px] text-zinc-700 leading-relaxed",
    quote:    "text-[15px] text-zinc-500 italic",
    divider:  "",
  };

  return (
    <div className={`${wrap} bg-violet-50/40`}>
      {prefix}
      <textarea
        ref={textareaRef} rows={1} value={block.content}
        placeholder={PLACEHOLDER[block.type]} autoFocus
        onFocus={onFocus} onBlur={onBlur}
        onChange={e => { onChange(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
        onKeyDown={onKeyDown}
        className={`w-full flex-1 bg-transparent resize-none outline-none placeholder-zinc-300 ${editClass[block.type]} ${block.type === "todo" && block.checked ? "line-through text-zinc-400" : ""}`}
        style={{ minHeight: "28px", overflow: "hidden" }}
      />
    </div>
  );
}

// ── NoteCard ──────────────────────────────────────────────────────────────────

function NoteCard({ note, subjects, isActive, onClick }: { note: Note; subjects: { id: string; name: string }[]; isActive: boolean; onClick: () => void }) {
  const preview = note.blocks.find(b => b.type === "text" && b.content.trim())?.content ?? "";
  return (
    <button onClick={onClick} className={`w-full text-left px-2 py-1.5 rounded-md transition-all ${isActive ? "bg-zinc-700" : "hover:bg-zinc-800"}`}>
      <div className="flex items-center gap-1.5">
        <FileText className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-violet-400" : "text-zinc-600"}`} />
        <p className={`text-sm truncate flex-1 font-medium ${isActive ? "text-white" : "text-zinc-300"}`}>{note.title || "Sem título"}</p>
        {note.is_pinned && <Pin className={`h-3 w-3 shrink-0 fill-current ${isActive ? "text-violet-300" : "text-zinc-600"}`} />}
      </div>
      {preview && <p className={`text-xs truncate mt-0.5 pl-5 ${isActive ? "text-zinc-400" : "text-zinc-600"}`}>{preview}</p>}
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
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");

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
    setMobileView("editor");
    setTimeout(() => titleRef.current?.focus(), 80);
  }, []);

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
    if (activeId === id) { setActiveId(null); setMobileView("list"); }
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

  let ctr = 0;
  const numMap: Record<string, number> = {};
  blocks.forEach(b => { if (b.type === "numbered") { ctr++; numMap[b.id] = ctr; } else ctr = 0; });

  const slashFiltered = SLASH_ITEMS.filter(i => !slash.filter || i.label.toLowerCase().includes(slash.filter.toLowerCase()));

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-4rem)] -mx-4 md:-mx-8 overflow-hidden">

      {/* ── SIDEBAR (dark) ──────────────────────────────────────────────────── */}
      <aside className={`${mobileView === "editor" ? "hidden" : "flex"} md:flex flex-col w-full md:w-[260px] shrink-0 bg-zinc-900 overflow-hidden`}>

        <div className="px-3 pt-3 pb-2 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-bold text-zinc-200">Meu Caderno</span>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/dashboard/student/notes/graph" className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors" title="Grafo">
                <Network className="h-4 w-4" />
              </Link>
              <button onClick={createNote} className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors" title="Nova nota">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
            <input
              type="text" placeholder="Buscar notas…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 bg-zinc-800 rounded-md text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-violet-500 border-none"
            />
          </div>
        </div>

        {subjects.length > 0 && (
          <div className="px-3 py-2 border-b border-zinc-800 flex gap-1 flex-wrap">
            <button onClick={() => setFilterSubject(null)}
              className={`h-5 px-2 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${!filterSubject ? "bg-violet-600 text-white" : "text-zinc-600 hover:text-zinc-300"}`}>
              Todas
            </button>
            {subjects.slice(0, 5).map(s => (
              <button key={s.id} onClick={() => setFilterSubject(filterSubject === s.id ? null : s.id)}
                className={`h-5 px-2 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${filterSubject === s.id ? "bg-violet-600 text-white" : "text-zinc-600 hover:text-zinc-300"}`}>
                {s.name.split(" ")[0]}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-px">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <StickyNote className="h-8 w-8 text-zinc-700" />
              <p className="text-sm text-zinc-600">Nenhuma nota ainda</p>
              <button onClick={createNote} className="h-7 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5">
                <Plus className="h-3 w-3" /> Nova nota
              </button>
            </div>
          )}
          {pinned.length > 0 && <>
            <p className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Fixadas</p>
            {pinned.map(n => <NoteCard key={n.id} note={n} subjects={subjects} isActive={activeId === n.id} onClick={() => openNote(n)} />)}
          </>}
          {recents.length > 0 && <>
            <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Notas</p>
            {recents.map(n => <NoteCard key={n.id} note={n} subjects={subjects} isActive={activeId === n.id} onClick={() => openNote(n)} />)}
          </>}
        </div>

        <div className="px-3 py-2.5 border-t border-zinc-800">
          <p className="text-[11px] text-zinc-600">{notes.length} nota{notes.length !== 1 ? "s" : ""}</p>
        </div>
      </aside>

      {/* ── EDITOR (light) ──────────────────────────────────────────────────── */}
      <main className={`${mobileView === "list" ? "hidden" : "flex"} md:flex flex-1 flex-col overflow-hidden bg-white`}>
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
            <div className="h-20 w-20 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-zinc-200" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-zinc-800 mb-1">Selecione uma nota</h2>
              <p className="text-sm text-zinc-400">Escolha na lista ou crie uma nova.</p>
            </div>
            <button onClick={createNote} className="h-10 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-colors flex items-center gap-2">
              <Plus className="h-4 w-4" /> Nova Nota
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 md:px-8 py-2 border-b border-zinc-100 shrink-0 gap-2 min-h-[44px]">
              <button className="md:hidden flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors" onClick={() => setMobileView("list")}>
                <ChevronLeft className="h-4 w-4" /> Notas
              </button>
              <div className="flex items-center gap-1.5 flex-wrap flex-1">
                {subjects.slice(0, 6).map(s => {
                  const pal = subjectPalette(s.name);
                  const isAct = noteSubjectId === s.id;
                  return (
                    <button key={s.id} onClick={() => handleSubjectChange(s.id)}
                      className={`h-6 px-2.5 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all ${isAct ? `${pal.bg} ${pal.text} border-transparent` : "border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"}`}>
                      {s.name.length > 10 ? s.name.split(" ")[0] : s.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {saving && <span className="hidden sm:flex items-center gap-1 text-[10px] text-zinc-400 mr-2"><Loader2 className="h-3 w-3 animate-spin" /> Salvando</span>}
                <button onClick={togglePin} title={noteIsPinned ? "Desafixar" : "Fixar"}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${noteIsPinned ? "text-amber-500 bg-amber-50" : "text-zinc-400 hover:text-amber-500 hover:bg-amber-50"}`}>
                  {noteIsPinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-bold">Apagar nota?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteNote(activeId!)} className="rounded-xl bg-red-500 hover:bg-red-600 border-none">Apagar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="max-w-[720px] mx-auto px-6 md:px-14 py-8 md:py-12">

                {activeSubject && (() => {
                  const pal = subjectPalette(activeSubject.name);
                  return (
                    <div className="mb-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${pal.bg} ${pal.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${pal.dot}`} />{activeSubject.name}
                      </span>
                    </div>
                  );
                })()}

                <textarea
                  ref={titleRef} rows={1} value={noteTitle} placeholder="Sem título"
                  onChange={e => { handleTitleChange(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (blocks[0]) setTimeout(() => { handleBlockFocus(blocks[0].id); textareaRefs.current[blocks[0].id]?.focus(); }, 30); } }}
                  className="w-full bg-transparent resize-none outline-none text-[2.2rem] md:text-[2.8rem] font-bold text-zinc-900 placeholder-zinc-200 leading-tight mb-1"
                  style={{ minHeight: "52px", overflow: "hidden" }}
                />

                {activeNote && (
                  <p className="text-[11px] text-zinc-300 uppercase tracking-wider mb-8">
                    {format(new Date(activeNote.updated_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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
                  onClick={() => addBlockAfter(blocks[blocks.length - 1].id)}
                  className="w-full mt-6 py-2.5 rounded-lg border border-dashed border-zinc-200 hover:border-violet-300 hover:bg-violet-50/40 transition-all flex items-center justify-center gap-2 text-zinc-300 hover:text-violet-400 text-sm">
                  <Plus className="h-4 w-4" /> Adicionar bloco
                </button>

                <div className="flex items-center justify-center gap-6 mt-3 flex-wrap">
                  {(["/ tipos de bloco", "[[ linkar nota", "** negrito", "* itálico"] as const).map(hint => {
                    const [key, ...rest] = hint.split(" ");
                    return (
                      <p key={key} className="text-[10px] text-zinc-300">
                        <kbd className="bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded font-mono">{key}</kbd> {rest.join(" ")}
                      </p>
                    );
                  })}
                </div>

                {backlinks.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-zinc-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Link2 className="h-4 w-4 text-zinc-400" />
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                        {backlinks.length} link{backlinks.length !== 1 ? "s" : ""} reverso{backlinks.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {backlinks.map(note => {
                        const subj = subjects.find(s => s.id === note.subject_id);
                        const pal = subj ? subjectPalette(subj.name) : null;
                        return (
                          <button key={note.id} onClick={() => openNote(note)}
                            className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 hover:border-violet-200 hover:bg-violet-50/40 transition-all text-left group">
                            <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 font-bold text-violet-600 text-sm">
                              {note.title.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-zinc-800 text-sm truncate">{note.title}</p>
                              {subj && pal && <span className={`text-[9px] font-bold uppercase ${pal.text}`}>{subj.name}</span>}
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-violet-400 transition-colors shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── SLASH MENU ──────────────────────────────────────────────────────── */}
      {slash.open && slashFiltered.length > 0 && (
        <div className="fixed z-50 w-64 bg-white rounded-xl shadow-2xl border border-zinc-100 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: Math.min(slash.y, window.innerHeight - 320), left: Math.min(slash.x, window.innerWidth - 270) }}>
          <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            Tipos de bloco {slash.filter && `· "${slash.filter}"`}
          </p>
          {slashFiltered.map((item, i) => (
            <button key={item.type} onMouseDown={e => { e.preventDefault(); changeBlockType(slash.blockId, item.type); }}
              className={`w-full flex items-center gap-3 px-3 py-2 transition-colors ${i === slash.cursor ? "bg-violet-50 text-violet-700" : "hover:bg-zinc-50 text-zinc-700"}`}>
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${i === slash.cursor ? "bg-violet-600 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                <item.Icon className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm leading-none">{item.label}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── WIKILINK MENU ───────────────────────────────────────────────────── */}
      {wikiMenu && wikiSuggestions.length > 0 && (
        <div className="fixed z-50 w-64 bg-white rounded-xl shadow-2xl border border-zinc-100 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: Math.min(wikiMenu.y, window.innerHeight - 280), left: Math.min(wikiMenu.x, window.innerWidth - 270) }}>
          <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <Link2 className="h-3 w-3" /> Linkar nota
            {wikiMenu.query && <span className="text-violet-500">· "{wikiMenu.query}"</span>}
          </p>
          {wikiSuggestions.map(note => {
            const subj = subjects.find(s => s.id === note.subject_id);
            const pal = subj ? subjectPalette(subj.name) : null;
            return (
              <button key={note.id} onMouseDown={e => { e.preventDefault(); insertWikilink(wikiMenu.blockId, note.title); }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-violet-50 transition-colors">
                <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 font-bold text-violet-600 text-sm">
                  {note.title.charAt(0).toUpperCase()}
                </div>
                <div className="text-left min-w-0">
                  <p className="font-medium text-sm leading-tight truncate text-zinc-800">{note.title}</p>
                  {subj && pal && <p className={`text-[9px] font-bold uppercase ${pal.text}`}>{subj.name}</p>}
                </div>
              </button>
            );
          })}
          <p className="px-3 pt-1 pb-2 text-[9px] text-zinc-300">Enter para inserir o primeiro</p>
        </div>
      )}
    </div>
  );
}
