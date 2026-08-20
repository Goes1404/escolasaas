import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/lib/server-auth";

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export type ThreadSummary = {
  u1_id: string;
  u2_id: string;
  u1_name: string;
  u2_name: string;
  u1_type: string;
  u2_type: string;
  last_message: string;
  last_date: string;
};

export type ThreadDetail = {
  user1: { id: string; name: string; profile_type: string } | null;
  user2: { id: string; name: string; profile_type: string } | null;
  messages: Array<{ id: string; sender_id: string; receiver_id: string; content: string; created_at: string }>;
};

// GET /api/admin/chat-audit                → lista todas as conversas (threads)
// GET /api/admin/chat-audit?u1=X&u2=Y      → histórico completo entre dois usuários
export async function GET(req: NextRequest) {
  const caller = await requireAdminUser();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const supabase = serviceClient();
  const u1 = req.nextUrl.searchParams.get("u1");
  const u2 = req.nextUrl.searchParams.get("u2");

  if (u1 && u2) {
    const [{ data: user1 }, { data: user2 }, { data: messages, error }] = await Promise.all([
      supabase.from("profiles").select("id, name, profile_type").eq("id", u1).maybeSingle(),
      supabase.from("profiles").select("id, name, profile_type").eq("id", u2).maybeSingle(),
      supabase
        .from("direct_messages")
        .select("id, sender_id, receiver_id, content, created_at")
        .or(`and(sender_id.eq.${u1},receiver_id.eq.${u2}),and(sender_id.eq.${u2},receiver_id.eq.${u1})`)
        .order("created_at", { ascending: true }),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ user1: user1 ?? null, user2: user2 ?? null, messages: messages ?? [] } satisfies ThreadDetail);
  }

  // Teto defensivo: hoje ~700 mensagens no total, mas a query não tinha limite
  // algum — cada mensagem histórica do app inteiro seria reenviada a cada
  // carregamento da auditoria. 5000 (desc) garante a última mensagem de cada
  // thread mesmo com uso bem maior, sem herdar o histórico inteiro pra sempre.
  const { data: messages, error } = await supabase
    .from("direct_messages")
    .select("sender_id, receiver_id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!messages || messages.length === 0) {
    return NextResponse.json({ threads: [] as ThreadSummary[] });
  }

  const userIds = Array.from(new Set(messages.flatMap((m) => [m.sender_id, m.receiver_id])));
  const { data: profiles, error: pError } = await supabase
    .from("profiles")
    .select("id, name, profile_type")
    .in("id", userIds);

  if (pError) return NextResponse.json({ error: pError.message }, { status: 500 });

  const profileMap = new Map(profiles?.map((p) => [p.id, p]));
  const threadMap = new Map<string, ThreadSummary>();

  for (const msg of messages) {
    const ids = [msg.sender_id, msg.receiver_id].sort();
    const key = ids.join(":");
    if (threadMap.has(key)) continue;

    const u1p = profileMap.get(ids[0]);
    const u2p = profileMap.get(ids[1]);

    threadMap.set(key, {
      u1_id: ids[0],
      u2_id: ids[1],
      u1_name: u1p?.name || "Usuário Externo",
      u2_name: u2p?.name || "Usuário Externo",
      u1_type: u1p?.profile_type || "student",
      u2_type: u2p?.profile_type || "student",
      last_message: msg.content,
      last_date: msg.created_at,
    });
  }

  return NextResponse.json({ threads: Array.from(threadMap.values()) });
}

// DELETE /api/admin/chat-audit  { u1, u2 }  → apaga o histórico entre dois usuários
export async function DELETE(req: NextRequest) {
  const caller = await requireAdminUser();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { u1, u2 } = await req.json();
  if (!u1 || !u2) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });

  const supabase = serviceClient();
  const { error } = await supabase
    .from("direct_messages")
    .delete()
    .or(`and(sender_id.eq.${u1},receiver_id.eq.${u2}),and(sender_id.eq.${u2},receiver_id.eq.${u1})`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
