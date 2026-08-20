// src/lib/file-types.ts
// Tipos de arquivo aceitos pela plataforma + helpers de detecção e exibição.
// Objetivo: aceitar praticamente todos os formatos que um professor utiliza
// (PDF, Word, PowerPoint, Excel, texto, imagens, vídeo, áudio, etc.).

// String pronta para o atributo `accept` de inputs de upload de documentos.
export const DOCUMENT_ACCEPT = [
  // PDF
  '.pdf', 'application/pdf',
  // Word / texto rico
  '.doc', '.docx', '.odt', '.rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  // PowerPoint / apresentações
  '.ppt', '.pptx', '.odp',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.presentation',
  // Excel / planilhas
  '.xls', '.xlsx', '.ods', '.csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  // Texto puro / markdown
  '.txt', '.md', 'text/plain',
  // Imagens
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', 'image/*',
  // Vídeo
  '.mp4', '.mov', '.webm', '.mkv', '.avi', 'video/*',
  // Áudio
  '.mp3', '.wav', '.m4a', '.ogg', 'audio/*',
  // Compactados
  '.zip', '.rar', '.7z',
].join(',');

export type FileKind =
  | 'pdf'
  | 'documento'
  | 'apresentacao'
  | 'planilha'
  | 'texto'
  | 'imagem'
  | 'video'
  | 'audio'
  | 'compactado'
  | 'outro';

const EXT_KIND: Record<string, FileKind> = {
  pdf: 'pdf',
  doc: 'documento', docx: 'documento', odt: 'documento', rtf: 'documento',
  ppt: 'apresentacao', pptx: 'apresentacao', odp: 'apresentacao',
  xls: 'planilha', xlsx: 'planilha', ods: 'planilha', csv: 'planilha',
  txt: 'texto', md: 'texto',
  jpg: 'imagem', jpeg: 'imagem', png: 'imagem', webp: 'imagem', gif: 'imagem', svg: 'imagem', bmp: 'imagem',
  mp4: 'video', mov: 'video', webm: 'video', mkv: 'video', avi: 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio',
  zip: 'compactado', rar: 'compactado', '7z': 'compactado',
};

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: 'PDF',
  documento: 'Documento',
  apresentacao: 'Apresentação',
  planilha: 'Planilha',
  texto: 'Texto',
  imagem: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  compactado: 'Arquivo',
  outro: 'Arquivo',
};

// Extrai a extensão (minúscula, sem ponto) de um nome de arquivo ou URL.
export function extOf(nameOrUrl: string): string {
  const clean = (nameOrUrl || '').split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  if (dot === -1) return '';
  return clean.slice(dot + 1).toLowerCase();
}

// Detecta o "kind" amplo a partir do nome/URL do arquivo.
export function detectKind(nameOrUrl: string): FileKind {
  return EXT_KIND[extOf(nameOrUrl)] || 'outro';
}

// Mapeia o kind amplo para os valores aceitos pela coluna
// class_materials.file_type (constraint: pdf | video | link | imagem | outro).
export function toClassMaterialType(
  kind: FileKind
): 'pdf' | 'video' | 'link' | 'imagem' | 'outro' {
  if (kind === 'pdf') return 'pdf';
  if (kind === 'imagem') return 'imagem';
  if (kind === 'video' || kind === 'audio') return 'video';
  return 'outro';
}

// Rótulo amigável a partir do nome/URL do arquivo (ex.: "Apresentação").
export function describeFile(nameOrUrl: string): { kind: FileKind; label: string } {
  const kind = detectKind(nameOrUrl);
  return { kind, label: KIND_LABEL[kind] };
}
