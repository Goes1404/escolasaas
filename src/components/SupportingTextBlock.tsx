import { BookOpen } from 'lucide-react';

const MD_IMAGE_RE = /!\[.*?\]\((https?:\/\/[^)]+)\)/g;
const PENDING_IMAGE_RE = /\[IMAGEM_PENDENTE\]/g;

function parse(raw: string): { images: string[]; text: string } {
  const images: string[] = [];
  const text = raw
    .replace(MD_IMAGE_RE, (_, url: string) => { images.push(url); return ''; })
    .replace(PENDING_IMAGE_RE, '')
    .trim();
  return { images, text };
}

export function SupportingTextBlock({ text }: { text: string }) {
  const { images, text: body } = parse(text);
  if (images.length === 0 && !body) return null;

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Texto de Apoio</span>
      </div>
      {images.map((url, i) => (
        <img key={i} src={url} alt="Imagem do contexto" className="w-full rounded-xl object-contain max-h-64 border border-amber-200 bg-white" />
      ))}
      {body && (
        <p className="text-sm text-amber-900 font-medium leading-relaxed italic whitespace-pre-wrap">{body}</p>
      )}
    </div>
  );
}
