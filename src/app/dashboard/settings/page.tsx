"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  User, 
  Camera, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  Sparkles,
  Palette,
  Lock,
  Star,
  RefreshCw,
  School,
  GraduationCap,
  BookOpen,
  Users,
  Bell,
  BellRing,
  BellOff
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSupabaseConfigured } from "@/app/lib/supabase";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const PRESET_AVATARS = [
  "https://picsum.photos/seed/user1/400/400",
  "https://picsum.photos/seed/user2/400/400",
  "https://picsum.photos/seed/user3/400/400",
  "https://picsum.photos/seed/user4/400/400",
  "https://picsum.photos/seed/user5/400/400",
  "https://picsum.photos/seed/user6/400/400",
];

// Fallback local — garante que o Select nunca fique vazio mesmo sem banco
const FALLBACK_SUBJECTS = [
  "Matemática", "Física", "Química", "Biologia",
  "História", "Geografia", "Linguagens", "Literatura",
  "Filosofia", "Sociologia", "Atualidades",
].map((name, i) => ({ id: String(i + 1), name }));

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { permission, motivo: motivoPush, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // ✅ FIX 1: começa com fallback local — evita spinner infinito no primeiro render
  const [subjects, setSubjects] = useState<any[]>(FALLBACK_SUBJECTS);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    avatar_url: "",
    favorite_subject: ""
  });

  const [guardianToken, setGuardianToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    async function fetchGuardianToken() {
      const { data, error } = await supabase
        .from('guardian_tokens')
        .select('token')
        .eq('student_id', userId)
        .maybeSingle();
      if (!error && data) {
        setGuardianToken(data.token);
      }
    }
    fetchGuardianToken();
  }, [user]);

  const handleGenerateGuardianToken = async () => {
    const userId = user?.id;
    if (!userId || generatingToken) return;
    setGeneratingToken(true);
    try {
      const arr = new Uint8Array(32);
      window.crypto.getRandomValues(arr);
      const token = Array.from(arr, dec => dec.toString(16).padStart(2, '0')).join('');

      // Deleta tokens antigos se existirem para este aluno
      await supabase.from('guardian_tokens').delete().eq('student_id', userId);

      const { error } = await supabase
        .from('guardian_tokens')
        .insert({ student_id: userId, token });

      if (error) throw error;

      setGuardianToken(token);
      toast({
        title: "Link Gerado! 🔗",
        description: "Agora você pode compartilhar este link com seus responsáveis."
      });
    } catch (err: any) {
      toast({ title: "Erro ao gerar link", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyLink = () => {
    if (!guardianToken) return;
    const url = `${window.location.origin}/guardian/${guardianToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Copiado! 📋", description: "Link copiado para a área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    // ✅ FIX 2: se Supabase não está configurado, usa fallback local imediatamente
    if (!isSupabaseConfigured) {
      setSubjects(FALLBACK_SUBJECTS);
      return;
    }

    async function fetchSubjects() {
      setLoadingSubjects(true);
      try {
        // ✅ FIX 3: timeout de 5s — garante que o finally SEMPRE é atingido
        const timeout = new Promise<{ data: null; error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 5000)
        );
        const query = supabase
          .from('subjects')
          .select('id, name')
          .order('name');

        const { data, error } = await Promise.race([query, timeout]) as any;

        if (error) throw error;
        // Se o banco retornou lista válida, usa; senão mantém o fallback local
        setSubjects(data?.length > 0 ? data : FALLBACK_SUBJECTS);
      } catch (e) {
        console.warn("Matérias: usando lista local como fallback.", e);
        setSubjects(FALLBACK_SUBJECTS);
      } finally {
        setLoadingSubjects(false);
      }
    }

    fetchSubjects();
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        avatar_url: profile.avatar_url || "",
        favorite_subject: profile.favorite_subject || ""
      });
    }
  }, [profile]);

  const isNameDisabled = profile?.profile_type === 'student' || (profile?.name_changes_count ?? 0) >= 1;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isUpdating) return;

    setIsUpdating(true);
    try {
      const isNameChanged = formData.name !== profile?.name;
      
      const updateData: any = {
        avatar_url: formData.avatar_url,
        updated_at: new Date().toISOString()
      };

      // Só envia a matéria se ela não estiver vazia (evita erro de UUID vazio no banco)
      if (formData.favorite_subject && formData.favorite_subject.trim() !== "") {
        updateData.favorite_subject = formData.favorite_subject;
      }

      if (isNameChanged && !isNameDisabled) {
        updateData.name = formData.name;
        updateData.name_changes_count = (profile?.name_changes_count ?? 0) + 1;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Perfil Atualizado! ✅",
        description: "Suas preferências foram sincronizadas com a rede industrial."
      });
    } catch (err: any) {
      toast({ title: "Erro na Atualização", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      
      // ✅ Atualiza imediatamente no banco para o aluno ver que funcionou
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);
      
      setFormData(prev => ({ ...prev, avatar_url: data.publicUrl }));
      toast({ title: "Foto industrial atualizada! 📸", description: "Sua nova imagem já está ativa em toda a rede." });
    } catch (err: any) {
      toast({ title: "Falha no Upload", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) return null;

  const isStudent = profile?.profile_type === 'student';

  const nameParts = (profile?.name || "").trim().split(" ");
  const formattedDisplayName = nameParts.length > 1 
    ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}` 
    : nameParts[0] || "Usuário";

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20 px-2 md:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-primary italic leading-none">Configurações de Identidade</h1>
          <p className="text-muted-foreground font-medium italic">Gerencie sua presença digital e preferências acadêmicas.</p>
        </div>
        <Badge className="bg-accent text-accent-foreground font-black border-none px-5 py-2.5 flex items-center gap-2 w-fit rounded-xl shadow-xl">
          <ShieldCheck className="h-4 w-4" /> ACESSO VERIFICADO
        </Badge>
      </div>

      <div className={`grid grid-cols-1 ${isStudent ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-8`}>
        {/* Coluna Visual (Sempre Visível) */}
        <div className={`${isStudent ? 'max-w-2xl mx-auto w-full' : 'lg:col-span-4'} space-y-6`}>
          <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden text-center p-10 flex flex-col items-center">
            <div className="relative group mb-8">
              <div className="h-48 w-48 rounded-[3rem] overflow-hidden border-[8px] border-slate-50 shadow-2xl relative transition-transform duration-500 group-hover:scale-105">
                <Avatar className="h-full w-full rounded-none">
                  <AvatarImage src={formData.avatar_url || `https://picsum.photos/seed/${user.id}/400/400`} className="object-cover" />
                  <AvatarFallback className="bg-primary text-white text-6xl font-black italic">{formData.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-white" />
                  </div>
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading} 
                className="absolute -bottom-3 -right-3 h-14 w-14 bg-accent rounded-2xl border-4 border-white flex items-center justify-center text-accent-foreground shadow-2xl hover:scale-110 active:scale-95 transition-all z-10"
                title="Trocar Foto"
              >
                <Camera className="h-7 w-7" />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-3xl font-black text-accent italic leading-none truncate max-w-[340px] uppercase tracking-tighter">{formattedDisplayName}</h3>
                <div className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] flex flex-col items-center justify-center gap-1">
                  {isStudent && (
                    <>
                      <p className="opacity-80 text-primary">Turma {profile?.exam_target || 'ENEM'}</p> 
                      <p className="opacity-60">{profile?.institution || 'Colégio Colaço'}</p>
                    </>
                  )}
                  {!isStudent && (
                    <p className="opacity-80 text-primary">{profile?.course || 'Docente'}</p>
                  )}
                </div>
              </div>

              {isStudent && (
                 <div className="pt-4 space-y-6">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-2 flex items-center justify-center gap-3">
                    <Palette className="h-4 w-4" /> Sugestões de Avatar
                  </Label>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {PRESET_AVATARS.map((url, i) => (
                      <button 
                        key={i} 
                        type="button" 
                        onClick={() => setFormData({...formData, avatar_url: url})} 
                        className={`relative rounded-[1.2rem] overflow-hidden h-14 w-14 border-4 transition-all hover:scale-110 active:scale-95 shadow-xl ${formData.avatar_url === url ? 'border-accent scale-110 ring-4 ring-accent/5' : 'border-white opacity-60 hover:opacity-100'}`}
                      >
                        <Avatar className="w-full h-full rounded-none"><AvatarImage src={url} className="object-cover" /></Avatar>
                        {formData.avatar_url === url && (
                          <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-white drop-shadow-xl" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <Button onClick={handleUpdateProfile} disabled={isUpdating} className="w-full bg-primary text-white font-black h-12 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all mt-4 border-none">
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2 text-accent" />}
                    CONFIRMAR ALTERAÇÕES
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Coluna Formulário (Oculta para Alunos na versão original, agora mostramos campos lidos) */}
        <div className="lg:col-span-8 space-y-8">
            <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden">
              <CardHeader className="bg-muted/10 p-10 border-b border-dashed border-muted/20">
                <CardTitle className="text-2xl font-black text-primary italic uppercase tracking-tighter">Dados Cadastrais</CardTitle>
                <CardDescription className="font-medium italic text-lg mt-2">Alterações de nome são restritas por segurança de rede.</CardDescription>
              </CardHeader>
              <CardContent className="p-10">
                <form onSubmit={handleUpdateProfile} className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-2 flex items-center gap-3">
                        <User className="h-4 w-4" /> Nome de Exibição
                      </Label>
                      <div className="relative">
                        <Input 
                          value={formData.name} 
                          onChange={(e) => setFormData({...formData, name: e.target.value})} 
                          disabled={isNameDisabled} 
                          className={`h-16 rounded-2xl border-none font-bold text-xl italic ${isNameDisabled ? 'bg-muted/30 opacity-60' : 'bg-muted/40 shadow-inner focus:ring-accent'}`} 
                        />
                        {isNameDisabled && <Lock className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/20" />}
                      </div>
                    </div>

                    {isStudent && (
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-2 flex items-center gap-3">
                          <School className="h-4 w-4" /> Colégio / Unidade
                        </Label>
                        <div className="relative">
                          <Input 
                            value={profile?.institution || "Completar no perfil"}
                            disabled 
                            className="h-16 rounded-2xl border-none font-bold text-xl italic bg-muted/30 opacity-60" 
                          />
                          <Lock className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/20" />
                        </div>
                      </div>
                    )}

                    {isStudent && (
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-2 flex items-center gap-3">
                          <GraduationCap className="h-4 w-4" /> Objetivo Acadêmico
                        </Label>
                        <div className="relative">
                          <Input 
                            value={profile?.exam_target?.toUpperCase() || "ENEM"} 
                            disabled 
                            className="h-16 rounded-2xl border-none font-bold text-xl italic bg-muted/30 opacity-60" 
                          />
                          <Lock className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/20" />
                        </div>
                      </div>
                    )}

                    {!isStudent && (
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-2 flex items-center gap-3">
                          <BookOpen className="h-4 w-4" /> Matéria / Função
                        </Label>
                        <div className="relative">
                          <Input 
                            value={profile?.course || "Docente"} 
                            disabled 
                            className="h-16 rounded-2xl border-none font-bold text-xl italic bg-muted/30 opacity-60" 
                          />
                          <Lock className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/20" />
                        </div>
                      </div>
                    )}

                    {isStudent && (
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-2 flex items-center gap-3">
                          <Star className="h-4 w-4" /> Matéria de Foco
                        </Label>
                        <Select value={formData.favorite_subject} onValueChange={(v) => setFormData({...formData, favorite_subject: v})}>
                          <SelectTrigger className="h-16 rounded-2xl bg-muted/40 border-none font-bold text-xl italic shadow-inner">
                            {loadingSubjects ? (
                              <div className="flex items-center gap-3"><RefreshCw className="h-4 w-4 animate-spin" /> Sincronizando...</div>
                            ) : (
                              <SelectValue placeholder="Selecione sua preferência" />
                            )}
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none shadow-2xl max-h-80 p-2">
                            {subjects.map(s => <SelectItem key={s.id} value={s.name} className="font-bold py-4 rounded-xl italic">{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {!isStudent && (
                    <div className="space-y-6">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-2 flex items-center gap-3">
                        <Palette className="h-4 w-4" /> Galeria de Avatares Dinâmicos
                      </Label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-6">
                        {PRESET_AVATARS.map((url, i) => (
                          <button 
                            key={i} 
                            type="button" 
                            onClick={() => setFormData({...formData, avatar_url: url})} 
                            className={`relative rounded-card overflow-hidden aspect-square border-[6px] transition-all hover:scale-110 active:scale-90 shadow-xl ${formData.avatar_url === url ? 'border-accent scale-110 ring-8 ring-accent/5' : 'border-white opacity-60 hover:opacity-100'}`}
                          >
                            <Avatar className="w-full h-full rounded-none"><AvatarImage src={url} className="object-cover" /></Avatar>
                            {formData.avatar_url === url && (
                              <div className="absolute inset-0 bg-accent/20 flex items-center justify-center animate-in zoom-in duration-500">
                                <CheckCircle2 className="h-10 w-10 text-white drop-shadow-xl" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isStudent && (
                    <Button type="submit" disabled={isUpdating} className="w-full h-14 bg-primary text-white font-black text-sm md:text-base rounded-3xl shadow-[0_20px_50px_-10px_rgba(26,44,75,0.4)] hover:scale-[1.02] active:scale-95 transition-all mt-6 border-none px-4">
                      {isUpdating ? <Loader2 className="h-5 w-5 animate-spin mr-2 shrink-0" /> : <CheckCircle2 className="h-5 w-5 mr-2 shrink-0 text-accent" />}
                      <span className="truncate">SALVAR PREFERÊNCIAS</span>
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>

            {isStudent && (
              <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden mt-8">
                <CardHeader className="bg-muted/10 p-10 border-b border-dashed border-muted/20">
                  <CardTitle className="text-2xl font-black text-primary italic uppercase tracking-tighter flex items-center gap-3">
                    <Users className="h-6 w-6 text-accent" /> Acompanhamento dos Responsáveis
                  </CardTitle>
                  <CardDescription className="font-medium italic text-lg mt-2">
                    Gere um link exclusivo e seguro para que seus pais ou responsáveis acompanhem seu desempenho sem precisar de login.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-10 space-y-6">
                  {guardianToken ? (
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-2">
                        Seu Link de Acompanhamento
                      </Label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 bg-muted/40 p-4 rounded-2xl font-bold text-xs sm:text-sm text-slate-700 select-all truncate border border-slate-100 flex items-center">
                          {`${typeof window !== 'undefined' ? window.location.origin : ''}/guardian/${guardianToken}`}
                        </div>
                        <Button 
                          onClick={handleCopyLink}
                          className="h-14 px-6 rounded-2xl bg-accent text-accent-foreground font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all border-none"
                        >
                          {copied ? 'Copiado!' : 'Copiar Link'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground italic px-2">
                        ⚠️ Atenção: Quem tiver acesso a este link poderá ver suas estatísticas gerais de estudo (XP, Streak e quantidade de questões resolvidas). Você pode gerar um novo link a qualquer momento para invalidar o anterior.
                      </p>
                      <Button 
                        variant="ghost" 
                        onClick={handleGenerateGuardianToken}
                        disabled={generatingToken}
                        className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 font-bold underline p-0 h-auto"
                      >
                        {generatingToken ? 'Gerando novo link...' : 'Resetar / Gerar Novo Link'}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-4">
                      <p className="text-slate-600 font-semibold text-sm">
                        Nenhum link ativo gerado. Compartilhe seu progresso para ter mais apoio nos estudos!
                      </p>
                      <Button 
                        onClick={handleGenerateGuardianToken}
                        disabled={generatingToken}
                        className="bg-primary text-white font-black h-13 px-8 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all border-none"
                      >
                        {generatingToken ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        GERAR LINK DE ACOMPANHAMENTO
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ── Notificações Push ─────────────────────────────────────────── */}
        <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden">
          <CardHeader className="bg-muted/10 p-8 md:p-10 border-b border-dashed border-muted/20">
            <CardTitle className="text-2xl font-black text-primary italic uppercase tracking-tighter flex items-center gap-3">
              <BellRing className="h-6 w-6 text-accent" /> Notificações
            </CardTitle>
            <CardDescription className="font-medium italic text-base md:text-lg mt-2">
              Receba comunicados, mensagens e novos materiais direto no celular, como no WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 md:p-10">
            {motivoPush === "ios_precisa_instalar" ? (
              /* Das 68 inscricoes de push da base, UMA e de iPhone. Nao e
                 recusa: no iOS o Web Push so existe com o site instalado na
                 tela de inicio, e a mensagem generica de "navegador sem
                 suporte" nao dizia o que fazer a respeito. */
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-100">
                <BellOff className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-amber-800">Falta instalar na tela de início</p>
                  <p className="text-xs font-medium text-amber-700/80 mt-1 leading-relaxed">
                    No iPhone, as notificações só funcionam com o app aberto pelo ícone.
                  </p>
                  <ol className="text-xs font-medium text-amber-700/90 mt-2 space-y-1 list-decimal list-inside">
                    <li>Toque em <b>Compartilhar</b>, na barra do Safari.</li>
                    <li>Escolha <b>Adicionar à Tela de Início</b>.</li>
                    <li>Abra pelo <b>ícone novo</b> e volte aqui para ativar.</li>
                  </ol>
                </div>
              </div>
            ) : permission === "unsupported" ? (
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-muted/20">
                <BellOff className="h-6 w-6 text-muted-foreground shrink-0" />
                <p className="text-sm font-medium text-muted-foreground italic">
                  Este navegador não suporta notificações.
                </p>
              </div>
            ) : permission === "denied" ? (
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-red-50 border border-red-100">
                <BellOff className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-red-700">Notificações bloqueadas</p>
                  <p className="text-xs font-medium text-red-600/80 mt-1 leading-relaxed">
                    Você bloqueou as notificações. Para reativar, abra as configurações do navegador,
                    localize este site e permita notificações.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${subscribed ? 'bg-green-100' : 'bg-accent/10'}`}>
                    {subscribed ? <BellRing className="h-7 w-7 text-green-600" /> : <Bell className="h-7 w-7 text-accent" />}
                  </div>
                  <div>
                    <p className="text-base font-black text-primary italic flex items-center gap-2 flex-wrap">
                      {subscribed ? "Notificações ativadas" : "Notificações desativadas"}
                      <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 border-slate-200 bg-slate-50 text-slate-500">
                        Navegador: {permission}
                      </Badge>
                    </p>
                    <p className="text-xs font-medium text-muted-foreground mt-0.5">
                      {subscribed
                        ? "Você está recebendo avisos neste dispositivo."
                        : "Ative para não perder nenhum comunicado importante."}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={subscribed ? unsubscribe : subscribe}
                  disabled={pushLoading}
                  className={`h-12 px-8 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all shrink-0 ${
                    subscribed
                      ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                      : 'bg-accent text-accent-foreground hover:bg-accent/90'
                  }`}
                >
                  {pushLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : subscribed ? (
                    <BellOff className="h-4 w-4 mr-2" />
                  ) : (
                    <BellRing className="h-4 w-4 mr-2" />
                  )}
                  {subscribed ? "Desativar" : "Ativar notificações"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}