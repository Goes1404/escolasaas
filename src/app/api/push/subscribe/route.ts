import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { endpoint, keys, userAgent } = await req.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Subscription inválida." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Upsert por endpoint (caso o aluno reinstale o app, atualiza o user_id)
    const { error } = await adminClient
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: userAgent || null,
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      log.error('push.subscribe.db_error', error, { userId: user.id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    log.info('push.subscribe.ok', { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    log.error('push.subscribe.unhandled', err);
    return NextResponse.json({ error: err.message || "Erro interno." }, { status: 500 });
  }
}
