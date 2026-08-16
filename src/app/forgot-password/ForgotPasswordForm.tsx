"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, AlertCircle, CheckCircle2, Lock, Phone,
  Eye, EyeOff, ArrowLeft, KeyRound, MessageSquare,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Step = "phone" | "otp";

/**
 * Atendimento da secretaria por WhatsApp.
 *
 * A recuperação automática exige telefone cadastrado ou data de nascimento, e
 * hoje a maioria das contas não tem nenhum dos dois — para essas pessoas o
 * atendimento humano é o único caminho, não um plano B.
 *
 * Número em formato internacional, sem símbolos, como o wa.me exige.
 */
const WHATSAPP_NUMBER = "5511950085875";
const WHATSAPP_MESSAGE =
  "Olá! Não consegui recuperar minha senha na plataforma e preciso de ajuda.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

async function callApi(action: string, payload: Record<string, unknown>) {
  const res = await Promise.race([
    fetch("/api/student/primeiro-acesso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tempo esgotado. Verifique sua conexão e tente novamente.")), 15_000)
    ),
  ]);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Não foi possível completar a operação.");
  return data;
}

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [resetToken, setResetToken] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const startCooldown = () => {
    setResendCooldown(60);
    const id = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const handlePhoneLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError("Informe seu telefone com DDD.");
      return;
    }
    setLoading(true);
    try {
      const data = await callApi("lookup-phone", { phone });
      if (data.found === false) {
        // Antes daqui saía uma etapa que pedia nome + data de nascimento para
        // cadastrar o telefone. Ela foi removida: a data de nascimento era a
        // ÚNICA prova de identidade desse caminho e só 39 dos 1058 alunos a têm
        // cadastrada — na prática atendia 3,7% e confundia o resto. Sem ela o
        // caminho viraria "digite o nome de alguém e cadastre seu telefone",
        // ou seja, tomada de conta. Quem não tem telefone vai para o
        // atendimento humano, que confere identidade presencialmente.
        setError(
          "Não encontramos esse telefone em nenhum cadastro. " +
          "Muitas contas ainda não têm telefone registrado — se for o seu caso, " +
          "fale com a secretaria pelo WhatsApp que ela redefine sua senha na hora."
        );
      } else {
        setResetToken(data.resetToken);
        setMaskedPhone(data.maskedPhone);
        setStep("otp");
        startCooldown();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleResend = async () => {
    setError(null);
    setLoading(true);
    try {
      await callApi("resend", { resetToken });
      startCooldown();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("Informe o código recebido por SMS.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A nova senha precisa de pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await callApi("confirm", { resetToken, code, newPassword });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 7) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };
  const strength = getPasswordStrength(newPassword);
  const strengthColor = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"][strength];
  const strengthText = ["Muito Fraca", "Fraca", "Média", "Forte", "Excelente"][strength];

  if (success) {
    return (
      <Card className="w-full max-w-md border-none shadow-2xl bg-white/95 backdrop-blur-md rounded-[2rem] p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-primary italic uppercase tracking-tighter">Senha Redefinida!</h2>
          <p className="text-sm text-primary/60 font-medium leading-relaxed italic">
            Tudo certo. Sua nova senha já está ativa. É só entrar.
          </p>
        </div>
        <Button asChild className="w-full bg-primary hover:bg-primary/95 text-white font-black h-14 rounded-2xl shadow-xl border-none text-sm uppercase tracking-widest">
          <a href="/login">Ir para o Login</a>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden bg-white/95 backdrop-blur-md rounded-[2rem]">
      <CardHeader className="space-y-1 pb-6 pt-8 text-center bg-primary/5 border-b border-dashed">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-accent" />
          </div>
        </div>
        <CardTitle className="text-xl font-black text-primary italic uppercase">Recuperar Acesso</CardTitle>
        <CardDescription className="text-xs font-medium italic px-4">
          {step === "phone" && "Informe o telefone cadastrado pra receber o código."}
          {step === "otp" && `Enviamos um código pro telefone ${maskedPhone}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pt-8 space-y-5 pb-8">
        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-[11px] font-bold">{error}</AlertDescription>
          </Alert>
        )}

        {/* Saída pelo atendimento humano. A recuperação automática depende de
            telefone ou data de nascimento no cadastro, e a maioria das contas
            ainda não tem nenhum dos dois — sem esta saída o aluno fica sem
            caminho nenhum. Aparece sempre, e com destaque quando deu erro. */}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 w-full h-12 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 ${
            error
              ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Falar com a secretaria no WhatsApp
        </a>

        {step === "phone" && (
          <form onSubmit={handlePhoneLookup} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 px-2">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 90000-0000"
                  className="pl-11 h-14 bg-muted/30 border-none rounded-xl font-bold"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/95 text-white font-black h-14 text-sm shadow-xl rounded-xl transition-all border-none uppercase tracking-widest">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continuar"}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 px-2">Código Recebido</Label>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  className="pl-11 h-14 bg-muted/30 border-none rounded-xl font-bold tracking-[0.3em]"
                  required
                  disabled={loading}
                />
              </div>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                className="text-[10px] font-black uppercase text-accent/70 hover:text-accent disabled:text-muted-foreground/50 px-2"
              >
                {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar código"}
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 px-2">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pl-11 pr-11 h-14 bg-muted/30 border-none rounded-xl font-bold"
                  required
                  disabled={loading}
                />
                <button type="button" onClick={() => setShowPass((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword && (
                <div className="px-2 space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                    <span className="text-primary/40">Segurança</span>
                    <span className={strength > 2 ? "text-emerald-500" : "text-orange-500"}>{strengthText}</span>
                  </div>
                  <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden">
                    <div className={`h-full ${strengthColor} transition-all duration-500`} style={{ width: `${(strength / 4) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 px-2">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="pl-11 h-14 bg-muted/30 border-none rounded-xl font-bold"
                  required
                  disabled={loading}
                />
              </div>
              {confirmPassword && (
                <div className={`flex items-center gap-2 text-[11px] font-bold ml-2 ${newPassword === confirmPassword ? "text-emerald-600" : "text-red-500"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {newPassword === confirmPassword ? "Senhas coincidem" : "Senhas não coincidem"}
                </div>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/95 text-white font-black h-14 text-sm shadow-xl rounded-xl transition-all border-none uppercase tracking-widest">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Redefinir Senha"}
            </Button>
          </form>
        )}

        <div className="pt-1 space-y-3">
          <Button asChild variant="ghost" className="w-full text-[10px] font-black uppercase text-primary/40 h-10 rounded-xl">
            <a href="/login" className="flex items-center justify-center gap-2"><ArrowLeft className="h-3 w-3" /> Lembrei minha senha / Voltar</a>
          </Button>
          <p className="text-center text-[10px] text-muted-foreground/70 font-medium leading-relaxed px-2">
            Não conseguiu recuperar? Procure a secretaria para redefinir.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
