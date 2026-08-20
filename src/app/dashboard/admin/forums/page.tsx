
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
import { format } from "date-fns";
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
      toast({ title: "Tópico Removido", description: "O debate e todas as suas mensagens foram excluídos." });
    } catch (err: any) {
      toast({ title: "Erro na Moderação", description: err.message, variant: "destructive" });
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
      toast({ title: "Configurações Salvas", description: "As permissões do fórum foram atualizadas." });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
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
      toast({ title: "Usuário Restrito", description: `${targetUser.name} não pode mais postar aqui.` });
    } catch (err: any) {
      toast({ title: "Ação já registrada", description: "Este usuário já está banido deste debate.", variant: "destructive" });
    }
  };

  const liftBan = async (banId: string) => {
    const { error } = await supabase.from('forum_bans').delete().eq('id', banId);
    if (!error) {
      setBannedUsers(bannedUsers.filter(b => b.id !== banId));
      toast({ title: "Acesso Restaurado" });
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

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-primary italic leading-none">Moderação de Comunidade</h1>
            <Gavel className="h-6 w-6 text-accent" />
          </div>
          <p className="text-muted-foreground font-medium italic">Gestão de tópicos, permissões de fala e restrições de usuários.</p>
        </div>
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors" />
          <Input 
            placeholder="Pesquisar tópico ou autor..." 
            className="pl-12 h-14 bg-white border-none shadow-xl rounded-2xl italic font-medium focus-visible:ring-accent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-primary/40 px-2 tracking-widest flex items-center gap-2">
            <Filter className="h-3 w-3" /> Filtrar por Matéria
          </Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-12 rounded-xl bg-white border-none shadow-md font-bold italic">
              <SelectValue placeholder="Todas as Categorias" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl">
              <SelectItem value="all" className="font-bold">Todas as Matérias</SelectItem>
              {FORUM_CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat} className="font-bold">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-primary/40 px-2 tracking-widest flex items-center gap-2">
            <Eye className="h-3 w-3" /> Nível de Visibilidade
          </Label>
          <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
            <SelectTrigger className="h-12 rounded-xl bg-white border-none shadow-md font-bold italic">
              <SelectValue placeholder="Todos os Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl">
              <SelectItem value="all" className="font-bold">Todos os Tópicos</SelectItem>
              <SelectItem value="public" className="font-bold">Apenas Públicos</SelectItem>
              <SelectItem value="staff" className="font-bold">Apenas Somente Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-accent" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Escaneando Redes de Debate...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 border-b border-muted/10">
                  <TableRow className="border-none h-16">
                    <TableHead className="px-8 font-black uppercase text-[10px] tracking-widest text-primary/40">Tópico / Status</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-primary/40">Autor</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-primary/40">Data</TableHead>
                    <TableHead className="text-right px-8 font-black uppercase text-[10px] tracking-widest text-primary/40">Ações de Gestão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => (
                    <TableRow key={f.id} className="border-b last:border-0 hover:bg-accent/5 transition-colors group h-24">
                      <TableCell className="px-8">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shadow-inner">
                            {f.is_teacher_only ? <Lock className="h-5 w-5 text-accent" /> : <MessageSquare className="h-5 w-5" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-primary text-sm italic group-hover:text-accent transition-colors">{f.name}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className="bg-muted/50 text-[7px] font-black uppercase text-primary/40 border-none">{f.category}</Badge>
                              {f.is_teacher_only && <Badge className="bg-red-50 text-red-600 text-[7px] font-black uppercase border-none">Somente Staff</Badge>}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-bold text-primary/70">{f.author_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{format(new Date(f.created_at), "dd/MM/yy")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-8">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-primary" asChild>
                            <Link href={`/dashboard/forum/${f.id}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link>
                          </Button>
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-accent" onClick={() => handleOpenConfig(f)}>
                                <Settings2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-[2rem] border-none shadow-2xl p-6 max-w-2xl bg-white">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-black italic text-primary">Configurações de Debate</DialogTitle>
                              </DialogHeader>
                              
                              {configForum && (
                                <div className="space-y-4 py-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                      <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black uppercase opacity-40">Título do Fórum</Label>
                                        <Input 
                                          value={configForum.name} 
                                          onChange={e => setConfigForum({...configForum, name: e.target.value})}
                                          className="h-10 rounded-xl bg-muted/30 border-none font-bold text-sm"
                                        />
                                      </div>
                                      
                                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 shadow-inner">
                                        <div className="space-y-0.5">
                                          <Label className="font-black text-xs italic text-primary">Somente Professores</Label>
                                          <p className="text-[9px] font-bold text-muted-foreground uppercase leading-tight">Alunos apenas leem</p>
                                        </div>
                                        <Switch 
                                          checked={configForum.is_teacher_only}
                                          onCheckedChange={v => setConfigForum({...configForum, is_teacher_only: v})}
                                        />
                                      </div>

                                      <Button onClick={updateForumSettings} disabled={isUpdating} className="w-full h-10 bg-primary text-white font-black rounded-xl shadow-lg text-sm mt-2">
                                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gravar Preferências"}
                                      </Button>
                                    </div>

                                    <div className="space-y-3">
                                      <Label className="text-[9px] font-black uppercase opacity-40 flex items-center gap-2">
                                        <UserX className="h-3 w-3" /> Restringir Participantes
                                      </Label>
                                      <div className="relative">
                                        <Input 
                                          placeholder="Buscar aluno para banir..."
                                          className="h-10 rounded-xl bg-muted/30 border-none pr-10 italic text-sm"
                                          value={userSearch}
                                          onChange={e => { setUserSearch(e.target.value); searchUserToBan(); }}
                                        />
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                                      </div>

                                      {searchResults.length > 0 && (
                                        <div className="bg-white border rounded-xl shadow-xl p-2 absolute z-50 w-[240px] -mt-1 animate-in fade-in zoom-in-95">
                                          {searchResults.map(u => (
                                            <button 
                                              key={u.id}
                                              onClick={() => banUserFromForum(u)}
                                              className="w-full text-left p-2 hover:bg-red-50 rounded-lg flex items-center justify-between group"
                                            >
                                              <span className="text-xs font-bold text-primary italic">{u.name}</span>
                                              <Badge className="bg-red-100 text-red-600 border-none text-[7px] font-black uppercase">Banir</Badge>
                                            </button>
                                          ))}
                                        </div>
                                      )}

                                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                                        <p className="text-[8px] font-black uppercase text-primary/30 tracking-widest px-1">Banidos deste fórum</p>
                                        {bannedUsers.length === 0 ? (
                                          <p className="text-[10px] italic text-muted-foreground p-3 text-center border-2 border-dashed rounded-xl opacity-40">Nenhum banimento específico.</p>
                                        ) : (
                                          bannedUsers.map(b => (
                                            <div key={b.id} className="flex items-center justify-between p-2.5 bg-red-50 rounded-xl border border-red-100 group">
                                              <div>
                                                <p className="text-xs font-black text-red-800 italic leading-none">{b.profiles?.name}</p>
                                                <p className="text-[7px] font-bold text-red-600 uppercase mt-0.5">{b.profiles?.profile_type}</p>
                                              </div>
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-white rounded-lg" onClick={() => liftBan(b.id)}>
                                                <Unlock className="h-3 w-3" />
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
                              <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-red-400 hover:text-red-600 hover:bg-red-50">
                                {deletingId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl p-10 max-w-sm">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-2xl font-black italic text-primary">Banir Tópico?</AlertDialogTitle>
                                <AlertDialogDescription className="font-medium text-sm">
                                  Esta ação removerá o debate <strong className="text-red-600">"{f.name}"</strong> e todas as mensagens vinculadas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-3 mt-6">
                                <AlertDialogCancel className="rounded-xl font-bold border-none bg-muted/30">Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteForum(f.id, f.name)} 
                                  className="rounded-xl font-black bg-red-600 hover:bg-red-700 text-white px-8"
                                >
                                  Remover Agora
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-64 text-center py-20">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                        <p className="font-black italic text-xl text-primary/40 uppercase tracking-widest">Nenhuma discussão localizada</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
