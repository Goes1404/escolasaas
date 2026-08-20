"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserPlus,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Mail,
  KeyRound,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/AuthProvider";
import { SCHOOL_LIST } from "@/lib/constants";

// ────────────────────────────────────────────────
// Utilitários
// ────────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}

function generateEmail(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return `${normalizeStr(parts[0])}@compromisso.com`;
  if (parts.length === 2) return `${normalizeStr(parts[0])}${normalizeStr(parts[1])}@compromisso.com`;
  const first = normalizeStr(parts[0]);
  const mid = normalizeStr(parts[1]).charAt(0);
  const last = normalizeStr(parts[parts.length - 1]);
  return `${first}${mid}${last}@compromisso.com`;
}

function cpfMask(v: string): string {
  return v.replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+$/, '$1');
}

// ────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────

type Role = 'student' | 'teacher' | 'admin' | 'staff';
type ExamTarget = 'ENEM' | 'ETEC';

interface FormData {
  fullName: string;
  cpf: string;
  birthDate: string;
  role: Role;
  profileType: string;
  examTarget: ExamTarget;
  institution: string;
  course: string;
  sala: string;
  turno: string;
  emailOverride: string;
}

const ROLE_OPTIONS: { value: Role; label: string; color: string }[] = [
  { value: 'student', label: 'Aluno', color: 'bg-blue-100 text-blue-700' },
  { value: 'teacher', label: 'Professor', color: 'bg-purple-100 text-purple-700' },
  { value: 'admin', label: 'Coordenação / Admin', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'staff', label: 'Equipe de Apoio', color: 'bg-orange-100 text-orange-700' },
];

const SALA_OPTIONS = ['1','2','3','4','5','6','7','8','9','10'];

const TURNO_OPTIONS = [
  { value: 'manha',    label: 'Manhã'    },
  { value: 'tarde',    label: 'Tarde'    },
  { value: 'integral', label: 'Integral' },
];

const PROFILE_TYPES: Record<Role, string[]> = {
  student: ['Estudante ENEM', 'Estudante ETEC'],
  teacher: ['Professor', 'Coordenador Pedagógico'],
  admin: ['Administrador', 'Coordenação'],
  staff: ['Assessor', 'Secretaria', 'Apoio Técnico', 'Videomaker', 'Psicóloga', 'Agente Educacional'],
};

// ────────────────────────────────────────────────
// Componente de Link Gerado
// ────────────────────────────────────────────────

function GeneratedLinkCard({
  link,
  type,
  onRegenerate,
  loading,
}: {
  link: string;
  type: 'invite' | 'recovery';
  onRegenerate: () => void;
  loading: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const preview = showFull ? link : `${link.substring(0, 60)}...`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
          <Clock size={12} />
          Expira em 1 hora
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
          <CheckCircle2 size={12} />
          {type === 'invite' ? 'Link de Primeiro Acesso' : 'Link de Reset de Senha'}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-mono text-slate-600 break-all leading-relaxed">
          {preview}
          {!showFull && (
            <button
              onClick={() => setShowFull(true)}
              className="ml-1 text-accent underline text-xs font-bold"
            >
              ver completo
            </button>
          )}
        </p>

        <div className="flex gap-2">
          <Button
            onClick={handleCopy}
            className="flex-1 h-10 rounded-xl font-bold text-xs gap-2 bg-primary text-white border-none"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado!' : 'Copiar Link'}
          </Button>
          <Button
            variant="outline"
            onClick={onRegenerate}
            disabled={loading}
            className="h-10 px-4 rounded-xl font-bold text-xs border-muted/30"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-medium leading-relaxed">
        Envie este link pelo WhatsApp ou e-mail. Ele funciona <strong>uma única vez</strong> e
        expira em 1 hora. O usuário será redirecionado para definir uma nova senha.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────
// Página Principal
// ────────────────────────────────────────────────

export default function AdminNewUserPage() {
  const { userRole } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState<FormData>({
    fullName: '',
    cpf: '',
    birthDate: '',
    role: 'student',
    profileType: 'Estudante ENEM',
    examTarget: 'ENEM',
    institution: '',
    course: '',
    sala: '',
    turno: '',
    emailOverride: '',
  });

  const [generatedEmail, setGeneratedEmail] = useState('');
  const [useCustomEmail, setUseCustomEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultPassword, setDefaultPassword] = useState<string | null>(null);

  // Estado pós-criação
  const [createdUser, setCreatedUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    if (form.fullName && !useCustomEmail) {
      setGeneratedEmail(generateEmail(form.fullName));
    }
  }, [form.fullName, useCustomEmail]);

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const finalEmail = useCustomEmail ? form.emailOverride : generatedEmail;
  const isStudent = form.role === 'student';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.fullName.trim()) {
      setError('Nome completo é obrigatório.');
      return;
    }
    if (!finalEmail) {
      setError('Não foi possível gerar o e-mail. Verifique o nome.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          cpf: form.cpf,
          birthDate: form.birthDate || undefined,
          role: form.role,
          profileType: form.profileType,
          institution: form.institution,
          course: form.course,
          sala: form.sala || undefined,
          turno: form.turno || undefined,
          examTarget: form.examTarget,
          emailOverride: useCustomEmail ? form.emailOverride : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar usuário.');
        return;
      }

      setCreatedUser(data.user);
      setDefaultPassword(data.defaultPassword ?? null);
      toast({ title: 'Usuário criado com sucesso!' });
      await generateInviteLink(data.user.email);

    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const generateInviteLink = async (email: string) => {
    setLinkLoading(true);
    try {
      const res = await fetch('/api/admin/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          type: 'invite',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteLink(data.link);
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar link',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLinkLoading(false);
    }
  };

  // Redireciona não-admins
  if (userRole && userRole !== 'admin' && userRole !== 'staff') {
    router.replace('/dashboard');
    return null;
  }

  // ── Tela de Sucesso ──
  if (createdUser) {
    return (
      <div className="max-w-xl mx-auto space-y-8 animate-in fade-in duration-500 py-8">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-primary">Usuário Criado!</h1>
          <p className="text-sm text-muted-foreground">
            <strong>{createdUser.name}</strong> foi cadastrado com o e-mail{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">{createdUser.email}</code>
          </p>
        </div>

        {/* Senha padrão */}
        {defaultPassword && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-amber-200 flex items-center justify-center shrink-0">
                <KeyRound className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p className="text-xs font-black text-amber-800">Senha Padrão de Acesso</p>
                <p className="text-[10px] text-amber-600 font-medium">O aluno usa essa senha para entrar pela primeira vez</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-amber-200">
              <code className="flex-1 text-base font-black text-amber-900 font-mono tracking-wider">{defaultPassword}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(defaultPassword);
                  toast({ title: 'Senha copiada!' });
                }}
                className="h-8 px-3 text-amber-700 hover:bg-amber-100 rounded-lg font-bold text-xs"
              >
                <Copy size={13} className="mr-1" /> Copiar
              </Button>
            </div>
            <p className="text-[10px] text-amber-600 font-medium leading-relaxed">
              No primeiro login o aluno será solicitado a criar uma nova senha.
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-muted/20 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-sm font-black text-primary">Link de Primeiro Acesso</h2>
          </div>

          {linkLoading && !inviteLink ? (
            <div className="py-6 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Gerando link seguro...</span>
            </div>
          ) : inviteLink ? (
            <GeneratedLinkCard
              link={inviteLink}
              type="invite"
              onRegenerate={() => generateInviteLink(createdUser.email)}
              loading={linkLoading}
            />
          ) : (
            <Button
              onClick={() => generateInviteLink(createdUser.email)}
              className="w-full h-11 rounded-xl font-bold bg-primary text-white border-none"
            >
              <Sparkles size={16} className="mr-2" />
              Gerar Link de Acesso
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            asChild
            variant="outline"
            className="flex-1 h-11 rounded-xl font-bold border-muted/30"
          >
            <Link href="/dashboard/admin/users">Ver Diretório</Link>
          </Button>
          <Button
            onClick={() => {
              setCreatedUser(null);
              setInviteLink(null);
              setDefaultPassword(null);
              setForm({
                fullName: '', cpf: '', birthDate: '', role: 'student', profileType: 'Estudante ENEM',
                examTarget: 'ENEM', institution: '', course: '', sala: '', turno: '', emailOverride: '',
              });
              setGeneratedEmail('');
            }}
            className="flex-1 h-11 rounded-xl font-bold bg-primary text-white border-none"
          >
            Criar Outro Usuário
          </Button>
        </div>
      </div>
    );
  }

  // ── Formulário ──
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 px-1">

      {/* Cabeçalho */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-xl mt-1 shrink-0">
          <Link href="/dashboard/admin/users">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-black text-primary italic leading-none">Novo Usuário</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preencha os dados. O e-mail será gerado automaticamente no padrão da plataforma.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Erro global */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Bloco 1: Identidade */}
        <fieldset className="bg-white rounded-2xl border border-muted/20 shadow-sm p-6 space-y-5">
          <legend className="text-xs font-black uppercase text-primary/50 tracking-widest px-1">
            Identidade
          </legend>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-primary/60 tracking-widest">
              Nome Completo <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.fullName}
              onChange={e => setField('fullName', e.target.value)}
              placeholder="Ex: João Carlos Silva"
              className="h-12 rounded-xl bg-slate-50 border-none font-medium shadow-sm focus-visible:ring-accent"
              required
            />
            <p className="text-xs text-muted-foreground px-1">
              Use o nome completo para gerar o e-mail corretamente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-primary/60 tracking-widest">CPF</Label>
              <Input
                value={form.cpf}
                onChange={e => setField('cpf', cpfMask(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className="h-12 rounded-xl bg-slate-50 border-none font-medium shadow-sm focus-visible:ring-accent"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-primary/60 tracking-widest">
                Data de Nascimento
              </Label>
              <Input
                type="date"
                value={form.birthDate}
                onChange={e => setField('birthDate', e.target.value)}
                className="h-12 rounded-xl bg-slate-50 border-none font-medium shadow-sm focus-visible:ring-accent"
              />
            </div>
          </div>
        </fieldset>

        {/* Bloco 2: E-mail gerado */}
        <fieldset className="bg-white rounded-2xl border border-muted/20 shadow-sm p-6 space-y-4">
          <legend className="text-xs font-black uppercase text-primary/50 tracking-widest px-1">
            E-mail de Acesso
          </legend>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <Mail size={18} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                E-mail gerado automaticamente
              </p>
              <p className="text-sm font-black text-primary font-mono truncate">
                {generatedEmail || (
                  <span className="text-muted-foreground font-normal italic">
                    Digite o nome para gerar
                  </span>
                )}
              </p>
            </div>
            {generatedEmail && (
              <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px] shrink-0">
                Padrão
              </Badge>
            )}
          </div>

          {/* Toggle e-mail personalizado */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="custom-email"
              checked={useCustomEmail}
              onChange={e => setUseCustomEmail(e.target.checked)}
              className="h-4 w-4 rounded accent-primary cursor-pointer"
            />
            <label htmlFor="custom-email" className="text-xs font-semibold text-muted-foreground cursor-pointer">
              Usar e-mail personalizado (fora do padrão @compromisso.com)
            </label>
          </div>

          {useCustomEmail && (
            <Input
              type="email"
              value={form.emailOverride}
              onChange={e => setField('emailOverride', e.target.value)}
              placeholder="email@exemplo.com"
              className="h-12 rounded-xl bg-slate-50 border-none font-medium shadow-sm focus-visible:ring-accent"
            />
          )}
        </fieldset>

        {/* Bloco 3: Papel */}
        <fieldset className="bg-white rounded-2xl border border-muted/20 shadow-sm p-6 space-y-5">
          <legend className="text-xs font-black uppercase text-primary/50 tracking-widest px-1">
            Papel na Plataforma
          </legend>

          <RadioGroup
            value={form.role}
            onValueChange={v => {
              const newRole = v as Role;
              setField('role', newRole);
              setField('profileType', PROFILE_TYPES[newRole][0]);
            }}
            className="grid grid-cols-2 gap-3"
          >
            {ROLE_OPTIONS.map(opt => (
              <div key={opt.value}>
                <RadioGroupItem value={opt.value} id={`role-${opt.value}`} className="sr-only" />
                <label
                  htmlFor={`role-${opt.value}`}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all font-bold text-sm ${
                    form.role === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-muted/30 hover:border-primary/30'
                  }`}
                >
                  <div className={`h-2 w-2 rounded-full ${form.role === opt.value ? 'bg-primary' : 'bg-muted'}`} />
                  {opt.label}
                </label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-primary/60 tracking-widest">
              Cargo / Perfil Detalhado
            </Label>
            <Select value={form.profileType} onValueChange={v => setField('profileType', v)}>
              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-medium shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROFILE_TYPES[form.role].map(pt => (
                  <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        {/* Bloco 4: Dados acadêmicos (apenas alunos) */}
        {isStudent && (
          <fieldset className="bg-white rounded-2xl border border-muted/20 shadow-sm p-6 space-y-5">
            <legend className="text-xs font-black uppercase text-primary/50 tracking-widest px-1">
              Dados Acadêmicos
            </legend>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-primary/60 tracking-widest">
                Objetivo do Aluno
              </Label>
              <RadioGroup
                value={form.examTarget}
                onValueChange={v => setField('examTarget', v as ExamTarget)}
                className="flex gap-4"
              >
                {(['ENEM', 'ETEC'] as ExamTarget[]).map(t => (
                  <div key={t} className="flex items-center gap-2">
                    <RadioGroupItem value={t} id={`exam-${t}`} />
                    <label htmlFor={`exam-${t}`} className="text-sm font-bold cursor-pointer">{t}</label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-primary/60 tracking-widest">
                Escola / Polo
              </Label>
              <Select value={form.institution} onValueChange={v => setField('institution', v)}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-medium shadow-sm">
                  <SelectValue placeholder="Selecione a escola..." />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_LIST.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-primary/60 tracking-widest">
                Turma / Curso
              </Label>
              <Input
                value={form.course}
                onChange={e => setField('course', e.target.value)}
                placeholder="Ex: 3ª Série A, Informática"
                className="h-12 rounded-xl bg-slate-50 border-none font-medium shadow-sm focus-visible:ring-accent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-primary/60 tracking-widest">
                  Número da Sala
                </Label>
                <Select value={form.sala} onValueChange={v => setField('sala', v)}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-medium shadow-sm">
                    <SelectValue placeholder="Selecione a sala..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SALA_OPTIONS.map(n => (
                      <SelectItem key={n} value={n}>Sala {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-primary/60 tracking-widest">
                  Turno
                </Label>
                <Select value={form.turno} onValueChange={v => setField('turno', v)}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-medium shadow-sm">
                    <SelectValue placeholder="Selecione o turno..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TURNO_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>
        )}

        {/* Resumo e submit */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
          <p className="text-xs font-black uppercase text-primary/50 tracking-widest">Resumo</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Nome</span>
              <p className="font-bold text-primary truncate">{form.fullName || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">E-mail</span>
              <p className="font-bold text-primary truncate font-mono text-xs">{finalEmail || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Papel</span>
              <p className="font-bold text-primary">{form.profileType || '—'}</p>
            </div>
            {isStudent && (
              <div>
                <span className="text-muted-foreground text-xs">Objetivo</span>
                <p className="font-bold text-primary">{form.examTarget}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-medium">
            <KeyRound size={14} className="shrink-0" />
            O usuário receberá um link temporário para definir sua própria senha no primeiro acesso.
          </div>

          <Button
            type="submit"
            disabled={loading || !form.fullName.trim() || !finalEmail}
            className="w-full h-13 bg-primary text-white font-black text-sm rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all border-none h-12"
          >
            {loading ? (
              <span className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                Criando usuário...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <UserPlus size={18} />
                Criar Usuário e Gerar Link
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
