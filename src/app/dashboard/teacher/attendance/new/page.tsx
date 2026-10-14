
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, ClipboardCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { format } from "date-fns";
import { toDate } from "@/lib/format";

export default function NewAttendanceSessionPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lives, setLives] = useState<any[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    class_label: "",
    session_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "",
    session_type: "presencial" as "presencial" | "live",
    live_id: "",
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("lives")
      .select("id, title, start_time")
      .eq("teacher_id", user.id)
      .order("start_time", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setLives(data);
      });

    supabase
      .from("profiles")
      .select("course")
      .eq("role", "student")
      .not("course", "is", null)
      .then(({ data }) => {
        if (!data) return;
        const distinct = Array.from(new Set(data.map((p) => (p.course || "").trim()).filter(Boolean))).sort();
        setClassOptions(distinct);
      });
  }, [user]);

  function handleLiveSelect(liveId: string) {
    if (liveId === "none") {
      setFormData((prev) => ({ ...prev, live_id: "" }));
      return;
    }
    const live = lives.find((l) => l.id === liveId);
    if (!live) return;
    const d = toDate(live.start_time);
    setFormData((prev) => ({
      ...prev,
      live_id: liveId,
      title: prev.title || live.title,
      session_date: d ? format(d, "yyyy-MM-dd") : prev.session_date,
      start_time: d ? format(d, "HH:mm") : prev.start_time,
      session_type: "live",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title || !formData.session_date || !user) {
      toast({
        title: "Dados incompletos",
        description: "Título e data são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.class_label) {
      toast({
        title: "Selecione uma sala/turma",
        description: "A chamada precisa estar vinculada a uma turma.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);

    const { data, error } = await supabase
      .from("class_sessions")
      .insert({
        title: formData.title,
        description: formData.description || null,
        subject: formData.subject || null,
        class_label: formData.class_label,
        session_date: formData.session_date,
        start_time: formData.start_time || null,
        session_type: formData.session_type,
        teacher_id: user.id,
        teacher_name: profile?.full_name || null,
        live_id: formData.live_id || null,
      })
      .select("id")
      .single();

    if (error) {
      toast({ title: "Erro ao criar chamada", description: error.message, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    toast({ title: "Chamada criada!", description: "Agora você pode marcar a presença dos alunos." });
    router.push(`/dashboard/teacher/attendance/${data.id}`);
  }

  const labelCls = "u-label ml-0.5";
  const inputCls = "w-full h-11 bg-background border border-border rounded-control px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors";
  const triggerCls = "h-11 rounded-control bg-background border-border text-foreground text-sm";

  return (
    <div className="pb-24 space-y-6 max-w-2xl">

      {/* ── Cabeçalho (nível médio) ── */}
      <div>
        <Link
          href="/dashboard/teacher/attendance"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para as chamadas
        </Link>
        <p className="u-label flex items-center gap-2"><ClipboardCheck className="h-3.5 w-3.5" /> Professor · nova chamada</p>
        <h1 className="u-page-title text-3xl mt-1">Criar chamada</h1>
        <p className="text-muted-foreground text-sm mt-2">Vincule a uma turma para gerar o código de presença.</p>
      </div>

      {/* ── Formulário ── */}
      <form onSubmit={handleSubmit} className="u-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="u-label flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Dados da aula</p>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className={labelCls}>Vincular a uma aula ao vivo (opcional)</Label>
            <Select onValueChange={handleLiveSelect} defaultValue="none">
              <SelectTrigger className={triggerCls}>
                <SelectValue placeholder="Selecionar aula ao vivo…" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="none" className="text-sm">Nenhuma</SelectItem>
                {lives.map((live) => (
                  <SelectItem key={live.id} value={live.id} className="text-sm">
                    {live.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className={labelCls}>
              Título <span className="text-red-600">*</span>
            </Label>
            <input
              type="text"
              placeholder="Ex.: Matemática — Funções"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              required
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={labelCls}>
                Data <span className="text-red-600">*</span>
              </Label>
              <input
                type="date"
                value={formData.session_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, session_date: e.target.value }))}
                required
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Horário</Label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={labelCls}>Matéria</Label>
              <input
                type="text"
                placeholder="Matemática"
                value={formData.subject}
                onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Tipo</Label>
              <Select
                value={formData.session_type}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, session_type: v as "presencial" | "live" }))
                }
              >
                <SelectTrigger className={triggerCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-control">
                  <SelectItem value="presencial" className="text-sm">Presencial</SelectItem>
                  <SelectItem value="live" className="text-sm">Ao vivo (online)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={labelCls}>
              Sala / turma <span className="text-red-600">*</span>
            </Label>
            <Select
              value={formData.class_label}
              onValueChange={(v) => setFormData((prev) => ({ ...prev, class_label: v }))}
            >
              <SelectTrigger className={triggerCls}>
                <SelectValue placeholder="Selecionar turma…" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                {classOptions.length === 0 ? (
                  <SelectItem value="__none__" disabled className="text-sm">
                    Nenhuma turma cadastrada
                  </SelectItem>
                ) : (
                  classOptions.map((c) => (
                    <SelectItem key={c} value={c} className="text-sm">
                      {c}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground leading-snug px-0.5">
              Só alunos desta sala poderão usar o código de presença.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className={labelCls}>Descrição (opcional)</Label>
            <Textarea
              placeholder="Observações sobre a aula…"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="rounded-control bg-background border-border text-sm resize-none"
            />
          </div>

          <Button
            type="submit"
            variant="arcade"
            disabled={isSubmitting}
            className="w-full h-12 rounded-control font-bold"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar e abrir a chamada
          </Button>
        </div>
      </form>
    </div>
  );
}
