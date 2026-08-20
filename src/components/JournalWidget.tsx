'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookHeart, ChevronRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';

type Props = { userId: string };

type Mood = 'great' | 'good' | 'neutral' | 'tired' | 'frustrated';

const MOODS: { value: Mood; emoji: string; label: string; bg: string; ring: string }[] = [
  { value: 'great',      emoji: '🚀', label: 'Ótimo',      bg: 'bg-emerald-50',  ring: 'ring-emerald-300' },
  { value: 'good',       emoji: '🙂', label: 'Bom',        bg: 'bg-sky-50',      ring: 'ring-sky-300' },
  { value: 'neutral',    emoji: '😐', label: 'Neutro',     bg: 'bg-slate-50',    ring: 'ring-slate-300' },
  { value: 'tired',      emoji: '😪', label: 'Cansado',    bg: 'bg-amber-50',    ring: 'ring-amber-300' },
  { value: 'frustrated', emoji: '😤', label: 'Frustrado',  bg: 'bg-rose-50',     ring: 'ring-rose-300' },
];

const today = () => new Date().toISOString().split('T')[0];

export function JournalWidget({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasEntry, setHasEntry] = useState(false);
  const [mood, setMood] = useState<Mood | null>(null);
  const [whatStudied, setWhatStudied] = useState('');

  useEffect(() => {
    let alive = true;
    supabase
      .from('study_journal_entries')
      .select('mood, what_studied')
      .eq('user_id', userId)
      .eq('entry_date', today())
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        if (data) {
          setHasEntry(true);
          setMood((data.mood as Mood) ?? null);
          setWhatStudied(data.what_studied ?? '');
        }
        setLoading(false);
      });
    return () => { alive = false; };
  }, [userId]);

  const handleSave = async () => {
    if (!mood) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('study_journal_entries').upsert(
        {
          user_id: userId,
          entry_date: today(),
          mood,
          what_studied: whatStudied.trim() || null,
        },
        { onConflict: 'user_id,entry_date' }
      );
      if (!error) setHasEntry(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-40 rounded-[2.5rem] bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-muted/20 overflow-hidden">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <BookHeart className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Diário de Estudos</p>
              <p className="text-base font-black text-primary italic leading-none">
                {hasEntry ? 'Registrado hoje ✓' : 'Como foi seu dia?'}
              </p>
            </div>
          </div>
          {hasEntry && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        </div>

        {!hasEntry ? (
          <>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Seu humor</p>
              <div className="grid grid-cols-5 gap-1.5">
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    className={`${m.bg} rounded-2xl p-2 transition-all hover:scale-105 active:scale-95 ${
                      mood === m.value ? `ring-2 ${m.ring} scale-105` : 'opacity-70'
                    }`}
                  >
                    <div className="text-2xl">{m.emoji}</div>
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-600 mt-0.5">{m.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={whatStudied}
              onChange={e => setWhatStudied(e.target.value.slice(0, 200))}
              placeholder="O que você estudou hoje? (opcional)"
              rows={2}
              className="w-full text-xs font-medium rounded-2xl border border-slate-200 bg-slate-50 p-3 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!mood || saving}
                className="flex-1 h-12 bg-violet-600 hover:bg-violet-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-[11px] uppercase tracking-widest rounded-2xl transition-all"
              >
                {saving ? 'Salvando...' : 'Registrar'}
              </button>
              <Link
                href="/dashboard/student/journal"
                className="h-12 px-4 flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-violet-700 hover:text-violet-800 active:scale-95 rounded-2xl border border-violet-200 transition-all"
              >
                Histórico <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl">
              <span className="text-2xl">{MOODS.find(m => m.value === mood)?.emoji ?? '📝'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Humor de hoje</p>
                <p className="text-xs font-black text-primary italic">{MOODS.find(m => m.value === mood)?.label ?? '—'}</p>
              </div>
            </div>
            {whatStudied && (
              <p className="text-[11px] font-medium text-slate-600 italic px-1 line-clamp-2">"{whatStudied}"</p>
            )}
            <Link
              href="/dashboard/student/journal"
              className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-violet-700 hover:text-violet-800 py-2"
            >
              Ver histórico <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
