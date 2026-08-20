
"use client";

export const runtime = 'edge';

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ChevronLeft, 
  Send, 
  Loader2, 
  MessageSquare, 
  Info, 
  Lock, 
  ShieldAlert, 
  UserX, 
  Users, 
  Settings2,
  ExternalLink,
  Search,
  ArrowUpRight
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";

export default function ForumDetailPage() {
  const params = useParams();
  const forumId = params.id as string;
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [newPost, setNewPost] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [forum, setForum] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRestricted, setIsRestricted] = useState(false);
  const [isBanned, setIsBanned] = useState(false);

  // Estados para Gestão de Membros
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const isStaff = ['teacher', 'admin', 'staff'].includes(profile?.profile_type?.toLowerCase() || '');

  useEffect(() => {
    async function loadData() {
      if (!forumId || !user) return;
      setLoading(true);
      try {
        const { data: forumData } = await supabase.from('forums').select('*').eq('id', forumId).single();
        if (forumData) {
          setForum(forumData);
          
          if (forumData.is_teacher_only && !isStaff) {
            setIsRestricted(true);
          }
        }

        const { data: banData } = await supabase
          .from('forum_bans')
          .select('id')
          .eq('forum_id', forumId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (banData) setIsBanned(true);

        const { data: postsData } = await supabase
          .from('forum_posts')
          .select('*')
          .eq('forum_id', forumId)
          .order('created_at', { ascending: true });
        
        setPosts(postsData || []);
      } catch (err) {
        console.error("Erro ao carregar fórum:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    const channel = supabase
      .channel(`forum:${forumId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'forum_posts', 
        filter: `forum_id=eq.${forumId}` 
      }, (payload) => {
        setPosts(prev => {
          const exists = prev.some(p => p.id === payload.new.id);
          return exists ? prev : [...prev, payload.new];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [forumId, user, profile, isStaff]);

  const loadMembers = async () => {
    if (!forum || !isStaff) return;
    setLoadingMembers(true);
    try {
      let query = supabase.from('profiles').select('*');
      
      // Se for fórum de polo, filtra apenas alunos daquela instituição
      if (forum.category === "Polos") {
        const poloName = forum.name.replace('Comunidade: ', '');
        query = query.ilike('institution', `%${poloName}%`);
      }

      const { data } = await query.order('name');
      setMembers(data || []);
    } catch (err) {
      console.error("Erro ao buscar membros:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSendPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !user || isSubmitting || isRestricted || isBanned) return;

    setIsSubmitting(true);
    const content = newPost;
    
    const { data, error } = await supabase.from('forum_posts').insert({
      forum_id: forumId,
      author_id: user.id,
      author_name: profile?.name || user.email?.split('@')[0],
      content: content
    }).select().single();

    if (error) {
      console.error("Erro ao postar:", error);
      toast({ title: "Erro ao publicar", description: "Verifique a conexão.", variant: "destructive" });
    } else if (data) {
      setNewPost("");
      setPosts(prev => [...prev, data]);
    }
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      }
    }
  }, [posts]);

  const filteredMembers = members.filter(m => 
    m.name?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 animate-spin text-accent" />
        <p className="text-muted-foreground font-black uppercase text-[10px] tracking-widest animate-pulse">Sincronizando Debate...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 animate-in fade-in overflow-hidden">
       <div className="flex items-center justify-between p-3 md:p-4 bg-white shadow-sm border-b shrink-0 z-10">
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 shrink-0 hover:bg-primary/5">
            <ChevronLeft className="h-6 w-6 text-primary" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm md:text-lg font-black text-primary italic leading-none truncate">
              {forum?.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="bg-accent/10 text-accent border-none font-black text-[8px] uppercase px-2 h-4 tracking-widest">
                {forum?.category || "Geral"}
              </Badge>
              {forum?.is_teacher_only && (
                <Badge className="bg-red-50 text-red-600 border-none font-black text-[8px] uppercase px-2 h-4 tracking-widest flex items-center gap-1">
                  <Lock className="h-2 w-2" /> Somente Mentoria
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isStaff && (
            <Dialog open={isMembersOpen} onOpenChange={(open) => { setIsMembersOpen(open); if(open) loadMembers(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl border-dashed border-primary/20 text-primary font-black text-[10px] uppercase gap-2 hover:bg-primary/5 hidden md:flex shadow-sm">
                  <Users className="h-3.5 w-3.5" /> Gerenciar Membros
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[2.5rem] p-10 bg-white border-none shadow-2xl max-w-2xl">
                <DialogHeader>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-black italic text-primary leading-none">Membros do Fórum</DialogTitle>
                      <p className="text-xs text-muted-foreground italic mt-1.5">Alunos vinculados à instituição: {forum?.name?.replace('Comunidade: ', '')}</p>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-accent" />
                    <Input 
                      placeholder="Buscar aluno no polo..." 
                      className="h-12 rounded-xl bg-muted/30 border-none pl-11 font-bold italic"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                  </div>

                  <ScrollArea className="h-[400px] pr-4">
                    {loadingMembers ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" />
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sincronizando Rede...</p>
                      </div>
                    ) : filteredMembers.length === 0 ? (
                      <div className="py-20 text-center opacity-30 italic">
                        <p className="text-sm font-black uppercase">Nenhum aluno localizado</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredMembers.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center font-black italic shadow-md">{member.name?.charAt(0)}</div>
                              <div className="flex flex-col">
                                <span className="font-black text-primary text-sm italic">{member.name}</span>
                                <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">{member.profile_type}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-accent hover:bg-accent/10" asChild>
                                <Link href={`/dashboard/chat/${member.id}`}><Send className="h-4 w-4" /></Link>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-primary" asChild>
                                <Link href={`/dashboard/admin/users?search=${member.name}`}><ArrowUpRight className="h-4 w-4" /></Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Badge className="bg-green-100 text-green-700 border-none font-black text-[9px] px-3 py-1 uppercase tracking-tighter">Debate Ativo</Badge>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col relative">
        <ScrollArea className="flex-1" ref={scrollRef}>
           <div className="flex flex-col gap-6 py-8 px-4 md:px-12 max-w-5xl mx-auto w-full">
                <div className="bg-white p-6 rounded-3xl shadow-sm border-l-4 border-accent mb-4">
                  <p className="text-[10px] font-black uppercase text-primary/40 mb-2 flex items-center gap-2">
                    <Info className="h-3 w-3" /> Pauta Inicial do Debate
                  </p>
                  <p className="text-sm md:text-base font-medium italic text-primary/80 leading-relaxed">
                    "{forum?.description}"
                  </p>
                </div>

                {posts.length === 0 ? (
                  <div className="text-center py-20 opacity-30 flex flex-col items-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <MessageSquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-black italic uppercase text-xs">Seja o primeiro a contribuir com este tópico</p>
                  </div>
                ) : (
                  posts.map((post) => {
                    const isMe = post.author_id === user?.id;
                    return (
                        <div key={post.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                            <div className="flex items-center gap-2 mb-1 px-2">
                              <span className="text-[8px] font-black uppercase text-primary/40">{post.author_name}</span>
                              <span className="text-[7px] font-bold text-muted-foreground italic">
                                {format(new Date(post.created_at), "HH:mm")}
                              </span>
                            </div>
                            <div className={`px-5 py-3.5 rounded-[1.5rem] shadow-sm max-w-[90%] md:max-w-[75%] text-sm font-medium leading-relaxed ${
                              isMe 
                                ? 'bg-primary text-white rounded-tr-none' 
                                : 'bg-white text-primary rounded-tl-none border border-primary/5'
                            }`}>
                                {post.content}
                            </div>
                        </div>
                    );
                  })
                )}
           </div>
        </ScrollArea>
        
        <div className="p-4 md:p-6 bg-white border-t shrink-0">
          {isBanned ? (
            <div className="max-w-4xl mx-auto p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center gap-3">
              <UserX className="h-5 w-5 text-red-600" />
              <p className="text-sm font-black text-red-800 italic uppercase">Sua participação foi restrita neste debate pelo moderador.</p>
            </div>
          ) : isRestricted ? (
            <div className="max-w-4xl mx-auto p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <p className="text-sm font-black text-amber-800 italic uppercase">Este fórum está em modo 'Leitura'. Apenas mentores podem postar.</p>
            </div>
          ) : (
            <form onSubmit={handleSendPost} className="flex items-center gap-3 bg-slate-100 p-2 pl-6 rounded-full shadow-inner border max-w-4xl mx-auto focus-within:ring-2 focus-within:ring-accent/30 transition-all">
              <Input 
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Sua contribuição..."
                disabled={isSubmitting}
                className="flex-1 h-10 md:h-12 bg-transparent border-none text-primary text-sm font-medium italic focus-visible:ring-0 px-0"
              />
              <Button type="submit" disabled={!newPost.trim() || isSubmitting} className="h-10 w-10 md:h-12 md:w-12 bg-primary hover:bg-primary/95 text-white rounded-full shadow-xl shrink-0 transition-transform active:scale-90">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
