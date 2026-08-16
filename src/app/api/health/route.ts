import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/app/lib/supabase';

/**
 * 🏥 DIAGNÓSTICO DE INFRAESTRUTURA - PLATAFORMA
 * Verifica a saúde do Supabase no ambiente de deploy.
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    supabase: { status: 'unknown', details: '' },
  };

  // 1. Testar Conexão Supabase
  if (!isSupabaseConfigured) {
    diagnostics.supabase = { status: 'error', details: 'NEXT_PUBLIC_SUPABASE_URL ou ANON_KEY ausentes no ambiente.' };
  } else {
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) throw error;
      diagnostics.supabase = { status: 'ok', details: 'Banco de dados conectado.' };
    } catch (e: any) {
      diagnostics.supabase = { status: 'error', details: e.message || 'Falha ao consultar tabela de perfis.' };
    }
  }

  const allOk = diagnostics.supabase.status === 'ok';

  return NextResponse.json(diagnostics, { status: allOk ? 200 : 207 });
}
