/**
 * Envio de SMS via Twilio para códigos OTP de recuperação de senha.
 * Server-side only — nunca importe em componentes "use client".
 */

import twilio from 'twilio';

function client() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Credenciais Twilio não configuradas');
  return twilio(sid, token);
}

// Telefone brasileiro em dígitos puros (com ou sem DDI 55) -> formato E.164 (+55...).
function toE164BR(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (!digits.startsWith('55')) digits = `55${digits}`;
  return `+${digits}`;
}

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('TWILIO_PHONE_NUMBER não configurado');

  await client().messages.create({
    to: toE164BR(phone),
    from,
    body: `Plataforma: seu código de recuperação de senha é ${code}. Válido por 5 minutos.`,
  });
}
