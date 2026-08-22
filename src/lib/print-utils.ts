/**
 * Utilitários de impressão de documentos oficiais (declarações, recibos,
 * contratos). Extraído de secretary/documents para reuso no financeiro e na
 * rematrícula.
 */

/**
 * Escapa valores vindos do banco/UI antes de injetar no HTML de impressão.
 * Evita XSS armazenado (um nome com <script> executaria na janela de impressão).
 */
export const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface PrintDocumentOptions {
  /** Título da janela e do cabeçalho do documento (já deve vir SEM html). */
  title: string;
  /** Corpo do documento em HTML — os valores dinâmicos DEVEM passar por esc(). */
  contentHtml: string;
  /** Rótulo sob a linha de assinatura. Padrão: Secretaria Acadêmica. */
  signatureTitle?: string;
  /** Linha de local/data. Padrão: "São Paulo, <hoje por extenso>". */
  datePlace?: string;
  /** Prefixo do código de verificação no rodapé. Padrão: DOC. */
  codePrefix?: string;
}

/**
 * Abre a janela de impressão com o layout institucional (mesmo visual dos
 * documentos da secretaria) e dispara window.print() ao carregar.
 */
export function openPrintWindow({
  title,
  contentHtml,
  signatureTitle = "Secretaria Acadêmica",
  datePlace,
  codePrefix = "DOC",
}: PrintDocumentOptions): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const hoje =
    datePlace ??
    `São Paulo, ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.`;

  printWindow.document.write(`
    <html>
      <head>
        <title>${esc(title)}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
          body { font-family: 'Inter', sans-serif; padding: 50px; color: #1e293b; line-height: 1.8; }
          .container { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 60px; border-radius: 8px; position: relative; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
          .header { text-align: center; margin-bottom: 50px; border-bottom: 2px solid #ea580c; padding-bottom: 25px; }
          .logo-text { font-size: 26px; font-weight: 800; color: #ea580c; font-style: italic; letter-spacing: -1px; }
          .sub-header { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: 800; margin-top: 5px; }
          .doc-title { text-align: center; font-size: 22px; font-weight: 800; text-transform: uppercase; margin-bottom: 40px; color: #0f172a; letter-spacing: 0.5px; }
          .content { font-size: 14px; text-align: justify; margin-bottom: 60px; color: #334155; }
          .content p { margin-bottom: 20px; text-indent: 30px; }
          .content table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .content th, .content td { border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 13px; text-align: left; }
          .content th { background: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; color: #64748b; }
          .footer { text-align: center; margin-top: 80px; }
          .date-place { font-size: 12px; color: #64748b; margin-bottom: 50px; }
          .signature-line { width: 250px; border-top: 1px solid #94a3b8; margin: 0 auto 10px auto; }
          .signature-title { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
          .watermark { position: absolute; bottom: 20px; right: 20px; font-size: 8px; color: #cbd5e1; font-weight: 600; letter-spacing: 1px; }
          @media print { body { padding: 0; } .container { border: none; box-shadow: none; padding: 40px; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-text">PLATAFORMA</div>
            <div class="sub-header">Secretaria Geral e Atendimento Acadêmico</div>
          </div>
          <div class="doc-title">${esc(title)}</div>
          <div class="content">${contentHtml}</div>
          <div class="footer">
            <div class="date-place">${esc(hoje)}</div>
            <div class="signature-line"></div>
            <div class="signature-title">${esc(signatureTitle)}</div>
          </div>
          <div class="watermark">Código de Verificação: ${esc(codePrefix)}-${Math.floor(100000 + Math.random() * 900000)}</div>
        </div>
        <script>window.onload = function(){ window.print(); }</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/** Formata um número como moeda brasileira. */
export const brl = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
