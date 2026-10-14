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
          {type === 'invite' ? 'Link de primeiro acesso' : 'Link para redefinir a senha'}
        </div>
      </div>

      <div className="bg-muted/40 border rounded-card p-4 space-y-3">
        <p className="text-xs font-mono text-muted-foreground break-all leading-relaxed">
          {preview}
          {!showFull && (
            <button
              onClick={() => setShowFull(true)}
              className="ml-1 text-primary underline text-xs font-bold"
            >
              ver completo
            </button>
          )}
        </p>

        <div className="flex gap-2">
          <Button
            onClick={handleCopy}
            className="flex-1 h-10 rounded-control font-bold text-xs gap-2"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar link'}
          </Button>
          <Button
            variant="outline"
            onClick={onRegenerate}
            disabled={loading}
            aria-label="Gerar novo link"
            title="Gerar novo link"
            className="h-10 px-4 rounded-control font-bold text-xs"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
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
        setError(data.error || 'Não foi possível criar o usuário.');
        return;
      }

      setCreatedUser(data.user);
      setDefaultPassword(data.defaultPassword ?? null);
      toast({ title: 'Usuário criado' });
      await generateInviteLink(data.user.email);

    } catch {
      setError('Sem conexão com o servidor. Tente novamente.');
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
        title: 'Não foi possível gerar o link',
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
      <div className="max-w-xl mx-auto space-y-6 py-8 px-1">
        <div className="text-center space-y-3">
          <div className="h-14 w-14 bg-emerald-100 rounded-card flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="u-label">Coordenação · novo usuário</p>
          <h1 className="u-page-title text-3xl">Usuário criado</h1>
          <p className="text-sm text-muted-foreground">
            <strong>{createdUser.name}</strong> foi cadastrado com o e-mail{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono break-all">{createdUser.email}</code>
          </p>
        </div>

        {/* Senha padrão */}
        {defaultPassword && (
          <div className="bg-amber-50 border border-amber-200 rounded-card p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-control bg-amber-200 flex items-center justify-center shrink-0">
                <KeyRound className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">Senha padrão de acesso</p>
                <p className="text-xs text-amber-800">O aluno usa essa senha para entrar pela primeira vez</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-card rounded-control px-4 py-3 border border-amber-200">
              <code className="flex-1 min-w-0 truncate text-base font-bold text-amber-900 font-mono tracking-wider">{defaultPassword}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(defaultPassword);
                  toast({ title: 'Senha copiada' });
                }}
                className="h-8 px-3 text-amber-800 hover:bg-amber-100 rounded-control font-bold text-xs shrink-0"
              >
                <Copy size={13} className="mr-1" /> Copiar
              </Button>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              No primeiro login o aluno será solicitado a criar uma nova senha.
            </p>
          </div>
        )}

        <div className="bg-card rounded-card border p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-8 w-8 rounded-control bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-sm font-bold text-foreground">Link de primeiro acesso</h2>
          </div>

          {linkLoading && !inviteLink ? (
            <div className="py-6 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Gerando o link…</span>
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
              className="w-full h-11 rounded-control font-bold"
            >
              <Sparkles size={16} className="mr-2" />
              Gerar link de acesso
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            asChild
            variant="outline"
            className="flex-1 h-11 rounded-control font-bold"
          >
            <Link href="/dashboard/admin/users">Ver lista de usuários</Link>
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
            className="flex-1 h-11 rounded-control font-bold"
          >
            Criar outro usuário
          </Button>
        </div>
      </div>
    );
  }

  // ── Formulário ──
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 px-1">

      {/* Cabeçalho */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-control mt-1 shrink-0">
          <Link href="/dashboard/admin/users" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <p className="u-label">Coordenação · usuários</p>
          <h1 className="u-page-title text-3xl mt-1">Novo usuário</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Preencha os dados. O e-mail será gerado automaticamente no padrão da plataforma.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Erro global */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-card text-sm text-red-700 font-medium break-words">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Bloco 1: Identidade */}
        <fieldset className="bg-card rounded-card border p-5 sm:p-6 space-y-5">
          <legend className="u-label px-1">
            Identidade
          </legend>

          <div className="space-y-2">
            <Label className="u-label">
              Nome completo <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.fullName}
              onChange={e => setField('fullName', e.target.value)}
              placeholder="Ex: João Carlos Silva"
              className="h-11 rounded-control"
              required
            />
            <p className="text-xs text-muted-foreground px-1">
              Use o nome completo para gerar o e-mail corretamente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="u-label">CPF</Label>
              <Input
                value={form.cpf}
                onChange={e => setField('cpf', cpfMask(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className="h-11 rounded-control"
              />
            </div>

            <div className="space-y-2">
              <Label className="u-label">
                Data de nascimento
              </Label>
              <Input
                type="date"
                value={form.birthDate}
                onChange={e => setField('birthDate', e.target.value)}
                className="h-11 rounded-control"
              />
            </div>
          </div>
        </fieldset>

        {/* Bloco 2: E-mail gerado */}
        <fieldset className="bg-card rounded-card border p-5 sm:p-6 space-y-4">
          <legend className="u-label px-1">
            E-mail de acesso
          </legend>

          <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-control border">
            <Mail size={18} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="u-label mb-0.5">
                E-mail gerado automaticamente
              </p>
              <p className="text-sm font-bold text-foreground font-mono truncate">
                {generatedEmail || (
                  <span className="text-muted-foreground font-normal">
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
              className="h-11 rounded-control"
            />
          )}
        </fieldset>

        {/* Bloco 3: Papel */}
        <fieldset className="bg-card rounded-card border p-5 sm:p-6 space-y-5">
          <legend className="u-label px-1">
            Papel na plataforma
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
                  className={`flex items-center gap-2.5 p-3 rounded-control border-2 cursor-pointer transition-colors font-bold text-sm ${
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
            <Label className="u-label">
              Cargo / perfil
            </Label>
            <Select value={form.profileType} onValueChange={v => setField('profileType', v)}>
              <SelectTrigger className="h-11 rounded-control">
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
          <fieldset className="bg-card rounded-card border p-5 sm:p-6 space-y-5">
            <legend className="u-label px-1">
              Dados acadêmicos
            </legend>

            <div className="space-y-2">
              <Label className="u-label">
                Objetivo do aluno
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
              <Label className="u-label">
                Escola / polo
              </Label>
              <Select value={form.institution} onValueChange={v => setField('institution', v)}>
                <SelectTrigger className="h-11 rounded-control">
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
              <Label className="u-label">
                Turma / curso
              </Label>
              <Input
                value={form.course}
                onChange={e => setField('course', e.target.value)}
                placeholder="Ex: 3ª Série A, Informática"
                className="h-11 rounded-control"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="u-label">
                  Número da sala
                </Label>
                <Select value={form.sala} onValueChange={v => setField('sala', v)}>
                  <SelectTrigger className="h-11 rounded-control">
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
                <Label className="u-label">
                  Turno
                </Label>
                <Select value={form.turno} onValueChange={v => setField('turno', v)}>
                  <SelectTrigger className="h-11 rounded-control">
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
        <div className="bg-muted/30 rounded-card border p-5 space-y-4">
          <p className="u-label">Resumo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Nome</span>
              <p className="font-bold text-foreground truncate">{form.fullName || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">E-mail</span>
              <p className="font-bold text-foreground truncate font-mono text-xs">{finalEmail || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Papel</span>
              <p className="font-bold text-foreground">{form.profileType || '—'}</p>
            </div>
            {isStudent && (
              <div>
                <span className="text-muted-foreground text-xs">Objetivo</span>
                <p className="font-bold text-foreground">{form.examTarget}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-control px-3 py-2 font-medium">
            <KeyRound size={14} className="shrink-0" />
            O usuário receberá um link temporário para definir sua própria senha no primeiro acesso.
          </div>

          <Button
            type="submit"
            disabled={loading || !form.fullName.trim() || !finalEmail}
            variant="arcade"
            className="w-full h-12 font-bold text-sm rounded-control"
          >
            {loading ? (
              <span className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                Criando usuário…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <UserPlus size={18} />
                Criar usuário e gerar link
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
