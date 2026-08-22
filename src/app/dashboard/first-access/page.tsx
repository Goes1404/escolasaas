'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck, Loader2, Sparkles, AlertCircle,
  Eye, EyeOff, LockKeyhole, CheckCircle2, Info,
  Phone, BookOpen, School, ChevronRight, ChevronLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackAcao, trackFalha } from "@/lib/telemetry";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";

type Step = 1 | 2 | 3;

const EXAM_OPTIONS = [
  { id: 'enem', label: 'ENEM', icon: BookOpen, desc: 'Ensino Superior — vestibulares' },
  { id: 'etec', label: 'ETEC', icon: School,   desc: 'Ensino Técnico — ETEC/FATEC' },
];
const TURNO_OPTIONS = [
  { id: 'manha',    label: 'Manhã',    emoji: '🌅', hint: '07h–12h' },
  { id: 'tarde',    label: 'Tarde',    emoji: '☀️',  hint: '13h–18h' },
  { id: 'integral', label: 'Integral', emoji: '🕐', hint: 'Manhã + Tarde' },
];

// Aplica máscara (11) 99999-9999
function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2)  return `(${d}`;
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

// ─── step indicator com labels ───────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const steps = [
    { n: 1 as Step, label: 'Senha'  },
    { n: 2 as Step, label: 'Perfil' },
  ];
  return (
    <div className="flex items-center gap-3 justify-center">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300
              ${current > s.n ? 'bg-green-500 text-white' : current === s.n ? 'bg-white text-primary' : 'bg-white/15 text-white/65'}`}>
              {current > s.n ? <CheckCircle2 className="h-4 w-4" /> : s.n}
            </div>
            <span className={`text-[9px] font-black uppercase tracking-wider transition-colors
              ${current >= s.n ? 'text-white/70' : 'text-white/60'}`}>
              {s.label}
            </span>
          </div>
          {i === 0 && (
            <div className={`h-0.5 w-12 rounded-full mb-4 transition-all duration-500
              ${current > 1 ? 'bg-white/60' : 'bg-white/15'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────
export default function FirstAccessPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep]       = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // step 1
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass]               = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  // step 2
  const [phone, setPhone]           = useState("");
  const [sala, setSala]             = useState("");
  const [examTarget, setExamTarget] = useState("");
  const [turno, setTurno]           = useState("");

  // pré-preenche com máscara aplicada
  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    if (p.phone)       setPhone(maskPhone(p.phone));
    if (p.sala)        setSala(p.sala);
    if (p.exam_target) setExamTarget(p.exam_target);
    if (p.turno)       setTurno(p.turno);
  }, [profile]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  // validações step 1
  const hasLength = newPassword.length >= 8;
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isMatch   = newPassword === confirmPassword && confirmPassword.length > 0;
  const step1OK   = hasLength && hasSymbol && hasNumber && isMatch;

  // `role` e não `profile_type`: este último é texto livre e tem cinco valores
  // distintos em produção ('student' 608, 'etec' 259, 'enem' 167, 'Estudante
  // ENEM' 17, 'Estudante ETEC' 9). Comparar com a string 'student' deixava 452
  // alunos de fora — eles pulariam a escolha de trilha, que é justamente o que
  // decide qual conteúdo passam a ver.
  const isStudent =
    profile?.role === 'student' ||
    user?.user_metadata?.role === 'student' ||
    (profile?.profile_type ?? '').toLowerCase().includes('estudante') ||
    ['student', 'etec', 'enem'].includes((profile?.profile_type ?? '').toLowerCase());

  function handlePhoneChange(v: string) {
    setPhone(maskPhone(v));
  }

  // ── step 1 ──
  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!step1OK) { setError("Verifique os requisitos de senha antes de continuar."); return; }
    setLoading(true);
    try {
      // Não setamos must_change_password aqui — isso é feito ao final do passo 2
      // (após salvar o perfil) para evitar redirect-loop no middleware.
      const result = await Promise.race([
        supabase.auth.updateUser({ password: newPassword }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Tempo esgotado. Verifique sua conexão e tente novamente.')), 10_000)
        ),
      ]);
      if (result.error) throw result.error;
      trackAcao('primeiro_acesso_senha_trocada');
      setStep(2);
    } catch (err: any) {
      trackFalha('primeiro_acesso_senha_falhou', err);
      setError(err.message || "Não foi possível salvar a senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // ── step 2 ──
  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isStudent && !examTarget) { setError("Selecione seu objetivo: ENEM ou ETEC."); return; }
    if (isStudent && !turno)      { setError("Selecione o turno em que você estuda."); return; }
    setLoading(true);
    try {
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");
      const updateData: any = { phone: phone.replace(/\D/g, '') || null };
      if (isStudent) {
        updateData.sala = sala.trim() || null;
        updateData.exam_target = examTarget;
        updateData.turno = turno;
      }
      
      const profileResult = await Promise.race([
        supabase.from('profiles').update(updateData).eq('id', user.id),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Tempo esgotado. Verifique sua conexão e tente novamente.')), 10_000)
        ),
      ]);
      if (profileResult.error) throw profileResult.error;

      // Atualiza o metadata para indicar que o primeiro acesso foi concluído com sucesso
      // (feito só agora, ao final, para evitar redirect-loop no middleware).
      const metaResult = await Promise.race([
        supabase.auth.updateUser({ data: { must_change_password: false } }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Tempo esgotado. Verifique sua conexão e tente novamente.')), 10_000)
        ),
      ]);
      if (metaResult.error) throw metaResult.error;

      trackAcao('primeiro_acesso_concluido', { aluno: isStudent });
      toast({ title: "Perfil salvo!", description: "Seja bem-vindo à Plataforma!" });
      setStep(3);
      setTimeout(() => window.location.assign("/dashboard"), 2000);
    } catch (err: any) {
      // Falhar aqui deixa o aluno preso: a senha já mudou, mas o metadado
      // `must_change_password` continua ligado e o middleware o traz de volta.
      trackFalha('primeiro_acesso_perfil_falhou', err);
      setError(err.message || "Não foi possível salvar o perfil. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading && !user) return (
    <div className="h-screen w-full flex items-center justify-center bg-gray-950">
      <Loader2 className="h-10 w-10 animate-spin text-accent" />
    </div>
  );

  return (
    // items-start + py-8 permite scroll em telas pequenas sem truncar conteúdo
    <div className="min-h-screen w-full bg-gray-950 flex items-start sm:items-center justify-center p-4 py-8 relative overflow-x-hidden">
      {/* glows */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* cabeçalho */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Primeiro Acesso</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
            Bem-vindo à <span className="text-primary">Plataforma!</span>
          </h1>
          {step < 3 && <StepBar current={step} />}
        </div>

        {/* ════ card ════ */}
        <div className="bg-white rounded-card shadow-2xl overflow-hidden">

          {/* ══ STEP 1: SENHA ══ */}
          {step === 1 && (
            <form onSubmit={handlePassword} noValidate>
              <div className="p-7 pb-5 border-b border-dashed border-slate-100 flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <LockKeyhole className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-black text-primary italic">Crie sua Senha</h2>
                <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xs">
                  Escolha uma senha segura — ela será seu acesso único à plataforma.
                </p>
              </div>

              <div className="p-7 space-y-5">
                {error && (
                  <div className="flex items-start gap-2.5 bg-red-50 text-red-600 rounded-2xl px-4 py-3 text-xs font-bold border border-red-100">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                    Nova Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPass ? "text" : "password"}
                      name="new-password"
                      autoComplete="new-password"
                      autoFocus
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mín. 8 caracteres"
                      className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-bold px-5 pr-14 text-base focus-visible:ring-accent"
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)} aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                      {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                    Confirmar Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      name="confirm-password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Digite a senha novamente"
                      className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-bold px-5 pr-14 text-base focus-visible:ring-accent"
                    />
                    <button type="button" onClick={() => setShowConfirm(p => !p)} aria-label={showConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                      {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* checklist de requisitos — sempre visível, verde quando ok */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="col-span-2 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" /> Sua senha precisa ter
                  </p>
                  {[
                    { label: "Mínimo 8 caracteres", met: hasLength },
                    { label: "Pelo menos 1 número",  met: hasNumber },
                    { label: "1 símbolo (ex: @, !)",  met: hasSymbol },
                    { label: "Confirmação igual",    met: isMatch   },
                  ].map((r, i) => (
                    <div key={i} className={`flex items-center gap-1.5 text-[10px] font-bold transition-colors ${r.met ? 'text-green-600' : 'text-slate-400'}`}>
                      <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 transition-colors ${r.met ? 'bg-green-500' : 'bg-slate-300'}`} />
                      {r.label}
                    </div>
                  ))}
                </div>

                <Button
                  type="submit"
                  disabled={loading || !step1OK}
                  className="w-full h-14 bg-primary text-white font-black text-base rounded-2xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading
                    ? <><Loader2 className="h-5 w-5 animate-spin" /> Salvando...</>
                    : <><span>Continuar</span><ChevronRight className="h-4 w-4" /></>}
                </Button>

                <p className="text-center text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1.5">
                  <Info className="h-3 w-3 shrink-0" /> Esta senha substitui a senha temporária fornecida pela secretaria
                </p>
              </div>
            </form>
          )}

          {/* ══ STEP 2: PERFIL ══ */}
          {step === 2 && (
            <form onSubmit={handleProfile} noValidate>
              <div className="p-7 pb-5 border-b border-dashed border-slate-100 flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-accent" />
                </div>
                <h2 className="text-xl font-black text-primary italic">Seus Dados</h2>
                <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xs">
                  {isStudent 
                    ? "Essas informações ajudam o cursinho a personalizar sua experiência e entrar em contato."
                    : "Informe seu telefone de contato (opcional) para comunicações da escola."}
                </p>
              </div>

              <div className="p-7 space-y-6">
                {error && (
                  <div className="flex items-start gap-2.5 bg-red-50 text-red-600 rounded-2xl px-4 py-3 text-xs font-bold border border-red-100">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
                  </div>
                )}

                {/* telefone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5">
                    Celular / WhatsApp
                    <span className="normal-case font-medium text-slate-400">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      autoFocus
                      value={phone}
                      onChange={e => handlePhoneChange(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="pl-11 h-14 bg-slate-50 border-slate-200 rounded-2xl font-bold text-base focus-visible:ring-accent"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1">Usado para comunicados e lembretes.</p>
                </div>

                {isStudent && (
                  <>
                    {/* sala */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5">
                        Número da Sala
                        <span className="normal-case font-medium text-slate-400">(opcional)</span>
                      </Label>
                      <Select value={sala} onValueChange={setSala}>
                        <SelectTrigger className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-bold text-base focus-visible:ring-accent">
                          <SelectValue placeholder="Selecione a sala..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 15 }, (_, i) => String(i + 1)).map(n => (
                            <SelectItem key={n} value={n}>Sala {n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* objetivo */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5">
                        Qual é o seu objetivo?
                        <span className="text-red-400 font-black">*</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        {EXAM_OPTIONS.map(o => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setExamTarget(o.id)}
                            aria-pressed={examTarget === o.id}
                            className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 text-left
                              ${examTarget === o.id
                                ? 'border-primary bg-primary/5 shadow-md'
                                : 'border-slate-200 bg-slate-50 hover:border-slate-300 active:scale-[0.97]'}`}
                          >
                            {examTarget === o.id && (
                              <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-primary" />
                            )}
                            <o.icon className={`h-7 w-7 ${examTarget === o.id ? 'text-primary' : 'text-slate-400'}`} />
                            <div className="text-center">
                              <p className={`font-black text-base ${examTarget === o.id ? 'text-primary' : 'text-slate-700'}`}>{o.label}</p>
                              <p className="text-[10px] text-slate-400 font-medium leading-snug mt-0.5">{o.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* turno */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5">
                        Qual turno você estuda?
                        <span className="text-red-400 font-black">*</span>
                      </Label>
                      <Select value={turno} onValueChange={setTurno}>
                        <SelectTrigger className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-bold text-base focus-visible:ring-accent">
                          <SelectValue placeholder="Selecione o turno..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manha">Manhã (07h–12h)</SelectItem>
                          <SelectItem value="tarde">Tarde (13h–18h)</SelectItem>
                          <SelectItem value="integral">Integral (Manhã + Tarde)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* rodapé obrigatórios */}
                    <p className="text-[10px] text-slate-400 ml-1">
                      <span className="text-red-400 font-black">*</span> Campos obrigatórios
                    </p>
                  </>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(null); }}
                    aria-label="Voltar para definição de senha"
                    className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 active:scale-95 transition-all shrink-0"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <Button
                    type="submit"
                    disabled={loading || (isStudent && (!examTarget || !turno))}
                    className="flex-1 h-14 bg-primary text-white font-black text-base rounded-2xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {loading
                      ? <><Loader2 className="h-5 w-5 animate-spin" /> Salvando...</>
                      : <><span>Ativar Minha Conta</span><ChevronRight className="h-4 w-4" /></>}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* ══ STEP 3: SUCESSO ══ */}
          {step === 3 && (
            <div className="p-12 text-center space-y-5">
              <div className="h-20 w-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-primary italic">Tudo pronto!</h3>
                <p className="text-sm text-slate-400 font-medium mt-1.5 leading-relaxed">
                  Sua conta foi ativada com sucesso.<br />Você será redirecionado em instantes.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span className="text-xs text-slate-400 font-medium">Entrando na plataforma...</span>
              </div>
            </div>
          )}
        </div>

        <footer className="text-center opacity-40 pb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white">
            Plataforma • Sistema Acadêmico Inteligente
          </p>
        </footer>
      </div>
    </div>
  );
}
