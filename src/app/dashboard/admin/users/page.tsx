"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  Send,
  Ban,
  CheckCircle2,
  UserPlus,
  KeyRound,
  Copy,
  Check,
  Clock,
  RefreshCw,
  AlertCircle,
  Link2,
  Sparkles,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
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
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { fmtNumber, txt } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

// ────────────────────────────────────────────────
// Modal de Gerar Link de Convite (Cadastro em Massa)
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
      toast({ title: 'Não foi possível gerar o link', description: err.message, variant: 'destructive' });
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
      <DialogContent className="sm:max-w-md rounded-card p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-11 w-11 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                Link de convite
              </DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                Para vários alunos se cadastrarem sozinhos
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {!link ? (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Este link permite que novos alunos se cadastrem sozinhos na plataforma.
                Eles entram automaticamente como <strong className="text-foreground">alunos</strong>.
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
                      className={`flex-1 min-w-0 px-0 h-11 rounded-control font-bold text-xs tabular-nums ${expiryDays === d ? '' : 'text-muted-foreground'}`}
                    >
                      {d}d
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                onClick={generateInvite}
                disabled={loading}
                className="w-full h-11 font-bold rounded-control text-sm"
              >
                {loading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Gerar link de cadastro
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-muted/30 border rounded-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                   <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px] uppercase px-3">Link ativo</Badge>
                   <span className="u-label">Expira em {expiryDays} {expiryDays === 1 ? 'dia' : 'dias'}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground break-all bg-card p-3 rounded-control border">
                  {link}
                </p>
                <Button
                  onClick={handleCopy}
                  className="w-full h-11 font-bold rounded-control gap-2"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado' : 'Copiar link'}
                </Button>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-control border text-muted-foreground">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-xs leading-snug">
                  Envie este link para os grupos de WhatsApp. O aluno preencherá o próprio nome e curso.
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
// Modal de Reset de Senha
// ────────────────────────────────────────────────

interface ResetModalProps {
  user: { id: string; name: string; email: string } | null;
  open: boolean;
  onClose: () => void;
}

function ResetPasswordModal({ user, open, onClose }: ResetModalProps) {
  const { toast } = useToast();

  // Aba ativa: 'link' = gerar link de recuperação | 'direct' = definir senha diretamente
  const [tab, setTab] = useState<'link' | 'direct'>('link');

  // Estado da aba "Gerar Link"
  const [link, setLink] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Estado da aba "Definir Senha"
  const [newPassword, setNewPassword] = useState('mudar123');
  const [directLoading, setDirectLoading] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [directSuccess, setDirectSuccess] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // Limpa estado ao abrir um novo usuário
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

  /* ── Aba: Gerar Link ── */
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
      setLinkError(err.message || 'Não foi possível gerar o link. Tente novamente.');
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

  /* ── Aba: Definir Senha Diretamente ── */
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
      toast({ title: 'Senha redefinida', description: `${txt(user.name, 'O usuário')} vai usar a nova senha no próximo login.` });
    } catch (err: any) {
      setDirectError(err.message || 'Não foi possível redefinir a senha. Tente novamente.');
    } finally {
      setDirectLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-card p-0 overflow-hidden max-h-[92vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground leading-tight">
                Redefinir senha
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {user?.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* E-mail do usuário */}
          <div className="flex items-center gap-2.5 bg-muted/30 rounded-control border px-4 py-3">
            <Link2 size={15} className="text-muted-foreground shrink-0" />
            <span className="text-xs font-mono font-bold text-foreground truncate">{user?.email}</span>
          </div>

          {/* Seletor de abas */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-control">
            <button
              onClick={() => setTab('link')}
              aria-pressed={tab === 'link'}
              className={`h-9 rounded-control text-xs font-bold uppercase tracking-wider transition-colors ${
                tab === 'link'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Enviar link
            </button>
            <button
              onClick={() => setTab('direct')}
              aria-pressed={tab === 'direct'}
              className={`h-9 rounded-control text-xs font-bold uppercase tracking-wider transition-colors ${
                tab === 'direct'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Definir senha
            </button>
          </div>

          {/* ── Conteúdo: Gerar Link ── */}
          {tab === 'link' && (
            <div className="space-y-4">
              {!link && !linkLoading && !linkError && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Gere um link seguro e envie ao aluno. Ele expira em <strong>1 hora</strong> e funciona uma única vez.
                  </p>
                  <Button
                    onClick={generateLink}
                    className="w-full h-11 font-bold rounded-control"
                  >
                    <KeyRound size={16} className="mr-2" />
                    Gerar link de redefinição
                  </Button>
                </div>
              )}

              {linkLoading && (
                <div className="py-6 flex items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Gerando o link…</span>
                </div>
              )}

              {linkError && !linkLoading && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-control text-red-700 text-sm font-medium break-words">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    {linkError}
                  </div>
                  <Button variant="outline" onClick={generateLink} className="w-full h-10 rounded-control font-bold gap-2">
                    <RefreshCw size={14} />
                    Tentar novamente
                  </Button>
                </div>
              )}

              {link && !linkLoading && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold">
                      <Clock size={11} />
                      Expira em 1 hora
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold">
                      <CheckCircle2 size={11} />
                      Link gerado
                    </span>
                  </div>
                  <div className="bg-muted/30 border rounded-card p-3 space-y-3">
                    <p className="text-[11px] font-mono text-muted-foreground break-all leading-relaxed line-clamp-3">
                      {link}
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={handleCopy} className="flex-1 h-10 rounded-control font-bold text-xs gap-2">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copiado' : 'Copiar link'}
                      </Button>
                      <Button variant="outline" onClick={generateLink} disabled={linkLoading} title="Gerar novo link" aria-label="Gerar novo link" className="h-10 px-3 rounded-control">
                        <RefreshCw size={14} />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Envie este link ao aluno via WhatsApp. Ele será redirecionado para criar uma nova senha.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Conteúdo: Definir Senha Diretamente ── */}
          {tab === 'direct' && (
            <div className="space-y-4">
              {directSuccess ? (
                <div className="py-4 space-y-3 text-center">
                  <div className="h-14 w-14 rounded-card bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  </div>
                  <p className="font-bold text-foreground text-sm">Senha redefinida</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    O aluno precisará trocar a senha no próximo login.
                  </p>
                  <Button variant="outline" onClick={onClose} className="w-full h-10 rounded-control font-bold text-xs">
                    Fechar
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Define uma senha temporária para o aluno. Ele será obrigado a alterá-la no próximo login.
                  </p>
                  <div className="space-y-2">
                    <Label className="u-label">
                      Nova senha temporária
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPwd ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => { setNewPassword(e.target.value); setDirectError(null); }}
                        className="h-11 rounded-control font-mono font-bold pr-12"
                        placeholder="Mínimo 8 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPwd ? <CheckCircle2 size={16} /> : <KeyRound size={16} />}
                      </button>
                    </div>
                  </div>

                  {directError && (
                    <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-control text-red-700 text-sm font-medium break-words">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      {directError}
                    </div>
                  )}

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-control">
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                      O aluno será redirecionado para trocar a senha obrigatoriamente no próximo acesso.
                    </p>
                  </div>

                  <Button
                    onClick={handleDirectReset}
                    disabled={directLoading || !newPassword.trim()}
                    className="w-full h-11 font-bold rounded-control disabled:opacity-40"
                  >
                    {directLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <KeyRound size={16} className="mr-2" />
                        Redefinir senha
                      </>
                    )}
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
// Página Principal
// ────────────────────────────────────────────────

export default function AdminUserDirectoryPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [users, setUsers] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Estado do modal de reset e convite
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const SALA_OPTIONS = ['1','2','3','4','5','6','7','8','9','10'];
  const TURNO_OPTIONS = [
    { value: 'manha',    label: 'Manhã'    },
    { value: 'tarde',    label: 'Tarde'    },
    { value: 'integral', label: 'Integral' },
  ];

  // Estado do modal de edição
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editSala, setEditSala] = useState("");
  const [editTurno, setEditTurno] = useState("");
  const [editExamTarget, setEditExamTarget] = useState("");
  const [editProfileType, setEditProfileType] = useState("");
  const [editIsSubmitting, setEditIsSubmitting] = useState(false);

  /** Quantos alunos em cada situação, para rotular os filtros. */
  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of users) {
      const sit = u.acesso?.situacao;
      if (sit) c[sit] = (c[sit] ?? 0) + 1;
    }
    return c;
  }, [users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // A situação de acesso vem de `auth.users.last_sign_in_at`, que o cliente
      // não pode ler — por isso uma função com checagem de papel, e não uma
      // view (que rodaria como dono e exporia a lista a qualquer sessão).
      const [{ data, error }, { data: situacoes }] = await Promise.all([
        supabase.from('profiles').select('*').order('name'),
        supabase.rpc('listar_status_alunos'),
      ]);
      if (error) throw error;

      const porId = new Map(
        (situacoes ?? []).map((s: any) => [s.id, s]),
      );
      setUsers((data ?? []).map(u => ({ ...u, acesso: porId.get(u.id) ?? null })));
    } catch (err) {
      console.error("Erro diretório:", err);
      toast({
        title: 'Não foi possível carregar o diretório',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    if (id === currentUser?.id) {
      toast({ title: "Ação não permitida", description: "Você não pode suspender a própria conta.", variant: "destructive" });
      return;
    }
    setProcessingId(id);
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u));
      toast({ title: newStatus === 'active' ? 'Acesso reativado' : 'Usuário suspenso' });
    } catch (err: any) {
      toast({ title: "Não foi possível alterar o acesso", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (id === currentUser?.id) {
      toast({ title: "Ação não permitida", description: "Você não pode excluir a própria conta.", variant: "destructive" });
      return;
    }
    setProcessingId(id);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUsers(prev => prev.filter(u => u.id !== id));
      toast({ title: 'Usuário excluído', description: `${txt(name, 'O usuário')} foi removido da plataforma.` });
    } catch (err: any) {
      toast({ title: 'Não foi possível excluir', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const openResetModal = (u: any) => {
    if (!u.email) {
      toast({ title: "Sem e-mail cadastrado", description: "Este usuário não possui e-mail vinculado.", variant: "destructive" });
      return;
    }
    setResetTarget({ id: u.id, name: u.name, email: u.email });
    setResetOpen(true);
  };

  const openEditModal = (u: any) => {
    setEditingUser(u);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
    setEditInstitution(u.institution || "");
    setEditCourse(u.course || "");
    setEditSala(u.sala || "");
    setEditTurno(u.turno || "");
    setEditExamTarget(u.exam_target || "");
    setEditProfileType(u.profile_type || "");
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setEditIsSubmitting(true);
    try {
      const updates: Record<string, string> = {};
      if (editName.trim()) updates.name = editName.trim();
      if (editEmail.trim()) updates.email = editEmail.trim();
      updates.institution = editInstitution.trim();
      updates.course = editCourse.trim();
      updates.sala = editSala;
      updates.turno = editTurno;
      updates.exam_target = editExamTarget;
      if (editProfileType.trim()) updates.profile_type = editProfileType.trim();

      const { error } = await supabase.from('profiles').update(updates).eq('id', editingUser.id);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updates } : u));
      toast({ title: "Dados atualizados" });
      setEditingUser(null);
    } catch (err: any) {
      toast({ title: "Não foi possível salvar", description: err.message, variant: "destructive" });
    } finally {
      setEditIsSubmitting(false);
    }
  };

  const filtered = users.filter(u => {
    const norm = (s: string) =>
      (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const terms = norm(searchTerm).trim().split(/\s+/).filter(Boolean);
    const matchesSearch =
      terms.length === 0 ||
      terms.every(t => norm(u.name).includes(t) || norm(u.username).includes(t));

    const pType = (u.profile_type || '').toLowerCase();
    const isStaff = u.role === 'admin' || u.role === 'teacher' ||
      ['admin', 'staff', 'teacher', 'tecnico', 'técnico', 'coord', 'prof',
        'psicóloga', 'apoio', 'assessor', 'secretaria', 'videomaker',
        'administrador', 'agente'].some(k => pType.includes(k));

    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'staff' && isStaff) ||
      (roleFilter === 'student' && !isStaff);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.status !== 'suspended') ||
      (statusFilter === 'suspended' && u.status === 'suspended') ||
      // "Sem acesso" é a lista de trabalho da secretaria: alunos que existem,
      // têm boletim, e nunca conseguiram entrar. Não são contas para apagar —
      // são senhas para entregar.
      (statusFilter === 'sem_acesso' && u.acesso?.situacao === 'sem_acesso') ||
      (statusFilter === 'sumido' && u.acesso?.situacao === 'sumido') ||
      (statusFilter === 'arquivado' && u.acesso?.situacao === 'arquivado');

    return matchesSearch && matchesRole && matchesStatus;
  });

  const staffOf = (u: any) => {
    const pType = (u.profile_type || '').toLowerCase();
    const isStaff = u.role === 'admin' || u.role === 'teacher' ||
      ['admin', 'staff', 'teacher', 'tecnico', 'técnico', 'coord', 'prof',
        'psicóloga', 'apoio', 'assessor', 'secretaria', 'videomaker',
        'administrador', 'agente'].some(k => pType.includes(k));
    return { pType, isStaff };
  };

  const roleLabel = (u: any) =>
    txt(u.profile_type, u.role === 'admin' ? 'Coordenação' : u.role === 'teacher' ? 'Professor' : 'Aluno');

  const statusBadge = (u: any) => {
    const isSuspended = u.status === 'suspended';
    return (
      <Badge variant="outline" className={`font-bold text-[10px] uppercase px-2.5 h-5 ${isSuspended ? 'text-red-700 border-red-200 bg-red-50' : 'text-emerald-700 border-emerald-200 bg-emerald-50'}`}>
        {isSuspended ? 'Suspenso' : 'Ativo'}
      </Badge>
    );
  };

  const rowActions = (u: any) => {
    const isSuspended = u.status === 'suspended';
    const isProcessing = processingId === u.id;
    const name = txt(u.name, 'Este usuário');
    return (
      <div className="flex items-center justify-end gap-1 flex-wrap">
        {/* Editar dados */}
        <Button
          variant="ghost"
          size="icon"
          title="Editar dados do usuário"
          aria-label="Editar dados do usuário"
          onClick={() => openEditModal(u)}
          className="h-10 w-10 rounded-control"
        >
          <Pencil className="h-4 w-4" />
        </Button>

        {/* Reset de Senha */}
        <Button
          variant="ghost"
          size="icon"
          title="Redefinir senha"
          aria-label="Redefinir senha"
          onClick={() => openResetModal(u)}
          className="h-10 w-10 rounded-control"
        >
          <KeyRound className="h-4 w-4" />
        </Button>

        {/* Suspender / Reativar */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={isProcessing || u.id === currentUser?.id}
              title={isSuspended ? 'Reativar acesso' : 'Suspender acesso'}
              aria-label={isSuspended ? 'Reativar acesso' : 'Suspender acesso'}
              className="h-10 w-10 rounded-control"
            >
              {isProcessing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : isSuspended
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <Ban className="h-4 w-4" />
              }
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-bold text-foreground">
                {isSuspended ? 'Reativar acesso?' : 'Suspender acesso?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isSuspended
                  ? `${name} voltará a ter acesso à plataforma normalmente.`
                  : `${name} não conseguirá mais entrar. Dá para desfazer depois.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-control font-bold">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleToggleStatus(u.id, u.status)}
                className={`rounded-control font-bold border-none text-white ${isSuspended ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {isSuspended ? 'Reativar' : 'Suspender'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Chat */}
        <Button
          variant="ghost"
          size="icon"
          title="Enviar mensagem"
          aria-label="Enviar mensagem"
          asChild
          className="h-10 w-10 rounded-control"
        >
          <Link href={`/dashboard/chat/${u.id}`}>
            <Send className="h-4 w-4" />
          </Link>
        </Button>

        {/* Excluir Usuário */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={isProcessing || u.id === currentUser?.id}
              title="Excluir usuário"
              aria-label="Excluir usuário"
              className="h-10 w-10 rounded-control text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              {isProcessing && processingId === u.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-bold text-red-600">
                Excluir este usuário de vez?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é <strong>irreversível</strong>. <strong>{name}</strong> será excluído do login e de todos os registros de perfil da plataforma.
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

  const avatar = (u: any) => (
    <div className={`h-9 w-9 rounded-control flex items-center justify-center font-bold text-sm shrink-0 ${staffOf(u).isStaff ? 'bg-muted text-foreground' : 'bg-primary/10 text-primary'}`}>
      {txt(u.name, '?').charAt(0).toUpperCase()}
    </div>
  );

  return (
    <div className="space-y-6 pb-20 px-1">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><UserPlus className="h-3.5 w-3.5" /> Coordenação · usuários</p>
          <h1 className="u-page-title text-3xl mt-1">Usuários</h1>
          <p className="text-muted-foreground text-sm mt-2">
            <span className="tabular-nums">{fmtNumber(filtered.length, 0, '0')}</span> {filtered.length === 1 ? 'pessoa' : 'pessoas'} · cadastro, senha e acesso de alunos e equipe.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={() => setInviteOpen(true)}
            className="font-bold rounded-control h-11 px-5 gap-2"
          >
            <Link2 className="h-4 w-4" />
            Link de convite
          </Button>
          <Button
            asChild
            variant="arcade"
            className="font-bold rounded-control h-11 px-5 gap-2"
          >
            <Link href="/dashboard/admin/users/new">
              <UserPlus className="h-4 w-4" />
              Novo usuário
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-end">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            className="pl-9 h-11 rounded-control w-full"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="u-label px-1">Papel</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-11 rounded-control">
              <SelectValue placeholder="Papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="student">Alunos</SelectItem>
              <SelectItem value="staff">Equipe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="u-label px-1">Situação</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 rounded-control">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
              <SelectItem value="sem_acesso">
                Nunca entraram{contagem.sem_acesso ? ` (${contagem.sem_acesso})` : ''}
              </SelectItem>
              <SelectItem value="sumido">
                Sumidos há 30+ dias{contagem.sumido ? ` (${contagem.sumido})` : ''}
              </SelectItem>
              <SelectItem value="arquivado">
                Arquivados{contagem.arquivado ? ` (${contagem.arquivado})` : ''}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <Card className="rounded-card">
          <CardContent className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="u-label">Carregando usuários…</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={users.length === 0 ? 'Nenhum usuário cadastrado' : 'Nenhum usuário encontrado'}
          description={users.length === 0
            ? 'Cadastre o primeiro usuário ou envie um link de convite para os alunos.'
            : 'Nenhuma pessoa corresponde à busca e aos filtros escolhidos.'}
          action={users.length === 0
            ? { label: 'Novo usuário', href: '/dashboard/admin/users/new', icon: UserPlus }
            : { label: 'Limpar filtros', onClick: () => { setSearchTerm(''); setRoleFilter('all'); setStatusFilter('all'); } }}
        />
      ) : (
        <>
          {/* Celular: cartões empilhados */}
          <div className="sm:hidden space-y-3">
            {filtered.map(u => {
              const isSuspended = u.status === 'suspended';
              return (
                <Card key={u.id} className="rounded-card">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {avatar(u)}
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold text-sm break-words ${isSuspended ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {txt(u.name)}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground truncate">
                          {u.email || '@' + (u.username || 'usuario')}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className="font-bold text-[10px] uppercase px-2.5 h-5">{roleLabel(u)}</Badge>
                          {statusBadge(u)}
                        </div>
                      </div>
                    </div>
                    {rowActions(u)}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="hidden sm:block rounded-card overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="px-4 md:px-6 u-label min-w-[150px]">Nome</TableHead>
                      <TableHead className="u-label hidden md:table-cell">E-mail</TableHead>
                      <TableHead className="u-label">Cargo</TableHead>
                      <TableHead className="u-label">Situação</TableHead>
                      <TableHead className="text-right px-4 md:px-6 u-label">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(u => {
                      const isSuspended = u.status === 'suspended';
                      return (
                        <TableRow key={u.id} className="hover:bg-muted/20">
                          {/* Identidade */}
                          <TableCell className="px-4 md:px-6 py-3">
                            <div className="flex items-center gap-3">
                              {avatar(u)}
                              <div className="min-w-0">
                                <p className={`font-semibold text-sm truncate ${isSuspended ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  {txt(u.name)}
                                </p>
                                <p className="text-[11px] font-mono text-muted-foreground md:hidden truncate">
                                  {u.email || '@' + (u.username || 'usuario')}
                                </p>
                                <p className="text-[11px] font-mono text-muted-foreground hidden md:block">
                                  @{u.username || 'usuario'}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* E-mail */}
                          <TableCell className="hidden md:table-cell">
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[180px] block">
                              {txt(u.email)}
                            </span>
                          </TableCell>

                          {/* Cargo */}
                          <TableCell>
                            <Badge variant="secondary" className="font-bold text-[10px] uppercase px-2.5 h-5">
                              {roleLabel(u)}
                            </Badge>
                          </TableCell>

                          {/* Status */}
                          <TableCell>{statusBadge(u)}</TableCell>

                          {/* Ações */}
                          <TableCell className="text-right px-4 md:px-6">{rowActions(u)}</TableCell>
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

      {/* ── Modal de Convite ── */}
      <InviteLinkModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      {/* ── Modal de Reset ── */}
      <ResetPasswordModal
        user={resetTarget}
        open={resetOpen}
        onClose={() => { setResetOpen(false); setResetTarget(null); }}
      />

      {/* ── Modal de Edição ── */}
      <Dialog open={!!editingUser} onOpenChange={v => { if (!v) setEditingUser(null); }}>
        <DialogContent className="rounded-card p-0 overflow-hidden w-[95vw] sm:max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-control bg-primary/10 flex items-center justify-center font-bold text-primary text-lg shrink-0">
                {editingUser?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                  Editar usuário
                </DialogTitle>
                <DialogDescription className="text-sm mt-0.5 text-muted-foreground">
                  {editingUser?.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="u-label ml-1">Nome completo</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Nome do usuário"
                className="h-11 bg-muted/30 border-none rounded-control font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="u-label ml-1">E-mail</Label>
              <Input
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="h-11 bg-muted/30 border-none rounded-control font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Escola / polo</Label>
                <Input
                  value={editInstitution}
                  onChange={e => setEditInstitution(e.target.value)}
                  placeholder="Nome da escola"
                  className="h-11 bg-muted/30 border-none rounded-control font-medium text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Turma / curso</Label>
                <Input
                  value={editCourse}
                  onChange={e => setEditCourse(e.target.value)}
                  placeholder="Ex: 3ª Série A"
                  className="h-11 bg-muted/30 border-none rounded-control font-medium text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Número da sala</Label>
                <Select value={editSala} onValueChange={setEditSala}>
                  <SelectTrigger className="h-11 bg-muted/30 border-none rounded-control font-medium text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SALA_OPTIONS.map(n => (
                      <SelectItem key={n} value={n}>Sala {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Turno</Label>
                <div className="flex gap-2">
                  {TURNO_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setEditTurno(t.value)}
                      aria-pressed={editTurno === t.value}
                      className={`flex-1 min-w-0 h-11 rounded-control font-bold text-xs transition-colors border ${
                        editTurno === t.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="u-label ml-1">Tipo de perfil</Label>
              <Input
                value={editProfileType}
                onChange={e => setEditProfileType(e.target.value)}
                placeholder="Ex: student, teacher, staff..."
                className="h-11 bg-muted/30 border-none rounded-control font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="u-label ml-1">Segmento</Label>
              <div className="flex gap-3">
                {['', 'ENEM', 'ETEC'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setEditExamTarget(opt)}
                    aria-pressed={editExamTarget === opt}
                    className={`flex-1 h-11 rounded-control font-bold text-xs transition-colors border ${
                      editExamTarget === opt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {opt === '' ? 'Nenhum' : opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <Button
              onClick={handleUpdateUser}
              disabled={editIsSubmitting}
              className="w-full h-11 font-bold rounded-control"
            >
              {editIsSubmitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
