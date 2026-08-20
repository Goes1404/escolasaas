import { NextResponse } from 'next/server';
import { verifyRegistrationToken, tokenExpiryInfo } from '@/lib/registration-token';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ status: 'invalid', message: 'Token ausente.' }, { status: 400 });
  }

  const status = verifyRegistrationToken(token);

  if (status === 'invalid') {
    return NextResponse.json({ status: 'invalid', message: 'Link de cadastro inválido ou adulterado.' }, { status: 400 });
  }

  if (status === 'expired') {
    return NextResponse.json({ status: 'expired', message: 'Este link de cadastro expirou. Solicite um novo ao seu coordenador.' }, { status: 410 });
  }

  const info = tokenExpiryInfo(token);
  return NextResponse.json({
    status: 'valid',
    daysLeft: info?.daysLeft ?? 0,
    expiresAt: info?.expiresAt?.toISOString() ?? null,
  });
}
