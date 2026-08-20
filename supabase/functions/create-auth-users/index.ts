import { createClient } from "npm:@supabase/supabase-js@2";

// GUARD: roda com SERVICE ROLE e cria contas de auth com senha temporária
// aleatória (forçando troca no primeiro login). Antes só gateada por
// verify_jwt. Agora exige que o chamador seja admin. Ver requireAdmin().
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
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const denied = await requireAdmin(req, supabase);
    if (denied) return denied;

    // fetch profiles updated in last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, email, raw_user_meta_data")
      .gt("updated_at", tenMinutesAgo);

    if (pErr) throw pErr;

    const results = [];

    for (const prof of profiles || []) {
      const email = prof.email;
      const raw = prof.raw_user_meta_data || {};
      const password = crypto.randomUUID() + crypto.randomUUID();

      // check if auth user exists
      const { data: existing, error: exErr } = await supabase.auth.admin.listUsers();
      if (exErr) throw exErr;
      const found = (existing?.users || []).find((u) => u.email === email);
      if (found) {
        results.push({ email, status: "exists" });
        continue;
      }

      // create user
      const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        user_metadata: { ...(raw || {}), must_reset_password_next_login: true },
      });

      if (error) {
        results.push({ email, status: "error", message: error.message });
      } else {
        results.push({ email, status: "created", id: data?.user?.id, temp_password: password });
      }
    }

    return json({ ok: true, results });
  } catch (err: any) {
    return json({ ok: false, error: err.message || String(err) }, 500);
  }
});
