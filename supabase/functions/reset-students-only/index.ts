import { createClient } from "npm:@supabase/supabase-js@2";

type ResetStudentsOnlyRequest = {
  emails: string[];
  profileType?: string; // default: "student"
  password?: string; // default: "compromisso2026"
};

// GUARD: roda com SERVICE ROLE e é destrutiva (apaga perfis do tipo escolhido
// e reseta senhas). Antes só gateada por verify_jwt. Agora exige admin.
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeEmails(emails: unknown): string[] {
  if (!Array.isArray(emails)) return [];
  return emails
    .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
    .filter(Boolean);
}

async function deleteAuthUsersByEmails(supabase: any, emails: string[]) {
  const deleted: string[] = [];
  const notFound: string[] = [];

  const chunkSize = 20;
  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize);

    for (const email of chunk) {
      const { data, error } = await supabase.auth.admin.listUsers({
        search: email,
        page: 1,
        perPage: 5,
      });

      if (error) throw error;

      const match =
        data?.users?.find((u: any) => (u.email ?? "").toLowerCase() === email) ?? null;

      if (!match) {
        notFound.push(email);
        continue;
      }

      await supabase.auth.admin.deleteUser(match.id);
      deleted.push(email);
    }
  }

  return { deleted, notFound };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const denied = await requireAdmin(req, supabase);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as
    | ResetStudentsOnlyRequest
    | null;

  const emails = normalizeEmails(body?.emails);
  if (!emails.length) {
    return json({ error: "Missing or empty emails" }, 400);
  }

  const profileType = body?.profileType ?? "student";
  const password = body?.password ?? "compromisso2026";

  // 1) Remove profiles only for students
  const { error: profilesErr } = await supabase
    .from("profiles")
    .delete()
    .eq("profile_type", profileType);

  if (profilesErr) {
    return json({
      error: "Failed deleting student profiles",
      details: String(profilesErr),
    }, 500);
  }

  // 2) Remove Auth users only for emails passed (admins/professors remain)
  let authDelete: { deleted: string[]; notFound: string[] };
  try {
    authDelete = await deleteAuthUsersByEmails(supabase, emails);
  } catch (e) {
    return json({
      error: "Failed deleting auth users",
      details: e instanceof Error ? e.message : String(e),
    }, 500);
  }

  // 3) Recreate users + profiles
  const results: { email: string; ok: boolean; userId?: string; error?: string }[] = [];
  const chunkSize = 25;

  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize);

    for (const email of chunk) {
      try {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (createErr) throw createErr;

        const userId = created?.id;
        if (!userId) throw new Error("User created but no id returned");

        const { error: profileErr } = await supabase.from("profiles").upsert(
          { id: userId, profile_type: profileType },
          { onConflict: "id" },
        );

        if (profileErr) throw profileErr;

        results.push({ email, ok: true, userId });
      } catch (e) {
        results.push({
          email,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return json({
    ok: true,
    deletedAuth: authDelete.deleted.length,
    notFoundAuth: authDelete.notFound.length,
    results,
  });
});
