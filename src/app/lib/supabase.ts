import { createBrowserClient } from '@supabase/ssr'
import { log } from '@/lib/logger'

/**
 * 🔒 CONFIGURAÇÃO INDUSTRIAL SUPABASE - PLATAFORMA
 * Versão Estabilizada: Cliente usando @supabase/ssr para sincronia de cookies e middleware.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && 
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder')
)

// Ensure valid URL for prevent build-time crashes
const validUrl = supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`;

export const supabase = createBrowserClient(validUrl, supabaseAnonKey);

/**
 * Utilitário para execução de consultas.
 * Simplificado para evitar delays excessivos no login.
 */
export async function safeExecute<T = any>(fn: () => Promise<any>): Promise<{ data: T | null; error: any }> {
  try {
    const result = await fn();
    return result;
  } catch (error: any) {
    log.error('supabase.safe_execute.failed', error);
    return { data: null, error };
  }
}
