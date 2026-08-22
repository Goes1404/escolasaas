
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/lib/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Scroll, Plus, Upload, FileText, Trash2, Pencil, ExternalLink, Loader2,
  BookOpen, AlertCircle, RotateCw, CheckCircle2, Search, Download, Lock, ScanSearch
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { EXAM_TYPES, EXAM_TYPE_BADGE as TYPE_COLOR, type ExamType } from '@/lib/exam-types';

type Exam = {
  id: string;
  title: string;
  description: string | null;
  year: number | null;
  exam_type: string;
  pdf_url: string | null;
  teacher_id: string | null;
  question_count: number;
};

type FormState = {
  title: string;
  description: string;
  year: string;
  exam_type: ExamType;
};

const EMPTY_FORM: FormState = { title: '', description: '', year: String(new Date().getFullYear()), exam_type: 'enem' };

export default function TeacherExamsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOwn, setFilterOwn] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchExams = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('exams')
      .select('id, title, description, year, exam_type, pdf_url, teacher_id, exam_questions(count)')
      .order('year', { ascending: false });

    if (!error && data) {
      setExams(data.map((e: any) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        year: e.year,
        exam_type: e.exam_type,
        pdf_url: e.pdf_url,
        teacher_id: e.teacher_id,
        question_count: e.exam_questions?.[0]?.count ?? 0,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const isOwner = (exam: Exam) => exam.teacher_id === user?.id;

  const openCreate = () => {
    setEditingExam(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (exam: Exam) => {
    setEditingExam(exam);
    setForm({
      title: exam.title,
      description: exam.description ?? '',
      year: String(exam.year ?? new Date().getFullYear()),
      exam_type: (EXAM_TYPES as readonly string[]).includes(exam.exam_type) ? exam.exam_type as ExamType : 'outro',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !user) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        year: form.year ? parseInt(form.year) : null,
        exam_type: form.exam_type,
        teacher_id: user.id,
      };

      if (editingExam) {
        const { error } = await supabase.from('exams').update(payload).eq('id', editingExam.id);
        if (error) throw error;
        toast({ title: 'Prova atualizada!' });
      } else {
        const { error } = await supabase.from('exams').insert(payload);
        if (error) throw error;
        toast({ title: 'Prova criada!' });
      }
      setDialogOpen(false);
      fetchExams();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exam: Exam) => {
    if (!confirm(`Deletar "${exam.title}"?`)) return;
    const { error } = await supabase.from('exams').delete().eq('id', exam.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Prova removida.' });
    fetchExams();
  };

  const handlePdfUpload = async (exam: Exam, file: File) => {
    if (!file.type.includes('pdf')) {
      toast({ title: 'Selecione um PDF', variant: 'destructive' }); return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande (máx. 50 MB)', variant: 'destructive' }); return;
    }
    setUploading(u => ({ ...u, [exam.id]: true }));
    try {
      const path = `${exam.id}/${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from('exam_pdfs').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('exam_pdfs').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('exams').update({ pdf_url: urlData.publicUrl }).eq('id', exam.id);
      if (dbErr) throw dbErr;
      toast({ title: 'PDF enviado!' });
      fetchExams();
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(u => ({ ...u, [exam.id]: false }));
    }
  };

  const filtered = exams.filter(e => {
    const matchSearch = !search.trim() || e.title.toLowerCase().includes(search.toLowerCase());
    const matchOwn = !filterOwn || isOwner(e);
    return matchSearch && matchOwn;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium italic">Carregando provas...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl rotate-3">
            <Scroll className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-primary italic leading-none">Provas & PDFs</h1>
            <p className="text-muted-foreground font-medium italic">{exams.length} provas no sistema</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/teacher/enem-import">
            <Button variant="outline" className="h-12 px-4 rounded-2xl font-black border-blue-200 text-blue-700 hover:bg-blue-50">
              <Download className="h-4 w-4 mr-2" /> Importar ENEM
            </Button>
          </Link>
          <Button onClick={openCreate} className="h-12 px-6 rounded-2xl bg-primary text-white font-black shadow-xl hover:scale-[1.02] transition-all">
            <Plus className="h-5 w-5 mr-2" /> Nova Prova
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar provas..."
            className="pl-9 h-11 rounded-xl border-none bg-white shadow-sm font-medium" />
        </div>
        <button
          onClick={() => setFilterOwn(v => !v)}
          className={`px-4 h-11 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${filterOwn ? 'bg-primary text-white shadow-md' : 'bg-white text-muted-foreground hover:bg-slate-100'}`}
        >
          Só as minhas
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="border-none shadow-xl rounded-card bg-white p-12 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-xl font-black text-primary italic">Nenhuma prova encontrada</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(exam => {
            const typeColor = TYPE_COLOR[(EXAM_TYPES as readonly string[]).includes(exam.exam_type) ? exam.exam_type as ExamType : 'outro'];
            const isUploading = uploading[exam.id];
            const canEdit = isOwner(exam);

            return (
              <Card key={exam.id} className="border-none shadow-xl rounded-card bg-white overflow-hidden hover:shadow-2xl transition-all">
                <CardContent className="p-6 flex flex-col gap-4 h-full">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={`${typeColor} border-none font-black text-[10px] uppercase px-3 py-1`}>{exam.exam_type}</Badge>
                    <div className="flex items-center gap-1">
                      {exam.year && <Badge className="bg-primary/5 text-primary border-none font-black text-xs">{exam.year}</Badge>}
                      {!canEdit && <Lock className="h-3.5 w-3.5 text-muted-foreground/40" aria-label="Prova de outro professor" />}
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-black text-primary italic leading-tight">{exam.title}</h3>
                    {exam.description && <p className="text-xs text-muted-foreground font-medium mt-1.5 line-clamp-2">{exam.description}</p>}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                    <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{exam.question_count} questões</span>
                    {exam.pdf_url
                      ? <span className="flex items-center gap-1 text-green-600 font-black"><CheckCircle2 className="h-3.5 w-3.5" />PDF</span>
                      : <span className="flex items-center gap-1 text-amber-500 font-black"><FileText className="h-3.5 w-3.5" />Sem PDF</span>
                    }
                  </div>

                  {/* PDF */}
                  {exam.pdf_url ? (
                    <div className="flex gap-2">
                      <a href={exam.pdf_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button variant="outline" className="w-full h-10 rounded-xl font-black text-xs border-green-200 text-green-700 hover:bg-green-50">
                          <ExternalLink className="h-4 w-4 mr-1.5" /> Ver PDF
                        </Button>
                      </a>
                      {canEdit && (
                        <Button variant="outline" size="icon" onClick={() => fileInputRefs.current[exam.id]?.click()}
                          disabled={isUploading} className="h-10 w-10 rounded-xl border-slate-200 text-muted-foreground hover:bg-slate-50">
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  ) : canEdit ? (
                    <Button onClick={() => fileInputRefs.current[exam.id]?.click()} disabled={isUploading}
                      className="w-full h-10 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border-none font-black text-xs shadow-sm">
                      {isUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : <><Upload className="h-4 w-4 mr-2" />Upload PDF</>}
                    </Button>
                  ) : null}

                  <input type="file" accept="application/pdf" className="hidden"
                    ref={el => { fileInputRefs.current[exam.id] = el; }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(exam, f); e.target.value = ''; }}
                  />

                  {/* Reparar imagens: disponível para qualquer professor/admin em provas
                      com PDF, mesmo que a prova seja de outro (ação segura, validada no servidor). */}
                  {exam.pdf_url && (
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/teacher/exams/${exam.id}/images`)}
                      className="w-full h-9 rounded-xl text-xs font-black text-blue-600 bg-blue-50/50 hover:bg-blue-50">
                      <ScanSearch className="h-3.5 w-3.5 mr-1.5" /> Extrair imagens do PDF
                    </Button>
                  )}

                  {canEdit && (
                    <div className="flex gap-2 pt-1 border-t border-slate-100">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(exam)}
                        className="flex-1 h-9 rounded-xl text-xs font-black text-primary hover:bg-primary/5">
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(exam)}
                        className="flex-1 h-9 rounded-xl text-xs font-black text-red-400 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Deletar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black italic text-primary text-xl">
              {editingExam ? 'Editar Prova' : 'Nova Prova'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label className="font-black text-xs uppercase tracking-wider text-muted-foreground">Título</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: ENEM 2023 — 1º Dia" className="h-11 rounded-xl font-medium" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-black text-xs uppercase tracking-wider text-muted-foreground">Ano</Label>
                <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  placeholder="2024" className="h-11 rounded-xl font-medium" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-black text-xs uppercase tracking-wider text-muted-foreground">Tipo</Label>
                <Select value={form.exam_type} onValueChange={v => setForm(f => ({ ...f, exam_type: v as ExamType }))}>
                  <SelectTrigger className="h-11 rounded-xl font-medium"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {EXAM_TYPES.map(t => <SelectItem key={t} value={t} className="font-bold uppercase text-xs">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-black text-xs uppercase tracking-wider text-muted-foreground">Descrição (opcional)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Caderno de Linguagens e Ciências Humanas" className="rounded-xl font-medium resize-none" rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl font-black">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-primary text-white font-black shadow-lg">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
