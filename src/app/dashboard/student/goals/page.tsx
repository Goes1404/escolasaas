'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/app/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Target, Plus, Trash2, CheckCircle2, Loader2, TrendingUp, Calendar, Trophy } from 'lucide-react';

type Goal = {
  id: string;
  title: string;
  goal_type: 'questions' | 'essays' | 'simulados' | 'hours' | 'custom';
  target_value: number;
  current_value: number;
  period: 'daily' | 'weekly' | 'monthly' | 'custom';
  status: 'active' | 'completed' | 'abandoned';
  deadline: string | null;
  created_at: string;
  completed_at: string | null;
};

const TYPE_LABEL: Record<Goal['goal_type'], string> = {
  questions: 'Questões',
  essays: 'Redações',
  simulados: 'Simulados',
  hours: 'Horas de estudo',
  custom: 'Personalizada',
};

const PERIOD_LABEL: Record<Goal['period'], string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  custom: 'Personalizada',
};

export default function GoalsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [totalXp, setTotalXp] = useState(0);

  const [form, setForm] = useState({
    title: '',
    goal_type: 'questions' as Goal['goal_type'],
    target_value: 20,
    period: 'daily' as Goal['period'],
    deadline: '',
  });

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    async function fetchStats() {
      const { data: prof } = await supabase
        .from('profiles')
        .select('current_streak')
        .eq('id', userId)
        .maybeSingle();
      if (prof) setStreak(prof.current_streak ?? 0);

      const { data: xpData } = await supabase
        .from('student_xp_log')
        .select('xp_earned')
        .eq('student_id', userId);
      
      if (xpData) {
        const total = xpData.reduce((acc, curr) => acc + curr.xp_earned, 0);
        setTotalXp(total);
        let calculatedLevel = 1;
        if (total >= 7000) calculatedLevel = 5;
        else if (total >= 3500) calculatedLevel = 4;
        else if (total >= 1500) calculatedLevel = 3;
        else if (total >= 500) calculatedLevel = 2;
        setLevel(calculatedLevel);
      }
    }
    fetchStats();
  }, [user]);

  const downloadCertificate = () => {
    if (!user) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1130;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 1600, 1130);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1600, 1130);

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 15;
    ctx.strokeRect(40, 40, 1520, 1050);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(55, 55, 1490, 1020);

    ctx.fillStyle = 'rgba(217, 119, 6, 0.05)';
    ctx.beginPath();
    ctx.arc(800, 565, 400, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold italic 40px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('PLATAFORMA', 800, 180);
    ctx.font = '900 14px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('SISTEMA DE ENSINO', 800, 210);

    ctx.font = 'italic 900 65px Georgia';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('CERTIFICADO DE ENGAJAMENTO', 800, 360);

    ctx.fillStyle = '#d97706';
    ctx.fillRect(650, 400, 300, 3);

    const studentName = (profile?.name || user.user_metadata?.full_name || 'Estudante').toUpperCase();
    
    ctx.font = 'normal 24px Arial';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Certificamos com honra que o estudante', 800, 480);

    ctx.font = 'bold italic 50px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(studentName, 800, 560);

    ctx.font = 'normal 24px Arial';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('demonstrou excelente dedicação e compromisso acadêmico, alcançando a marca de', 800, 640);

    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`${streak} dias consecutivos de estudos (Streak 🔥) e acumulando um total de ${totalXp} XP.`, 800, 700);

    const dateStr = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    ctx.font = 'italic 20px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Emitido em ${dateStr} • Plataforma EAD`, 800, 840);

    ctx.font = 'italic 28px Georgia';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Equipe da Plataforma', 800, 930);
    ctx.fillRect(700, 950, 200, 1);
    ctx.font = 'normal 16px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Direção Pedagógica', 800, 975);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Certificado-Engajamento-${studentName.replace(/\s+/g, '-')}.png`;
    link.href = dataUrl;
    link.click();

    toast({
      title: "Certificado Emitido! 🏆",
      description: "O arquivo PNG de alta resolução foi baixado com sucesso."
    });
  };

  const loadGoals = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('student_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setGoals((data ?? []) as Goal[]);
    setLoading(false);
  };

  useEffect(() => { loadGoals(); }, [user]);

  const handleCreate = async () => {
    if (!user) return;
    if (!form.title.trim()) {
      toast({ title: 'Título obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('student_goals').insert({
        user_id: user.id,
        title: form.title.trim(),
        goal_type: form.goal_type,
        target_value: form.target_value,
        period: form.period,
        deadline: form.period === 'custom' && form.deadline ? form.deadline : null,
      });
      if (error) throw error;
      toast({ title: 'Meta criada! 🎯', description: 'Sua nova meta foi adicionada.' });
      setOpenCreate(false);
      setForm({ title: '', goal_type: 'questions', target_value: 20, period: 'daily', deadline: '' });
      loadGoals();
    } catch (e: any) {
      toast({ title: 'Erro ao criar meta', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta meta?')) return;
    const { error } = await supabase.from('student_goals').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Meta excluída' });
      loadGoals();
    }
  };

  const handleComplete = async (id: string) => {
    const { error } = await supabase
      .from('student_goals')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      toast({ title: 'Meta concluída! 🏆', description: 'Parabéns pela conquista.' });
      loadGoals();
    }
  };

  const handleProgress = async (g: Goal, delta: number) => {
    const next = Math.max(0, Math.min(g.target_value, g.current_value + delta));
    const isDone = next >= g.target_value;
    const { error } = await supabase
      .from('student_goals')
      .update({
        current_value: next,
        status: isDone ? 'completed' : 'active',
        completed_at: isDone ? new Date().toISOString() : null,
      })
      .eq('id', g.id);
    if (!error) loadGoals();
  };

  const active = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto px-2 md:px-4 pb-20 space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black italic text-primary leading-none">Minhas Metas</h1>
          <p className="text-muted-foreground font-medium italic mt-1">Defina objetivos claros, alcance-os com constância.</p>
        </div>
        <Button
          onClick={() => setOpenCreate(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 rounded-2xl shadow-lg shadow-emerald-200 border-none px-6"
        >
          <Plus className="h-4 w-4 mr-2" /> Nova Meta
        </Button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="bg-white rounded-2xl p-3 md:p-4 border border-slate-100 shadow-md">
          <Target className="h-4 w-4 text-emerald-600 mb-1.5" />
          <p className="text-xl md:text-2xl font-black text-primary">{active.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ativas</p>
        </div>
        <div className="bg-white rounded-2xl p-3 md:p-4 border border-slate-100 shadow-md">
          <Trophy className="h-4 w-4 text-amber-600 mb-1.5" />
          <p className="text-xl md:text-2xl font-black text-primary">{completed.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Concluídas</p>
        </div>
        <div className="bg-white rounded-2xl p-3 md:p-4 border border-slate-100 shadow-md">
          <TrendingUp className="h-4 w-4 text-violet-600 mb-1.5" />
          <p className="text-xl md:text-2xl font-black text-primary">{goals.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
        </div>
      </div>

      {/* ACTIVE GOALS */}
      <section>
        <h2 className="text-sm font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Em andamento
        </h2>
        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map(i => <div key={i} className="h-32 bg-muted/20 rounded-2xl animate-pulse" />)}
          </div>
        ) : active.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-emerald-200 rounded-3xl bg-emerald-50/30">
            <Target className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <p className="font-black text-emerald-700 italic">Nenhuma meta ativa</p>
            <p className="text-xs text-emerald-600/70 mt-1">Crie uma para começar a se desafiar.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {active.map(g => {
              const pct = Math.min(100, Math.round((g.current_value / Math.max(1, g.target_value)) * 100));
              return (
                <div key={g.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-primary italic text-base">{g.title}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {TYPE_LABEL[g.goal_type]}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" /> {PERIOD_LABEL[g.period]}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="h-10 w-10 min-w-[40px] rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-600 active:scale-90 transition-all flex items-center justify-center text-slate-400"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <span>Progresso</span>
                      <span className="text-emerald-700">{g.current_value} / {g.target_value} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-2 rounded-full bg-slate-100" />
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleProgress(g, -1)}
                      disabled={g.current_value === 0}
                      className="h-11 rounded-xl text-sm font-black border-slate-200 flex-1 active:scale-95"
                    >
                      –
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleProgress(g, 1)}
                      className="h-11 rounded-xl text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white flex-1 active:scale-95"
                    >
                      +1
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleComplete(g.id)}
                      className="h-11 rounded-xl text-xs font-black border-amber-200 text-amber-700 hover:bg-amber-50 flex-1 active:scale-95"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Concluir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* COMPLETED */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-amber-600" /> Conquistadas
          </h2>
          <div className="grid gap-2">
            {completed.slice(0, 10).map(g => (
              <div key={g.id} className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-black text-primary italic text-sm truncate">{g.title}</p>
                  <p className="text-[10px] font-bold text-amber-700 mt-0.5">
                    {TYPE_LABEL[g.goal_type]} · {g.target_value} unidades
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CERTIFICADO DE ENGAJAMENTO */}
      <section className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 justify-between mt-8 shadow-xl">
        <div className="space-y-2 text-left">
          <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-600 px-3 py-1 rounded-full border border-amber-500/30">
            Recompensa de Prestígio 🏆
          </span>
          <h3 className="text-xl md:text-2xl font-black italic text-primary leading-none uppercase tracking-tighter">
            Certificado de Engajamento
          </h3>
          <p className="text-xs md:text-sm text-slate-600 font-medium leading-relaxed">
            Desbloqueie e baixe seu certificado oficial de engajamento ao atingir <span className="font-black text-amber-600">7 dias consecutivos de estudos</span> ou <span className="font-black text-amber-600">Nível 3</span>.
          </p>
          <div className="flex gap-4 text-xs font-bold text-slate-500 pt-1">
            <span className={streak >= 7 ? 'text-emerald-600' : ''}>
              Seu streak: {streak}/7 dias {streak >= 7 ? '✅' : ''}
            </span>
            <span className={level >= 3 ? 'text-emerald-600' : ''}>
              Seu nível: Nível {level}/3 {level >= 3 ? '✅' : ''}
            </span>
          </div>
        </div>
        <Button
          onClick={downloadCertificate}
          disabled={streak < 7 && level < 3}
          className={`h-13 px-8 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all border-none ${
            streak >= 7 || level >= 3 
              ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:scale-105 active:scale-95' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {streak >= 7 || level >= 3 ? 'Emitir Certificado' : 'Bloqueado 🔒'}
        </Button>
      </section>

      {/* CREATE DIALOG */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 md:p-7 pb-4 bg-emerald-50 border-b-2 border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg md:text-xl font-black italic text-emerald-700 uppercase tracking-tighter leading-none">Nova Meta</DialogTitle>
                <DialogDescription className="text-xs font-bold text-emerald-600 mt-1">Defina um objetivo claro e mensurável</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 md:p-7 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Título</Label>
              <Input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Resolver 20 questões de exatas por dia"
                className="h-12 rounded-2xl border-slate-200 font-bold text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tipo</Label>
                <Select value={form.goal_type} onValueChange={(v: any) => setForm({ ...form, goal_type: v })}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 font-bold text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {Object.entries(TYPE_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="font-bold">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Período</Label>
                <Select value={form.period} onValueChange={(v: any) => setForm({ ...form, period: v })}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 font-bold text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {Object.entries(PERIOD_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="font-bold">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade alvo</Label>
              <Input
                type="number"
                min={1}
                value={form.target_value}
                onChange={e => setForm({ ...form, target_value: Math.max(1, parseInt(e.target.value) || 1) })}
                className="h-12 rounded-2xl border-slate-200 font-bold text-sm"
              />
            </div>

            {form.period === 'custom' && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Prazo</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm({ ...form, deadline: e.target.value })}
                  className="h-12 rounded-2xl border-slate-200 font-bold text-sm"
                />
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={saving || !form.title.trim()}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 border-none disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Meta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
