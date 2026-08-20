import { createClient } from "npm:@supabase/supabase-js@2";

// GUARD: esta função roda com a SERVICE ROLE e destrói dados (apaga todos os
// alunos). Antes só era gateada por verify_jwt (qualquer sessão passava, até
// de um aluno). Agora exige que o CHAMADOR seja admin. Ver requireAdmin().
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

async function fetchStudentEmails(supabase: any) {
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("profile_type", "student");

  if (error) throw error;

  return normalizeEmails(data?.map((r: any) => r.email) ?? []);
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

  // 1) Get student emails from profiles
  let studentEmails: string[];
  try {
    studentEmails = await fetchStudentEmails(supabase);
  } catch (e) {
    return json({
      error: "Failed fetching student emails from profiles",
      details: e instanceof Error ? e.message : String(e),
    }, 500);
  }

  // 2) Delete auth users for those emails
  let authDelete: { deleted: string[]; notFound: string[] };
  try {
    authDelete = await deleteAuthUsersByEmails(supabase, studentEmails);
  } catch (e) {
    return json({
      error: "Failed deleting auth users",
      details: e instanceof Error ? e.message : String(e),
    }, 500);
  }

  // 3) Delete profiles rows for students
  const { error: profilesErr } = await supabase
    .from("profiles")
    .delete()
    .eq("profile_type", "student");

  if (profilesErr) {
    return json({
      error: "Failed deleting student profiles",
      details: String(profilesErr),
    }, 500);
  }

  return json({
    ok: true,
    studentEmailsCount: studentEmails.length,
    deletedAuth: authDelete.deleted.length,
    notFoundAuth: authDelete.notFound.length,
  });
});
