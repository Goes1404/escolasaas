'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/app/lib/supabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BookHeart, Loader2, Calendar, Sparkles } from 'lucide-react';

type Mood = 'great' | 'good' | 'neutral' | 'tired' | 'frustrated';

type Entry = {
  id: string;
  entry_date: string;
  mood: Mood | null;
  what_studied: string | null;
  what_learned: string | null;
  blocker: string | null;
  hours_studied: number | null;
};

const MOODS: { value: Mood; emoji: string; label: string; bg: string; ring: string }[] = [
  { value: 'great',      emoji: '🚀', label: 'Ótimo',      bg: 'bg-emerald-50',  ring: 'ring-emerald-400' },
  { value: 'good',       emoji: '🙂', label: 'Bom',        bg: 'bg-sky-50',      ring: 'ring-sky-400' },
  { value: 'neutral',    emoji: '😐', label: 'Neutro',     bg: 'bg-slate-50',    ring: 'ring-slate-400' },
  { value: 'tired',      emoji: '😪', label: 'Cansado',    bg: 'bg-amber-50',    ring: 'ring-amber-400' },
  { value: 'frustrated', emoji: '😤', label: 'Frustrado',  bg: 'bg-rose-50',     ring: 'ring-rose-400' },
];

const today = () => new Date().toISOString().split('T')[0];

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export default function JournalPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [history, setHistory] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mood, setMood] = useState<Mood | null>(null);
  const [whatStudied, setWhatStudied] = useState('');
  const [whatLearned, setWhatLearned] = useState('');
  const [blocker, setBlocker] = useState('');
  const [hoursStudied, setHoursStudied] = useState<string>('');

  const loadHistory = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('study_journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .limit(30);
    const entries = (data ?? []) as Entry[];
    setHistory(entries);

    const todayEntry = entries.find(e => e.entry_date === today());
    if (todayEntry) {
      setMood(todayEntry.mood);
      setWhatStudied(todayEntry.what_studied ?? '');
      setWhatLearned(todayEntry.what_learned ?? '');
      setBlocker(todayEntry.blocker ?? '');
      setHoursStudied(todayEntry.hours_studied ? String(todayEntry.hours_studied) : '');
    }
    setLoading(false);
  };

  useEffect(() => { loadHistory(); }, [user]);

  const handleSave = async () => {
    if (!user || !mood) {
      toast({ title: 'Selecione seu humor', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const hours = hoursStudied ? parseFloat(hoursStudied) : null;
      const { error } = await supabase.from('study_journal_entries').upsert(
        {
          user_id: user.id,
          entry_date: today(),
          mood,
          what_studied: whatStudied.trim() || null,
          what_learned: whatLearned.trim() || null,
          blocker: blocker.trim() || null,
          hours_studied: hours && hours > 0 ? hours : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,entry_date' }
      );
      if (error) throw error;
      toast({ title: 'Entrada salva! 📝', description: 'Seu diário foi atualizado.' });
      loadHistory();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-2 md:px-4 pb-20 space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black italic text-primary leading-none flex items-center gap-3">
          <span className="h-10 w-10 rounded-2xl bg-violet-100 flex items-center justify-center">
            <BookHeart className="h-5 w-5 text-violet-600" />
          </span>
          Diário de Estudos
        </h1>
        <p className="text-muted-foreground font-medium italic mt-2">Reflita sobre seu dia. Pequenas reflexões = grandes conquistas.</p>
      </div>

      {/* TODAY */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-100 shadow-xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-violet-700 bg-violet-50 px-3 py-1.5 rounded-full">
            Hoje · {formatDate(today())}
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Como foi seu dia?</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {MOODS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value)}
                className={`${m.bg} rounded-2xl p-2 transition-all hover:scale-105 active:scale-95 min-h-[56px] flex flex-col items-center justify-center ${
                  mood === m.value ? `ring-2 ${m.ring} scale-105 shadow-md` : 'opacity-60'
                }`}
              >
                <div className="text-2xl leading-none">{m.emoji}</div>
                <p className="text-[8px] font-black uppercase tracking-wider text-slate-600 mt-1 leading-none">{m.label}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">O que você estudou?</Label>
            <textarea
              value={whatStudied}
              onChange={e => setWhatStudied(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="Ex: 30 questões de matemática, redação sobre IA..."
              className="w-full text-sm font-medium rounded-2xl border border-slate-200 bg-slate-50 p-3 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">O que aprendeu?</Label>
            <textarea
              value={whatLearned}
              onChange={e => setWhatLearned(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="Conceito novo, técnica, insight..."
              className="w-full text-sm font-medium rounded-2xl border border-slate-200 bg-slate-50 p-3 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Algum bloqueio ou dúvida?</Label>
            <textarea
              value={blocker}
              onChange={e => setBlocker(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="O que travou seu progresso? (opcional)"
              className="w-full text-sm font-medium rounded-2xl border border-slate-200 bg-slate-50 p-3 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Horas estudadas</Label>
            <input
              type="number"
              step="0.5"
              min={0}
              max={24}
              value={hoursStudied}
              onChange={e => setHoursStudied(e.target.value)}
              placeholder="2.5"
              className="w-full h-12 text-sm font-bold rounded-2xl border border-slate-200 bg-slate-50 px-4 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || !mood}
          className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl shadow-lg shadow-violet-200 border-none disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2 text-amber-200" />}
          Salvar Reflexão
        </Button>
      </div>

      {/* HISTORY */}
      <section>
        <h2 className="text-sm font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-violet-600" /> Histórico
        </h2>
        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map(i => <div key={i} className="h-24 bg-muted/20 rounded-2xl animate-pulse" />)}
          </div>
        ) : history.filter(e => e.entry_date !== today()).length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-violet-200 rounded-3xl bg-violet-50/30">
            <BookHeart className="h-8 w-8 text-violet-400 mx-auto mb-2" />
            <p className="font-black text-violet-700 italic">Sem entradas anteriores</p>
            <p className="text-xs text-violet-600/70 mt-1">Continue escrevendo todos os dias.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {history.filter(e => e.entry_date !== today()).map(e => {
              const moodMeta = MOODS.find(m => m.value === e.mood);
              return (
                <div key={e.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-md">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{moodMeta?.emoji ?? '📝'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-primary italic">{formatDate(e.entry_date)}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{moodMeta?.label ?? 'Sem humor'}</p>
                    </div>
                    {e.hours_studied && (
                      <span className="text-[10px] font-black text-violet-700 bg-violet-50 px-2 py-1 rounded-full">
                        {e.hours_studied}h
                      </span>
                    )}
                  </div>
                  {e.what_studied && (
                    <p className="text-xs text-slate-700 font-medium italic mb-1">📚 {e.what_studied}</p>
                  )}
                  {e.what_learned && (
                    <p className="text-xs text-emerald-700 font-medium italic mb-1">💡 {e.what_learned}</p>
                  )}
                  {e.blocker && (
                    <p className="text-xs text-rose-600 font-medium italic">⚠️ {e.blocker}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
