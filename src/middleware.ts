import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { extractTenantSlug } from '@/lib/tenant'

export async function middleware(request: NextRequest) {
  // Propagate or generate a correlation ID so every log entry for the same
  // request can be joined in any log aggregator (Datadog, Axiom, etc.)
  const requestId =
    request.headers.get('x-request-id') ?? crypto.randomUUID();
  request.headers.set('x-request-id', requestId);

  // Extração e resolução do Tenant Slug
  const host = request.headers.get('host');
  const tenantSlug = request.headers.get('x-tenant-slug') || extractTenantSlug(host);
  request.headers.set('x-tenant-slug', tenantSlug);

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-tenant-slug', tenantSlug);

  // Evita carregar o supabase client em recursos estáticos para performance
  if (request.nextUrl.pathname.startsWith('/_next') || request.nextUrl.pathname.includes('.')) {
      return response;
  }

  // ── Curto-circuito sem sessão (corrige TTFB) ────────────────────────────
  // O Supabase SSR guarda o token em cookie `sb-<ref>-auth-token` (às vezes
  // fatiado em `.0`/`.1`). Se NENHUM cookie de auth existe, não há sessão a
  // validar — e `getUser()` faria mesmo assim uma chamada de rede à API do
  // Supabase (~3s no visitante frio, além das tentativas de refresh que
  // falham no log). Sem cookie: decide na hora, sem tocar a rede.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));

  if (!hasAuthCookie) {
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      return NextResponse.redirect(redirectUrl);
    }
    // /login (ou qualquer rota pública casada): serve direto, sem rede.
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set({ name, value, ...options }))
          response = NextResponse.next({
            request,
          })
          response.headers.set('x-request-id', requestId)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...options })
          )
        },
      },
    }
  )

  // IMPORTANTE: Usamos getUser() em vez de getSession() para garantir que metadados
  // (como must_change_password) estejam 100% atualizados e evitar loops.
  //
  // O try/catch não é defensivo à toa: em produção este ponto acumulou 20
  // ocorrências de `Invalid Refresh Token: Refresh Token Not Found` entre
  // 16/06 e 10/08, com 3 alunos afetados. Sem capturar, cada uma vira erro de
  // runtime na Vercel e a requisição morre no meio.
  let user = null;
  let sessaoInvalida = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    // `refresh_token_not_found` e afins: o cookie existe mas não vale mais.
    if (error && !user) sessaoInvalida = true;
  } catch {
    sessaoInvalida = true;
  }
  const session = user ? { user } : null;

  // Cookie de sessão morto precisa ser APAGADO, não apenas ignorado.
  //
  // Antes, o cookie inválido permanecia no navegador: a cada nova página o
  // curto-circuito acima via um cookie de auth, entrava aqui e refazia a
  // chamada de rede que já tinha falhado. O aluno pagava a latência dessa ida
  // e volta em toda navegação, e o log enchia. Limpando, a próxima requisição
  // resolve na hora, sem rede.
  if (sessaoInvalida) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/login';
    // A tela de login usa isto para explicar o que houve, em vez de deixar o
    // aluno achar que errou a senha.
    destino.searchParams.set('sessao', 'expirada');

    const limpa = request.nextUrl.pathname.startsWith('/dashboard')
      ? NextResponse.redirect(destino)
      : response;

    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith('sb-') && c.name.includes('auth-token')) {
        limpa.cookies.delete(c.name);
      }
    }
    limpa.headers.set('x-request-id', requestId);
    return limpa;
  }

  // Proteger rotas /dashboard originando flash of content
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }

    // ── Primeiro acesso ──────────────────────────────────────────────────
    //
    // Antes, QUALQUER acesso a `/dashboard/first-access` era mandado para a
    // home — sem condição nenhuma. A tela existia, funcionava (troca a senha
    // no passo 1, completa o perfil no passo 2), e era inalcançável.
    //
    // Duas consequências em produção: 366 alunos ficaram com
    // `must_change_password: true` para sempre, ainda usando a senha padrão; e
    // o link que a secretaria gera em `/api/admin/generate-link` aponta
    // justamente para `/dashboard/first-access` — o aluno clicava, era jogado
    // para a home e nunca trocava a senha.
    //
    // A condição correta é o metadado, não a rota. Assim não há o
    // redirect-loop que motivou o bloqueio original: quem precisa trocar entra
    // e fica; quem já trocou é mandado para fora.
    const precisaTrocarSenha = user?.user_metadata?.must_change_password === true;
    const estaNoPrimeiroAcesso = request.nextUrl.pathname === '/dashboard/first-access';

    if (precisaTrocarSenha && !estaNoPrimeiroAcesso) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard/first-access'
      return NextResponse.redirect(redirectUrl)
    }

    if (!precisaTrocarSenha && estaNoPrimeiroAcesso) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard/home'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Redirecionar usuários logados para fora do login
  if (request.nextUrl.pathname === '/login' && session) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard/home'
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
