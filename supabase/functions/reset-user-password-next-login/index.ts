// Reseta senha de um usuário por email e marca para forçar reset no próximo login
// Uso: POST /reset-user-password-next-login
// body: { "email": "pauloaraujo@compromisso.com", "password": "..." }
//
// GUARD: roda com SERVICE ROLE e troca a senha de QUALQUER usuário. Antes só
// gateada por verify_jwt (qualquer sessão) — permitia takeover de conta admin.
// Agora exige que o chamador seja admin. Ver requireAdmin().

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireAdmin(req: Request, admin: any): Promise<Response | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return json({ error: "Unauthorized" }, 401);
  const { data: prof, error: pErr } = await admin
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (pErr) return json({ error: "Authorization check failed" }, 500);
  if (!prof || prof.role !== "admin") return json({ error: "Forbidden: admin only" }, 403);
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing Supabase env vars" }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    global: { headers: { "x-client-info": "reset-user-password-next-login" } },
  });

  const denied = await requireAdmin(req, supabaseAdmin);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : null;
  const password = typeof body.password === "string" ? body.password : null;

  if (!email || !password) {
    return json({ error: "Missing 'email' or 'password'" }, 400);
  }

  // Busca o usuário no Auth pelo email (via Admin API — a versão anterior
  // consultava uma tabela public.users que não existe no schema).
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    // @ts-ignore — search é suportado pela Admin API
    search: email,
    page: 1,
    perPage: 5,
  });
  if (listErr) return json({ error: listErr.message }, 500);

  const user = (list?.users ?? []).find(
    (u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  if (!user) return json({ error: "User not found" }, 404);

  const { error: updatedErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: {
      ...(user.user_metadata ?? {}),
      must_reset_password_next_login: true,
    },
  });

  if (updatedErr) return json({ error: updatedErr.message }, 500);

  return json({ ok: true, id: user.id, email: user.email });
});
