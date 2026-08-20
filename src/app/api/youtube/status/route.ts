import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ connected: false });
    }

    const { data: token } = await supabase
      .from('teacher_youtube_tokens')
      .select('channel_id, channel_title, token_expiry')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!token) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      channelId: token.channel_id,
      channelTitle: token.channel_title,
      tokenExpiry: token.token_expiry,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
