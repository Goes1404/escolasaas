'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Upload, ClipboardList, Grid3X3, FileSpreadsheet, Search, Save, ChevronDown, ChevronUp, BarChart3, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { EmptyState } from '@/components/EmptyState';

const TOTAL_Q = 60;
const OPTS = ['A', 'B', 'C', 'D', 'E'];

type Exam = { id: string; title: string; year: number; answer_key: string[] | null };
type Attempt = { id: string; user_id: string; score: number; answers: { q: number; selected: string }[]; completed_at: string; profile: { name: string } | null };
type ExcelRow = { name: string; userId: string | null; matchedName: string | null; confidence: 'high' | 'low' | 'none'; score: number | null; answers: string[] | null; isDetailed: boolean };

export default function SimuladoCorrecaoPage() {
  const { toast } = useToast();

  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'gabarito' | 'lancar' | 'geral'>('gabarito');
  const [subTab, setSubTab] = useState<'score' | 'card' | 'excel'>('score');

  // Gabarito state
  const [gabarito, setGabarito] = useState<string[]>(Array(TOTAL_Q).fill(''));
  const [savingGabarito, setSavingGabarito] = useState(false);

  // Score-only state
  const [scoreSearch, setScoreSearch] = useState('');
  const [scoreStudentId, setScoreStudentId] = useState('');
  const [scoreStudentName, setScoreStudentName] = useState('');
  const [scoreValue, setScoreValue] = useState('');
  const [savingScore, setSavingScore] = useState(false);

  // Card state
  const [cardSearch, setCardSearch] = useState('');
  const [cardStudentId, setCardStudentId] = useState('');
  const [cardStudentName, setCardStudentName] = useState('');
  const [cardAnswers, setCardAnswers] = useState<string[]>(Array(TOTAL_Q).fill(''));
  const [savingCard, setSavingCard] = useState(false);
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);

  // Excel state
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Students derived from attempts (for search)
  const [allStudents, setAllStudents] = useState<{ id: string; name: string }[]>([]);

  // Load exams list
  useEffect(() => {
    fetch('/api/teacher/simulado-correcao').then(r => r.json()).then(d => setExams(d.exams || []));
  }, []);

  // Load exam detail when selected
  const loadExam = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/teacher/simulado-correcao?examId=${id}`);
      const d = await r.json();
      setExam(d.exam);
      setAttempts(d.attempts || []);
      setGabarito(d.exam?.answer_key || Array(TOTAL_Q).fill(''));
      // Build student list from attempts
      const students = (d.attempts || []).map((a: Attempt) => ({ id: a.user_id, name: a.profile?.name || 'Aluno' }));
      setAllStudents(students);
    } catch (e) {
      console.error('Erro ao carregar simulado:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (selectedExamId) loadExam(selectedExamId); }, [selectedExamId, loadExam]);

  // ── Gabarito ──────────────────────────────────────────────────
  const handleSaveGabarito = async () => {
    const filled = gabarito.filter(g => g).length;
    if (filled < TOTAL_Q) {
      const confirmed = window.confirm(`Apenas ${filled}/${TOTAL_Q} questões preenchidas. Salvar assim mesmo?`);
      if (!confirmed) return;
    }
    setSavingGabarito(true);
    const r = await fetch('/api/teacher/simulado-correcao', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_gabarito', examId: selectedExamId, answerKey: gabarito }),
    });
    const d = await r.json();
    if (d.success) {
      toast({ title: 'Gabarito salvo' });
      setExam(prev => prev ? { ...prev, answer_key: gabarito } : prev);
    } else toast({ title: 'Erro', description: d.error, variant: 'destructive' });
    setSavingGabarito(false);
  };

  // ── Score only ────────────────────────────────────────────────
  const filteredByScore = allStudents.filter(s => s.name.toLowerCase().includes(scoreSearch.toLowerCase()));

  const handleSaveScore = async () => {
    if (!scoreStudentId || !scoreValue) return;
    setSavingScore(true);
    const r = await fetch('/api/teacher/simulado-correcao', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_score', examId: selectedExamId, userId: scoreStudentId, score: Number(scoreValue) }),
    });
    const d = await r.json();
    if (d.success) {
      toast({ title: `Nota salva — ${scoreStudentName}: ${scoreValue} acertos` });
      setScoreStudentId(''); setScoreStudentName(''); setScoreValue(''); setScoreSearch('');
      loadExam(selectedExamId);
    } else toast({ title: 'Erro', description: d.error, variant: 'destructive' });
    setSavingScore(false);
  };

  // ── Card ──────────────────────────────────────────────────────
  const filteredByCard = allStudents.filter(s => s.name.toLowerCase().includes(cardSearch.toLowerCase()));
  const cardScore = cardAnswers.filter((a, i) => a && (exam?.answer_key?.[i] || '') && a.toUpperCase() === (exam?.answer_key?.[i] || '').toUpperCase()).length;

  const handleSaveCard = async () => {
    if (!cardStudentId) return;
    if (!exam?.answer_key) { toast({ title: 'Defina o gabarito primeiro', variant: 'destructive' }); return; }
    setSavingCard(true);
    const r = await fetch('/api/teacher/simulado-correcao', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_card', examId: selectedExamId, userId: cardStudentId, selected: cardAnswers, answerKey: exam.answer_key }),
    });
    const d = await r.json();
    if (d.success) {
      toast({ title: `Cartão salvo — ${cardStudentName}: ${d.score} acertos` });
      setCardStudentId(''); setCardStudentName(''); setCardAnswers(Array(TOTAL_Q).fill('')); setCardSearch('');
      loadExam(selectedExamId);
    } else toast({ title: 'Erro', description: d.error, variant: 'destructive' });
    setSavingCard(false);
  };

  // ── Excel ─────────────────────────────────────────────────────
  const handleExcelUpload = async (file: File) => {
    setExcelLoading(true);
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab);
    const rows: string[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as string[][];
    const nonAttrRows = rows.filter(r => r && r.length > 0);

    const r = await fetch('/api/teacher/simulado-correcao', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'excel_preview', rows: nonAttrRows }),
    });
    const d = await r.json();
    setExcelRows(d.results || []);
    setExcelLoading(false);
  };

  const handleApplyExcel = async () => {
    const valid = excelRows.filter(r => r.userId && r.confidence !== 'none');
    if (!valid.length) { toast({ title: 'Nenhum aluno válido para importar', variant: 'destructive' }); return; }
    setApplying(true);
    const entries = valid.map(r => ({ userId: r.userId!, score: r.score, answers: r.answers }));
    const r = await fetch('/api/teacher/simulado-correcao', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'excel_apply', examId: selectedExamId, answerKey: exam?.answer_key ?? null, entries }),
    });
    const d = await r.json();
    toast({ title: `${d.ok ?? 0} alunos importados${d.err ? ` · ${d.err} com erro` : ''}` });
    setExcelRows([]);
    loadExam(selectedExamId);
    setApplying(false);
  };

  // ── Render helpers ────────────────────────────────────────────
  const pct = (score: number) => exam?.answer_key ? Math.round((score / (exam.answer_key.filter(a=>a).length || TOTAL_Q)) * 100) : null;

  const confColor = (c: string) =>
    c === 'high' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c === 'low' ? 'bg-brand-yellow/30 text-foreground border-foreground/15' : 'bg-red-50 text-red-700 border-red-200';
  const confLabel = (c: string) => (c === 'high' ? 'Confirmado' : c === 'low' ? 'Parcial' : 'Não encontrado');
  const excelScore = (r: ExcelRow) =>
    r.isDetailed && exam?.answer_key
      ? `${(r.answers ?? []).filter((a, idx) => a && a === (exam.answer_key![idx] || '')).length}/${exam.answer_key.filter(a => a).length}`
      : r.score ?? '—';

  // Botão de alternativa: cor só como sinal (verde = acerto, vermelho = erro).
  const optBtn = 'h-8 w-8 rounded-control text-xs font-bold transition-colors';
  const optIdle = 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground';

  // ── JSX ───────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-1">
      {/* Cabeçalho */}
      <header className="min-w-0">
        <p className="u-label flex items-center gap-2"><ClipboardList className="h-3.5 w-3.5" /> Professor · correção</p>
        <h1 className="u-page-title text-3xl mt-1">Correção de simulado</h1>
        <p className="text-sm text-muted-foreground mt-1">Gabarito, cartão-resposta e importação de planilha.</p>
      </header>

      {/* Seletor de simulado */}
      <Card className="rounded-card">
        <CardContent className="p-4 md:p-6">
          <p className="u-label mb-2">Simulado</p>
          <Select value={selectedExamId} onValueChange={setSelectedExamId}>
            <SelectTrigger className="h-11 rounded-control font-semibold">
              <SelectValue placeholder="Selecione o simulado..." />
            </SelectTrigger>
            <SelectContent className="rounded-control">
              {exams.map(e => (
                <SelectItem key={e.id} value={e.id} className="font-semibold">
                  {e.title} {e.year && `· ${e.year}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !exam && !selectedExamId && (
        <EmptyState
          icon={ClipboardList}
          title="Escolha um simulado para corrigir"
          description="Selecione acima o simulado. Depois você define o gabarito e lança as respostas dos alunos."
        />
      )}

      {!loading && exam && (
        <>
          {/* Abas */}
          <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-control" role="tablist">
            {([
              { key: 'gabarito', label: 'Gabarito', icon: Grid3X3 },
              { key: 'lancar', label: 'Lançar respostas', icon: ClipboardList },
              { key: 'geral', label: 'Visão geral', icon: BarChart3 },
            ] as const).map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-control font-semibold text-xs sm:text-sm min-h-10 px-2 sm:px-4 py-2 flex items-center justify-center gap-2 transition-colors ${tab === t.key ? 'bg-background text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                <t.icon className="h-4 w-4 shrink-0 hidden sm:block" /> {t.label}
              </button>
            ))}
          </div>

          {/* ─── GABARITO ─────────────────────────────────────────── */}
          {tab === 'gabarito' && (
            <Card className="rounded-card">
              <CardHeader className="px-4 md:px-6 pt-5 pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-base text-foreground">Gabarito oficial</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="tabular-nums">{gabarito.filter(g => g).length}/{TOTAL_Q}</span> questões preenchidas
                    </p>
                  </div>
                  {exam.answer_key && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">Salvo</Badge>}
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-5">
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                  {Array.from({ length: TOTAL_Q }, (_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 text-right text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                      <div className="flex gap-1">
                        {OPTS.map(opt => (
                          <button key={opt}
                            aria-label={`Questão ${i + 1}, alternativa ${opt}`}
                            aria-pressed={gabarito[i] === opt}
                            onClick={() => setGabarito(prev => { const n = [...prev]; n[i] = prev[i] === opt ? '' : opt; return n; })}
                            className={`${optBtn} ${gabarito[i] === opt ? 'bg-primary text-primary-foreground' : optIdle}`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setGabarito(Array(TOTAL_Q).fill(''))} className="rounded-control h-11 font-bold text-sm">
                    Limpar
                  </Button>
                  <Button variant="arcade" onClick={handleSaveGabarito} disabled={savingGabarito} className="rounded-control h-11 font-bold text-sm px-6">
                    {savingGabarito ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar gabarito
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── LANÇAR RESPOSTAS ─────────────────────────────────── */}
          {tab === 'lancar' && (
            <Card className="rounded-card">
              <CardContent className="p-4 md:p-6 space-y-5">
                {/* Sub-abas */}
                <div className="grid grid-cols-3 bg-muted p-1 rounded-control gap-1">
                  {([
                    { key: 'score', label: 'Só acertos' },
                    { key: 'card', label: 'Cartão completo' },
                    { key: 'excel', label: 'Planilha' },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => setSubTab(t.key)}
                      className={`py-2 rounded-control text-xs sm:text-sm font-semibold transition-colors ${subTab === t.key ? 'bg-background text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Só acertos */}
                {subTab === 'score' && (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar aluno..." value={scoreSearch} onChange={e => setScoreSearch(e.target.value)}
                        className="pl-9 h-11 rounded-control" />
                    </div>
                    {scoreSearch && !scoreStudentId && (
                      <div className="bg-card border border-border rounded-control overflow-hidden max-h-48 overflow-y-auto">
                        {filteredByScore.slice(0, 10).map(s => (
                          <button key={s.id} onClick={() => { setScoreStudentId(s.id); setScoreStudentName(s.name); setScoreSearch(s.name); }}
                            className="w-full text-left px-4 py-3 hover:bg-muted transition-colors text-sm font-semibold text-foreground border-b border-border last:border-none">
                            {s.name}
                          </button>
                        ))}
                        {filteredByScore.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum aluno encontrado com esse nome.</p>}
                      </div>
                    )}
                    {scoreStudentId && (
                      <div className="flex flex-wrap gap-3 items-end p-4 rounded-control border border-border">
                        <div className="flex-1 min-w-[140px]">
                          <p className="u-label mb-1">Aluno</p>
                          <p className="font-semibold text-foreground">{scoreStudentName}</p>
                        </div>
                        <div className="w-28">
                          <p className="u-label mb-1">Acertos</p>
                          <Input type="number" min={0} max={TOTAL_Q} value={scoreValue}
                            onChange={e => setScoreValue(e.target.value)}
                            placeholder={`0–${TOTAL_Q}`}
                            className="h-11 rounded-control font-bold text-center text-lg tabular-nums" />
                        </div>
                        <Button onClick={handleSaveScore} disabled={savingScore || !scoreValue} aria-label="Salvar nota"
                          className="rounded-control h-11 font-bold px-5">
                          {savingScore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" aria-label="Cancelar" onClick={() => { setScoreStudentId(''); setScoreStudentName(''); setScoreSearch(''); setScoreValue(''); }}
                          className="rounded-control h-11 text-sm font-bold text-muted-foreground">×</Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Cartão completo */}
                {subTab === 'card' && (
                  <div className="space-y-4">
                    {!exam.answer_key && (
                      <div className="flex items-center gap-3 p-4 bg-brand-yellow/25 rounded-control border border-foreground/15">
                        <AlertTriangle className="h-5 w-5 text-foreground shrink-0" />
                        <p className="text-sm font-semibold text-foreground">Defina o gabarito na aba "Gabarito" antes de lançar cartões.</p>
                      </div>
                    )}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar aluno..." value={cardSearch} onChange={e => setCardSearch(e.target.value)}
                        className="pl-9 h-11 rounded-control" />
                    </div>
                    {cardSearch && !cardStudentId && (
                      <div className="bg-card border border-border rounded-control overflow-hidden max-h-48 overflow-y-auto">
                        {filteredByCard.slice(0, 10).map(s => (
                          <button key={s.id} onClick={() => {
                            setCardStudentId(s.id); setCardStudentName(s.name); setCardSearch(s.name);
                            // Pre-fill existing answers if available
                            const existing = attempts.find(a => a.user_id === s.id);
                            if (existing?.answers?.length) {
                              const filled = Array(TOTAL_Q).fill('');
                              existing.answers.forEach((a: { q: number; selected: string }) => { if (a.q >= 1 && a.q <= TOTAL_Q) filled[a.q - 1] = a.selected; });
                              setCardAnswers(filled);
                            } else { setCardAnswers(Array(TOTAL_Q).fill('')); }
                          }}
                            className="w-full text-left px-4 py-3 hover:bg-muted transition-colors text-sm font-semibold text-foreground border-b border-border last:border-none">
                            {s.name}
                          </button>
                        ))}
                        {filteredByCard.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum aluno encontrado com esse nome.</p>}
                      </div>
                    )}
                    {cardStudentId && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3 p-4 rounded-control border border-border">
                          <div className="min-w-0">
                            <p className="u-label">Aluno</p>
                            <p className="font-semibold text-foreground truncate">{cardStudentName}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="u-label">Acertos</p>
                            <p className="u-num text-2xl text-foreground">{cardScore}<span className="text-sm text-muted-foreground">/{TOTAL_Q}</span></p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
                          {Array.from({ length: TOTAL_Q }, (_, i) => {
                            const gabAnswer = exam?.answer_key?.[i] || '';
                            const studentAnswer = cardAnswers[i];
                            let rowBg = '';
                            if (studentAnswer && gabAnswer) rowBg = studentAnswer === gabAnswer ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10';
                            return (
                              <div key={i} className={`flex items-center gap-2 p-1 rounded-control transition-colors ${rowBg}`}>
                                <span className="w-6 text-right text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                                <div className="flex gap-1">
                                  {OPTS.map(opt => (
                                    <button key={opt}
                                      aria-label={`Questão ${i + 1}, alternativa ${opt}`}
                                      aria-pressed={cardAnswers[i] === opt}
                                      onClick={() => setCardAnswers(prev => { const n = [...prev]; n[i] = prev[i] === opt ? '' : opt; return n; })}
                                      className={`${optBtn} ${cardAnswers[i] === opt
                                        ? gabAnswer && opt === gabAnswer ? 'bg-emerald-600 text-white'
                                          : gabAnswer ? 'bg-red-600 text-white'
                                            : 'bg-primary text-primary-foreground'
                                        : optIdle}`}>
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                                {gabAnswer && <span className="text-[11px] font-semibold text-muted-foreground" title="Resposta do gabarito">={gabAnswer}</span>}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                          <Button variant="outline" onClick={() => { setCardStudentId(''); setCardStudentName(''); setCardSearch(''); setCardAnswers(Array(TOTAL_Q).fill('')); }}
                            className="rounded-control h-11 font-bold text-sm">Cancelar</Button>
                          <Button onClick={handleSaveCard} disabled={savingCard || !exam.answer_key}
                            className="rounded-control h-11 font-bold text-sm px-6">
                            {savingCard ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Salvar cartão
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Planilha */}
                {subTab === 'excel' && (
                  <div className="space-y-4">
                    <div className="rounded-control border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-1">
                      <p className="font-bold text-foreground">Formatos aceitos:</p>
                      <p>• <strong className="text-foreground">Simples:</strong> <code>Aluno | Acertos</code> (1 linha por aluno, ex.: João Silva | 45)</p>
                      <p>• <strong className="text-foreground">Detalhado:</strong> <code>Aluno | Q1 | Q2 | ... | Q60</code> (letra marcada em cada coluna, ex.: A | C | B...)</p>
                    </div>

                    {excelRows.length === 0 && (
                      <div
                        className="border-2 border-dashed border-border rounded-card p-8 sm:p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                        onClick={() => fileRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleExcelUpload(f); }}>
                        {excelLoading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />}
                        <p className="font-semibold text-sm text-muted-foreground text-center">{excelLoading ? 'Processando...' : 'Toque ou arraste a planilha do Excel'}</p>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleExcelUpload(f); }} />
                      </div>
                    )}

                    {excelRows.length > 0 && (
                      <>
                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-control">{excelRows.filter(r => r.confidence === 'high').length} confirmados</span>
                          <span className="text-foreground bg-brand-yellow/30 border border-foreground/15 px-3 py-1 rounded-control">{excelRows.filter(r => r.confidence === 'low').length} parciais</span>
                          <span className="text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-control">{excelRows.filter(r => r.confidence === 'none').length} não encontrados</span>
                        </div>

                        {/* Celular: cartões empilhados */}
                        <div className="sm:hidden space-y-2">
                          {excelRows.map((r, i) => (
                            <div key={i} className={`rounded-control border border-border p-3 ${r.confidence === 'none' ? 'opacity-50' : ''}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">Cadastro: {r.matchedName || '—'}</p>
                                </div>
                                <Badge variant="outline" className={`text-[11px] font-bold shrink-0 ${confColor(r.confidence)}`}>{confLabel(r.confidence)}</Badge>
                              </div>
                              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                <span>{r.isDetailed ? 'Detalhado' : 'Simples'}</span>
                                <span>Acertos: <span className="u-num text-sm text-foreground">{excelScore(r)}</span></span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="hidden sm:block overflow-auto rounded-control border border-border">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="px-4 py-3 text-left u-label font-normal">Planilha</th>
                                <th className="px-4 py-3 text-left u-label font-normal">Cadastro</th>
                                <th className="px-4 py-3 text-center u-label font-normal">Tipo</th>
                                <th className="px-4 py-3 text-center u-label font-normal">Acertos</th>
                                <th className="px-4 py-3 text-center u-label font-normal">Situação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {excelRows.map((r, i) => (
                                <tr key={i} className={r.confidence === 'none' ? 'opacity-50' : ''}>
                                  <td className="px-4 py-2.5 font-semibold text-foreground">{r.name}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground">{r.matchedName || '—'}</td>
                                  <td className="px-4 py-2.5 text-center text-muted-foreground">
                                    {r.isDetailed ? 'Detalhado' : 'Simples'}
                                  </td>
                                  <td className="px-4 py-2.5 text-center u-num text-sm text-foreground">
                                    {excelScore(r)}
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <Badge variant="outline" className={`text-[11px] font-bold ${confColor(r.confidence)}`}>
                                      {confLabel(r.confidence)}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
                          <Button variant="outline" onClick={() => { setExcelRows([]); if (fileRef.current) fileRef.current.value = ''; }} className="rounded-control h-11 font-bold text-sm">
                            Cancelar
                          </Button>
                          <Button onClick={handleApplyExcel} disabled={applying} className="rounded-control h-11 font-bold text-sm px-6">
                            {applying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Confirmar {excelRows.filter(r => r.confidence !== 'none').length} alunos
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── VISÃO GERAL ──────────────────────────────────────── */}
          {tab === 'geral' && (
            <Card className="rounded-card">
              <CardHeader className="px-4 md:px-6 pt-5 pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-base text-foreground"><span className="u-num">{attempts.length}</span> alunos com resultado</p>
                  <Badge variant="outline" className={`font-bold ${exam.answer_key ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-brand-yellow/30 text-foreground border-foreground/15'}`}>
                    {exam.answer_key ? `Gabarito: ${exam.answer_key.filter(a=>a).length} questões` : 'Sem gabarito'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {attempts.length === 0 && (
                  <EmptyState
                    compact
                    icon={BarChart3}
                    title="Nenhum resultado lançado ainda"
                    description="Lance as notas ou os cartões-resposta dos alunos e eles aparecem aqui."
                    action={{ label: "Lançar respostas", onClick: () => setTab('lancar') }}
                  />
                )}
                {attempts.map(a => {
                  const p = pct(a.score);
                  const hasCard = a.answers?.length > 0;
                  const isOpen = expandedAttempt === a.user_id;
                  return (
                    <div key={a.user_id} className="rounded-control border border-border overflow-hidden">
                      <button className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedAttempt(isOpen ? null : a.user_id)}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-9 min-w-[44px] px-1 rounded-control flex items-center justify-center text-xs font-bold tabular-nums shrink-0 ${p !== null && p >= 60 ? 'bg-emerald-50 text-emerald-700' : p !== null && p >= 40 ? 'bg-brand-yellow/30 text-foreground' : 'bg-red-50 text-red-700'}`}>
                            {p !== null ? `${p}%` : '?'}
                          </div>
                          <div className="text-left min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{a.profile?.name || 'Aluno'}</p>
                            <p className="text-xs text-muted-foreground">{a.score ?? 0} acertos {hasCard ? '· cartão completo' : '· só total'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {hasCard ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Cartão completo" /> : null}
                          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {isOpen && hasCard && exam.answer_key && (
                        <div className="px-4 pb-4">
                          <div className="grid grid-cols-6 min-[420px]:grid-cols-10 sm:grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
                            {exam.answer_key.map((correct, i) => {
                              const ans = a.answers?.find(x => x.q === i + 1);
                              const selected = ans?.selected || '';
                              const right = correct && selected && selected.toUpperCase() === correct.toUpperCase();
                              const wrong = correct && selected && !right;
                              return (
                                <div key={i} className={`flex flex-col items-center p-1 rounded-md text-[10px] font-bold ${right ? 'bg-emerald-50 text-emerald-700' : wrong ? 'bg-red-50 text-red-700' : 'bg-muted/50 text-muted-foreground'}`}>
                                  <span className="opacity-60 tabular-nums">{i + 1}</span>
                                  <span>{selected || '–'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
