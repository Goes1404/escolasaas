"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StickyNote, Plus, Trash2, Loader2, Check, X, ArrowLeftRight, MessageSquare, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Note {
  id: string;
  category: string;
  note: string;
  author_name: string | null;
  created_at: string;
}

const CATEGORIES: Record<string, { label: string; icon: any; cls: string }> = {
  troca_sala:    { label: "Troca de sala/turma", icon: ArrowLeftRight, cls: "bg-blue-50 text-blue-700" },
  comportamento: { label: "Comportamento",       icon: MessageSquare,  cls: "bg-purple-50 text-purple-700" },
  ocorrencia:    { label: "Ocorrência",          icon: AlertTriangle,  cls: "bg-red-50 text-red-600" },
  observacao:    { label: "Observação geral",    icon: Info,           cls: "bg-slate-100 text-slate-600" },
};

export function StudentNotesCard({ studentId }: { studentId: string }) {
  const { userRole, user, profile } = useAuth();
  const { toast } = useToast();
  const canEdit = userRole === "staff" || userRole === "admin";

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState("observacao");
  const [text, setText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("student_notes")
      .select("id, category, note, author_name, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    setNotes((data as Note[]) || []);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!text.trim()) { toast({ title: "Escreva a observação", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("student_notes").insert({
        student_id: studentId,
        author_id: user?.id ?? null,
        author_name: profile?.name || profile?.full_name || null,
        category,
        note: text.trim(),
      });
      if (error) throw error;
      toast({ title: "Observação registrada" });
      setText(""); setCategory("observacao"); setAdding(false);
      await load();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("student_notes").delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    else { toast({ title: "Observação removida" }); await load(); }
    setDeleteTarget(null);
  };

  if (!canEdit) return null; // notas internas — não exibir para aluno

  return (
    <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
      <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base font-black text-primary italic flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-blue-500" />
          Observações
          {notes.length > 0 && <span className="text-[10px] font-black text-slate-400 not-italic">({notes.length})</span>}
        </CardTitle>
        {!adding && (
          <Button
            onClick={() => setAdding(true)}
            size="sm"
            className="h-9 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-black text-[11px] uppercase tracking-wide border-none shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-6 pt-3 space-y-3">
        <p className="text-[10px] font-bold text-slate-400 -mt-1">Notas internas da secretaria — não visíveis ao aluno.</p>

        {adding && (
          <div className="space-y-3 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 animate-in fade-in zoom-in-95 duration-300">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 bg-white border-none rounded-xl font-bold text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                {Object.entries(CATEGORIES).map(([key, c]) => (
                  <SelectItem key={key} value={key} className="font-bold text-xs">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ex: transferido da Sala 03 para a Sala 05 a pedido do responsável."
              rows={3}
              className="rounded-xl bg-white border-none text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-widest border-none">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
              <Button onClick={() => { setAdding(false); setText(""); }} variant="ghost" className="h-11 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-blue-400" /></div>
        ) : notes.length === 0 && !adding ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <StickyNote className="h-8 w-8 text-slate-200" />
            <p className="text-xs font-bold text-slate-400">Nenhuma observação registrada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((n) => {
              const meta = CATEGORIES[n.category] || CATEGORIES.observacao;
              const Icon = meta.icon;
              return (
                <div key={n.id} className="flex gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${meta.cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`border-none font-black text-[9px] uppercase px-2 h-4 ${meta.cls}`}>{meta.label}</Badge>
                      <span className="text-[10px] font-bold text-slate-400">
                        {format(new Date(n.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mt-1.5 whitespace-pre-wrap break-words">{n.note}</p>
                    {n.author_name && (
                      <p className="text-[10px] font-bold text-slate-400 mt-1">— {n.author_name}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(n)}
                    aria-label="Remover observação"
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black italic">Remover observação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl font-black bg-red-500 hover:bg-red-600 border-none">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
