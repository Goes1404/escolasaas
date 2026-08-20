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
      toast({ title: 'Gabarito salvo!' });
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
    toast({ title: `✅ ${d.ok} importados${d.err ? ` · ❌ ${d.err} erros` : ''}` });
    setExcelRows([]);
    loadExam(selectedExamId);
    setApplying(false);
  };

  // ── Render helpers ────────────────────────────────────────────
  const pct = (score: number) => exam?.answer_key ? Math.round((score / (exam.answer_key.filter(a=>a).length || TOTAL_Q)) * 100) : null;

  const confColor = (c: string) =>
    c === 'high' ? 'bg-green-100 text-green-700' : c === 'low' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';

  // ── JSX ───────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24 px-1 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl -rotate-3">
          <ClipboardList className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-primary italic leading-none">Correção de Simulado</h1>
          <p className="text-muted-foreground font-medium italic text-sm mt-0.5">Gabarito · Cartão-resposta · Import Excel</p>
        </div>
      </header>

      {/* Exam selector */}
      <Card className="border-none shadow-xl rounded-[2rem]">
        <CardContent className="p-6">
          <Select value={selectedExamId} onValueChange={setSelectedExamId}>
            <SelectTrigger className="h-12 rounded-xl font-bold border-none bg-slate-50 shadow-inner">
              <SelectValue placeholder="Selecione o simulado..." />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-2xl">
              {exams.map(e => (
                <SelectItem key={e.id} value={e.id} className="font-bold">
                  {e.title} {e.year && `· ${e.year}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && exam && (
        <>
          {/* Tab bar */}
          <div className="flex flex-wrap bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl border shadow-sm gap-1">
            {([
              { key: 'gabarito', label: 'Gabarito', icon: Grid3X3 },
              { key: 'lancar', label: 'Lançar Respostas', icon: ClipboardList },
              { key: 'geral', label: 'Visão Geral', icon: BarChart3 },
            ] as const).map(t => (
              <Button key={t.key} variant={tab === t.key ? 'default' : 'ghost'}
                onClick={() => setTab(t.key)}
                className={`rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-5 flex items-center gap-2 ${tab === t.key ? 'bg-primary text-white shadow-lg' : ''}`}>
                <t.icon className="h-4 w-4" /> {t.label}
              </Button>
            ))}
          </div>

          {/* ─── GABARITO ─────────────────────────────────────────── */}
          {tab === 'gabarito' && (
            <Card className="border-none shadow-xl rounded-[2rem]">
              <CardHeader className="px-6 pt-6 pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-primary italic">Gabarito Oficial</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {gabarito.filter(g => g).length}/{TOTAL_Q} questões preenchidas
                    </p>
                  </div>
                  {exam.answer_key && <Badge className="bg-green-100 text-green-700 border-none font-black">✓ Salvo</Badge>}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-10 gap-2">
                  {Array.from({ length: TOTAL_Q }, (_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase">{i + 1}</span>
                      <div className="flex gap-0.5">
                        {OPTS.map(opt => (
                          <button key={opt}
                            onClick={() => setGabarito(prev => { const n = [...prev]; n[i] = prev[i] === opt ? '' : opt; return n; })}
                            className={`h-7 w-7 rounded-lg text-[10px] font-black transition-all ${gabarito[i] === opt ? 'bg-primary text-white shadow-md scale-110' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setGabarito(Array(TOTAL_Q).fill(''))} className="rounded-xl h-10 font-black text-xs border-slate-200">
                    Limpar
                  </Button>
                  <Button onClick={handleSaveGabarito} disabled={savingGabarito} className="bg-primary text-white rounded-xl h-10 font-black text-xs px-6">
                    {savingGabarito ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar Gabarito
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── LANÇAR RESPOSTAS ─────────────────────────────────── */}
          {tab === 'lancar' && (
            <Card className="border-none shadow-xl rounded-[2rem]">
              <CardContent className="p-6 space-y-5">
                {/* Sub-tab bar */}
                <div className="flex flex-wrap bg-slate-50 p-1 rounded-xl gap-1">
                  {([
                    { key: 'score', label: 'Só Acertos' },
                    { key: 'card', label: 'Cartão Completo' },
                    { key: 'excel', label: 'Excel' },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => setSubTab(t.key)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${subTab === t.key ? 'bg-white shadow text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Score only */}
                {subTab === 'score' && (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input placeholder="Buscar aluno..." value={scoreSearch} onChange={e => setScoreSearch(e.target.value)}
                        className="pl-9 h-11 rounded-xl border-none bg-slate-50 font-medium" />
                    </div>
                    {scoreSearch && !scoreStudentId && (
                      <div className="bg-white border border-slate-100 rounded-2xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                        {filteredByScore.slice(0, 10).map(s => (
                          <button key={s.id} onClick={() => { setScoreStudentId(s.id); setScoreStudentName(s.name); setScoreSearch(s.name); }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors text-sm font-bold text-primary border-b border-slate-50 last:border-none">
                            {s.name}
                          </button>
                        ))}
                        {filteredByScore.length === 0 && <p className="px-4 py-3 text-xs text-slate-400 italic">Nenhum aluno encontrado</p>}
                      </div>
                    )}
                    {scoreStudentId && (
                      <div className="flex gap-3 items-end p-4 bg-slate-50 rounded-2xl">
                        <div className="flex-1">
                          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Aluno</p>
                          <p className="font-black text-primary">{scoreStudentName}</p>
                        </div>
                        <div className="w-28">
                          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Acertos</p>
                          <Input type="number" min={0} max={TOTAL_Q} value={scoreValue}
                            onChange={e => setScoreValue(e.target.value)}
                            placeholder={`0–${TOTAL_Q}`}
                            className="h-11 rounded-xl border-none bg-white shadow font-black text-center text-lg" />
                        </div>
                        <Button onClick={handleSaveScore} disabled={savingScore || !scoreValue}
                          className="bg-primary text-white rounded-xl h-11 font-black px-5">
                          {savingScore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" onClick={() => { setScoreStudentId(''); setScoreStudentName(''); setScoreSearch(''); setScoreValue(''); }}
                          className="rounded-xl h-11 text-xs font-black text-slate-400">×</Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Card completo */}
                {subTab === 'card' && (
                  <div className="space-y-4">
                    {!exam.answer_key && (
                      <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <p className="text-sm font-bold text-amber-700">Defina o gabarito na aba "Gabarito" antes de lançar cartões.</p>
                      </div>
                    )}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input placeholder="Buscar aluno..." value={cardSearch} onChange={e => setCardSearch(e.target.value)}
                        className="pl-9 h-11 rounded-xl border-none bg-slate-50 font-medium" />
                    </div>
                    {cardSearch && !cardStudentId && (
                      <div className="bg-white border border-slate-100 rounded-2xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
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
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors text-sm font-bold text-primary border-b border-slate-50 last:border-none">
                            {s.name}
                          </button>
                        ))}
                        {filteredByCard.length === 0 && <p className="px-4 py-3 text-xs text-slate-400 italic">Nenhum aluno encontrado</p>}
                      </div>
                    )}
                    {cardStudentId && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                          <div>
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Aluno</p>
                            <p className="font-black text-primary">{cardStudentName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Acertos calculados</p>
                            <p className="font-black text-2xl text-primary">{cardScore}<span className="text-sm text-slate-400">/{TOTAL_Q}</span></p>
                          </div>
                        </div>

                        <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-10 gap-2">
                          {Array.from({ length: TOTAL_Q }, (_, i) => {
                            const gabAnswer = exam?.answer_key?.[i] || '';
                            const studentAnswer = cardAnswers[i];
                            let rowBg = '';
                            if (studentAnswer && gabAnswer) rowBg = studentAnswer === gabAnswer ? 'bg-green-50' : 'bg-red-50';
                            return (
                              <div key={i} className={`flex flex-col items-center gap-1.5 p-1 rounded-xl transition-colors ${rowBg}`}>
                                <div className="flex items-center justify-between w-full px-0.5">
                                  <span className="text-[9px] font-black text-slate-400">{i + 1}</span>
                                  {gabAnswer && <span className="text-[8px] font-black text-slate-300">={gabAnswer}</span>}
                                </div>
                                <div className="flex gap-0.5 flex-wrap justify-center">
                                  {OPTS.map(opt => (
                                    <button key={opt}
                                      onClick={() => setCardAnswers(prev => { const n = [...prev]; n[i] = prev[i] === opt ? '' : opt; return n; })}
                                      className={`h-7 w-7 rounded-lg text-[10px] font-black transition-all ${cardAnswers[i] === opt
                                        ? gabAnswer && opt === gabAnswer ? 'bg-green-500 text-white shadow-md scale-110'
                                          : gabAnswer ? 'bg-red-400 text-white shadow-md scale-110'
                                            : 'bg-primary text-white shadow-md scale-110'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={() => { setCardStudentId(''); setCardStudentName(''); setCardSearch(''); setCardAnswers(Array(TOTAL_Q).fill('')); }}
                            className="rounded-xl h-10 font-black text-xs">Cancelar</Button>
                          <Button onClick={handleSaveCard} disabled={savingCard || !exam.answer_key}
                            className="bg-primary text-white rounded-xl h-10 font-black text-xs px-6">
                            {savingCard ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Salvar Cartão
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Excel */}
                {subTab === 'excel' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs font-medium text-blue-700 space-y-1">
                      <p className="font-black">Formatos aceitos:</p>
                      <p>• <strong>Simples:</strong> <code>Aluno | Acertos</code> (1 linha por aluno, ex: João Silva | 45)</p>
                      <p>• <strong>Detalhado:</strong> <code>Aluno | Q1 | Q2 | ... | Q60</code> (letra marcada em cada coluna, ex: A | C | B...)</p>
                    </div>

                    {excelRows.length === 0 && (
                      <div
                        className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                        onClick={() => fileRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleExcelUpload(f); }}>
                        {excelLoading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <FileSpreadsheet className="h-10 w-10 text-slate-300" />}
                        <p className="font-black text-sm text-slate-500">{excelLoading ? 'Processando...' : 'Clique ou arraste o arquivo Excel'}</p>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleExcelUpload(f); }} />
                      </div>
                    )}

                    {excelRows.length > 0 && (
                      <>
                        <div className="flex gap-3 text-xs font-black">
                          <span className="text-green-700 bg-green-100 px-3 py-1 rounded-xl">✓ {excelRows.filter(r => r.confidence === 'high').length} confirmados</span>
                          <span className="text-amber-700 bg-amber-100 px-3 py-1 rounded-xl">⚠ {excelRows.filter(r => r.confidence === 'low').length} parciais</span>
                          <span className="text-red-600 bg-red-100 px-3 py-1 rounded-xl">✗ {excelRows.filter(r => r.confidence === 'none').length} sem match</span>
                        </div>

                        <div className="overflow-auto rounded-2xl border border-slate-100">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-3 text-left font-black text-slate-500 uppercase tracking-widest">Planilha</th>
                                <th className="px-4 py-3 text-left font-black text-slate-500 uppercase tracking-widest">Cadastro</th>
                                <th className="px-4 py-3 text-center font-black text-slate-500 uppercase tracking-widest">Tipo</th>
                                <th className="px-4 py-3 text-center font-black text-slate-500 uppercase tracking-widest">Acertos</th>
                                <th className="px-4 py-3 text-center font-black text-slate-500 uppercase tracking-widest">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {excelRows.map((r, i) => (
                                <tr key={i} className={r.confidence === 'none' ? 'opacity-40' : ''}>
                                  <td className="px-4 py-2.5 font-medium text-primary">{r.name}</td>
                                  <td className="px-4 py-2.5 text-slate-600">{r.matchedName || '—'}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <Badge className="text-[9px] font-black bg-slate-100 text-slate-600 border-none">
                                      {r.isDetailed ? 'Detalhado' : 'Simples'}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2.5 text-center font-black text-primary">
                                    {r.isDetailed && exam?.answer_key
                                      ? `${r.answers!.filter((a, idx) => a && a === (exam.answer_key![idx] || '')).length}/${exam.answer_key.filter(a=>a).length}`
                                      : r.score ?? '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <Badge className={`text-[9px] font-black border-none ${confColor(r.confidence)}`}>
                                      {r.confidence === 'high' ? '✓' : r.confidence === 'low' ? '⚠' : '✗'}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex justify-between gap-3">
                          <Button variant="outline" onClick={() => { setExcelRows([]); if (fileRef.current) fileRef.current.value = ''; }} className="rounded-xl h-10 font-black text-xs">
                            Cancelar
                          </Button>
                          <Button onClick={handleApplyExcel} disabled={applying} className="bg-primary text-white rounded-xl h-10 font-black text-xs px-6">
                            {applying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Confirmar {excelRows.filter(r => r.confidence !== 'none').length} Alunos
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
            <Card className="border-none shadow-xl rounded-[2rem]">
              <CardHeader className="px-6 pt-6 pb-2">
                <div className="flex items-center justify-between">
                  <p className="font-black text-primary italic">{attempts.length} alunos registrados</p>
                  <Badge className={`font-black border-none ${exam.answer_key ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {exam.answer_key ? `Gabarito: ${exam.answer_key.filter(a=>a).length} questões` : 'Sem gabarito'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {attempts.length === 0 && (
                  <p className="text-center py-12 text-slate-400 italic text-sm">Nenhum resultado registrado ainda.</p>
                )}
                {attempts.map(a => {
                  const p = pct(a.score);
                  const hasCard = a.answers?.length > 0;
                  const isOpen = expandedAttempt === a.user_id;
                  return (
                    <div key={a.user_id} className="bg-slate-50 rounded-2xl overflow-hidden">
                      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-100 transition-colors"
                        onClick={() => setExpandedAttempt(isOpen ? null : a.user_id)}>
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black ${p !== null && p >= 60 ? 'bg-green-100 text-green-700' : p !== null && p >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                            {p !== null ? `${p}%` : '?'}
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-sm text-primary">{a.profile?.name || 'Aluno'}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{a.score} acertos {hasCard ? '· cartão completo' : '· só total'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasCard ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : null}
                          {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </div>
                      </button>

                      {isOpen && hasCard && exam.answer_key && (
                        <div className="px-4 pb-4">
                          <div className="grid grid-cols-10 sm:grid-cols-15 gap-1">
                            {exam.answer_key.map((correct, i) => {
                              const ans = a.answers?.find(x => x.q === i + 1);
                              const selected = ans?.selected || '';
                              const right = correct && selected && selected.toUpperCase() === correct.toUpperCase();
                              const wrong = correct && selected && !right;
                              return (
                                <div key={i} className={`flex flex-col items-center p-1 rounded-lg text-[9px] font-black ${right ? 'bg-green-100 text-green-700' : wrong ? 'bg-red-100 text-red-600' : 'bg-white text-slate-300'}`}>
                                  <span className="opacity-50">{i + 1}</span>
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
