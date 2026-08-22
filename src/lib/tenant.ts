export interface TenantBranding {
  appName: string
  logoUrl: string
  faviconUrl?: string
  primaryColor: string
  secondaryColor: string
  accentColor?: string
  contactEmail?: string
}

export interface TenantConfig {
  id: string
  name: string
  slug: string
  customDomain?: string | null
  branding: TenantBranding
  status: 'active' | 'inactive' | 'trial'
  features: {
    essays?: boolean
    simulations?: boolean
    forum?: boolean
    aiAurora?: boolean
    lives?: boolean
  }
}

export const DEFAULT_TENANT: TenantConfig = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Dalí',
  slug: 'default',
  branding: {
    appName: 'Dalí',
    logoUrl: '/logo-dali.svg',
    primaryColor: '#4CCCED',
    secondaryColor: '#ED3474',
    accentColor: '#EDE04C',
    contactEmail: 'suporte@escolasaas.com',
  },
  status: 'active',
  features: {
    essays: true,
    simulations: true,
    forum: true,
    aiAurora: true,
    lives: true,
  },
}

/**
 * Converte hex (#RRGGBB) pro triplet "H S% L%" que os design tokens em
 * globals.css esperam (usados como `hsl(var(--primary))` no tailwind.config).
 * Escrever hex direto na CSS var quebraria silenciosamente — `hsl(#ED3474)`
 * não é CSS válido.
 */
export function hexToHslTriplet(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const delta = max - min
    s = delta / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = 60 * (((g - b) / delta) % 6); break
      case g: h = 60 * ((b - r) / delta + 2); break
      case b: h = 60 * ((r - g) / delta + 4); break
    }
  }
  if (h < 0) h += 360

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/**
 * Deriva os design tokens (CSS vars de globals.css) a partir do branding do
 * tenant. `--secondary`/`--muted` seguem o mesmo matiz do primary, só que
 * bem claros — é o papel deles no design system (tom de fundo suave), não
 * uma segunda cor independente. Espelha a relação já definida em
 * globals.css pra paleta padrão.
 */
export function deriveBrandTokens(branding: TenantBranding): Record<string, string> {
  const [primaryH, primaryS] = hexToHslTriplet(branding.primaryColor).split(' ')
  const accentTriplet = hexToHslTriplet(branding.accentColor || branding.primaryColor)

  return {
    '--primary': hexToHslTriplet(branding.primaryColor),
    '--secondary': `${primaryH} ${primaryS} 95%`,
    '--muted': `${primaryH} ${primaryS} 95%`,
    '--accent': accentTriplet,
    '--ring': hexToHslTriplet(branding.primaryColor),
    '--brand-dark': `${primaryH} ${primaryS} 32%`,
    '--sidebar-primary': hexToHslTriplet(branding.primaryColor),
    '--sidebar-accent': `${primaryH} ${primaryS} 32%`,
    '--sidebar-ring': hexToHslTriplet(branding.primaryColor),
  }
}

/**
 * Extrai o slug do tenant a partir do hostname/header da requisição.
 * Exemplo: escolaA.saas.com -> "escolaA"
 * Exemplo: escolaA.localhost:3000 -> "escolaA"
 */
export function extractTenantSlug(host: string | null): string {
  if (!host) return DEFAULT_TENANT.slug

  // Remover porta se houver (ex: localhost:3000 -> localhost)
  const hostname = host.split(':')[0]

  // Se for IP, localhost direto ou domínios de desenvolvimento sem subdomínio
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.pages.dev')
  ) {
    return DEFAULT_TENANT.slug
  }

  const parts = hostname.split('.')
  // Subdomínio simples (ex: escola1.escolasaas.com -> "escola1")
  if (parts.length >= 3) {
    return parts[0]
  }

  return DEFAULT_TENANT.slug
}
