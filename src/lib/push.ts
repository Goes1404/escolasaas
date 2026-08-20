import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Configuração VAPID (somente server-side)
if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contato@compromissose.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  // Precisa bater com o CHECK de `notifications.type` — a inbox in-app recusa
  // qualquer outro valor, e sem a linha gravada o limite de 1 lembrete por dia
  // (que consulta essa tabela) deixaria de valer.
  type?: "chat" | "communication" | "material" | "document" | "attendance" | "info" | "ofensiva";
  icon?: string;
  image?: string;
  tag?: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Cliente admin para bypass de RLS ao enviar push em fan-out.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Envia uma notificação push (Web Push) para todos os dispositivos
 * inscritos de um conjunto de usuários. Também persiste em `notifications`
 * para a inbox in-app de cada destinatário.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return { sent: 0, failed: 0, persisted: 0 };

  const sb = adminClient();

  // 1) Persistir na inbox in-app
  const inboxRows = userIds.map(uid => ({
    user_id: uid,
    type: payload.type || "info",
    title: payload.title,
    body: payload.body || null,
    url: payload.url || null,
  }));
  const { error: notifErr } = await sb.from("notifications").insert(inboxRows);
  if (notifErr) console.error("[push] inbox insert error:", notifErr.message);

  // 2) Buscar subscriptions dos destinatários
  const { data: subs, error: subsErr } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id")
    .in("user_id", userIds);

  if (subsErr || !subs || subs.length === 0) {
    return { sent: 0, failed: 0, persisted: inboxRows.length };
  }

  const json = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  // 3) Disparar em paralelo
  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json
        );
        sent++;
      } catch (err: any) {
        failed++;
        // 404 / 410 = subscription expirada. 403 = o serviço de push (FCM,
        // Mozilla…) rejeitou as credenciais VAPID contra ESTA subscription —
        // sinal de que a chave pública mudou depois que o navegador se
        // inscreveu. Nos três casos o reenvio nunca vai funcionar: a
        // subscription ficaria reprovando para sempre, silenciosa, se só
        // logasse o erro. Por isso os três limpam do banco — é o que devolve
        // o aluno para o fluxo de "ativar notificações" na próxima visita, em
        // vez de um push que nunca chega e nunca é revisto.
        if (err.statusCode === 404 || err.statusCode === 410 || err.statusCode === 403) {
          expiredEndpoints.push(s.endpoint);
          if (err.statusCode === 403) {
            console.error("[push] subscription com VAPID incompatível, removida:", s.endpoint, err.body || err.message);
          }
        } else {
          console.error("[push] send error:", err.statusCode, err.body || err.message);
        }
      }
    })
  );

  // 4) Limpeza de subscriptions expiradas
  if (expiredEndpoints.length > 0) {
    await sb.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
  }

  return { sent, failed, persisted: inboxRows.length };
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  return sendPushToUsers([userId], payload);
}
