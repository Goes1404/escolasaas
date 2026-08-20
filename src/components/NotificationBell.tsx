"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Megaphone,
  AlertOctagon,
  Info,
  ChevronRight,
  Sparkles,
  Loader2,
  X,
  Calendar,
  Clock
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ─── Mapa de prioridades ─────────────────────────────────────────────── */
const PRIORITY_CONFIG = {
  high: {
    label: "Urgente",
    icon: AlertOctagon,
    dropBg: "bg-red-50",
    dropText: "text-red-600",
    dotColor: "bg-red-500",
    modalGradient: "from-red-600 via-red-500 to-orange-500",
    modalBadge: "bg-white/20 text-white border-white/30",
    pulseColor: "bg-red-500",
  },
  medium: {
    label: "Importante",
    icon: Megaphone,
    dropBg: "bg-amber-50",
    dropText: "text-amber-600",
    dotColor: "bg-amber-500",
    modalGradient: "from-amber-500 via-orange-500 to-yellow-500",
    modalBadge: "bg-white/20 text-white border-white/30",
    pulseColor: "bg-amber-500",
  },
  low: {
    label: "Informativo",
    icon: Info,
    dropBg: "bg-blue-50",
    dropText: "text-blue-600",
    dotColor: "bg-blue-500",
    modalGradient: "from-blue-600 via-blue-500 to-indigo-500",
    modalBadge: "bg-white/20 text-white border-white/30",
    pulseColor: "bg-blue-500",
  },
};

function getPriority(p: string) {
  return PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.low;
}

export function NotificationBell() {
  const { user, profile } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedAnn, setSelectedAnn] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Trava o scroll do body enquanto o modal está aberto
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = selectedAnn ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedAnn]);

  useEffect(() => {
    if (!user) return;

    async function fetchAnnouncements() {
      setLoading(true);
      try {
        let query = supabase.from('announcements').select('*');

        if (profile) {
          const audience = (profile.exam_target || '').toLowerCase().trim();
          const targets = ['all', profile.profile_type, audience, profile.class_id]
            .filter(Boolean)
            .map(t => `target_group.eq.${String(t).replace(/[(),*]/g, '')}`);
          query = query.or(targets.join(','));
        }

        let { data, error } = await query.order('created_at', { ascending: false }).limit(5);

        if (error && (error.code === '42703' || error.message.includes('target_group'))) {
          const fallback = await supabase.from('announcements')
            .select('*').order('created_at', { ascending: false }).limit(5);
          data = fallback.data; error = fallback.error;
        }

        if (error) throw error;
        setAnnouncements(data || []);

        const lastRead = localStorage.getItem('last_announcement_read');
        if (data && data.length > 0 && lastRead !== data[0].id) setUnreadCount(1);
      } catch (err) {
        console.error("Erro ao carregar notificações:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAnnouncements();

    const channel = supabase
      .channel('global_announcements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, fetchAnnouncements)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, profile]);

  const handleOpenChange = (open: boolean) => {
    setDropdownOpen(open);
    if (open && announcements.length > 0) {
      localStorage.setItem('last_announcement_read', announcements[0].id);
      setUnreadCount(0);
    }
  };

  const historyHref =
    profile?.profile_type === 'teacher'
      ? '/dashboard/teacher/communication'
      : profile?.role === 'admin' || profile?.role === 'secretary'
        ? '/dashboard/secretary/communication'
        : '/dashboard/home';

  return (
    <>
      {/* ── Botão de sino ──────────────────────────────────────────────── */}
      <DropdownMenu open={dropdownOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`relative h-10 w-10 rounded-full hover:bg-primary/5 transition-all ${unreadCount > 0 ? 'glow-orange' : ''}`}
          >
            <Bell className="h-5 w-5 text-primary/60" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center bg-accent text-accent-foreground border-2 border-white text-[8px] font-black animate-bounce">
                {unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-[min(340px,calc(100vw-1rem))] md:w-[390px] rounded-[2rem] border-none shadow-2xl p-0 bg-white overflow-hidden animate-in zoom-in-95 duration-200"
        >
          {/* Cabeçalho */}
          <DropdownMenuLabel className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <span className="text-sm font-black text-primary italic uppercase tracking-tight">Central de Avisos</span>
              </div>
              {unreadCount > 0 && (
                <Badge className="text-[8px] font-black bg-accent text-white border-none animate-pulse">
                  Novo
                </Badge>
              )}
            </div>
          </DropdownMenuLabel>

          {/* Lista */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-accent/40" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sincronizando...</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="py-12 text-center opacity-40 px-6">
                <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium italic">Nenhum comunicado recente.</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {announcements.map((ann) => {
                  const cfg = getPriority(ann.priority);
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={ann.id}
                      onClick={() => { setDropdownOpen(false); setSelectedAnn(ann); }}
                      className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition-all group"
                    >
                      {/* Ícone com ponto de status */}
                      <div className="relative shrink-0">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${cfg.dropBg}`}>
                          <Icon className={`h-4 w-4 ${cfg.dropText}`} />
                        </div>
                        <span className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${cfg.dotColor}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={`text-[8px] font-black uppercase tracking-widest ${cfg.dropText}`}>{cfg.label}</span>
                          <span className="text-[8px] text-slate-400 flex items-center gap-0.5 shrink-0">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDistanceToNow(new Date(ann.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-xs font-black text-slate-800 truncate leading-tight">{ann.title}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">{ann.message}</p>
                      </div>

                      <ChevronRight className="h-3.5 w-3.5 text-slate-200 group-hover:text-accent shrink-0 transition-colors" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DropdownMenuSeparator className="m-0" />
          <div className="p-2">
            <Button asChild variant="ghost" className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-accent hover:bg-accent/5">
              <Link href={historyHref}>
                Ver histórico completo <ChevronRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Modal do comunicado (via portal p/ escapar do header) ──────── */}
      {mounted && selectedAnn && createPortal((() => {
        const cfg = getPriority(selectedAnn.priority);
        const Icon = cfg.icon;
        return (
          /* Overlay */
          <div
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedAnn(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Card — slide-up no mobile, centrado no desktop */}
            <div
              className="relative z-10 w-full sm:max-w-lg bg-white sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90dvh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabeçalho com gradiente por prioridade */}
              <div className={`bg-gradient-to-br ${cfg.modalGradient} px-6 pt-6 pb-5 relative overflow-hidden shrink-0`}>
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: "radial-gradient(circle at 70% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

                {/* Botão fechar — sempre acessível, canto superior direito */}
                <button
                  onClick={() => setSelectedAnn(null)}
                  className="absolute top-4 right-4 h-9 w-9 rounded-xl bg-white/20 hover:bg-white/30 active:bg-white/40 flex items-center justify-center transition-colors z-20"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4 text-white" />
                </button>

                <div className="flex items-center gap-3 mb-4 pr-12">
                  <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <Badge className={`${cfg.modalBadge} border font-black text-[9px] uppercase tracking-widest`}>
                    {cfg.label}
                  </Badge>
                </div>

                <h2 className="text-xl font-black text-white italic leading-snug pr-2">
                  {selectedAnn.title}
                </h2>
                <p className="text-white/70 text-[10px] font-bold mt-2 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(selectedAnn.created_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>

              {/* Corpo — scrollável */}
              <div className="overflow-y-auto flex-1 px-6 py-5">
                <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                  {selectedAnn.message}
                </p>
              </div>

              {/* Rodapé */}
              <div className="px-6 pb-6 pt-2 shrink-0 border-t border-slate-100">
                <Button
                  asChild
                  className="w-full h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-slate-900 hover:bg-slate-800 text-white"
                >
                  <Link href={historyHref} onClick={() => setSelectedAnn(null)}>
                    Ver todos os comunicados <ChevronRight className="h-3.5 w-3.5 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </>
  );
}
