
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
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
  BookOpen, AlertCircle, RotateCw, CheckCircle2, Search, Filter, ScanSearch
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fmtNumber } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';

import { EXAM_TYPES, EXAM_TYPE_BADGE as TYPE_COLOR, type ExamType } from '@/lib/exam-types';

type Exam = {
  id: string;
  title: string;
  description: string | null;
  year: number | null;
  exam_type: string;
  pdf_url: string | null;
  question_count: number;
};

type FormState = {
  title: string;
  description: string;
  year: string;
  exam_type: ExamType;
};

const EMPTY_FORM: FormState = { title: '', description: '', year: String(new Date().getFullYear()), exam_type: 'enem' };

export default function AdminExamsPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<ExamType | 'all'>('all');
  const [search, setSearch] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // PDF upload state per card
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('exams')
        .select('id, title, description, year, exam_type, pdf_url, exam_questions(count)')
        .order('year', { ascending: false });

      if (err) throw err;

      const mapped: Exam[] = (data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        year: e.year,
        exam_type: e.exam_type,
        pdf_url: e.pdf_url,
        question_count: e.exam_questions?.[0]?.count ?? 0,
      }));
      setExams(mapped);
    } catch (e: any) {
      setError(e.message || 'Não foi possível carregar as provas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

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
      exam_type: (EXAM_TYPES as readonly string[]).includes(exam.exam_type)
        ? (exam.exam_type as ExamType)
        : 'outro',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Título obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        year: form.year ? parseInt(form.year) : null,
        exam_type: form.exam_type,
      };

      if (editingExam) {
        const { error: err } = await supabase.from('exams').update(payload).eq('id', editingExam.id);
        if (err) throw err;
        toast({ title: 'Prova atualizada' });
      } else {
        const { error: err } = await supabase.from('exams').insert(payload);
        if (err) throw err;
        toast({ title: 'Prova criada' });
      }

      setDialogOpen(false);
      fetchExams();
    } catch (e: any) {
      toast({ title: 'Não foi possível salvar a prova', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exam: Exam) => {
    if (!confirm(`Excluir "${exam.title}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const { error: err } = await supabase.from('exams').delete().eq('id', exam.id);
      if (err) throw err;
      toast({ title: 'Prova excluída' });
      fetchExams();
    } catch (e: any) {
      toast({ title: 'Não foi possível excluir a prova', description: e.message, variant: 'destructive' });
    }
  };

  const handlePdfUpload = async (exam: Exam, file: File) => {
    if (!file.type.includes('pdf')) {
      toast({ title: 'Formato inválido', description: 'Selecione um arquivo PDF.', variant: 'destructive' });
      return;
    }
    setUploading(u => ({ ...u, [exam.id]: true }));
    try {
      const ext = 'pdf';
      const path = `${exam.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('exam_pdfs').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('exam_pdfs').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: dbErr } = await supabase.from('exams').update({ pdf_url: publicUrl }).eq('id', exam.id);
      if (dbErr) throw dbErr;

      toast({ title: 'PDF enviado' });
      fetchExams();
    } catch (e: any) {
      toast({ title: 'Não foi possível enviar o PDF', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(u => ({ ...u, [exam.id]: false }));
    }
  };

  const handleRemovePdf = async (exam: Exam) => {
    if (!confirm('Remover o PDF desta prova?')) return;
    try {
      const { error: err } = await supabase.from('exams').update({ pdf_url: null }).eq('id', exam.id);
      if (err) throw err;
      toast({ title: 'PDF removido' });
      fetchExams();
    } catch (e: any) {
      toast({ title: 'Não foi possível remover o PDF', description: e.message, variant: 'destructive' });
    }
  };

  const filtered = exams.filter(e => {
    const matchType = filter === 'all' || e.exam_type === filter;
    const matchSearch = !search.trim() || (e.title || '').toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="u-label">Carregando provas…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="font-bold text-foreground">Não foi possível carregar as provas</p>
        <p className="text-sm text-muted-foreground break-words max-w-md">{error}</p>
        <Button onClick={fetchExams} variant="outline" className="rounded-control font-bold">
          <RotateCw className="h-4 w-4 mr-2" /> Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><Scroll className="h-3.5 w-3.5" /> Coordenação · provas</p>
          <h1 className="u-page-title text-3xl mt-1">Provas</h1>
          <p className="text-muted-foreground text-sm mt-2"><span className="tabular-nums">{fmtNumber(exams.length, 0, '0')}</span> provas cadastradas</p>
        </div>
        <Button variant="arcade" onClick={openCreate} className="h-11 px-5 rounded-control font-bold shrink-0">
          <Plus className="h-5 w-5 mr-2" /> Nova prova
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar provas..."
            className="pl-9 h-11 rounded-control"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <button
            onClick={() => setFilter('all')}
            aria-pressed={filter === 'all'}
            className={`px-3 py-1.5 rounded-control text-xs font-bold uppercase tracking-wider transition-colors border ${filter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:bg-muted'}`}
          >
            Todas
          </button>
          {EXAM_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              aria-pressed={filter === t}
              className={`px-3 py-1.5 rounded-control text-xs font-bold uppercase tracking-wider transition-colors border ${filter === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:bg-muted'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={exams.length === 0 ? 'Nenhuma prova cadastrada' : 'Nenhuma prova encontrada'}
          description={exams.length === 0
            ? 'Crie a primeira prova ou importe uma edição do ENEM.'
            : 'Tente outra busca ou outro tipo de prova.'}
          action={exams.length === 0
            ? { label: 'Nova prova', icon: Plus, onClick: openCreate }
            : { label: 'Limpar filtros', onClick: () => { setSearch(''); setFilter('all'); } }}
          secondary={exams.length === 0 ? { label: 'Importar ENEM', href: '/dashboard/admin/enem-import' } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(exam => {
            const typeColor = TYPE_COLOR[(EXAM_TYPES as readonly string[]).includes(exam.exam_type) ? exam.exam_type as ExamType : 'outro'];
            const isUploading = uploading[exam.id];
            return (
              <Card key={exam.id} className="rounded-card overflow-hidden">
                <CardContent className="p-5 flex flex-col gap-4 h-full">
                  {/* Type + Year */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={`${typeColor} border-none font-bold text-[10px] uppercase px-3 py-1`}>
                      {exam.exam_type}
                    </Badge>
                    {exam.year && (
                      <span className="u-label tabular-nums">{exam.year}</span>
                    )}
                  </div>

                  {/* Title */}
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-foreground leading-tight break-words">{exam.title}</h3>
                    {exam.description && (
                      <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{exam.description}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{fmtNumber(exam.question_count, 0, '0')}</span> questões
                    </span>
                    {exam.pdf_url ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> PDF disponível
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 font-semibold">
                        <FileText className="h-3.5 w-3.5" /> Sem PDF
                      </span>
                    )}
                  </div>

                  {/* PDF Action */}
                  {exam.pdf_url ? (
                    <div className="flex gap-2">
                      <a
                        href={exam.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full h-10 rounded-control font-bold text-xs">
                          <ExternalLink className="h-4 w-4 mr-1.5" /> Ver PDF
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRefs.current[exam.id]?.click()}
                        disabled={isUploading}
                        className="h-10 w-10 rounded-control text-muted-foreground"
                        title="Substituir PDF" aria-label="Substituir PDF"
                      >
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleRemovePdf(exam)}
                        className="h-10 w-10 rounded-control text-red-500 hover:bg-red-50"
                        title="Remover PDF" aria-label="Remover PDF"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => fileInputRefs.current[exam.id]?.click()}
                      disabled={isUploading}
                      variant="outline"
                      className="w-full h-10 rounded-control font-bold text-xs"
                    >
                      {isUploading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando…</>
                      ) : (
                        <><Upload className="h-4 w-4 mr-2" /> Enviar PDF</>
                      )}
                    </Button>
                  )}

                  {/* Hidden file input */}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    ref={el => { fileInputRefs.current[exam.id] = el; }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handlePdfUpload(exam, file);
                      e.target.value = '';
                    }}
                  />

                  {/* Extrair/reparar imagens do PDF */}
                  {exam.pdf_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/teacher/exams/${exam.id}/images`)}
                      className="w-full h-9 rounded-control text-xs font-bold text-muted-foreground hover:text-foreground"
                    >
                      <ScanSearch className="h-3.5 w-3.5 mr-1.5" /> Extrair imagens do PDF
                    </Button>
                  )}

                  {/* Edit / Delete */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(exam)}
                      className="flex-1 h-9 rounded-control text-xs font-bold"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(exam)}
                      className="flex-1 h-9 rounded-control text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold text-foreground text-xl">
              {editingExam ? 'Editar prova' : 'Nova prova'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label className="u-label">Título</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: ENEM 2023 — 1º Dia"
                className="h-11 rounded-control"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="u-label">Ano</Label>
                <Input
                  type="number"
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  placeholder="2024"
                  className="h-11 rounded-control"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="u-label">Tipo</Label>
                <Select
                  value={form.exam_type}
                  onValueChange={(v) => setForm(f => ({ ...f, exam_type: v as ExamType }))}
                >
                  <SelectTrigger className="h-11 rounded-control">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    {EXAM_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="font-bold uppercase text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="u-label">Descrição (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Caderno de Linguagens e Ciências Humanas"
                className="rounded-control resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-control font-bold">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-control font-bold">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
