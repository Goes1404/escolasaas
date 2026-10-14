
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, 
  Gavel, 
  Trash2, 
  Loader2, 
  MessageSquare, 
  ShieldAlert, 
  Settings2,
  Lock,
  Unlock,
  UserX,
  Calendar,
  User,
  ExternalLink,
  ShieldCheck,
  Filter,
  Eye,
  EyeOff
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fmtDate, txt } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';

const FORUM_CATEGORIES = [
  "Dúvidas", 
  "Matemática", 
  "Física", 
  "Química", 
  "Biologia", 
  "Linguagens", 
  "História", 
  "Geografia", 
  "Carreira", 
  "Off-Topic"
];

export default function AdminForumModerationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  
  const [forums, setForums] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Estados de Configuração
  const [configForum, setConfigForum] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const fetchForums = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forums')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setForums(data || []);
    } catch (err) {
      console.error("Erro moderação:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForums();
  }, []);

  const handleDeleteForum = async (id: string, name: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from('forums').delete().eq('id', id);
      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        user_name: 'Administrador',
        action: `Moderou e removeu o tópico de fórum: ${name}`,
        entity_type: 'forum',
        entity_id: id
      });

      setForums(prev => prev.filter(f => f.id !== id));
      toast({ title: "Tópico excluído", description: "O tópico e todas as mensagens dele foram excluídos." });
    } catch (err: any) {
      toast({ title: "Não foi possível excluir o tópico", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenConfig = async (forum: any) => {
    setConfigForum(forum);
    // Buscar usuários banidos deste fórum
    const { data, error } = await supabase
      .from('forum_bans')
      .select('*, profiles(name, profile_type)')
      .eq('forum_id', forum.id);
    
    if (!error) setBannedUsers(data || []);
  };

  const updateForumSettings = async () => {
    if (!configForum) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('forums')
        .update({
          name: configForum.name,
          is_teacher_only: configForum.is_teacher_only
        })
        .eq('id', configForum.id);

      if (error) throw error;
      
      setForums(prev => prev.map(f => f.id === configForum.id ? configForum : f));
      toast({ title: "Configurações salvas", description: "As permissões do fórum foram atualizadas." });
    } catch (err: any) {
      toast({ title: "Não foi possível salvar", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const searchUserToBan = async () => {
    if (userSearch.length < 3) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, name, profile_type')
      .ilike('name', `%${userSearch}%`)
      .limit(5);
    setSearchResults(data || []);
  };

  const banUserFromForum = async (targetUser: any) => {
    try {
      const { error } = await supabase
        .from('forum_bans')
        .insert({ forum_id: configForum.id, user_id: targetUser.id });
      
      if (error) throw error;

      setBannedUsers([...bannedUsers, { user_id: targetUser.id, profiles: targetUser }]);
      setUserSearch("");
      setSearchResults([]);
      toast({ title: "Usuário bloqueado", description: `${txt(targetUser.name, "O usuário")} não pode mais escrever neste fórum.` });
    } catch (err: any) {
      toast({ title: "Usuário já bloqueado", description: "Este usuário já está bloqueado neste fórum.", variant: "destructive" });
    }
  };

  const liftBan = async (banId: string) => {
    const { error } = await supabase.from('forum_bans').delete().eq('id', banId);
    if (!error) {
      setBannedUsers(bannedUsers.filter(b => b.id !== banId));
      toast({ title: "Usuário desbloqueado" });
    }
  };

  const filtered = forums.filter(f => {
    const matchesSearch = f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         f.author_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || f.category === categoryFilter;
    
    const matchesVisibility = visibilityFilter === 'all' || 
                             (visibilityFilter === 'staff' && f.is_teacher_only) ||
                             (visibilityFilter === 'public' && !f.is_teacher_only);

    return matchesSearch && matchesCategory && matchesVisibility;
  });

  const rowActions = (f: any) => (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" className="rounded-control h-10 w-10" asChild title="Abrir fórum" aria-label="Abrir fórum">
        <Link href={`/dashboard/forum/${f.id}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link>
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-control h-10 w-10" title="Configurar" aria-label="Configurar fórum" onClick={() => handleOpenConfig(f)}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="rounded-card p-6 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Configurações do fórum</DialogTitle>
          </DialogHeader>

          {configForum && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="u-label">Título do fórum</Label>
                    <Input
                      value={configForum.name}
                      onChange={e => setConfigForum({...configForum, name: e.target.value})}
                      className="h-11 rounded-control text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-control bg-muted/30 border">
                    <div className="space-y-0.5">
                      <Label className="font-semibold text-sm text-foreground">Só professores escrevem</Label>
                      <p className="text-xs text-muted-foreground leading-tight">Alunos apenas leem</p>
                    </div>
                    <Switch
                      checked={configForum.is_teacher_only}
                      onCheckedChange={v => setConfigForum({...configForum, is_teacher_only: v})}
                    />
                  </div>

                  <Button onClick={updateForumSettings} disabled={isUpdating} className="w-full h-11 font-bold rounded-control text-sm mt-2">
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar configurações"}
                  </Button>
                </div>

                <div className="space-y-3 relative">
                  <Label className="u-label flex items-center gap-2">
                    <UserX className="h-3 w-3" /> Bloquear participantes
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder="Buscar aluno para bloquear..."
                      className="h-11 rounded-control pr-10 text-sm"
                      value={userSearch}
                      onChange={e => { setUserSearch(e.target.value); searchUserToBan(); }}
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>

                  {searchResults.length > 0 && (
                    <div className="bg-popover border rounded-control shadow-xl p-2 absolute z-50 left-0 right-0">
                      {searchResults.map(u => (
                        <button
                          key={u.id}
                          onClick={() => banUserFromForum(u)}
                          className="w-full text-left p-2 hover:bg-red-50 rounded-control flex items-center justify-between gap-2"
                        >
                          <span className="text-sm font-semibold text-foreground truncate">{txt(u.name, "Usuário")}</span>
                          <Badge className="bg-red-100 text-red-700 border-none text-[10px] font-bold uppercase shrink-0">Bloquear</Badge>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    <p className="u-label px-1">Bloqueados neste fórum</p>
                    {bannedUsers.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 text-center border border-dashed rounded-control">Ninguém bloqueado neste fórum.</p>
                    ) : (
                      bannedUsers.map(b => (
                        <div key={b.id} className="flex items-center justify-between gap-2 p-2.5 bg-red-50 rounded-control border border-red-100">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-red-800 leading-none truncate">{txt(b.profiles?.name, "Usuário")}</p>
                            {b.profiles?.profile_type && <p className="text-[10px] font-semibold text-red-600 uppercase mt-1">{b.profiles.profile_type}</p>}
                          </div>
                          <Button variant="ghost" size="icon" title="Desbloquear" aria-label="Desbloquear" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-card rounded-control shrink-0" onClick={() => liftBan(b.id)}>
                            <Unlock className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Excluir tópico" aria-label="Excluir tópico" className="rounded-control h-10 w-10 text-red-500 hover:text-red-600 hover:bg-red-50">
            {deletingId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-card p-8 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">Excluir este tópico?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Esta ação remove o tópico <strong className="text-red-600">"{f.name}"</strong> e todas as mensagens dele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel className="rounded-control font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteForum(f.id, f.name)}
              className="rounded-control font-bold bg-red-600 hover:bg-red-700 text-white px-6"
            >
              Excluir tópico
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  const topicTags = (f: any) => (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      {f.category && <Badge variant="outline" className="text-[10px] font-bold uppercase">{f.category}</Badge>}
      {f.is_teacher_only && <Badge className="bg-muted text-foreground text-[10px] font-bold uppercase border-none gap-1"><Lock className="h-2.5 w-2.5" /> Só professores</Badge>}
    </div>
  );

  return (
    <div className="space-y-6 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><Gavel className="h-3.5 w-3.5" /> Coordenação · fóruns</p>
          <h1 className="u-page-title text-3xl mt-1">Moderação dos fóruns</h1>
          <p className="text-muted-foreground text-sm mt-2">Gerencie tópicos, quem pode escrever e quem está bloqueado.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tópico ou autor..."
            className="pl-9 h-11 rounded-control"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="u-label flex items-center gap-2">
            <Filter className="h-3 w-3" /> Matéria
          </Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-11 rounded-control">
              <SelectValue placeholder="Todas as matérias" />
            </SelectTrigger>
            <SelectContent className="rounded-control">
              <SelectItem value="all">Todas as matérias</SelectItem>
              {FORUM_CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="u-label flex items-center gap-2">
            <Eye className="h-3 w-3" /> Quem pode escrever
          </Label>
          <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
            <SelectTrigger className="h-11 rounded-control">
              <SelectValue placeholder="Todos os tópicos" />
            </SelectTrigger>
            <SelectContent className="rounded-control">
              <SelectItem value="all">Todos os tópicos</SelectItem>
              <SelectItem value="public">Só tópicos abertos</SelectItem>
              <SelectItem value="staff">Só tópicos de professores</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <Card className="rounded-card">
          <CardContent className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="u-label">Carregando tópicos…</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={forums.length === 0 ? "Nenhum tópico criado ainda" : "Nenhum tópico encontrado"}
          description={forums.length === 0
            ? "Quando alunos ou professores abrirem tópicos no fórum, eles aparecem aqui."
            : "Tente outra busca, outra matéria ou outro filtro."}
          action={forums.length === 0
            ? { label: "Abrir o fórum", href: "/dashboard/forum" }
            : { label: "Limpar filtros", onClick: () => { setSearchTerm(""); setCategoryFilter("all"); setVisibilityFilter("all"); } }}
        />
      ) : (
        <>
          <div className="sm:hidden space-y-3">
            {filtered.map((f) => (
              <Card key={f.id} className="rounded-card">
                <CardContent className="p-4 space-y-2">
                  <p className="font-semibold text-sm text-foreground break-words">{txt(f.name, "Sem título")}</p>
                  {topicTags(f)}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-muted-foreground truncate min-w-0">
                      {txt(f.author_name, "Autor desconhecido")} · {fmtDate(f.created_at, "dd/MM/yy")}
                    </span>
                    {rowActions(f)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden sm:block rounded-card overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="px-6 u-label">Tópico</TableHead>
                      <TableHead className="u-label">Autor</TableHead>
                      <TableHead className="u-label">Data</TableHead>
                      <TableHead className="text-right px-6 u-label">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((f) => (
                      <TableRow key={f.id} className="hover:bg-muted/20">
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-control bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                              {f.is_teacher_only ? <Lock className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground text-sm">{txt(f.name, "Sem título")}</span>
                              {topicTags(f)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm text-foreground">{txt(f.author_name, "Desconhecido")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground tabular-nums">{fmtDate(f.created_at, "dd/MM/yy")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6">{rowActions(f)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
