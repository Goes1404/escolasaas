"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, User, Users, MapPin, ShieldCheck, GraduationCap, MessagesSquare, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { AuroraAvatar } from "@/components/AuroraAvatar";

export default function ChatListPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [contacts, setContacts] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const [latestMessages, setLatestMessages] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const isStaffUser = ['teacher', 'staff', 'admin'].includes(profile?.profile_type?.toLowerCase() || '');
  
  const categories = [
    "Todos",
    ...(isStaffUser 
      ? ["ETEC", "ENEM", "1º Ano", "2º Ano", "3º Ano", "Apoio"] 
      : ["Redação", "Matemática", "Linguagens", "Ciências da Natureza", "Ciências Humanas", "Apoio Pedagógico"]
    )
  ];

  const fetchUnreadCounts = useCallback(async () => {
    if (!user) return;
    try {
      const { data: unreadData, error: unreadError } = await supabase
        .from('direct_messages')
        .select('sender_id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (unreadError) throw unreadError;

      const unreadCounts: Record<string, number> = {};
      if (unreadData) {
        unreadData.forEach((m: any) => {
          unreadCounts[m.sender_id] = (unreadCounts[m.sender_id] || 0) + 1;
        });
      }
      setUnreadMessages(unreadCounts);
    } catch (e) {
      console.error("Erro ao buscar mensagens não lidas:", e);
    }
  }, [user]);

  const fetchLatestMessages = useCallback(async () => {
    if (!user) return;
    try {
      const { data: lastMsgs, error: lastMsgsError } = await supabase
        .from('direct_messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (lastMsgsError) throw lastMsgsError;

      const latestMsgMap: Record<string, any> = {};
      if (lastMsgs) {
        lastMsgs.forEach((msg: any) => {
          const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
          if (!latestMsgMap[partnerId]) {
            latestMsgMap[partnerId] = msg;
          }
        });
      }
      setLatestMessages(latestMsgMap);
    } catch (e) {
      console.error("Erro ao buscar últimas mensagens:", e);
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    if (authLoading) return;
    if (!user || !profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    try {
      const userType = (profile.profile_type || 'student').toLowerCase();
      const userInstitution = (profile.institution || '').toLowerCase().trim();

      // 1. Buscar histórico de chat com qualquer pessoa para permitir responder mensagens recebidas
      const { data: chatHistory, error: historyError } = await supabase
        .from('direct_messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      const historyIds = new Set<string>();
      if (!historyError && chatHistory) {
        chatHistory.forEach((msg: any) => {
          if (msg.sender_id !== user.id) historyIds.add(msg.sender_id);
          if (msg.receiver_id !== user.id) historyIds.add(msg.receiver_id);
        });
      }
      
      // 2. Query para buscar contatos (professores, secretaria ou quem tem histórico de chat)
      let query = supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id);

      if (['teacher', 'staff', 'admin'].includes(userType)) {
        // Equipe de gestão/docente vê todo mundo (alunos, professores, secretaria)
        query = query.or('role.eq.student,profile_type.eq.student,role.eq.teacher,profile_type.eq.teacher,role.eq.staff,profile_type.eq.staff,role.eq.admin,profile_type.eq.admin');
      } else {
        // Aluno vê mentores, secretaria E qualquer pessoa com quem tenha histórico de chat
        if (historyIds.size > 0) {
          const idsList = Array.from(historyIds).join(',');
          query = query.or(`id.in.(${idsList}),profile_type.eq.teacher,profile_type.eq.staff`);
        } else {
          query = query.or('profile_type.eq.teacher,profile_type.eq.staff');
        }
      }

      const { data, error } = await query.order('name', { ascending: true });
      
      if (error) throw error;

      // LÓGICA DE SEGMENTAÇÃO POR POLO (INDUSTRIAL)
      // Alunos veem apenas mentores do seu polo ou mentores "Gerais" ou com quem tem histórico
      const filteredByPolo = data?.filter(mentor => {
        // Se tiver histórico de chat anterior com a pessoa, ela sempre aparece
        if (historyIds.has(mentor.id)) return true;

        // Secretaria e Admins globais sempre aparecem para todos os alunos
        if (mentor.profile_type === 'staff' || mentor.profile_type === 'admin') return true;

        // Admin, Professor e Secretaria veem todo mundo
        if (['admin', 'teacher', 'staff'].includes(userType)) return true;
        
        const mentorInstitution = (mentor.institution || '').toLowerCase();
        
        // Se o aluno não tem polo definido, vê mentores "Geral" ou sem polo
        if (!userInstitution) {
          return !mentorInstitution || mentorInstitution.includes('geral');
        }

        // Se o aluno tem polo, vê mentores do mesmo polo ou "Geral"
        return mentorInstitution.includes(userInstitution) || mentorInstitution.includes('geral') || !mentorInstitution;
      }) || [];

      setContacts(filteredByPolo);
    } catch (err: any) {
      console.error("Erro ao carregar rede de mentoria:", err);
    } finally {
      setLoading(false);
    }
  }, [user, profile, authLoading]);

  useEffect(() => {
    if (!authLoading && user && profile) {
      fetchData();
      fetchUnreadCounts();
      fetchLatestMessages();

      // Realtime para atualizações nas mensagens direcionadas a mim (atualiza não lidas e últimas mensagens)
      const channel = supabase
        .channel('chat_list_unread_realtime')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'direct_messages',
          filter: `receiver_id=eq.${user.id}`
        }, () => {
          fetchData();
          fetchUnreadCounts();
          fetchLatestMessages();
        })
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'direct_messages',
          filter: `sender_id=eq.${user.id}`
        }, () => {
          fetchLatestMessages();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, profile, authLoading, fetchData, fetchUnreadCounts, fetchLatestMessages]);

  const filteredContacts = contacts.filter((c) => {
    const term = searchTerm.toLowerCase();
    const searchString = `${c.name || ''} ${c.username || ''} ${c.institution || ''} ${c.course || ''} ${c.sala || ''} ${c.exam_target || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(term);
      
    if (activeCategory === "Todos") return matchesSearch;

    if (isStaffUser) {
      // Filtros da equipe: ETEC, ENEM ou ano (procura no curso, polo, etc)
      return matchesSearch && searchString.includes(activeCategory.toLowerCase());
    }

    const mentorCourse = c.course || "Apoio Pedagógico";
    const matchesCategory = mentorCourse.includes(activeCategory);
    
    return matchesSearch && matchesCategory;
  });

  // ORDENAÇÃO INTELIGENTE: Mensagens Não Lidas no topo -> Conversas Recentes -> Alfabeto
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const unreadA = unreadMessages[a.id] || 0;
    const unreadB = unreadMessages[b.id] || 0;
    if (unreadA !== unreadB) {
      return unreadB - unreadA; // Não lidas primeiro
    }

    const dateA = latestMessages[a.id]?.created_at || '';
    const dateB = latestMessages[b.id]?.created_at || '';
    if (dateA || dateB) {
      return dateB.localeCompare(dateA); // Mensagem mais recente primeiro
    }

    return (a.name || '').localeCompare(b.name || '');
  });

  // Separar conversas ativas (mensagens não lidas ou histórico) dos contatos disponíveis (estilo WhatsApp)
  const activeChats = sortedContacts.filter(
    (c) => (unreadMessages[c.id] || 0) > 0 || latestMessages[c.id]
  );
  const directoryContacts = sortedContacts.filter(
    (c) => !((unreadMessages[c.id] || 0) > 0) && !latestMessages[c.id]
  );

  const renderContactCard = (contact: any) => {
    const unreadCount = unreadMessages[contact.id] || 0;
    const hasUnread = unreadCount > 0;
    const lastMsg = latestMessages[contact.id];

    return (
      <Card 
        key={contact.id} 
        className={`gradient-border relative overflow-hidden flex flex-col shadow-xl rounded-card bg-white transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 border border-transparent ${
          hasUnread ? 'glow-orange-strong bg-gradient-to-br from-orange-500/5 via-white to-white' : ''
        }`}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
        <CardContent className="p-8 flex flex-col items-center text-center space-y-5 flex-grow">
          <div className="relative">
            <Avatar className={`h-20 w-20 md:h-24 md:w-24 border-[4px] shadow-2xl transition-all ${
              hasUnread ? 'border-orange-500 animate-pulse-subtle' : 'border-primary/5'
            }`}>
              <AvatarImage src={`https://picsum.photos/seed/${contact.id}/200/200`} className="object-cover" />
              <AvatarFallback className="bg-primary text-white font-black text-2xl italic">{contact.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            
            {hasUnread ? (
              <div className="absolute -top-1 -right-1 h-7 w-7 bg-red-500 text-white rounded-full flex items-center justify-center font-black text-xs shadow-lg animate-bounce border-2 border-white">
                {unreadCount}
              </div>
            ) : (
              <div className="absolute bottom-0 right-0 h-5 w-5 bg-green-500 rounded-full border-4 border-white shadow-xl ring-1 ring-black/5 animate-pulse" />
            )}
          </div>
          
          <div className="space-y-2 w-full flex-grow">
            <CardTitle className="text-lg md:text-xl font-black text-primary leading-tight truncate px-2 italic">{contact.name}</CardTitle>
            <div className="flex flex-col gap-2 items-center">
              <div className="flex flex-col items-center justify-center gap-1.5 text-accent font-black text-[9px] uppercase tracking-widest mt-1">
                <div className="flex items-center gap-1 opacity-80">
                  <MapPin className="h-3 w-3" />
                  <span>{contact.institution || "Rede Geral"}</span>
                </div>
                <Badge variant="outline" className="bg-primary/5 border-none text-primary/40 font-black text-[8px] px-3 h-5 uppercase tracking-widest leading-none flex items-center justify-center mt-1">
                  <GraduationCap className="h-2.5 w-2.5 mr-1 text-accent" />
                  {contact.profile_type === 'teacher' ? (contact.course || 'DOCENTE') : (contact.profile_type === 'staff' ? 'SECRETARIA' : (contact.exam_target || 'ENEM'))}
                </Badge>
              </div>
            </div>

            {/* Exibe trecho da última mensagem */}
            {lastMsg && (
              <div className="pt-2 mt-2 border-t border-slate-100 w-full">
                <p className="text-[11px] text-slate-500 line-clamp-1 italic font-medium">
                  {lastMsg.sender_id === user?.id ? "Você: " : ""}
                  {lastMsg.content}
                </p>
              </div>
            )}
          </div>
          
          <Button className="w-full btn-shimmer bg-primary text-white hover:bg-primary/95 font-black h-12 rounded-xl shadow-xl transition-all active:scale-95 border-none text-xs uppercase tracking-wider" asChild>
            <Link href={`/dashboard/chat/${contact.id}`}>
              {isStaffUser ? "Enviar Mensagem" : "Abrir Mentoria"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1 md:px-0.5">
      
      {/* ── BANNER CABEÇALHO (21st.dev/Stitch style) ── */}
      <section className="relative rounded-card overflow-hidden bg-slate-900 min-h-[160px] md:min-h-[220px] flex items-end p-6 md:p-8 shadow-2xl">
        {/* Glows de fundo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-30%] right-[-10%] w-[400px] h-[400px] bg-primary/25 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-30%] left-[-5%] w-[300px] h-[300px] bg-accent/15 rounded-full blur-[80px]" />
        </div>
        <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 w-full">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 px-3 py-1 rounded-full">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Rede de Diálogo</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tighter italic">
              {isStaffUser ? "Gestão de Conversas" : "Mentoria Especializada"}
            </h1>
            <p className="text-sm text-white/55 font-medium max-w-lg leading-relaxed">
              {isStaffUser 
                ? "Atendimento direto e suporte aos estudantes cadastrados na plataforma." 
                : "Conecte-se com professores de referência e sane suas dúvidas pedagógicas em tempo real."
              }
            </p>
          </div>
          
          <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 min-w-[155px]">
            <p className="text-[9px] text-white/65 font-bold uppercase tracking-widest leading-none">Contatos Ativos</p>
            <p className="font-black text-white text-2xl leading-none mt-1">{filteredContacts.length}</p>
            {Object.keys(unreadMessages).length > 0 && (
              <span className="text-[9px] bg-red-500 text-white font-black px-2.5 py-0.5 rounded-full animate-pulse mt-2">
                {Object.values(unreadMessages).reduce((a, b) => a + b, 0)} não lidas
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── BARRA DE PESQUISA (Glassmorphism) ── */}
      <div className="relative max-w-xl group w-full pt-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-accent z-10" />
        <Input 
          placeholder={isStaffUser ? "Buscar aluno por nome, polo, escola ou curso..." : "Buscar mentor por nome ou matéria..."} 
          className="pl-12 h-14 bg-white border-none shadow-md rounded-2xl text-base font-medium italic focus-visible:ring-accent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ── CATEGORIAS (TABS FILTROS) ── */}
      <div className="w-full flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant="ghost"
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-6 h-12 font-black text-[9px] uppercase tracking-widest whitespace-nowrap shadow-sm border snap-center transition-all flex-shrink-0 ${
              activeCategory === cat 
                ? 'bg-accent border-accent text-accent-foreground shadow-accent/20' 
                : 'bg-white border-muted/20 text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5'
            }`}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* ── CANAIS DE CONTATO RÁPIDO PARA ALUNOS ── */}
      {!isStaffUser && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: "Docente", desc: "Fale diretamente com seu professor de referência.", icon: GraduationCap, color: "bg-blue-50 border-blue-100 text-blue-700" },
            { title: "Bolsas", desc: "Tire dúvidas sobre processos e requisitos de bolsas.", icon: ShieldCheck, color: "bg-amber-50 border-amber-100 text-amber-700" },
            { title: "Apoio Psicopedagógico", desc: "Suporte emocional e pedagógico especializado.", icon: User, color: "bg-green-50 border-green-100 text-green-700" },
          ].map((canal) => (
            <div key={canal.title} className={`flex items-start gap-4 p-5 rounded-2xl border ${canal.color} shadow-sm transition-all hover:scale-102`}>
              <div className="h-10 w-10 rounded-xl bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
                <canal.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black text-sm uppercase tracking-tight">{canal.title}</p>
                <p className="text-xs font-medium opacity-70 mt-0.5 leading-relaxed">{canal.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── AURORA IA (fixa, sempre disponível, não vem da tabela profiles) ── */}
      {!isStaffUser && (
        <Card className="relative overflow-hidden border-none shadow-2xl rounded-card bg-gradient-to-br from-primary via-primary to-slate-900">
          <div className="absolute top-0 right-0 w-40 h-40 bg-accent/20 rounded-full blur-[80px] pointer-events-none" />
          <CardContent className="p-6 md:p-8 flex flex-col sm:flex-row items-center gap-5 relative z-10">
            {/* O rosto do próprio bichinho do aluno, quando ele tem um — a
                mentoria de IA e a criatura que ele alimenta estudando são
                as duas faces do mesmo incentivo. */}
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center shrink-0 shadow-xl overflow-hidden p-1.5">
              <AuroraAvatar className="h-full w-full" />
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <CardTitle className="text-lg md:text-xl font-black text-white italic leading-none">Aurora IA</CardTitle>
                <Badge className="bg-white/15 text-white border-none font-black text-[8px] uppercase px-2">24/7</Badge>
              </div>
              <p className="text-white/65 text-xs font-medium mt-1.5 leading-relaxed max-w-md">
                Sua mentora de inteligência artificial. Tire dúvidas pedagógicas a qualquer hora.
              </p>
            </div>
            <Button className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90 font-black h-12 px-8 rounded-xl shadow-xl active:scale-95 transition-all shrink-0" asChild>
              <Link href="/dashboard/chat/aurora-ai">Abrir Mentoria</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── SEÇÕES DE CONTATOS ESTILO WHATSAPP ── */}
      <div className="space-y-12 pt-2">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center relative">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40 animate-pulse">Sintonizando Rede de Mentores...</p>
          </div>
        ) : (
          <>
            {/* 1. SEÇÃO DE CONVERSAS ATIVAS */}
            {activeChats.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <MessagesSquare className="h-6 w-6 text-accent" />
                  <h2 className="text-xl md:text-2xl font-black text-primary italic uppercase tracking-tight">Conversas Recentes</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {activeChats.map(renderContactCard)}
                </div>
              </div>
            )}

            {/* 2. SEÇÃO DE DIRETÓRIO / NOVOS CONTATOS */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-primary/30" />
                <h2 className="text-xl md:text-2xl font-black text-primary/40 italic uppercase tracking-tight">
                  {isStaffUser ? "Iniciar Nova Conversa com Alunos" : "Disponíveis para Contato"}
                </h2>
              </div>
              
              {directoryContacts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {directoryContacts.map(renderContactCard)}
                </div>
              ) : (
                <div className="py-12 text-center border border-dashed rounded-card bg-white opacity-40">
                  <p className="text-sm font-medium italic">Nenhum outro contato disponível.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}