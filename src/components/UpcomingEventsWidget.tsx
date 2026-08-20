'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

type AcademicEvent = {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  simulado:        'bg-blue-100 text-blue-700',
  inscricao:       'bg-amber-100 text-amber-700',
  aulao:           'bg-purple-100 text-purple-700',
  entrega_redacao: 'bg-pink-100 text-pink-700',
  feriado:         'bg-green-100 text-green-700',
  outro:           'bg-slate-100 text-slate-600',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  simulado:        'Simulado',
  inscricao:       'Inscrição',
  aulao:           'Aulão',
  entrega_redacao: 'Redação',
  feriado:         'Feriado',
  outro:           'Evento',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function UpcomingEventsWidget() {
  const [events, setEvents] = useState<AcademicEvent[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('academic_events')
      .select('id, title, event_date, event_type')
      .gte('event_date', today)
      .order('event_date')
      .limit(4)
      .then(({ data }) => setEvents(data ?? []));
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="bg-white rounded-[2rem] shadow-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <p className="text-sm font-black text-primary italic">Próximos Eventos</p>
        </div>
        <Link href="/dashboard/student/calendar" className="text-[10px] font-black text-accent uppercase tracking-widest hover:underline">
          Ver tudo
        </Link>
      </div>

      <div className="space-y-2">
        {events.map(ev => (
          <div key={ev.id} className="flex items-center gap-3">
            <div className="w-10 text-center">
              <p className="text-xs font-black text-primary leading-none">{formatDate(ev.event_date)}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-primary truncate">{ev.title}</p>
            </div>
            <Badge className={`text-[8px] font-black border-none shrink-0 ${EVENT_TYPE_COLORS[ev.event_type] ?? EVENT_TYPE_COLORS.outro}`}>
              {EVENT_TYPE_LABELS[ev.event_type] ?? 'Evento'}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
