import { createClient } from '@supabase/supabase-js'
import { DEFAULT_TENANT, extractTenantSlug, TenantConfig } from '@/lib/tenant'

/**
 * Resolve o tenant a partir do host da requisição. Usado tanto pela rota
 * `api/tenant/config` (client-side fetch) quanto direto em Server Components
 * como `layout.tsx` (evita self-fetch da própria API do servidor).
 *
 * Sempre cai no `DEFAULT_TENANT` em erro — sem projeto Supabase novo
 * configurado ainda (ou sem a tabela `tenants` aplicada), a plataforma
 * continua funcionando com o branding padrão.
 */
export async function getTenantForHost(host: string | null): Promise<TenantConfig> {
  try {
    const slug = extractTenantSlug(host)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) return DEFAULT_TENANT

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (error || !tenant) return DEFAULT_TENANT

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      customDomain: tenant.custom_domain,
      branding: tenant.branding || DEFAULT_TENANT.branding,
      features: tenant.features || DEFAULT_TENANT.features,
      status: tenant.status,
    }
  } catch {
    return DEFAULT_TENANT
  }
}
