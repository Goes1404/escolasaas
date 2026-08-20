import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

export async function getAuthUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

async function getProfileRole(userId: string): Promise<string | null> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return data?.role ?? null;
}

/** Requer admin ou staff. */
export async function requireAdminUser(): Promise<User | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const role = await getProfileRole(user.id);
  if (!role || !['admin', 'staff'].includes(role)) return null;
  return user;
}

/** Requer professor, admin ou staff. */
export async function requireTeacherOrAdmin(): Promise<User | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const role = await getProfileRole(user.id);
  if (!role || !['teacher', 'admin', 'staff'].includes(role)) return null;
  return user;
}
