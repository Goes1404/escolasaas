"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  Loader2,
  Link2,
  UserCheck,
  UserX,
  Pencil,
  KeyRound,
  RefreshCw,
  Check,
  Copy,
  Sparkles,
  CheckCircle2,
  Circle,
  AlertCircle,
  HelpCircle,
  HandHeart,
  Mail,
  GraduationCap,
  UserPlus,
  Trash2,
  Phone,
  Eye
} from "lucide-react";
import Link from "next/link";
import { SCHOOL_LIST } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/export-csv";
import { StudentFilterBar, distinctOptions } from "@/components/secretary/StudentFilterBar";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { fmtBRL, fmtNumber, toNumber, txt } from "@/lib/format";

// ────────────────────────────────────────────────
// Modal de Convite (Cadastro de Aluno)
// ────────────────────────────────────────────────
function InviteLinkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiryDays, setExpiryDays] = useState(7);

  const generateInvite = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/generate-registration-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiryDays: expiryDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLink(data.link);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Link de convite copiado' });
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-md rounded-card p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b text-left">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-11 w-11 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="u-label">Secretaria · matrículas</p>
              <DialogTitle className="u-page-title text-xl mt-0.5">
                Link de cadastro
              </DialogTitle>
              <DialogDescription className="text-xs mt-1 text-muted-foreground">
                Para novos alunos se cadastrarem sozinhos
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {!link ? (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Com este link, novos alunos criam a própria conta. Eles entram automaticamente
                com o papel de <strong className="text-foreground">aluno</strong>.
              </p>
              
              <div className="space-y-3">
                <Label className="u-label ml-1">Validade do link (dias)</Label>
                <div className="flex gap-2">
                  {[1, 3, 7, 15, 30].map(d => (
                    <Button
                      key={d}
                      type="button"
                      variant={expiryDays === d ? 'default' : 'outline'}
                      onClick={() => setExpiryDays(d)}
                      aria-pressed={expiryDays === d}
                      className={`flex-1 min-w-0 px-0 h-11 rounded-control font-bold text-sm ${expiryDays === d ? '' : 'text-muted-foreground'}`}
                    >
                      {d}d
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                onClick={generateInvite}
                disabled={loading}
                variant="arcade"
                className="w-full h-11 font-bold rounded-control"
              >
                {loading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Gerar link de cadastro
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="border border-border rounded-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                   <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px] px-2.5">Link ativo</Badge>
                   <span className="u-label">Expira em {expiryDays} {expiryDays === 1 ? "dia" : "dias"}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground break-all bg-muted/40 p-3 rounded-control">
                  {link}
                </p>
                <Button
                  onClick={handleCopy}
                  className="w-full h-11 font-bold rounded-control gap-2"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Link copiado' : 'Copiar link'}
                </Button>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-control border border-border text-muted-foreground">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="text-sm leading-snug">
                  Envie este link nos grupos de novos alunos para que eles mesmos façam o cadastro.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────
// Modal de Recuperação de Senha
// ────────────────────────────────────────────────
interface ResetModalProps {
  user: { id: string; name: string; email: string } | null;
  open: boolean;
  onClose: () => void;
}
function ResetPasswordModal({ user, open, onClose }: ResetModalProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'link' | 'direct'>('link');
  const [link, setLink] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('mudar123');
  const [directLoading, setDirectLoading] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [directSuccess, setDirectSuccess] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (open) {
      setTab('link');
      setLink(null);
      setLinkError(null);
      setCopied(false);
      setNewPassword('mudar123');
      setDirectError(null);
      setDirectSuccess(false);
    }
  }, [open, user?.id]);

  const generateLink = async () => {
    if (!user) return;
    setLinkLoading(true);
    setLinkError(null);
    try {
      const res = await fetch('/api/admin/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          type: 'recovery',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLink(data.link);
    } catch (err: any) {
      setLinkError(err.message || 'Falha ao gerar link. Tente novamente.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Link copiado' });
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDirectReset = async () => {
    if (!user || !newPassword.trim()) return;
    if (newPassword.length < 8) {
      setDirectError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    setDirectLoading(true);
    setDirectError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDirectSuccess(true);
      toast({ title: 'Senha redefinida' });
    } catch (err: any) {
      setDirectError(err.message || 'Falha ao redefinir.');
    } finally {
      setDirectLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-md rounded-card p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b text-left">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="u-label">Secretaria · acesso</p>
              <DialogTitle className="u-page-title text-lg mt-0.5">Redefinir senha</DialogTitle>
              <DialogDescription className="text-xs truncate">{user?.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2 bg-muted/40 rounded-control px-3 py-2 text-xs min-w-0">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-mono text-muted-foreground truncate">{user?.email}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-control">
            <button onClick={() => setTab('link')} aria-pressed={tab === 'link'} className={`h-9 rounded-control text-sm font-semibold transition-colors ${tab === 'link' ? 'bg-background text-foreground' : 'text-muted-foreground'}`}>Enviar link</button>
            <button onClick={() => setTab('direct')} aria-pressed={tab === 'direct'} className={`h-9 rounded-control text-sm font-semibold transition-colors ${tab === 'direct' ? 'bg-background text-foreground' : 'text-muted-foreground'}`}>Definir senha</button>
          </div>

          {tab === 'link' && (
            <div className="space-y-4">
              {!link && !linkLoading && !linkError && (
                <Button onClick={generateLink} variant="arcade" className="w-full h-11 font-bold rounded-control">
                  Gerar link de recuperação
                </Button>
              )}
              {linkLoading && <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
              {linkError && <div className="text-sm text-red-600">{linkError}</div>}
              {link && (
                <div className="space-y-3">
                  <p className="text-xs font-mono break-all p-2.5 bg-muted/40 rounded-control">{link}</p>
                  <Button onClick={handleCopy} className="w-full h-11 rounded-control font-bold">
                    {copied ? 'Link copiado' : 'Copiar link'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === 'direct' && (
            <div className="space-y-4">
              {directSuccess ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Senha definida.</div>
              ) : (
                <>
                  <Input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} aria-label="Nova senha" className="h-11 rounded-control font-mono text-sm" />
                  {directError && <div className="text-sm text-red-600">{directError}</div>}
                  <Button onClick={handleDirectReset} disabled={directLoading} variant="arcade" className="w-full h-11 rounded-control font-bold">
                    {directLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Salvar nova senha
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────
// Modal de Cadastro Manual de Aluno
// ────────────────────────────────────────────────
function NewStudentModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [emailOverride, setEmailOverride] = useState('');
  const [useCustomEmail, setUseCustomEmail] = useState(false);
  const [institution, setInstitution] = useState('none');
  const [course, setCourse] = useState('');
  const [examTarget, setExamTarget] = useState('ENEM');
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  const reset = () => {
    setFullName(''); setCpf(''); setBirthDate(''); setEmailOverride('');
    setUseCustomEmail(false); setInstitution('none'); setCourse('');
    setExamTarget('ENEM'); setCreatedEmail(null); setLoading(false);
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' }); return;
    }
    if (!birthDate) {
      toast({ title: 'Data de nascimento obrigatória', variant: 'destructive' }); return;
    }
    if (useCustomEmail && !emailOverride.trim()) {
      toast({ title: 'E-mail obrigatório quando personalizado', variant: 'destructive' }); return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          cpf: cpf.trim() || undefined,
          birthDate,
          emailOverride: useCustomEmail ? emailOverride.trim() : undefined,
          institution: institution !== 'none' ? institution : undefined,
          course: course.trim() || undefined,
          examTarget,
          role: 'student',
          profileType: 'student',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreatedEmail(data.user.email);
      toast({ title: 'Aluno cadastrado' });
      onCreated();
    } catch (err: any) {
      toast({ title: 'Erro ao cadastrar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="w-[95vw] sm:max-w-lg rounded-card p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b text-left">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-11 w-11 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="u-label">Secretaria · matrículas</p>
              <DialogTitle className="u-page-title text-xl mt-0.5">
                Novo aluno
              </DialogTitle>
              <DialogDescription className="text-xs mt-1 text-muted-foreground">
                Cadastro manual
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {createdEmail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-control border border-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-700">Aluno cadastrado</p>
                  <p className="text-xs text-emerald-700 mt-0.5 font-mono break-all">{createdEmail}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Uma senha temporária foi gerada. Use o botão <strong className="text-foreground">Redefinir senha</strong> na lista para enviar o link de acesso ao aluno.
              </p>
              <Button onClick={() => { reset(); onClose(); }} className="w-full h-11 rounded-control font-bold">
                Fechar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Nome completo *</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ex.: Maria Silva Santos" className="h-11 bg-muted/30 border-none rounded-control font-semibold text-sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="u-label ml-1">CPF (opcional)</Label>
                  <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className="h-11 bg-muted/30 border-none rounded-control font-mono text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="u-label ml-1">Nascimento *</Label>
                  <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="h-11 bg-muted/30 border-none rounded-control font-medium text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="u-label ml-1">E-mail</Label>
                  <button type="button" onClick={() => setUseCustomEmail(!useCustomEmail)} className="u-label !text-primary hover:underline">
                    {useCustomEmail ? 'Usar e-mail automático' : 'Definir e-mail próprio'}
                  </button>
                </div>
                {useCustomEmail ? (
                  <Input value={emailOverride} onChange={e => setEmailOverride(e.target.value)} placeholder="aluno@email.com" className="h-11 bg-muted/30 border-none rounded-control font-mono text-sm" />
                ) : (
                  <div className="h-11 rounded-control bg-muted/40 flex items-center px-4 min-w-0">
                    <Mail className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                    <span className="text-xs text-muted-foreground font-mono truncate">
                      {fullName.trim() ? `${fullName.trim().split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}...@compromisso.com` : 'gerado a partir do nome'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="u-label ml-1">Escola / polo</Label>
                <Select value={institution} onValueChange={setInstitution}>
                  <SelectTrigger className="h-11 rounded-control bg-muted/30 border-none text-sm">
                    <SelectValue placeholder="Selecionar polo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    <SelectItem value="none" className="text-sm text-muted-foreground">Sem polo definido</SelectItem>
                    {SCHOOL_LIST.map(s => (
                      <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="u-label ml-1">Turma</Label>
                  <Select value={course} onValueChange={setCourse}>
                    <SelectTrigger className="h-11 bg-muted/30 border-none rounded-control font-medium text-sm">
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent className="rounded-control">
                      {Array.from({ length: 12 }, (_, i) => {
                        const num = String(i + 1).padStart(2, '0');
                        return (
                          <SelectItem key={num} value={num} className="text-sm">
                            Sala {num}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="u-label ml-1">Foco de exame</Label>
                  <Select value={examTarget} onValueChange={setExamTarget}>
                    <SelectTrigger className="h-11 rounded-control bg-muted/30 border-none text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-control">
                      <SelectItem value="ENEM" className="text-sm">ENEM</SelectItem>
                      <SelectItem value="ETEC" className="text-sm">ETEC / FATEC</SelectItem>
                      <SelectItem value="Outro" className="text-sm">Outros vestibulares</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <Button variant="outline" onClick={() => { reset(); onClose(); }} className="flex-1 h-11 rounded-control font-bold">
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={loading} variant="arcade" className="flex-1 h-11 rounded-control font-bold">
                  {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Cadastrar aluno
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────
// Componente de Diretório de Matrículas (Principal)
// ────────────────────────────────────────────────
export default function SecretaryEnrollmentDirectory() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modais
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newStudentOpen, setNewStudentOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Campos de edição
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editExamTarget, setEditExamTarget] = useState("");
  const [editIsFinancialAid, setEditIsFinancialAid] = useState(false);
  const [editIsSubmitting, setEditIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('name');
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Erro diretório:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    setProcessingId(id);
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u));
      toast({ title: newStatus === 'active' ? 'Matrícula reativada' : 'Matrícula suspensa' });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    setProcessingId(id);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUsers(prev => prev.filter(u => u.id !== id));
      toast({ title: 'Matrícula excluída', description: `${name} foi removido(a).` });
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const openEditModal = (u: any) => {
    setEditingUser(u);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
    setEditPhone(u.phone || "");
    setEditInstitution(u.institution || "");
    setEditCourse(u.course || "");
    setEditExamTarget(u.exam_target || "");
    setEditIsFinancialAid(!!u.is_financial_aid_eligible);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setEditIsSubmitting(true);
    try {
      const updates = {
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        institution: editInstitution.trim(),
        course: editCourse.trim(),
        exam_target: editExamTarget,
        is_financial_aid_eligible: editIsFinancialAid,
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', editingUser.id);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updates } : u));
      toast({ title: "Dados da matrícula atualizados" });
      setEditingUser(null);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setEditIsSubmitting(false);
    }
  };

  const courseOptions = useMemo(() => distinctOptions(users, "course"), [users]);
  const institutionOptions = useMemo(() => distinctOptions(users, "institution"), [users]);

  const filtered = users.filter(u => {
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const terms = norm(searchTerm).trim().split(/\s+/).filter(Boolean);
    const matchesSearch = terms.length === 0 || terms.every(t => norm(u.name).includes(t) || norm(u.email).includes(t));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.status !== 'suspended') ||
      (statusFilter === 'suspended' && u.status === 'suspended') ||
      (statusFilter === 'is_financial_aid_eligible' && u.is_financial_aid_eligible) ||
      (statusFilter === 'income_ok' && u.is_financial_aid_eligible) ||
      (statusFilter === 'income_exceeded' && Number(u.family_income) > 0 && !u.is_financial_aid_eligible) ||
      (statusFilter === 'income_pending' && !u.is_financial_aid_eligible && (!u.family_income || Number(u.family_income) === 0)) ||
      // Quem não tem telefone não consegue recuperar a senha sozinho (o fluxo
      // por SMS depende do número cadastrado). É exatamente o público que
      // precisa do atendimento da secretaria.
      (statusFilter === 'sem_telefone' && !String(u.phone || '').trim());

    const matchesCourse = !courseFilter || (u.course || '') === courseFilter;
    const matchesInstitution = !institutionFilter || (u.institution || '') === institutionFilter;

    return matchesSearch && matchesStatus && matchesCourse && matchesInstitution;
  });

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast({ title: "Nada para exportar", description: "A lista filtrada está vazia.", variant: "destructive" });
      return;
    }
    exportToCsv("matriculas", filtered, [
      { header: "Nome", accessor: (u) => u.name },
      { header: "Email", accessor: (u) => u.email },
      { header: "Telefone", accessor: (u) => u.phone },
      { header: "CPF", accessor: (u) => u.cpf },
      { header: "Turma", accessor: (u) => u.course },
      { header: "Escola/Polo", accessor: (u) => u.institution },
      { header: "Foco", accessor: (u) => u.exam_target },
      { header: "Status", accessor: (u) => (u.status === "suspended" ? "Suspenso" : "Ativo") },
      { header: "Renda Familiar", accessor: (u) => (u.family_income ? Number(u.family_income) : "") },
      { header: "Renda per capita", accessor: (u) => (u.income_per_capita ? Number(u.income_per_capita) : "") },
      { header: "Elegivel Isencao", accessor: (u) => (u.is_financial_aid_eligible ? "Sim" : "Nao") },
    ]);
    toast({ title: "CSV exportado", description: `${filtered.length} matrículas baixadas.` });
  };

  const hasFilter = !!searchTerm || !!courseFilter || !!institutionFilter || statusFilter !== 'all';
  const clearFilters = () => { setSearchTerm(""); setCourseFilter(""); setInstitutionFilter(""); setStatusFilter("all"); };

  // Situação social: verde = isento, vermelho = acima do limite, neutro = pendente.
  const socialBadge = (u: any) => {
    if (Number(u.family_income) > 0) {
      return (
        <div className="flex flex-col gap-0.5 items-start">
          <Badge className={`border-none font-bold text-[10px] px-2 h-5 flex items-center gap-1 ${
            u.is_financial_aid_eligible ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            <HandHeart className="h-3 w-3" />
            {u.is_financial_aid_eligible ? 'Isento' : 'Acima do limite'}
          </Badge>
          <span className="u-num text-[11px] text-muted-foreground">
            R$ {fmtNumber(toNumber(u.income_per_capita) ?? 0)}/morador
          </span>
        </div>
      );
    }
    if (u.is_financial_aid_eligible) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px] px-2 h-5 flex items-center gap-1 w-fit">
          <HandHeart className="h-3 w-3" /> Isento (manual)
        </Badge>
      );
    }
    return <span className="text-xs text-muted-foreground">Renda pendente</span>;
  };

  const statusBadge = (isSuspended: boolean) => (
    <Badge variant="outline" className={`font-bold text-[10px] px-2.5 h-5 ${isSuspended ? 'text-red-600 border-red-200 bg-red-50' : 'text-emerald-700 border-emerald-200 bg-emerald-50'}`}>
      {isSuspended ? 'Suspensa' : 'Ativa'}
    </Badge>
  );

  const iconBtn = "h-9 w-9 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted transition-colors";

  const rowActions = (u: any) => {
    const isSuspended = u.status === 'suspended';
    const isProcessing = processingId === u.id;
    return (
      <div className="flex items-center justify-end gap-0.5 flex-wrap">
        <Button variant="ghost" size="icon" title="Ver ficha completa" aria-label="Ver ficha completa" asChild className={iconBtn}>
          <Link href={`/dashboard/secretary/students/${u.id}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>

        <Button variant="ghost" size="icon" title="Editar matrícula" aria-label="Editar matrícula" onClick={() => openEditModal(u)} className={iconBtn}>
          <Pencil className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          title="Redefinir senha"
          aria-label="Redefinir senha"
          onClick={() => {
            setResetTarget({ id: u.id, name: u.name, email: u.email });
            setResetOpen(true);
          }}
          className={iconBtn}
        >
          <KeyRound className="h-4 w-4" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={isProcessing}
              title={isSuspended ? 'Reativar matrícula' : 'Suspender matrícula'}
              aria-label={isSuspended ? 'Reativar matrícula' : 'Suspender matrícula'}
              className={`${iconBtn} ${isSuspended ? 'hover:text-emerald-600' : 'hover:text-red-600'}`}
            >
              {isProcessing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : isSuspended
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <UserX className="h-4 w-4" />
              }
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[95vw] sm:max-w-md rounded-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-bold">
                {isSuspended ? 'Reativar matrícula?' : 'Suspender matrícula?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isSuspended
                  ? `${txt(u.name, 'O aluno')} volta a ter acesso às aulas e à plataforma.`
                  : `${txt(u.name, 'O aluno')} não vai conseguir entrar no sistema até a matrícula ser reativada.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-control font-bold">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleToggleStatus(u.id, u.status)}
                className={`rounded-control font-bold border-none text-white ${isSuspended ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {isSuspended ? 'Reativar' : 'Suspender'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {u.phone && (
          <Button variant="ghost" size="icon" title="Mandar mensagem no WhatsApp" aria-label="Mandar mensagem no WhatsApp" asChild className={`${iconBtn} hover:text-emerald-600`}>
            <a
              href={`https://wa.me/55${String(u.phone).replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Phone className="h-4 w-4" />
            </a>
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={isProcessing}
              title="Excluir matrícula"
              aria-label="Excluir matrícula"
              className={`${iconBtn} hover:text-red-600 hover:bg-red-50`}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[95vw] sm:max-w-md rounded-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-bold text-red-600">
                Excluir matrícula para sempre?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação <strong>não pode ser desfeita</strong>. <strong>{txt(u.name, 'O aluno')}</strong> será removido(a) do login e de todos os registros do sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-control font-bold">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteUser(u.id, u.name)}
                className="rounded-control font-bold border-none bg-red-600 hover:bg-red-700 text-white"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  };

  const perCapitaEdit = toNumber(editingUser?.income_per_capita) ?? 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Secretaria · matrículas</p>
          <h1 className="u-page-title text-3xl mt-1">
            Matrículas <span className="u-num text-xl text-muted-foreground align-middle">{filtered.length}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Cadastre alunos, gere links de convite, suspenda acessos, organize turmas e controle isenções.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
          <Button
            variant="arcade"
            onClick={() => setNewStudentOpen(true)}
            className="col-span-2 sm:col-span-1 rounded-control h-11 px-5 gap-2 font-bold"
          >
            <UserPlus className="h-4 w-4" />
            Novo aluno
          </Button>
          <Button
            variant="outline"
            onClick={() => setInviteOpen(true)}
            className="rounded-control h-11 px-4 gap-2 font-bold"
          >
            <Link2 className="h-4 w-4" />
            Convite
          </Button>
          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="rounded-control h-11 px-4 gap-2 font-bold"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <StudentFilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        course={courseFilter}
        onCourseChange={setCourseFilter}
        courseOptions={courseOptions}
        institution={institutionFilter}
        onInstitutionChange={setInstitutionFilter}
        institutionOptions={institutionOptions}
        resultCount={filtered.length}
        totalCount={users.length}
        extra={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 w-full lg:w-56 bg-muted/30 border-none rounded-control font-semibold text-sm shrink-0">
              <SelectValue placeholder="Filtrar por situação" />
            </SelectTrigger>
            <SelectContent className="rounded-control">
              <SelectItem value="all" className="text-sm">Todos os alunos</SelectItem>
              <SelectItem value="active" className="text-sm">Ativos</SelectItem>
              <SelectItem value="suspended" className="text-sm">Suspensos</SelectItem>
              <SelectItem value="is_financial_aid_eligible" className="text-sm">Elegíveis à isenção social</SelectItem>
              <SelectItem value="income_ok" className="text-sm">Renda dentro do limite / isentos</SelectItem>
              <SelectItem value="income_exceeded" className="text-sm">Renda acima do limite</SelectItem>
              <SelectItem value="income_pending" className="text-sm">Renda pendente (não informaram)</SelectItem>
              <SelectItem value="sem_telefone" className="text-sm">Sem telefone (não recuperam a senha sozinhos)</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Lista de alunos */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={users.length === 0 ? "Nenhum aluno cadastrado ainda" : "Nenhum aluno com esses filtros"}
          description={users.length === 0
            ? "Cadastre o primeiro aluno ou gere um link de convite para eles mesmos se cadastrarem."
            : "Tente outro nome ou limpe os filtros para ver todos."}
          action={users.length === 0
            ? { label: "Novo aluno", onClick: () => setNewStudentOpen(true), icon: UserPlus }
            : hasFilter ? { label: "Limpar filtros", onClick: clearFilters } : undefined}
          secondary={users.length === 0 ? { label: "Gerar convite", onClick: () => setInviteOpen(true) } : undefined}
        />
      ) : (
        <>
          {/* Celular: cartões empilhados */}
          <div className="sm:hidden space-y-2">
            {filtered.map(u => {
              const isSuspended = u.status === 'suspended';
              return (
                <div key={u.id} className="rounded-card border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-control flex items-center justify-center font-bold text-sm bg-muted text-foreground shrink-0">
                      {u.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold text-sm truncate ${isSuspended ? 'line-through text-muted-foreground' : ''}`}>
                        {txt(u.name)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email || '@' + (u.username || 'user')}
                      </p>
                      <p className="u-label mt-1 truncate">
                        {u.course || 'Sem turma'} · {u.institution || 'Sem polo'}
                      </p>
                    </div>
                    <div className="shrink-0">{statusBadge(isSuspended)}</div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {socialBadge(u)}
                    {u.phone && <span className="text-xs text-muted-foreground truncate">{u.phone}</span>}
                  </div>
                  <div className="border-t border-border pt-2">
                    {rowActions(u)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Telas maiores: tabela */}
          <Card className="hidden sm:block rounded-card shadow-none overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="h-12">
                      <TableHead className="px-4 md:px-6 u-label">Aluno</TableHead>
                      <TableHead className="u-label">Turma / escola</TableHead>
                      <TableHead className="u-label">Social</TableHead>
                      <TableHead className="u-label">Matrícula</TableHead>
                      <TableHead className="text-right px-4 md:px-6 u-label">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(u => {
                      const isSuspended = u.status === 'suspended';
                      return (
                        <TableRow key={u.id} className="h-16 hover:bg-muted/20 border-b last:border-0 transition-colors">
                          <TableCell className="px-4 md:px-6">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-control flex items-center justify-center font-bold text-sm bg-muted text-foreground shrink-0">
                                {u.name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0">
                                <p className={`font-semibold text-sm truncate ${isSuspended ? 'line-through text-muted-foreground' : ''}`}>
                                  {txt(u.name)}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {u.email || '@' + (u.username || 'user')}
                                </p>
                                {u.phone && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> {u.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold">{u.course || 'Sem turma'}</span>
                              <span className="text-xs text-muted-foreground">{u.institution || 'Sem polo'}</span>
                            </div>
                          </TableCell>

                          <TableCell>{socialBadge(u)}</TableCell>

                          <TableCell>{statusBadge(isSuspended)}</TableCell>

                          <TableCell className="text-right px-4 md:px-6">
                            {rowActions(u)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal de novo aluno */}
      <NewStudentModal open={newStudentOpen} onClose={() => setNewStudentOpen(false)} onCreated={fetchUsers} />

      {/* Modal de convite */}
      <InviteLinkModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      {/* Modal de senha */}
      <ResetPasswordModal user={resetTarget} open={resetOpen} onClose={() => { setResetOpen(false); setResetTarget(null); }} />

      {/* Modal de edição de matrícula */}
      <Dialog open={!!editingUser} onOpenChange={v => { if (!v) setEditingUser(null); }}>
        <DialogContent className="rounded-card p-0 overflow-y-auto max-h-[92vh] w-[95vw] sm:max-w-md">
          <DialogHeader className="p-6 pb-4 border-b text-left">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-control bg-muted flex items-center justify-center font-bold text-lg shrink-0">
                {editingUser?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <p className="u-label">Secretaria · matrículas</p>
                <DialogTitle className="u-page-title text-xl mt-0.5">
                  Editar matrícula
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5 text-muted-foreground truncate">
                  {txt(editingUser?.name, "Ficha do aluno")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="u-label ml-1">Nome completo</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-11 bg-muted/30 border-none rounded-control font-semibold text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="u-label ml-1">E-mail</Label>
              <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="h-11 bg-muted/30 border-none rounded-control font-mono text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="u-label ml-1">Telefone</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="h-11 bg-muted/30 border-none rounded-control text-sm" placeholder="Ex.: (11) 99999-9999" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Escola / polo</Label>
                <Input value={editInstitution} onChange={e => setEditInstitution(e.target.value)} className="h-11 bg-muted/30 border-none rounded-control text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Turma</Label>
                <Select value={editCourse} onValueChange={setEditCourse}>
                  <SelectTrigger className="h-11 bg-muted/30 border-none rounded-control text-sm">
                    <SelectValue placeholder="Selecionar sala" />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    {Array.from({ length: 12 }, (_, i) => {
                      const num = String(i + 1).padStart(2, '0');
                      return (
                        <SelectItem key={num} value={num} className="text-sm">
                          Sala {num}
                        </SelectItem>
                      );
                    })}
                    {editCourse && !Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).includes(editCourse) && (
                      <SelectItem value={editCourse} className="text-sm">
                        {editCourse}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="u-label ml-1">Foco de exame</Label>
              <Select value={editExamTarget} onValueChange={setEditExamTarget}>
                <SelectTrigger className="h-11 rounded-control bg-muted/30 border-none text-sm">
                  <SelectValue placeholder="Foco" />
                </SelectTrigger>
                <SelectContent className="rounded-control">
                  <SelectItem value="ENEM" className="text-sm">ENEM</SelectItem>
                  <SelectItem value="ETEC" className="text-sm">ETEC / FATEC</SelectItem>
                  <SelectItem value="Outro" className="text-sm">Outros vestibulares</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Renda informada pelo aluno */}
            {editingUser?.family_income > 0 && (
              <div className="p-4 rounded-control border border-border space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="u-label">Renda informada pelo aluno</span>
                  <Badge className={`border-none font-bold text-[10px] px-2 h-5 shrink-0 ${
                    perCapitaEdit <= 2431.50
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {perCapitaEdit <= 2431.50 ? 'Dentro do limite' : 'Acima do limite'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[11px]">Renda familiar total</span>
                    <p className="u-num text-sm">{fmtBRL(editingUser.family_income)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Moradores</span>
                    <p className="u-num text-sm">{txt(editingUser.family_size)} {Number(editingUser.family_size) === 1 ? 'pessoa' : 'pessoas'}</p>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-border">
                    <span className="text-muted-foreground text-[11px]">Renda per capita</span>
                    <p className="u-num text-base">
                      {fmtBRL(perCapitaEdit)} <span className="font-sans text-xs text-muted-foreground">por morador</span>
                    </p>
                  </div>
                </div>

                {editingUser.family_members && Array.isArray(editingUser.family_members) && editingUser.family_members.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-1">
                    <span className="u-label">Composição familiar</span>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {editingUser.family_members.map((m: any, i: number) => (
                        <div key={i} className="flex justify-between gap-2 text-xs bg-muted/40 px-2.5 py-1 rounded-control">
                          <span className="text-muted-foreground truncate">{txt(m?.label, `Integrante ${i + 1}`)}</span>
                          <span className="u-num shrink-0">{fmtBRL(m?.income || 0, 'R$ 0,00')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Isenção social */}
            <div className="flex items-center justify-between gap-3 p-4 border border-border rounded-control">
              <div className="flex gap-2.5 items-center min-w-0">
                <HandHeart className="h-5 w-5 text-primary shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold leading-none">Cota social / isenção</span>
                  <span className="text-xs text-muted-foreground mt-1">Elegível para os benefícios da plataforma</span>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={editIsFinancialAid}
                aria-label="Cota social / isenção"
                onClick={() => setEditIsFinancialAid(!editIsFinancialAid)}
                className={`h-6 w-11 rounded-full p-0.5 transition-colors focus:outline-none shrink-0 ${editIsFinancialAid ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white transition-transform ${editIsFinancialAid ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <Button onClick={handleUpdateUser} disabled={editIsSubmitting} variant="arcade" className="w-full h-11 rounded-control font-bold mt-2">
              {editIsSubmitting ? <Loader2 className="animate-spin mr-2" /> : <UserCheck className="mr-2" />}
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
