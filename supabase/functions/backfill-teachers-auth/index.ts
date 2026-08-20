// Supabase Edge Function: backfill teachers into auth + profiles, then link public.teachers.auth_user_id
//
// GUARD: roda com SERVICE ROLE, cria contas de auth e escreve role='teacher'
// em profiles (escalada de privilégio). Antes só gateada por verify_jwt.
// Agora exige que o chamador seja admin. Ver requireAdmin().

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

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
    return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const denied = await requireAdmin(req, supabaseAdmin);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const defaultPassword = body?.password ?? "compromisso2026";
  const dryRun = body?.dryRun === true;

  // Step 1: fetch teacher rows that are not linked
  const { data: teachers, error: teachersErr } = await supabaseAdmin
    .from("teachers")
    .select("id, email, name, subjects")
    .is("auth_user_id", null);

  if (teachersErr) {
    return json({ error: "Failed reading teachers", details: teachersErr.message }, 500);
  }

  if (!teachers || teachers.length === 0) {
    return json({ ok: true, message: "No teachers to backfill", count: 0 });
  }

  let createdUsers = 0;
  let createdProfiles = 0;
  let updatedTeachers = 0;
  let skipped = 0;
  const errors: Array<{ teacherId: string; email: string | null; message: string }> = [];

  for (const t of teachers) {
    if (!t.email) {
      skipped++;
      continue;
    }

    try {
      // Best-effort: check if a profile exists by email
      const { data: existingProfiles, error: profileLookupErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", t.email)
        .limit(1);

      if (profileLookupErr) throw profileLookupErr;

      if (existingProfiles && existingProfiles.length > 0) {
        const profileId = existingProfiles[0].id;
        if (!dryRun) {
          await supabaseAdmin.from("profiles").update({ role: "teacher" }).eq("id", profileId);
          await supabaseAdmin.from("teachers").update({ auth_user_id: profileId }).eq("id", t.id);
        }
        updatedTeachers++;
        continue;
      }

      if (dryRun) {
        createdUsers++;
        createdProfiles++;
        updatedTeachers++;
        continue;
      }

      // Create auth user
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: t.email,
        password: defaultPassword,
      });

      if (createErr) throw createErr;
      const newUserId = created.user?.id;
      if (!newUserId) throw new Error("User id not returned");

      createdUsers++;

      // Insert profile
      const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
        id: newUserId,
        role: "teacher",
        full_name: t.name,
        email: t.email,
        last_access: new Date().toISOString(),
        status: "active",
      });
      if (profileErr) throw profileErr;
      createdProfiles++;

      // Update teacher row
      const { error: teacherErr } = await supabaseAdmin.from("teachers").update({ auth_user_id: newUserId }).eq("id", t.id);
      if (teacherErr) throw teacherErr;
      updatedTeachers++;
    } catch (e) {
      const message = e && typeof e === "object" && "message" in e ? String((e as any).message) : String(e);
      errors.push({ teacherId: String(t.id), email: t.email ?? null, message });
    }
  }

  return json({
    ok: true,
    input: { passwordSet: defaultPassword ? true : false, dryRun },
    teacherRowsProcessed: teachers.length,
    createdUsers,
    createdProfiles,
    updatedTeachers,
    skipped,
    errors,
  });
});
