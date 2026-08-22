/** Utilitários das rotas de aceite de rematrícula. */

/** Valida CPF com dígito verificador (aceita com ou sem pontuação). */
export function cpfValido(raw: string): boolean {
  const cpf = String(raw ?? '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const len of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i);
    const dig = ((soma * 10) % 11) % 10;
    if (dig !== Number(cpf[len])) return false;
  }
  return true;
}

/** IP real da requisição — só headers do servidor, nunca o body. */
export function requestIp(request: Request): string | null {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip');
}
