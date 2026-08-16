import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendPushToUser, sendPushToUsers } from "@/lib/push";

type NotifyBody =
  | { type: "chat"; receiverId: string; content: string }
  | { type: "communication"; announcementId: string }
  | { type: "material"; materialId: string };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NotifyBody;

    // Autenticar o emissor
    const cookieStore = await cookies();
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Buscar nome do emissor para personalizar a notificação
    const { data: senderProfile } = await admin
      .from("profiles")
      .select("name, role")
      .eq("id", user.id)
      .maybeSingle();
    const senderName = senderProfile?.name || "Plataforma";

    // ── Caso 1: Mensagem direta no chat ──────────────────────
    if (body.type === "chat") {
      if (!body.receiverId) {
        return NextResponse.json({ error: "receiverId obrigatório" }, { status: 400 });
      }

      // A notificação é derivada da mensagem GRAVADA, não do texto enviado no
      // corpo. Antes, qualquer sessão autenticada podia disparar push com
      // conteúdo arbitrário para qualquer usuário — bastava informar o id do
      // destinatário. O nome do remetente ia junto, então dava para forjar uma
      // mensagem convincente de outra pessoa.
      //
      // Buscar a mensagem real resolve as duas coisas de uma vez: prova que a
      // conversa existe e garante que o texto notificado é o que foi de fato
      // enviado.
      const { data: mensagem } = await admin
        .from("direct_messages")
        .select("content, created_at")
        .eq("sender_id", user.id)
        .eq("receiver_id", body.receiverId)
        .gte("created_at", new Date(Date.now() - 120_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mensagem) {
        return NextResponse.json(
          { error: "Nenhuma mensagem recente para notificar." },
          { status: 409 },
        );
      }

      const texto = mensagem.content ?? "";
      const preview = texto.length > 140 ? texto.slice(0, 140) + "…" : texto;
      const result = await sendPushToUser(body.receiverId, {
        title: senderName,
        body: preview,
        type: "chat",
        url: `/dashboard/chat/${user.id}`,
        tag: `chat-${user.id}`,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    // ── Caso 2: Comunicado/Aviso ─────────────────────────────
    if (body.type === "communication") {
      const { data: ann } = await admin
        .from("announcements")
        .select("title, content, target_audience, priority")
        .eq("id", body.announcementId)
        .maybeSingle();
      if (!ann) return NextResponse.json({ error: "Comunicado não encontrado" }, { status: 404 });

      // Restringe envio a roles autorizadas
      if (!senderProfile || !["teacher", "admin", "staff"].includes(senderProfile.role)) {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      }

      // Audience: 'all' | 'enem' | 'etec' (best-effort por exam_target)
      // profile_type é texto livre (ex.: "etec", "Estudante ETEC") — usar role,
      // que é o enum confiável para identificar alunos.
      let q = admin.from("profiles").select("id").eq("role", "student");
      if (ann.target_audience === "enem" || ann.target_audience === "etec") {
        q = q.eq("exam_target", ann.target_audience.toUpperCase());
      }
      const { data: students } = await q;
      const userIds = (students || []).map((s: any) => s.id);

      const result = await sendPushToUsers(userIds, {
        title: ann.priority === "high" ? "⚠️ " + ann.title : ann.title,
        body: (ann.content || "").slice(0, 200),
        type: "communication",
        url: `/dashboard/home`,
        tag: `comunicado-${body.announcementId}`,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    // ── Caso 3: Material publicado ───────────────────────────
    if (body.type === "material") {
      const { data: mat } = await admin
        .from("class_materials")
        .select("title, subject, target_group, teacher_name")
        .eq("id", body.materialId)
        .maybeSingle();
      if (!mat) return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });

      if (!senderProfile || !["teacher", "admin", "staff"].includes(senderProfile.role)) {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      }

      let q = admin.from("profiles").select("id").eq("role", "student");
      if (mat.target_group === "enem" || mat.target_group === "etec") {
        q = q.eq("exam_target", mat.target_group.toUpperCase());
      }
      const { data: students } = await q;
      const userIds = (students || []).map((s: any) => s.id);

      const result = await sendPushToUsers(userIds, {
        title: `📚 Novo material: ${mat.title}`,
        body: `${mat.teacher_name || "Professor"}${mat.subject ? " — " + mat.subject : ""}`,
        type: "material",
        url: `/dashboard/student/materials`,
        tag: `material-${body.materialId}`,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Tipo de evento desconhecido" }, { status: 400 });
  } catch (err: any) {
    console.error("[push/notify]", err);
    return NextResponse.json({ error: err.message || "Erro interno." }, { status: 500 });
  }
}
