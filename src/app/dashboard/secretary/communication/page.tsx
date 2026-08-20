"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Megaphone,
  Send,
  Loader2,
  Info,
  AlertOctagon,
  Trash2,
  Users,
  Clock,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Priority = "low" | "medium" | "high";

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: Priority;
  target_group?: string;
  created_at: string;
}

const priorityMeta: Record<Priority, { label: string; chip: string; dot: string }> = {
  low:    { label: "Informativo", chip: "bg-blue-50 text-blue-600 border-blue-100",   dot: "bg-blue-500" },
  medium: { label: "Importante",  chip: "bg-amber-50 text-amber-600 border-amber-100", dot: "bg-amber-500" },
  high:   { label: "Urgente",     chip: "bg-red-50 text-red-600 border-red-200",       dot: "bg-red-500" },
};

const targetLabel = (t?: string) => {
  if (!t || t === "all") return "Toda a rede";
  if (t === "etec") return "ETEC";
  if (t === "enem") return "ENEM";
  if (t === "teacher") return "Staff";
  if (/^\d{1,2}$/.test(t)) return `Sala ${t.padStart(2, "0")}`;
  return t;
};

export default function SecretaryCommunication() {
  const { userRole, loading: isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<Priority>("low");
  const [target, setTarget] = useState("all");
  const [sending, setSending] = useState(false);

  const [list, setList] = useState<Announcement[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    if (!isUserLoading && userRole !== "staff" && userRole !== "admin") {
      router.replace("/dashboard/home");
    }
  }, [userRole, isUserLoading, router]);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from("announcements")
      .select("id, title, message, priority, target_group, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    setList((data as Announcement[]) || []);
    setLoadingList(false);
  }, []);

  useEffect(() => {
    if (userRole === "staff" || userRole === "admin") fetchList();
  }, [userRole, fetchList]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Dados incompletos", description: "Preencha título e mensagem.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, priority, target_group: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao publicar");

      // Dispara push (best-effort, não bloqueia).
      if (data.announcement?.id) {
        fetch("/api/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "communication", announcementId: data.announcement.id }),
        }).catch(() => {});
      }

      toast({ title: "Comunicado publicado! 📣", description: "A rede foi notificada." });
      setTitle("");
      setMessage("");
      setPriority("low");
      setTarget("all");
      if (data.announcement) setList((prev) => [data.announcement, ...prev]);
      else fetchList();
    } catch (e: any) {
      toast({ title: "Erro ao publicar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setList((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "Comunicado removido." });
  };

  if (isUserLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 animate-in fade-in duration-500 pb-20 px-1">
      {/* HERO */}
      <div className="relative aurora-dark rounded-[2rem] p-5 md:p-8 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone className="h-4 w-4 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45">Secretaria · Comunicação</span>
          </div>
          <h1 className="text-[2.4rem] md:text-[3.2rem] font-black text-white italic tracking-tighter leading-none">
            Comunicados<span className="text-primary">.</span>
          </h1>
          <p className="text-white/45 text-[11px] font-bold mt-2 tracking-wide">
            Envie avisos para toda a rede ou turmas específicas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 md:gap-6">
        {/* COMPOSER */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-lg p-5 md:p-6 space-y-4 h-fit">
          <h2 className="font-black text-sm text-slate-900 italic flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Novo Comunicado
          </h2>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="Ex: Simulado neste sábado"
              className="h-12 bg-muted/30 border-none rounded-xl font-bold text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Mensagem *</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Escreva o aviso que será exibido para os alunos…"
              className="w-full bg-muted/30 border-none rounded-xl font-medium text-sm p-3.5 resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <p className="text-[9px] font-bold text-slate-300 text-right">{message.length}/2000</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Prioridade</Label>
              <Select value={priority} onValueChange={(v: Priority) => setPriority(v)}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="low" className="font-bold text-blue-500 text-xs">Informativo</SelectItem>
                  <SelectItem value="medium" className="font-bold text-amber-500 text-xs">Importante</SelectItem>
                  <SelectItem value="high" className="font-bold text-red-500 text-xs">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Público</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl max-h-60">
                  <SelectGroup>
                    <SelectLabel className="text-[9px] font-black uppercase text-slate-400">Geral</SelectLabel>
                    <SelectItem value="all" className="font-bold text-xs">Toda a rede</SelectItem>
                    <SelectItem value="etec" className="font-bold text-xs">ETEC</SelectItem>
                    <SelectItem value="enem" className="font-bold text-xs">ENEM</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="text-[9px] font-black uppercase text-slate-400 border-t border-slate-100 mt-1 pt-2">Turmas</SelectLabel>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((n) => (
                      <SelectItem key={n} value={n} className="font-bold text-xs">Sala {n}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview chip */}
          {title.trim() && (
            <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${priorityMeta[priority].chip}`}>
              {priority === "high" ? <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" /> : <Info className="h-4 w-4 shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="font-black text-xs truncate">{title}</p>
                <p className="text-[11px] opacity-80 line-clamp-2 italic mt-0.5">{message || "…"}</p>
              </div>
            </div>
          )}

          <Button
            onClick={handleSend}
            disabled={sending || !title.trim() || !message.trim()}
            className="w-full h-12 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest border-none shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Publicar Comunicado
          </Button>
        </div>

        {/* RECENT LIST */}
        <div className="lg:col-span-3 bg-white rounded-[2rem] border border-slate-100 shadow-lg p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-sm text-slate-900 italic flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              Últimos Comunicados
            </h2>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{list.length} no total</span>
          </div>

          {loadingList ? (
            <div className="space-y-2.5">
              {Array(4).fill(0).map((_, i) => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-2xl" />)}
            </div>
          ) : list.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl">
              <Megaphone className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-400 italic">Nenhum comunicado publicado ainda.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {list.map((a) => {
                const meta = priorityMeta[a.priority] || priorityMeta.low;
                return (
                  <div key={a.id} className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 hover:bg-white hover:shadow-sm transition-all group">
                    <div className={`h-2.5 w-2.5 rounded-full ${meta.dot} shrink-0 mt-1.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.chip}`}>{meta.label}</span>
                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
                          <Users className="h-2.5 w-2.5" /> {targetLabel(a.target_group)}
                        </span>
                      </div>
                      <p className="font-black text-sm text-slate-800 truncate italic">{a.title}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mt-0.5">{a.message}</p>
                      {a.created_at && (
                        <p className="text-[9px] font-bold text-slate-300 mt-1">
                          {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="h-8 w-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center shrink-0 transition-colors opacity-60 group-hover:opacity-100" aria-label="Remover">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[2rem] w-[95vw] sm:max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-black italic">Remover comunicado?</AlertDialogTitle>
                          <AlertDialogDescription>
                            “{a.title}” deixará de aparecer para os alunos. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl font-black text-xs">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(a.id)} className="rounded-xl font-black text-xs bg-red-600 hover:bg-red-700">
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
