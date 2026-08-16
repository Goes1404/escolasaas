
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { log } from '@/lib/logger'

/**
 * 🔒 CLIENTE SUPABASE SERVER - PLATAFORMA
 * Atualizado para Next.js 15: cookies() agora é assíncrono.
 * Esta correção elimina o erro 500 em logins reais ao usar a IA.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set({ name, value, ...options })
            )
          } catch (error) {
            // Expected in React Server Components: cookies() is read-only there.
            // Supabase SSR docs explicitly recommend catching and ignoring this.
            // Log at debug so it appears only when LOG_LEVEL=debug.
            log.debug('supabase.cookies.set_skipped', { count: cookiesToSet.length });
          }
        },
      },
    }
  )
}
