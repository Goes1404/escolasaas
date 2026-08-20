
"use client";

import { useState, useEffect } from "react";
import {
  PlusCircle,
  Calendar,
  Clock,
  Loader2,
  Trash2,
  Radio,
  Link as LinkIcon,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ManageLivePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lives, setLives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    meet_link: "",
  });

  async function fetchLives() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lives")
        .select("*")
        .order("start_time", { ascending: false });

      if (!error && data) setLives(data);
    } catch (err) {
      console.error("Erro ao buscar lives:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLives();
  }, [user]);

  const handleCreateLive = async () => {
    if (!formData.title || !formData.date || !formData.time || !user || isSubmitting) {
      if (!isSubmitting)
        toast({
          title: "Dados Incompletos",
          description: "Título, data e horário são obrigatórios.",
          variant: "destructive",
        });
      return;
    }

    setIsSubmitting(true);
    try {
      const start_time = new Date(`${formData.date}T${formData.time}`).toISOString();

      const { error } = await supabase.from("lives").insert({
        title: formData.title,
        description: formData.description,
        start_time,
        meet_link: formData.meet_link,
        teacher_id: user.id,
        teacher_name: user.user_metadata?.full_name || "Mentor da Rede",
        status: "scheduled",
      });

      if (error) throw new Error(error.message);

      toast({ title: "Sala Criada!", description: "A reunião externa já está na agenda." });
      setIsCreateOpen(false);
      setFormData({ title: "", description: "", date: "", time: "", meet_link: "" });
      fetchLives();
    } catch (error: any) {
      toast({
        title: "Erro ao agendar",
        description:
          error?.message?.includes("status")
            ? "A coluna 'status' não existe no banco. Execute o script SQL."
            : error?.message || "Ocorreu um erro desconhecido.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    const { error } = await supabase.from("lives").delete().eq("id", id);
    if (!error) {
      setLives((prev) => prev.filter((live) => live.id !== id));
      toast({ title: "Sala removida" });
    }
    setDeletingId(null);
  };

  const upcomingCount = lives.filter((l) => new Date(l.start_time) >= new Date()).length;
  const liveNow = lives.filter((l) => l.status === "live").length;

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Hero ── */}
      <div className="relative rounded-[2rem] overflow-hidden bg-[#0d0d0f] border border-white/5 p-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 80% 10%, rgba(168,85,247,0.13) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(239,68,68,0.10) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Radio className="h-3 w-3 text-purple-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400/70">
              Studio Virtual
            </p>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">
            Lives & Mentorias
          </h1>
          <p className="text-white/65 text-xs font-semibold mt-1">
            Gerencie reuniões (Meet/YouTube)
          </p>

          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="flex flex-col items-center bg-white/5 border border-white/8 rounded-2xl py-2.5">
              <span className="text-lg font-black text-white leading-none">{lives.length}</span>
              <span className="text-[8px] font-bold text-white/55 uppercase tracking-wider mt-0.5">Total</span>
            </div>
            <div className="flex flex-col items-center bg-purple-500/10 border border-purple-500/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-purple-400 leading-none">{upcomingCount}</span>
              <span className="text-[8px] font-bold text-purple-400/80 uppercase tracking-wider mt-0.5">Futuras</span>
            </div>
            <div className="flex flex-col items-center bg-red-500/10 border border-red-500/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-red-400 leading-none">{liveNow}</span>
              <span className="text-[8px] font-bold text-red-400/80 uppercase tracking-wider mt-0.5">No ar</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogTrigger asChild>
          <Button className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-slate-800 font-black rounded-2xl shadow-xl shadow-orange-500/20 text-xs uppercase tracking-widest border-none">
            <PlusCircle className="h-4 w-4 mr-2" />
            Agendar Aula
          </Button>
        </DialogTrigger>
        <DialogContent className="rounded-[2rem] p-0 bg-white border-slate-200 w-[95vw] sm:w-full max-w-lg max-h-[95vh] overflow-y-auto shadow-2xl">
          <DialogHeader className="p-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-black italic text-slate-800 uppercase tracking-tighter">
              Nova Sala Online
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                Título da Aula
              </Label>
              <input
                placeholder="Ex: Mentoria - Carreira"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isSubmitting}
                className="w-full h-11 bg-white shadow-sm border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/40 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Data</Label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  disabled={isSubmitting}
                  className="w-full h-11 bg-white shadow-sm border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-500/40 transition-all [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Horário</Label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  disabled={isSubmitting}
                  className="w-full h-11 bg-white shadow-sm border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-500/40 transition-all [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                Link da Reunião
              </Label>
              <div className="relative">
                <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                <input
                  placeholder="https://meet.google.com/..."
                  value={formData.meet_link}
                  onChange={(e) => setFormData({ ...formData, meet_link: e.target.value })}
                  disabled={isSubmitting}
                  className="w-full h-11 bg-white shadow-sm border border-slate-200 rounded-xl pl-10 pr-3 text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/40 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                Pauta (opcional)
              </Label>
              <textarea
                placeholder="O que será discutido..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                className="w-full min-h-[70px] bg-white shadow-sm border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-500 outline-none focus:border-orange-500/40 transition-all resize-none"
              />
            </div>
          </div>
          <DialogFooter className="p-5 pt-0 flex-col gap-2">
            <Button
              onClick={handleCreateLive}
              disabled={isSubmitting || !formData.title}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-800 font-black rounded-2xl shadow-xl shadow-orange-500/30 border-none text-xs uppercase tracking-widest disabled:opacity-40"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
              ) : null}
              Publicar na Agenda
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
              <AlertCircle className="h-3 w-3" /> Execute o SQL no Supabase
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Lives list ── */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
          </div>
        ) : lives.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-200 rounded-[1.5rem]">
            <Inbox className="h-8 w-8 mx-auto mb-2 text-white/15" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Nenhuma aula agendada
            </p>
          </div>
        ) : (
          lives.map((live) => {
            const isLive = live.status === "live";
            const d = new Date(live.start_time);
            const dayNum = d.getDate();
            const monthShort = format(d, "MMM", { locale: ptBR }).toUpperCase();

            return (
              <div
                key={live.id}
                className="group bg-white shadow-sm border border-slate-200 hover:border-purple-500/20 rounded-2xl p-3.5 transition-all"
              >
                <div className="flex items-start gap-3">
                  {/* Date anchor */}
                  <div
                    className={`flex flex-col items-center justify-center min-w-[44px] py-1 px-2 rounded-xl shrink-0 border ${
                      isLive
                        ? "bg-red-500/20 border-red-500/30 animate-pulse"
                        : "bg-white shadow-sm border-slate-200"
                    }`}
                  >
                    <span className={`text-xl font-black italic leading-none ${isLive ? "text-red-400" : "text-slate-800"}`}>
                      {String(dayNum).padStart(2, "0")}
                    </span>
                    <span
                      className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${
                        isLive ? "text-red-400/70" : "text-purple-400/70"
                      }`}
                    >
                      {monthShort}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {format(d, "HH:mm")}
                      </span>
                      <Badge
                        className={`border font-black text-[8px] uppercase px-1.5 h-4 ${
                          isLive
                            ? "bg-red-500/15 text-red-400 border-red-500/25 animate-pulse"
                            : "bg-purple-500/15 text-purple-400 border-purple-500/25"
                        }`}
                      >
                        {isLive ? "🔴 No ar" : live.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-black text-slate-800 italic leading-snug truncate">
                      {live.title}
                    </p>
                    {live.meet_link && (
                      <p className="text-[10px] text-purple-400/70 font-bold truncate mt-1 flex items-center gap-1">
                        <LinkIcon className="h-2.5 w-2.5" />
                        {live.meet_link}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleDelete(live.id)}
                    disabled={deletingId === live.id}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-40 touch-manipulation"
                    title="Excluir"
                  >
                    {deletingId === live.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                  <Link
                    href={`/dashboard/teacher/live/${live.id}`}
                    className="h-8 px-4 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-all active:scale-95 touch-manipulation"
                  >
                    Studio
                    <Radio className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
