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
    toast({ title: 'Link de convite copiado!' });
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-4 bg-orange-50 border-b border-orange-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <Link2 className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-orange-700 leading-none italic uppercase tracking-tighter">
                Link de Cadastro
              </DialogTitle>
              <DialogDescription className="text-xs mt-1 font-medium text-orange-600/60">
                Inscrição direta de novos estudantes
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6">
          {!link ? (
            <div className="space-y-6">
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                Este link permite que novos alunos criem suas contas sozinhos. 
                Eles serão integrados automaticamente como <strong className="text-primary italic uppercase">Estudantes</strong>.
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
                className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-2xl shadow-xl shadow-orange-200 uppercase tracking-widest text-xs transition-all active:scale-95 border-none"
              >
                {loading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Gerar Link de Inscrição
              </Button>
            </div>
          ) : (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
              <div className="bg-slate-50 border border-slate-100 rounded-[1.5rem] p-5 space-y-4">
                <div className="flex items-center justify-between">
                   <Badge className="bg-emerald-500 text-white border-none font-black text-[9px] uppercase px-3 py-1">Link Ativo</Badge>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expira em {expiryDays} dias</span>
                </div>
                <p className="text-xs font-mono text-slate-400 break-all bg-white p-3 rounded-xl border border-slate-50">
                  {link}
                </p>
                <Button
                  onClick={handleCopy}
                  className="w-full h-12 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 gap-2 border-none"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado para o clipboard!' : 'Copiar Link agora'}
                </Button>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-700">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-[10px] font-bold leading-tight uppercase tracking-tight">
                  Envie este link para os grupos de novos alunos para que façam a autoinscrição.
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
    toast({ title: 'Link copiado!' });
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
      toast({ title: 'Senha redefinida!' });
    } catch (err: any) {
      setDirectError(err.message || 'Falha ao redefinir.');
    } finally {
      setDirectLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-primary" />
            <div>
              <DialogTitle className="text-base font-black text-primary">Redefinir Senha</DialogTitle>
              <DialogDescription className="text-xs">{user?.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 text-xs">
            <Mail className="h-4 w-4 text-slate-400" />
            <span className="font-mono text-slate-600 truncate">{user?.email}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => setTab('link')} className={`h-8 rounded-lg text-xs font-bold transition-all ${tab === 'link' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Enviar Link</button>
            <button onClick={() => setTab('direct')} className={`h-8 rounded-lg text-xs font-bold transition-all ${tab === 'direct' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Definir Senha</button>
          </div>

          {tab === 'link' && (
            <div className="space-y-4">
              {!link && !linkLoading && !linkError && (
                <Button onClick={generateLink} className="w-full h-11 bg-primary text-white font-bold rounded-xl border-none shadow-md">
                  Gerar Link de Recuperação
                </Button>
              )}
              {linkLoading && <div className="py-4 text-center text-xs text-slate-400">Gerando...</div>}
              {link && (
                <div className="space-y-3">
                  <p className="text-[10px] font-mono break-all p-2.5 bg-slate-50 border border-slate-100 rounded-lg">{link}</p>
                  <Button onClick={handleCopy} className="w-full h-10 bg-primary text-white border-none rounded-xl font-bold text-xs">
                    {copied ? 'Copiado!' : 'Copiar Link'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === 'direct' && (
            <div className="space-y-4">
              {directSuccess ? (
                <div className="text-center py-4 text-xs font-bold text-green-600">Senha definida com sucesso!</div>
              ) : (
                <>
                  <Input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-10 rounded-xl font-mono text-xs" />
                  {directError && <div className="text-xs text-red-600">{directError}</div>}
                  <Button onClick={handleDirectReset} disabled={directLoading} className="w-full h-11 bg-primary text-white border-none rounded-xl font-bold text-xs">
                    Salvar Nova Senha
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
      toast({ title: 'Aluno cadastrado com sucesso!' });
      onCreated();
    } catch (err: any) {
      toast({ title: 'Erro ao cadastrar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-4 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-blue-700 leading-none italic uppercase tracking-tighter">
                Novo Aluno
              </DialogTitle>
              <DialogDescription className="text-xs mt-1 font-medium text-blue-600/60">
                Cadastro manual de estudante
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
          {createdEmail ? (
            <div className="space-y-4 animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-emerald-700 uppercase tracking-wide">Aluno criado!</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5 font-mono">{createdEmail}</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Uma senha temporária foi gerada. Use o botão <strong>Redefinir Senha</strong> na lista para enviar o link de acesso ao aluno.
              </p>
              <Button onClick={() => { reset(); onClose(); }} className="w-full h-12 rounded-2xl font-black text-xs border-none bg-blue-600 hover:bg-blue-700 text-white">
                Fechar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nome Completo *</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ex: Maria Silva Santos" className="h-12 bg-muted/30 border-none rounded-xl font-bold text-sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">CPF (opcional)</Label>
                  <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className="h-12 bg-muted/30 border-none rounded-xl font-mono text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nascimento *</Label>
                  <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">E-mail</Label>
                  <button type="button" onClick={() => setUseCustomEmail(!useCustomEmail)} className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700">
                    {useCustomEmail ? 'Usar e-mail automático' : 'Definir e-mail próprio'}
                  </button>
                </div>
                {useCustomEmail ? (
                  <Input value={emailOverride} onChange={e => setEmailOverride(e.target.value)} placeholder="aluno@email.com" className="h-12 bg-muted/30 border-none rounded-xl font-mono text-sm" />
                ) : (
                  <div className="h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center px-4">
                    <Mail className="h-4 w-4 text-slate-300 mr-2 shrink-0" />
                    <span className="text-xs text-slate-400 font-mono">
                      {fullName.trim() ? `${fullName.trim().split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}...@compromisso.com` : 'gerado a partir do nome'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Escola / Polo</Label>
                <Select value={institution} onValueChange={setInstitution}>
                  <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold">
                    <SelectValue placeholder="Selecionar polo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="none" className="font-bold text-xs text-slate-400">Sem polo definido</SelectItem>
                    {SCHOOL_LIST.map(s => (
                      <SelectItem key={s} value={s} className="font-bold text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Turma</Label>
                  <Select value={course} onValueChange={setCourse}>
                    <SelectTrigger className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm">
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {Array.from({ length: 12 }, (_, i) => {
                        const num = String(i + 1).padStart(2, '0');
                        return (
                          <SelectItem key={num} value={num} className="font-bold text-xs">
                            Sala {num}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Foco de Exame</Label>
                  <Select value={examTarget} onValueChange={setExamTarget}>
                    <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="ENEM" className="font-bold text-xs">ENEM</SelectItem>
                      <SelectItem value="ETEC" className="font-bold text-xs">ETEC / FATEC</SelectItem>
                      <SelectItem value="Outro" className="font-bold text-xs">Outros Vestibulares</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => { reset(); onClose(); }} className="flex-1 h-12 rounded-2xl font-black text-xs border-slate-200">
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={loading} className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-200 border-none text-xs">
                  {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Cadastrar Aluno
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
      toast({ title: newStatus === 'active' ? 'Matrícula Reativada' : 'Matrícula Suspensa' });
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
      toast({ title: 'Matrícula excluída', description: `O estudante ${name} foi removido com sucesso.` });
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
      toast({ title: "Dados da matrícula atualizados!" });
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
    toast({ title: "CSV exportado! 📄", description: `${filtered.length} matrículas baixadas.` });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-primary italic leading-none">
            Matrículas & Estudantes
            <span className="text-lg font-bold text-muted-foreground ml-2 not-italic">
              ({filtered.length})
            </span>
          </h1>
          <p className="text-muted-foreground font-medium italic text-sm">
            Gere links de convite, suspenda acessos, gerencie turmas e controle isenções sociais.
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0 flex-wrap">
          <Button
            onClick={() => setNewStudentOpen(true)}
            className="bg-blue-600 text-white border-none font-black rounded-2xl shadow-md h-12 px-4 md:px-6 gap-2 hover:bg-blue-700 transition-all text-xs md:text-sm"
          >
            <UserPlus className="h-4 w-4" />
            Novo Aluno
          </Button>
          <Button
            onClick={() => setInviteOpen(true)}
            className="bg-white text-orange-600 border border-orange-100 font-black rounded-2xl shadow-md h-12 px-4 md:px-6 gap-2 hover:bg-orange-50 transition-all text-xs md:text-sm"
          >
            <Link2 className="h-4 w-4" />
            Convite
          </Button>
          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="bg-white text-slate-600 border-slate-200 font-black rounded-2xl shadow-md h-12 px-4 md:px-6 gap-2 hover:bg-slate-50 transition-all text-xs md:text-sm"
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
            <SelectTrigger className="h-11 w-full lg:w-56 bg-muted/30 border-none rounded-xl font-bold text-sm shrink-0">
              <SelectValue placeholder="Filtrar por Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl">
              <SelectItem value="all" className="font-bold text-xs">Todos os Estudantes</SelectItem>
              <SelectItem value="active" className="font-bold text-xs">Ativos</SelectItem>
              <SelectItem value="suspended" className="font-bold text-xs">Suspensos</SelectItem>
              <SelectItem value="is_financial_aid_eligible" className="font-bold text-xs">Elegíveis Isenção (Social)</SelectItem>
              <SelectItem value="income_ok" className="font-bold text-xs">Renda OK / Isento</SelectItem>
              <SelectItem value="income_exceeded" className="font-bold text-xs">Excedeu Limite (Reprovado)</SelectItem>
              <SelectItem value="income_pending" className="font-bold text-xs">Pendente (Não Simularam)</SelectItem>
              <SelectItem value="sem_telefone" className="font-bold text-xs">Sem telefone (não recupera senha sozinho)</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Tabela de Alunos */}
      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-accent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground italic text-sm">
              Nenhum estudante encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="h-12 md:h-14">
                    <TableHead className="px-4 md:px-6 font-black uppercase text-[10px] tracking-widest">Estudante</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest hidden sm:table-cell">Turma / Escola</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Social</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Matrícula</TableHead>
                    <TableHead className="text-right px-4 md:px-6 font-black uppercase text-[10px] tracking-widest">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => {
                    const isSuspended = u.status === 'suspended';
                    const isProcessing = processingId === u.id;

                    return (
                      <TableRow key={u.id} className="h-16 hover:bg-muted/5 border-b last:border-0 transition-colors">
                        <TableCell className="px-4 md:px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm bg-primary text-white shrink-0">
                              {u.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className={`font-bold text-sm truncate ${isSuspended ? 'line-through opacity-40 text-slate-400' : 'text-primary italic'}`}>
                                {u.name || '—'}
                              </p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 truncate">
                                {u.email || '@' + (u.username || 'user')}
                              </p>
                              {u.phone && (
                                <p className="text-[9px] font-black text-emerald-600 truncate mt-0.5">
                                  📞 {u.phone}
                                </p>
                              )}
                              {/* Turma/Polo inline no mobile (coluna dedicada fica oculta < sm) */}
                              <p className="sm:hidden text-[9px] font-black uppercase tracking-wider text-slate-400 truncate mt-0.5">
                                {u.course || 'Sem turma'} · {u.institution || 'Sem polo'}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">{u.course || 'Sem Turma'}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{u.institution || 'Sem Polo'}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {Number(u.family_income) > 0 ? (
                            <div className="flex flex-col gap-0.5 items-start">
                              <Badge className={`border-none font-bold text-[9px] uppercase px-2 h-5 flex items-center gap-1 ${
                                u.is_financial_aid_eligible
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                <HandHeart className="h-3 w-3" />
                                {u.is_financial_aid_eligible ? 'Isento' : 'Excedeu'}
                              </Badge>
                              <span className="text-[10px] font-mono font-bold text-slate-500">
                                R$ {Number(u.income_per_capita).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mor.
                              </span>
                            </div>
                          ) : u.is_financial_aid_eligible ? (
                            <div className="flex flex-col gap-0.5 items-start">
                              <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[9px] uppercase px-2 h-5 flex items-center gap-1">
                                <HandHeart className="h-3 w-3" /> Isento (Man.)
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Pendente</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className={`font-bold text-[9px] uppercase px-2.5 h-5 ${isSuspended ? 'text-red-500 border-red-200 bg-red-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}`}>
                            {isSuspended ? 'Suspensa' : 'Ativa'}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right px-4 md:px-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ver perfil 360°"
                              asChild
                              className="h-10 w-10 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            >
                              <Link href={`/dashboard/secretary/students/${u.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar Matrícula"
                              onClick={() => openEditModal(u)}
                              className="h-10 w-10 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="Gerar Reset de Senha"
                              onClick={() => {
                                setResetTarget({ id: u.id, name: u.name, email: u.email });
                                setResetOpen(true);
                              }}
                              className="h-10 w-10 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-colors"
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
                                  className={`h-10 w-10 rounded-lg transition-colors ${isSuspended ? 'hover:bg-emerald-50 hover:text-emerald-600' : 'hover:bg-amber-50 hover:text-amber-600'}`}
                                >
                                  {isProcessing
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : isSuspended
                                      ? <CheckCircle2 className="h-4 w-4" />
                                      : <UserX className="h-4 w-4" />
                                  }
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-black text-primary">
                                    {isSuspended ? 'Reativar Matrícula?' : 'Suspender Matrícula?'}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {isSuspended
                                      ? `O estudante ${u.name} terá o acesso restabelecido para assistir aulas e acessar a plataforma.`
                                      : `O estudante ${u.name} não conseguirá mais realizar login no sistema até que a matrícula seja reativada.`
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

                            {/* WhatsApp Link */}
                            {u.phone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Enviar mensagem por WhatsApp"
                                asChild
                                className="h-10 w-10 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                              >
                                <a
                                  href={`https://wa.me/55${u.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Phone className="h-4 w-4" />
                                </a>
                              </Button>
                            )}

                            {/* Excluir Matrícula */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isProcessing}
                                  title="Excluir matrícula permanentemente"
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
                                    Excluir Matrícula Permanentemente?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação é <strong>irreversível</strong>. O estudante <strong>{u.name}</strong> será excluído definitivamente da autenticação e de todos os registros no sistema.
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

      {/* Modal de Novo Aluno */}
      <NewStudentModal open={newStudentOpen} onClose={() => setNewStudentOpen(false)} onCreated={fetchUsers} />

      {/* Modal de Convite */}
      <InviteLinkModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      {/* Modal de Reset */}
      <ResetPasswordModal user={resetTarget} open={resetOpen} onClose={() => { setResetOpen(false); setResetTarget(null); }} />

      {/* Modal de Edição de Matrícula */}
      <Dialog open={!!editingUser} onOpenChange={v => { if (!v) setEditingUser(null); }}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-y-auto max-h-[92vh] w-[95vw] sm:max-w-md">
          <DialogHeader className="p-8 pb-4 bg-primary/5 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center font-black text-white text-lg shadow shrink-0">
                {editingUser?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <DialogTitle className="text-xl font-black italic text-primary leading-none uppercase tracking-tight">
                  Editar Matrícula
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5 font-medium text-muted-foreground">
                  Ficha do Estudante
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Nome Completo</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-12 bg-muted/30 border-none rounded-xl font-bold text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">E-mail</Label>
              <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="h-12 bg-muted/30 border-none rounded-xl font-mono text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Telefone</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm" placeholder="Ex: (11) 99999-9999" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Escola / Polo</Label>
                <Input value={editInstitution} onChange={e => setEditInstitution(e.target.value)} className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Turma</Label>
                <Select value={editCourse} onValueChange={setEditCourse}>
                  <SelectTrigger className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm">
                    <SelectValue placeholder="Selecionar Sala" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {Array.from({ length: 12 }, (_, i) => {
                      const num = String(i + 1).padStart(2, '0');
                      return (
                        <SelectItem key={num} value={num} className="font-bold text-xs">
                          Sala {num}
                        </SelectItem>
                      );
                    })}
                    {editCourse && !Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).includes(editCourse) && (
                      <SelectItem value={editCourse} className="font-bold text-xs">
                        {editCourse}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Foco de Exame</Label>
              <Select value={editExamTarget} onValueChange={setEditExamTarget}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold">
                  <SelectValue placeholder="Foco" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="ENEM" className="font-bold text-xs">ENEM</SelectItem>
                  <SelectItem value="ETEC" className="font-bold text-xs">ETEC / FATEC</SelectItem>
                  <SelectItem value="Outro" className="font-bold text-xs">Outros Vestibulares</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Renda calculada pelo aluno */}
            {editingUser?.family_income > 0 && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-primary/40 tracking-widest">Cálculo de Renda (Aluno)</span>
                  <Badge className={`border-none font-bold text-[9px] uppercase px-2 h-5 ${
                    editingUser.income_per_capita <= 2431.50
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {editingUser.income_per_capita <= 2431.50 ? 'Renda OK' : 'Excedeu Limite'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px]">Renda Familiar Total</span>
                    <p className="font-bold text-primary">R$ {Number(editingUser.family_income).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Membros da Família</span>
                    <p className="font-bold text-primary">{editingUser.family_size} pessoas</p>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200/60">
                    <span className="text-muted-foreground text-[10px]">Renda Per Capita</span>
                    <p className="font-black text-sm italic text-primary">
                      R$ {Number(editingUser.income_per_capita).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / morador
                    </p>
                  </div>
                </div>

                {editingUser.family_members && Array.isArray(editingUser.family_members) && editingUser.family_members.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 space-y-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Composição Familiar:</span>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {editingUser.family_members.map((m: any, i: number) => (
                        <div key={i} className="flex justify-between text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-100">
                          <span>{m.label || `Integrante ${i + 1}`}</span>
                          <span className="font-mono">R$ {Number(m.income || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Social / Isenção (Financial Aid) */}
            <div className="flex items-center justify-between p-4 bg-orange-50/50 border border-orange-100 rounded-2xl">
              <div className="flex gap-2.5 items-center">
                <HandHeart className="h-5 w-5 text-orange-600 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-slate-700 leading-none">Cota Social / Isenção</span>
                  <span className="text-[9px] text-slate-400 font-semibold mt-1">Elegível para benefícios da plataforma</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditIsFinancialAid(!editIsFinancialAid)}
                className={`h-6 w-11 rounded-full p-0.5 transition-colors focus:outline-none ${editIsFinancialAid ? 'bg-orange-600' : 'bg-slate-200'}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white transition-transform ${editIsFinancialAid ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <Button onClick={handleUpdateUser} disabled={editIsSubmitting} className="w-full h-14 bg-primary hover:bg-primary/95 text-white font-black rounded-2xl shadow-xl mt-4 border-none">
              {editIsSubmitting ? <Loader2 className="animate-spin mr-2" /> : <UserCheck className="mr-2" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
