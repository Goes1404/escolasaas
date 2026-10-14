
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

import { EXAM_TYPES, EXAM_TYPE_BADGE as TYPE_COLOR, examTypeLabel, type ExamType } from '@/lib/exam-types';
import { EmptyState } from '@/components/EmptyState';

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
    if (!confirm(`Excluir "${exam.title}"?`)) return;
    const { error } = await supabase.from('exams').delete().eq('id', exam.id);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
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
      toast({ title: 'Erro ao enviar o PDF', description: e.message, variant: 'destructive' });
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="u-label">Carregando provas…</p>
      </div>
    );
  }

  const labelCls = 'u-label';

  return (
    <div className="max-w-6xl space-y-6 pb-24">
      {/* Cabeçalho (nível médio) */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><Scroll className="h-3.5 w-3.5" /> Professor · provas</p>
          <h1 className="u-page-title text-3xl mt-1">Provas e PDFs</h1>
          <p className="text-muted-foreground text-sm mt-2"><span className="tabular-nums">{exams.length}</span> {exams.length === 1 ? 'prova cadastrada' : 'provas cadastradas'}</p>
        </div>
        <div className="flex flex-col min-[400px]:flex-row gap-2">
          <Button asChild variant="outline" className="h-11 px-4 rounded-control font-semibold">
            <Link href="/dashboard/teacher/enem-import">
              <Download className="h-4 w-4 mr-2" /> Importar ENEM
            </Link>
          </Button>
          <Button onClick={openCreate} variant="arcade" className="h-11 px-5 rounded-control font-bold">
            <Plus className="h-4 w-4 mr-2" /> Nova prova
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar provas…"
            className="pl-9 h-11 rounded-control bg-background border-border" />
        </div>
        <button
          onClick={() => setFilterOwn(v => !v)}
          aria-pressed={filterOwn}
          className={`px-4 h-11 rounded-control text-sm font-semibold border transition-colors ${filterOwn ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'}`}
        >
          Só as minhas
        </button>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        exams.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nenhuma prova cadastrada"
            description="Crie uma prova e envie o PDF, ou importe uma edição do ENEM já com as questões."
            action={{ label: 'Nova prova', onClick: openCreate, icon: Plus }}
            secondary={{ label: 'Importar ENEM', href: '/dashboard/teacher/enem-import' }}
          />
        ) : (
          <EmptyState
            icon={Search}
            title="Nenhuma prova encontrada"
            description={filterOwn ? 'Nenhuma prova sua corresponde à busca.' : 'Nenhuma prova corresponde à busca.'}
            secondary={{ label: 'Limpar filtros', onClick: () => { setSearch(''); setFilterOwn(false); } }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(exam => {
            const typeColor = TYPE_COLOR[(EXAM_TYPES as readonly string[]).includes(exam.exam_type) ? exam.exam_type as ExamType : 'outro'];
            const isUploading = uploading[exam.id];
            const canEdit = isOwner(exam);

            return (
              <Card key={exam.id} className="rounded-card overflow-hidden">
                <CardContent className="p-4 sm:p-5 flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={`${typeColor} font-semibold text-[10px] px-2 py-0.5 rounded-control`}>{examTypeLabel(exam.exam_type)}</Badge>
                    <div className="flex items-center gap-1.5">
                      {exam.year && <span className="u-num text-sm text-muted-foreground">{exam.year}</span>}
                      {!canEdit && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Prova de outro professor" />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-foreground leading-snug break-words">{exam.title}</h3>
                    {exam.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{exam.description}</p>}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1 tabular-nums"><BookOpen className="h-3.5 w-3.5" />{exam.question_count} {exam.question_count === 1 ? 'questão' : 'questões'}</span>
                    {exam.pdf_url
                      ? <span className="flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" />Com PDF</span>
                      : <span className="flex items-center gap-1 font-semibold"><FileText className="h-3.5 w-3.5" />Sem PDF</span>
                    }
                  </div>

                  {/* PDF */}
                  {exam.pdf_url ? (
                    <div className="flex gap-2">
                      <Button asChild variant="outline" className="flex-1 h-10 rounded-control font-semibold text-xs">
                        <a href={exam.pdf_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1.5" /> Ver PDF
                        </a>
                      </Button>
                      {canEdit && (
                        <Button variant="outline" size="icon" onClick={() => fileInputRefs.current[exam.id]?.click()}
                          disabled={isUploading} className="h-10 w-10 rounded-control" title="Trocar PDF" aria-label="Trocar PDF">
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  ) : canEdit ? (
                    <Button variant="outline" onClick={() => fileInputRefs.current[exam.id]?.click()} disabled={isUploading}
                      className="w-full h-10 rounded-control font-semibold text-xs">
                      {isUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando…</> : <><Upload className="h-4 w-4 mr-2" />Enviar PDF</>}
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
                      className="w-full h-9 rounded-control text-xs font-semibold">
                      <ScanSearch className="h-3.5 w-3.5 mr-1.5" /> Extrair imagens do PDF
                    </Button>
                  )}

                  {canEdit && (
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(exam)}
                        className="flex-1 h-9 rounded-control text-xs font-semibold">
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(exam)}
                        className="flex-1 h-9 rounded-control text-xs font-semibold text-red-600 hover:text-red-600 hover:bg-red-500/10">
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Diálogo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-card w-[95vw] sm:w-full max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold text-lg">
              {editingExam ? 'Editar prova' : 'Nova prova'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className={labelCls}>Título</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: ENEM 2023 — 1º dia" className="h-11 rounded-control" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelCls}>Ano</Label>
                <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  placeholder="2024" className="h-11 rounded-control" />
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Tipo</Label>
                <Select value={form.exam_type} onValueChange={v => setForm(f => ({ ...f, exam_type: v as ExamType }))}>
                  <SelectTrigger className="h-11 rounded-control"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-control">
                    {EXAM_TYPES.map(t => <SelectItem key={t} value={t} className="text-sm">{examTypeLabel(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Descrição (opcional)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Caderno de Linguagens e Ciências Humanas" className="rounded-control resize-none" rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-control font-semibold">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-control font-bold">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando…</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
