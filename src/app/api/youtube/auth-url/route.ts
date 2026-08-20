import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trailId = searchParams.get('trailId') || '';

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://compromissose.com';
    const redirectUri = `${appUrl}/api/youtube/callback`;

    if (!clientId) {
      return NextResponse.json({ error: 'Google OAuth não configurado (GOOGLE_CLIENT_ID ausente)' }, { status: 500 });
    }

    const state = Buffer.from(JSON.stringify({ userId: user.id, trailId })).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    log.info('youtube.auth_url.generated', { userId: user.id, trailId });
    return NextResponse.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  } catch (err: any) {
    log.error('youtube.auth_url.unhandled', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
