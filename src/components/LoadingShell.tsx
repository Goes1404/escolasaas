import { BookOpen } from "lucide-react";

/**
 * Shell de carregamento ultra-leve baseado em CSS puro para FCP rápido.
 */
export function LoadingShell() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950 gap-8 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[400px] h-[400px] bg-primary/10 blur-[100px] rounded-full animate-pulse" />
      </div>
      
      <div className="relative flex items-center justify-center z-10">
        {/* Pinging Radar Rings */}
        <div className="absolute h-32 w-32 border-2 border-primary/20 rounded-full animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
        <div className="absolute h-24 w-24 border-2 border-primary/40 rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]" />
        
        {/* Core Container */}
        <div className="relative h-20 w-20 rounded-card bg-white/5 backdrop-blur-xl flex items-center justify-center border border-white/10 shadow-[0_0_40px_rgba(76,204,237,0.2)]">
          <BookOpen className="h-10 w-10 text-primary animate-pulse" />
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-3 z-10">
        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Plataforma</h2>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '-0.3s' }} />
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '-0.15s' }} />
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    </div>
  );
}
