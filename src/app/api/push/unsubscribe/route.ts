import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "endpoint requerido" }, { status: 400 });

    const cookieStore = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { error } = await sb
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", user.id);

    if (error) {
      log.error('push.unsubscribe.db_error', error, { userId: user.id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    log.info('push.unsubscribe.ok', { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    log.error('push.unsubscribe.unhandled', err);
    return NextResponse.json({ error: err.message || "Erro interno." }, { status: 500 });
  }
}
