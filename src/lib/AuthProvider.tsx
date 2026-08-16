
'use client';

import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

/**
 * 🔒 PROVEDOR DE IDENTIDADE INDUSTRIAL - PLATAFORMA
 * Versão Estabilizada: Elimina travamentos de sincronização e melhora a resiliência do perfil.
 */

type UserRole = 'admin' | 'teacher' | 'student' | 'staff';

type Profile = {
  id: string;
  name: string;
  email: string;
  profile_type: string;
  status?: string;
  institution?: string;
  [key: string]: any;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  userRole: 'student',
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const authInitialized = useRef(false);
  // id do usuário cujo perfil já está carregado — evita refetch redundante
  // quando onAuthStateChange dispara INITIAL_SESSION/TOKEN_REFRESHED
  const profileUserIdRef = useRef<string | null>(null);
  const router = useRouter();

  const userRole = useMemo((): UserRole => {
    // PRIORIDADE 1: campo `role` explícito no perfil — fonte mais confiável
    if (profile?.role) {
      const r = profile.role.toLowerCase().trim();
      if (r === 'admin' || r === 'staff' || r === 'teacher' || r === 'student') return r as UserRole;
      if (['gestor', 'coordenador', 'coordenação', 'coordenacao', 'administrador'].includes(r)) return 'admin';
      if (['tecnico', 'técnico', 'assistente', 'suporte', 'secretaria'].includes(r)) return 'staff';
      if (['mentor', 'professor', 'docente'].includes(r)) return 'teacher';
    }

    // PRIORIDADE 2: campo `profile_type` — mapeamento explícito, sem inferência
    if (profile?.profile_type) {
      const pt = profile.profile_type.toLowerCase().trim();
      if (['admin', 'gestor', 'coordenador', 'coordenação', 'coordenacao', 'administrador'].includes(pt)) return 'admin';
      if (['staff', 'tecnico', 'técnico', 'equipe técnica', 'assistente', 'suporte', 'secretaria', 'agente de organização'].includes(pt)) return 'staff';
      if (['teacher', 'mentor', 'professor', 'docente'].includes(pt)) return 'teacher';
    }

    // PRIORIDADE 3: user_metadata.role — apenas valores explícitos, sem inferência por e-mail
    if (user?.user_metadata?.role) {
      const r = (user.user_metadata.role as string).toLowerCase().trim();
      if (r === 'admin' || r === 'staff' || r === 'teacher' || r === 'student') return r as UserRole;
    }

    // Padrão seguro: menor privilégio
    return 'student';
  }, [profile, user]);

  const fetchProfile = useCallback(async (userId: string, retries = 1, delayMs = 500) => {
    if (!isSupabaseConfigured || !userId) return null;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Consulta com tratamento de erro
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.warn(`[AUTH] Tentativa ${attempt + 1} falhou: ${error.message}`);
          if (attempt === retries - 1) return null;
        }

        if (data) {
          if (data.status === 'suspended') {
            router.replace('/suspended');
            return null;
          }
          profileUserIdRef.current = userId;
          return data as Profile;
        }
        
        // Se não encontrou o perfil e ainda há tentativas, espera antes de tentar de novo
        // Isso resolve o bug do "loading infinito" causado pelo delay do trigger no banco
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (err: any) {
        const errorMsg = err?.message || JSON.stringify(err);
        console.error(`[AUTH] Erro na tentativa ${attempt + 1}:`, errorMsg);
        if (attempt === retries - 1) return null;
      }
    }
    
    return null;
  }, [router]);

  const refreshProfile = async () => {
    if (user?.id) {
      const p = await fetchProfile(user.id, 1); // Sem retry no refresh manual
      if (p) setProfile(p);
    }
  };

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    setUser(null);
    setSession(null);
    setProfile(null);
    profileUserIdRef.current = null;
    // Segurança: limpa dados acadêmicos pessoais em cache (não devem sobreviver ao logout
    // em dispositivos compartilhados). Remove apenas as chaves de cache do dashboard.
    try {
      if (typeof window !== 'undefined') {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('dash_cache_'))
          .forEach((k) => localStorage.removeItem(k));
      }
    } catch (e) {}
    setLoading(false);
    window.location.assign("/login");
  }, []);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    async function initAuth() {
      if (authInitialized.current) return;
      authInitialized.current = true;

      try {
        const { data: { session: initialSession }, error: initialSessionError } = await supabase.auth.getSession();
        
        if (initialSessionError) {
          console.warn("[AUTH] Erro ao recuperar sessão inicial:", initialSessionError.message);
          if (initialSessionError.message.includes("Refresh Token") || 
              initialSessionError.message.includes("refresh_token") || 
              initialSessionError.status === 400) {
            // Limpa tokens salvos no localStorage para evitar tentativas recorrentes do SDK
            if (typeof window !== 'undefined') {
              Object.keys(localStorage).forEach(key => {
                if (key.includes('-auth-token') || key.includes('supabase')) {
                  localStorage.removeItem(key);
                }
              });
            }
            try {
              await supabase.auth.signOut();
            } catch (e) {}
            router.replace('/login');
          }
        }

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          // ⚡ NÃO esperamos o perfil para destravar o loading
          fetchProfile(initialSession.user.id).then(p => setProfile(p));
        }
      } catch (e: any) {
        console.error("[AUTH] Erro ao inicializar sessão:", e?.message || e);
      } finally {
        setLoading(false);
      }

      const { data } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        const currentUser = currentSession?.user ?? null;
        
        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setUser(null);
          setSession(null);
          profileUserIdRef.current = null;
          router.replace('/login');
          return;
        }

        setUser(currentUser);
        setSession(currentSession);

        if (!currentUser) {
          setProfile(null);
          profileUserIdRef.current = null;
          return;
        }

        // Busca o perfil apenas quando necessário: usuário trocou ou metadata
        // foi atualizada (ex.: first-access). INITIAL_SESSION e TOKEN_REFRESHED
        // do mesmo usuário reutilizam o perfil já carregado.
        const needsProfile =
          profileUserIdRef.current !== currentUser.id || event === 'USER_UPDATED';
        if (needsProfile) {
          const p = await fetchProfile(currentUser.id);
          setProfile(p);
        }
      });
      
      subscription = data.subscription;
    }

    initAuth();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [fetchProfile, router]);

  const contextValue = useMemo(() => ({
    user,
    session,
    profile,
    userRole,
    loading,
    signOut,
    refreshProfile,
  }), [user, session, profile, userRole, loading]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
