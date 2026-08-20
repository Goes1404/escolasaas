import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { code, confirmed } = await req.json();

    // Token de 4 a 6 caracteres alfanuméricos
    if (!code || typeof code !== "string" || code.trim().length < 4 || code.trim().length > 6) {
      return NextResponse.json({ error: "Código inválido." }, { status: 400 });
    }

    // Barreira anti-fraude: aluno precisa ter confirmado a leitura do aviso de fraude
    if (confirmed !== true) {
      return NextResponse.json(
        { error: "Confirmação obrigatória. Leia o aviso de fraude e digite CONFIRMO." },
        { status: 400 }
      );
    }

    const upperCode = code.trim().toUpperCase();
    const cookieStore = await cookies();

    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Buscar sessão com código válido e não expirado
    const { data: session, error: sessionError } = await adminClient
      .from("class_sessions")
      .select("id, title, session_date, class_label")
      .eq("checkin_code", upperCode)
      .gt("checkin_code_expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 400 });
    }

    // Buscar perfil do aluno para validar a turma (barreira anti-fraude)
    const { data: studentProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("course")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !studentProfile) {
      return NextResponse.json({ error: "Perfil do aluno não encontrado." }, { status: 400 });
    }

    if (session.class_label && studentProfile.course !== session.class_label) {
      return NextResponse.json(
        {
          error: `Este token é exclusivo para a turma ${session.class_label}. Sua turma cadastrada é ${
            studentProfile.course || "Sem Turma"
          }.`,
        },
        { status: 400 }
      );
    }

    // Bloquear sobrescrita: se já tem status válido (presente/justificado) ou foi marcado manualmente
    const { data: existing } = await adminClient
      .from("attendance_records")
      .select("id, status, method")
      .eq("session_id", session.id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existing && existing.status !== "ausente") {
      return NextResponse.json({
        message: "Presença já registrada.",
        session_title: session.title,
        session_date: session.session_date,
      });
    }

    // Se um professor/secretaria já marcou como ausente manualmente (override), não permitir auto-checkin
    if (existing && existing.method === "override") {
      return NextResponse.json(
        { error: "Sua presença foi revisada pela secretaria. Procure-os para regularizar." },
        { status: 403 }
      );
    }

    const { error: upsertError } = await adminClient
      .from("attendance_records")
      .upsert(
        {
          session_id: session.id,
          student_id: user.id,
          status: "presente",
          self_checkin: true,
          method: "app",
          recorded_at: new Date().toISOString(),
        },
        { onConflict: "session_id,student_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      session_title: session.title,
      session_date: session.session_date,
      class_label: session.class_label,
    });
  } catch (err) {
    console.error("[checkin]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
