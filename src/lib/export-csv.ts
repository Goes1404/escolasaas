// Utilitário de exportação CSV (abre no Excel/Google Sheets).
// Gera o arquivo 100% no cliente — nenhum dado sai para servidores externos.

type CsvValue = string | number | boolean | null | undefined;

/** Escapa um valor para uma célula CSV segura (RFC 4180). */
function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Aspas, vírgulas, quebras de linha e ponto-e-vírgula exigem aspas duplas.
  if (/["\n\r,;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => CsvValue;
}

/**
 * Monta e baixa um arquivo CSV a partir de uma lista de objetos.
 * @param filename Nome do arquivo (sem extensão).
 * @param rows Dados a exportar.
 * @param columns Definição de colunas (cabeçalho + como extrair o valor).
 */
export function exportToCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(',');
  const bodyLines = rows.map((row) =>
    columns.map((c) => escapeCell(c.accessor(row))).join(','),
  );

  // BOM (﻿) garante acentuação correta ao abrir no Excel.
  const csv = '﻿' + [headerLine, ...bodyLines].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${filename}_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
