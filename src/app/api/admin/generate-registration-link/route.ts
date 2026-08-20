import { NextResponse } from 'next/server';
import { generateRegistrationToken } from '@/lib/registration-token';
import { requireAdminUser } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    // Segurança: exige sessão de admin/staff (cookie) em vez de senha mestra no body.
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { expiryDays } = await request.json();

    const days = typeof expiryDays === 'number' && expiryDays > 0 && expiryDays <= 30
      ? expiryDays
      : 7;

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';

    const token = generateRegistrationToken(days);
    const link = `${origin}/primeiro-acesso?invite=${token}`;

    return NextResponse.json({
      success: true,
      link,
      expiryDays: days,
    });

  } catch (error: any) {
    console.error('[ADMIN_GENERATE_REGISTRATION_LINK]', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar link de cadastro' },
      { status: 500 }
    );
  }
}
