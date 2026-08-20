import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    // Segurança: a redação é sempre gravada para o usuário AUTENTICADO. Nunca
    // confiar no user_id do corpo (permitia lançar redação/nota para outro aluno).
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { theme, content, score, feedback, result_data } = body;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypassa o RLS e grava direto
    );

    const { data, error } = await supabaseAdmin
      .from('essay_submissions')
      .insert({
        user_id: user.id,
        theme,
        content,
        score,
        feedback,
        result_data
      })
      .select('*')
      .single();

    if (error) {
      console.error("Supabase Admin Insert Error:", error);
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('API /essay-save Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
