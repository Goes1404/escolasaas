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
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Link de convite copiado!' });
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-card border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-4 bg-orange-50 border-b border-orange-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <Link2 className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-orange-700 leading-none italic uppercase tracking-tighter">
                Link de Convite
              </DialogTitle>
              <DialogDescription className="text-xs mt-1 font-medium text-orange-600/60">
                Cadastro em massa para novos alunos
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6">
          {!link ? (
            <div className="space-y-6">
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                Este link permite que novos alunos se cadastrem sozinhos na plataforma. 
                Eles serão registrados automaticamente como <strong className="text-primary italic uppercase">Estudantes</strong>.
              </p>
              
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Validade do Link (Dias)</Label>
                <div className="flex gap-2">
                  {[1, 3, 7, 15, 30].map(d => (
                    <Button
                      key={d}
                      type="button"
                      variant={expiryDays === d ? 'default' : 'outline'}
                      onClick={() => setExpiryDays(d)}
                      className={`flex-1 h-11 rounded-xl font-black text-xs transition-all ${expiryDays === d ? 'bg-orange-600 shadow-lg shadow-orange-200 border-none' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      {d}d
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                onClick={generateInvite}
                disabled={loading}
                className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-2xl shadow-xl shadow-orange-200 uppercase tracking-widest text-xs transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Gerar Link de Cadastro
              </Button>
            </div>
          ) : (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
              <div className="bg-slate-50 border border-slate-100 rounded-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                   <Badge className="bg-emerald-500 text-white border-none font-black text-[9px] uppercase px-3">Link Ativo</Badge>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expira em {expiryDays} dias</span>
                </div>
                <p className="text-xs font-mono text-slate-400 break-all bg-white p-3 rounded-xl border border-slate-50">
                  {link}
                </p>
                <Button
                  onClick={handleCopy}
                  className="w-full h-12 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 gap-2"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado para o Clip!' : 'Copiar Link agora'}
                </Button>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-700">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-[10px] font-bold leading-tight uppercase tracking-tight">
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
      setLinkError(err.message || 'Falha ao gerar link. Tente novamente.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Link copiado para a área de transferência!' });
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
      toast({ title: 'Senha redefinida!', description: `${user.name} precisará usar a nova senha no próximo login.` });
    } catch (err: any) {
      setDirectError(err.message || 'Falha ao redefinir senha. Tente novamente.');
    } finally {
      setDirectLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-primary leading-none">
                Resetar Senha
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {user?.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* E-mail do usuário */}
          <div className="flex items-center gap-2.5 bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
            <Link2 size={15} className="text-muted-foreground shrink-0" />
            <span className="text-xs font-mono font-bold text-primary truncate">{user?.email}</span>
          </div>

          {/* Seletor de abas */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl">
            <button
              onClick={() => setTab('link')}
              className={`h-9 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                tab === 'link'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Enviar Link
            </button>
            <button
              onClick={() => setTab('direct')}
              className={`h-9 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                tab === 'direct'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Definir Senha
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
                    className="w-full h-11 bg-primary text-white font-bold rounded-2xl border-none shadow-md"
                  >
                    <KeyRound size={16} className="mr-2" />
                    Gerar Link de Reset
                  </Button>
                </div>
              )}

              {linkLoading && (
                <div className="py-6 flex items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">Gerando link seguro...</span>
                </div>
              )}

              {linkError && !linkLoading && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    {linkError}
                  </div>
                  <Button variant="outline" onClick={generateLink} className="w-full h-10 rounded-xl font-bold border-muted/30 gap-2">
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
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-3">
                    <p className="text-[10px] font-mono text-slate-500 break-all leading-relaxed line-clamp-3">
                      {link}
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={handleCopy} className="flex-1 h-10 rounded-xl font-bold text-xs gap-2 bg-primary text-white border-none">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copiado!' : 'Copiar Link'}
                      </Button>
                      <Button variant="outline" onClick={generateLink} disabled={linkLoading} title="Gerar novo link" className="h-10 px-3 rounded-xl border-muted/30">
                        <RefreshCw size={14} />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
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
                  <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  </div>
                  <p className="font-black text-primary text-sm uppercase tracking-wide">Senha Redefinida!</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    O aluno precisará trocar a senha no próximo login.
                  </p>
                  <Button variant="outline" onClick={onClose} className="w-full h-10 rounded-xl font-bold text-xs border-muted/30">
                    Fechar
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Define uma senha temporária para o aluno. Ele será obrigado a alterá-la no próximo login.
                  </p>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary/40">
                      Nova Senha Temporária
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPwd ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => { setNewPassword(e.target.value); setDirectError(null); }}
                        className="h-12 bg-slate-50 border-slate-200 rounded-xl font-mono font-bold pr-12"
                        placeholder="Mínimo 8 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPwd ? <CheckCircle2 size={16} /> : <KeyRound size={16} />}
                      </button>
                    </div>
                  </div>

                  {directError && (
                    <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      {directError}
                    </div>
                  )}

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs text-amber-700 font-medium leading-relaxed">
                      O aluno será redirecionado para trocar a senha obrigatoriamente no próximo acesso.
                    </p>
                  </div>

                  <Button
                    onClick={handleDirectReset}
                    disabled={directLoading || !newPassword.trim()}
                    className="w-full h-11 bg-primary text-white font-bold rounded-2xl border-none shadow-md disabled:opacity-40"
                  >
                    {directLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <KeyRound size={16} className="mr-2" />
                        Redefinir Senha Agora
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
      toast({ title: "Ação Negada", description: "Você não pode suspender sua própria conta.", variant: "destructive" });
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
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (id === currentUser?.id) {
      toast({ title: "Ação Negada", description: "Você não pode excluir sua própria conta.", variant: "destructive" });
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
      toast({ title: 'Usuário excluído', description: `${name} foi removido da plataforma.` });
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
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
      toast({ title: "Dados atualizados com sucesso!" });
      setEditingUser(null);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
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

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-primary italic leading-none">
            Diretório de Usuários
            <span className="text-lg font-bold text-muted-foreground ml-2 not-italic">
              ({filtered.length})
            </span>
          </h1>
          <p className="text-muted-foreground font-medium italic text-sm">
            Gestão completa de identidades e acessos da rede.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={() => setInviteOpen(true)}
            className="bg-white text-orange-600 border border-orange-100 font-black rounded-2xl shadow-md h-12 px-6 gap-2 hover:bg-orange-50 transition-all"
          >
            <Link2 className="h-4 w-4" />
            Link de Convite
          </Button>
          <Button
            asChild
            className="bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 h-12 px-6 gap-2 hover:scale-[1.02] active:scale-95 transition-all border-none"
          >
            <Link href="/dashboard/admin/users/new">
              <UserPlus className="h-4 w-4" />
              Novo Usuário
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            className="pl-11 h-12 bg-white border-none shadow-md rounded-2xl font-medium w-full"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-black uppercase text-primary/40 px-1 tracking-widest">Papel</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-12 rounded-xl bg-white border-none shadow-md font-bold">
              <SelectValue placeholder="Papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="student">Estudantes</SelectItem>
              <SelectItem value="staff">Equipe Profissional</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-black uppercase text-primary/40 px-1 tracking-widest">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-12 rounded-xl bg-white border-none shadow-md font-bold">
              <SelectValue placeholder="Status" />
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

      {/* ── Tabela ── */}
      <Card className="border-none shadow-2xl rounded-card bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-accent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground italic text-sm">
              Nenhum usuário encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="h-12 md:h-14">
                    <TableHead className="px-4 md:px-6 font-black uppercase text-[10px] tracking-widest min-w-[150px]">Identidade</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest hidden md:table-cell">E-mail</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest hidden sm:table-cell">Cargo</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Status</TableHead>
                    <TableHead className="text-right px-4 md:px-6 font-black uppercase text-[10px] tracking-widest">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => {
                    const pType = (u.profile_type || '').toLowerCase();
                    const isStaff = u.role === 'admin' || u.role === 'teacher' ||
                      ['admin', 'staff', 'teacher', 'tecnico', 'técnico', 'coord', 'prof',
                        'psicóloga', 'apoio', 'assessor', 'secretaria', 'videomaker',
                        'administrador', 'agente'].some(k => pType.includes(k));
                    const isSuspended = u.status === 'suspended';
                    const isProcessing = processingId === u.id;

                    return (
                      <TableRow
                        key={u.id}
                        className="h-16 hover:bg-muted/10 border-b last:border-0 transition-colors"
                      >
                        {/* Identidade */}
                        <TableCell className="px-4 md:px-6">
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm shadow-sm shrink-0 ${isStaff ? 'bg-accent text-white' : 'bg-primary text-white'}`}>
                              {u.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className={`font-bold text-sm truncate ${isSuspended ? 'line-through opacity-40 text-slate-400' : 'text-primary italic'}`}>
                                {u.name || '—'}
                              </p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 md:hidden truncate">
                                {u.email || '@' + (u.username || 'user')}
                              </p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 hidden md:block">
                                @{u.username || 'user'}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* E-mail */}
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs font-mono text-muted-foreground truncate max-w-[160px] block">
                            {u.email || '—'}
                          </span>
                        </TableCell>

                        {/* Cargo */}
                        <TableCell className="hidden sm:table-cell">
                          <Badge className={`border-none font-bold text-[9px] uppercase px-2.5 h-5 ${
                            isStaff
                              ? pType.includes('admin') ? 'bg-indigo-100 text-indigo-700'
                              : pType.includes('teacher') ? 'bg-purple-100 text-purple-700'
                              : 'bg-orange-100 text-orange-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {u.profile_type || (u.role === 'admin' ? 'Coordenação' : u.role === 'teacher' ? 'Professor' : 'Estudante')}
                          </Badge>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge variant="outline" className={`font-bold text-[9px] uppercase px-2.5 h-5 ${isSuspended ? 'text-red-500 border-red-200 bg-red-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}`}>
                            {isSuspended ? 'Suspenso' : 'Ativo'}
                          </Badge>
                        </TableCell>

                        {/* Ações */}
                        <TableCell className="text-right px-4 md:px-6">
                          <div className="flex items-center justify-end gap-1">
                            {/* Editar dados */}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar dados do usuário"
                              onClick={() => openEditModal(u)}
                              className="h-10 w-10 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            {/* Reset de Senha */}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Gerar link de reset de senha"
                              onClick={() => openResetModal(u)}
                              className="h-10 w-10 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-colors"
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
                                  className={`h-10 w-10 rounded-lg transition-colors ${isSuspended ? 'hover:bg-emerald-50 hover:text-emerald-600' : 'hover:bg-amber-50 hover:text-amber-600'}`}
                                >
                                  {isProcessing
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : isSuspended
                                      ? <CheckCircle2 className="h-4 w-4" />
                                      : <Ban className="h-4 w-4" />
                                  }
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-black text-primary">
                                    {isSuspended ? 'Reativar acesso?' : 'Suspender acesso?'}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {isSuspended
                                      ? `${u.name} voltará a ter acesso à plataforma normalmente.`
                                      : `${u.name} não conseguirá mais fazer login. Esta ação pode ser revertida.`
                                    }
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleToggleStatus(u.id, u.status)}
                                    className={`rounded-xl font-bold border-none ${isSuspended ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'}`}
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
                              asChild
                              className="h-10 w-10 rounded-lg hover:bg-accent/10 hover:text-accent transition-colors"
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
                                  title="Excluir usuário permanentemente"
                                  className="h-10 w-10 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                                >
                                  {isProcessing && processingId === u.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-black text-red-600">
                                    Excluir Usuário Permanentemente?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação é <strong>irreversível</strong>. O usuário <strong>{u.name}</strong> será excluído definitivamente da autenticação e de todos os registros de perfil no sistema.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(u.id, u.name)}
                                    className="rounded-xl font-bold border-none bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
        <DialogContent className="rounded-card border-none shadow-2xl p-0 overflow-hidden w-[95vw] sm:max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader className="p-8 pb-4 bg-primary/5 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center font-black text-white text-lg shadow shrink-0">
                {editingUser?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <DialogTitle className="text-xl font-black italic text-primary leading-none uppercase tracking-tight">
                  Editar Usuário
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5 font-medium text-muted-foreground">
                  {editingUser?.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Nome Completo</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Nome do usuário"
                className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">E-mail</Label>
              <Input
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="h-12 bg-muted/30 border-none rounded-xl font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Escola / Polo</Label>
                <Input
                  value={editInstitution}
                  onChange={e => setEditInstitution(e.target.value)}
                  placeholder="Nome da escola"
                  className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Turma / Curso</Label>
                <Input
                  value={editCourse}
                  onChange={e => setEditCourse(e.target.value)}
                  placeholder="Ex: 3ª Série A"
                  className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Número da Sala</Label>
                <Select value={editSala} onValueChange={setEditSala}>
                  <SelectTrigger className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm">
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
                <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Turno</Label>
                <div className="flex gap-2">
                  {TURNO_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setEditTurno(t.value)}
                      className={`flex-1 h-12 rounded-xl font-black text-xs transition-all border-2 ${
                        editTurno === t.value
                          ? 'bg-primary text-white border-primary shadow'
                          : 'bg-white border-muted text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Tipo de Perfil</Label>
              <Input
                value={editProfileType}
                onChange={e => setEditProfileType(e.target.value)}
                placeholder="Ex: student, teacher, staff..."
                className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Segmento</Label>
              <div className="flex gap-3">
                {['', 'ENEM', 'ETEC'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setEditExamTarget(opt)}
                    className={`flex-1 h-11 rounded-xl font-black text-xs transition-all border-2 ${
                      editExamTarget === opt
                        ? opt === 'ETEC'
                          ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200'
                          : opt === 'ENEM'
                            ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-200'
                            : 'bg-slate-200 text-slate-600 border-slate-200'
                        : 'bg-white border-muted text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    {opt === '' ? 'N/A' : opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-8 pb-8">
            <Button
              onClick={handleUpdateUser}
              disabled={editIsSubmitting}
              className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 uppercase tracking-widest text-xs transition-all active:scale-95"
            >
              {editIsSubmitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
