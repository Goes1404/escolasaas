const WHATSAPP_NUMBER = '5511950085875';

export function buildWhatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const CONTACT_EMAIL = 'contato@escolasaas.com';
export const DEMO_WHATSAPP_URL = buildWhatsappUrl(
  'Olá! Quero conhecer a plataforma para minha instituição de ensino.'
);
