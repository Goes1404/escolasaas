import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedTenant() {
  console.log('🌱 Criando novo tenant de testes...')

  const newTenant = {
    name: 'Escola Exemplo SaaS',
    slug: 'escola-exemplo',
    custom_domain: 'ead.escolaexemplo.com.br',
    branding: {
      appName: 'Escola Exemplo EAD',
      logoUrl: '/images/default-logo.png',
      primaryColor: '#2563EB',
      secondaryColor: '#1E40AF',
      contactEmail: 'contato@escolaexemplo.com.br',
    },
    features: {
      essays: true,
      simulations: true,
      forum: true,
      aiAurora: true,
      lives: true,
    },
    status: 'active',
  }

  const { data, error } = await supabase
    .from('tenants')
    .upsert(newTenant, { onConflict: 'slug' })
    .select()

  if (error) {
    console.error('❌ Erro ao criar tenant:', error.message)
    process.exit(1)
  }

  console.log('✅ Tenant criado/atualizado com sucesso:')
  console.log(data)
}

seedTenant()
