import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Corrige texto com problema de codificação (mojibake UTF-8 lido como Latin-1),
 * ex: "previsÃ£o" -> "previsão". Comum em textos importados/extraídos por IA
 * e salvos com encoding errado no banco. Seguro de chamar em texto já correto.
 */
export function fixEncoding(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/Ã£/g, "ã")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ãµ/g, "õ")
    .replace(/Ã¢/g, "â")
    .replace(/Ãª/g, "ê")
    .replace(/Ã´/g, "ô")
    .replace(/Ã‰/g, "É")
    .replace(/Ã‚/g, "Â")
    .replace(/Ã€/g, "À")
    .replace(/Â«/g, "«")
    .replace(/Â»/g, "»")
    .replace(/Â°/g, "°");
}
