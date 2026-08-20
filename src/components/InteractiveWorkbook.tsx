"use client";

import { useEffect, useRef, useState, useCallback } from "react";
// As bibliotecas serão carregadas via CDN e acessadas pelo window
const getPdfJs = () => {
  if (typeof window === 'undefined') return null;
  return (window as any).pdfjsLib;
};
const getFabric = () => typeof window !== 'undefined' ? (window as any).fabric : null;
import { 
  Loader2, 
  Pencil, 
  Eraser, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Cloud,
  AlertTriangle,
  Hash,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Highlighter,
  Hand
} from "lucide-react";

// FIX: Global in-memory cache para PDFs para evitar redundância de downloads
const globalPdfCache: Record<string, any> = {};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";

interface InteractiveWorkbookProps {
  materialId: string;
  pdfUrl?: string;
  userName: string;
  userCpf: string;
}

type Tool = 'pencil' | 'highlighter' | 'eraser' | 'pan';

export function InteractiveWorkbook({ materialId, pdfUrl: initialPdfUrl, userName, userCpf }: InteractiveWorkbookProps) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string>(initialPdfUrl || "");
  const [numPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [inputPage, setInputPage] = useState("1");
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1.0);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  
  // Ferramentas
  const [activeTool, setActiveTool] = useState<Tool>('pan');
  const [brushColor, setBrushColor] = useState("#FF0000");
  const [highlightColor, setHighlightColor] = useState("rgba(255, 255, 0, 0.3)");
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toolsRef = useRef({ activeTool, brushColor, highlightColor });
  useEffect(() => {
    toolsRef.current = { activeTool, brushColor, highlightColor };
    
    // Sync fabric when tools change without recreating the canvas
    if (fabricCanvasRef.current) {
      const fCanvas = fabricCanvasRef.current;
      const fabricLib = getFabric();
      fCanvas.isDrawingMode = activeTool !== 'eraser' && activeTool !== 'pan';
      fCanvas.selection = activeTool === 'eraser';
      
      if (activeTool === 'pencil' && fabricLib) {
        fCanvas.freeDrawingBrush = new fabricLib.PencilBrush(fCanvas);
        fCanvas.freeDrawingBrush.color = brushColor;
        fCanvas.freeDrawingBrush.width = 3 * zoom;
      } else if (activeTool === 'highlighter' && fabricLib) {
        fCanvas.freeDrawingBrush = new fabricLib.PencilBrush(fCanvas);
        fCanvas.freeDrawingBrush.color = highlightColor;
        fCanvas.freeDrawingBrush.width = 20 * zoom;
      }
    }
  }, [activeTool, brushColor, highlightColor, zoom]);

  const { toast } = useToast();

  useEffect(() => {
    async function fetchMaterialUrl() {
      if (initialPdfUrl) {
        setCurrentPdfUrl(initialPdfUrl);
        return;
      }
      if (!materialId) return;

      try {
        const { data, error } = await supabase
          .from('library_resources')
          .select('url')
          .eq('id', materialId)
          .single();
        
        if (error) throw error;
        if (data?.url) {
          if (data.url.startsWith('http')) {
             setCurrentPdfUrl(data.url);
          } else {
             // Proteger IP gerando URL assinada com validade de 60s
             const { data: signedData, error: signError } = await supabase
               .storage
               .from('apostilas')
               .createSignedUrl(data.url, 60);
             
             if (!signError && signedData?.signedUrl) {
               setCurrentPdfUrl(signedData.signedUrl);
             } else {
               setCurrentPdfUrl(data.url); // Fallback
             }
          }
        }
      } catch (err) {
        setError("Não foi possível localizar o arquivo da apostila.");
      }
    }
    fetchMaterialUrl();
  }, [materialId, initialPdfUrl]);

  const savePageDraft = useCallback(() => {
    if (!fabricCanvasRef.current) return;

    const objects = fabricCanvasRef.current.getObjects().map((obj: any) => {
      return obj.toObject();
    });

    const pageData = {
      viewport: {
        width: fabricCanvasRef.current.getWidth(),
        height: fabricCanvasRef.current.getHeight()
      },
      objects
    };

    const draftStr = localStorage.getItem(`workbook_draft_${materialId}`);
    const draft = draftStr ? JSON.parse(draftStr) : { annotations: {} };
    
    draft.annotations[currentPage] = pageData;
    draft.lastPage = currentPage;
    draft.timestamp = Date.now();

    localStorage.setItem(`workbook_draft_${materialId}`, JSON.stringify(draft));
  }, [materialId, currentPage]);

  const syncWithSupabase = useCallback(async () => {
    if (isSaving || !user || !materialId) return;
    setIsSaving(true);
    
    const draftStr = localStorage.getItem(`workbook_draft_${materialId}`);
    if (!draftStr) {
      setIsSaving(false);
      return;
    }

    try {
      const draft = JSON.parse(draftStr);
      const percentage = Math.round((currentPage / numPages) * 100);

      const { error: syncError } = await supabase
        .from('material_annotations')
        .upsert({
          user_id: user.id,
          material_id: materialId,
          percentage_explored: percentage,
          drawing_data: { pages: draft.annotations },
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,material_id' });

      if (syncError) throw syncError;
      
      toast({ title: "Sincronizado! ☁️", description: "Suas anotações estão seguras na nuvem." });
    } catch (e: any) {
      toast({ 
        title: "Erro ao sincronizar", 
        description: "Rascunho local mantido.", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  }, [materialId, currentPage, numPages, isSaving, toast, user]);

  useEffect(() => {
    async function loadPdf() {
      if (!currentPdfUrl) return;
      const pdfjsLib = getPdfJs();
      if (!pdfjsLib) {
        // Se ainda não carregou, tentamos novamente em 500ms
        setTimeout(loadPdf, 500);
        return;
      }

      setLoading(true);
      try {
        let pdf: any;
        if (globalPdfCache[currentPdfUrl]) {
           pdf = globalPdfCache[currentPdfUrl];
        } else {
           pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
           const loadingTask = pdfjsLib.getDocument(currentPdfUrl);
           pdf = await loadingTask.promise;
           globalPdfCache[currentPdfUrl] = pdf;
        }

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        
        const draftStr = localStorage.getItem(`workbook_draft_${materialId}`);
        if (draftStr) {
          const draft = JSON.parse(draftStr);
          if (draft.lastPage) {
            const pageToLoad = Math.min(draft.lastPage, pdf.numPages);
            setCurrentPage(pageToLoad);
            setInputPage(pageToLoad.toString());
          }
        }
      } catch (err) {
        setError("Erro ao carregar o arquivo PDF.");
      } finally {
        setLoading(false);
      }
    }
    loadPdf();
  }, [currentPdfUrl, materialId]);

  const renderPage = useCallback(async (pageNum: number, currentZoom: number) => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;
    const fabric = getFabric();
    if (!fabric) return;
    
    setLoading(true);

    try {
      const page = await pdfDoc.getPage(pageNum);
      
      const containerWidth = containerRef.current.clientWidth - 40;
      const unscaledViewport = page.getViewport({ scale: 1 });
      
      // FIX: Aumentamos a fidelidade base (oversampling) para evitar borrão
      // Usamos Device Pixel Ratio para telas Retina/4K, mas limitamos a 2x para evitar crashes de memória.
      const rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
      const dpr = Math.min(Math.max(rawDpr, 1), 2); // Cap em 2x máximo para estabilidade
      const baseScale = (containerWidth / unscaledViewport.width);
      const finalScale = baseScale * currentZoom * dpr;
      const viewport = page.getViewport({ scale: finalScale }); 

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { alpha: false });
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Armazenamos o tamanho CSS (visual) para o container
      setDisplaySize({ 
        width: viewport.width / dpr, 
        height: viewport.height / dpr 
      });

      if (renderTaskRef.current) renderTaskRef.current.cancel();
      const renderTask = page.render({ canvasContext: context!, viewport });
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      // Marca d'água de segurança
      context!.font = "bold 14px Inter";
      context!.fillStyle = "rgba(0, 0, 0, 0.05)";
      context!.save();
      context!.rotate(-Math.PI / 4);
      for(let x=-canvas.width; x<canvas.width*2; x+=250) {
        for(let y=-canvas.height; y<canvas.height*2; y+=180) {
          context!.fillText(`${userName} • ${userCpf}`, x, y);
        }
      }
      context!.restore();

      if (fabricCanvasRef.current) fabricCanvasRef.current.dispose();
      
      const { activeTool: currentTool, brushColor: currentBrush, highlightColor: currentHighlight } = toolsRef.current;
      
      const fCanvas = new fabric.Canvas('fabric-layer', {
        height: viewport.height / dpr,
        width: viewport.width / dpr,
        isDrawingMode: currentTool !== 'eraser' && currentTool !== 'pan',
        selection: currentTool === 'eraser'
      });
      
      // Zoom interno do Fabric para bater com o oversampling do PDF se necessário, 
      // mas aqui controlaremos via CSS scale ou apenas dimensões iguais ao displaySize.
      fCanvas.setZoom(1);

      const draftStr = localStorage.getItem(`workbook_draft_${materialId}`);
      const draft = draftStr ? JSON.parse(draftStr) : null;
      const pageDraft = draft?.annotations?.[pageNum];

      if (pageDraft) {
        const oldWidth = pageDraft.viewport.width;
        const scaleFactor = viewport.width / oldWidth;

        fCanvas.loadFromJSON(pageDraft, () => {
          const objects = fCanvas.getObjects();
          objects.forEach((obj: any) => {
            obj.scaleX = (obj.scaleX || 1) * scaleFactor;
            obj.scaleY = (obj.scaleY || 1) * scaleFactor;
            obj.left = (obj.left || 0) * scaleFactor;
            obj.top = (obj.top || 0) * scaleFactor;
            obj.setCoords();
          });
          fCanvas.renderAll();
        });
      }

      if (currentTool === 'pencil') {
        fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
        fCanvas.freeDrawingBrush.color = currentBrush;
        fCanvas.freeDrawingBrush.width = 3 * currentZoom;
      } else if (currentTool === 'highlighter') {
        fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
        fCanvas.freeDrawingBrush.color = currentHighlight;
        fCanvas.freeDrawingBrush.width = 20 * currentZoom;
      }

      fCanvas.on('mouse:down', (options: any) => {
      if (toolsRef.current.activeTool === 'eraser' && options.target) {
          fCanvas.remove(options.target);
          savePageDraft();
        }
      });

      fCanvas.on('path:created', () => savePageDraft());
      fabricCanvasRef.current = fCanvas;

    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') console.error(err);
    } finally {
      setLoading(false);
    }
  }, [pdfDoc, userName, userCpf, materialId, savePageDraft]);

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage, zoom);
  }, [currentPage, zoom, pdfDoc, renderPage]);

  // FIX: Recalibração de Escala no Mobile (Giro de Tela)
  useEffect(() => {
    let timeoutId: any;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        renderPage(currentPage, zoom);
      }, 300);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [renderPage, currentPage, zoom]);

  const updateTool = (tool: Tool) => {
    setActiveTool(tool);
    const fabric = getFabric();
    if (!fabricCanvasRef.current || !fabric) return;
    
    fabricCanvasRef.current.isDrawingMode = tool !== 'eraser' && tool !== 'pan';
    fabricCanvasRef.current.selection = tool === 'eraser';
    
    if (tool === 'pencil') {
      fabricCanvasRef.current.freeDrawingBrush = new fabric.PencilBrush(fabricCanvasRef.current);
      fabricCanvasRef.current.freeDrawingBrush.color = brushColor;
      fabricCanvasRef.current.freeDrawingBrush.width = 3 * zoom;
    } else if (tool === 'highlighter') {
      fabricCanvasRef.current.freeDrawingBrush = new fabric.PencilBrush(fabricCanvasRef.current);
      fabricCanvasRef.current.freeDrawingBrush.color = highlightColor;
      fabricCanvasRef.current.freeDrawingBrush.width = 20 * zoom;
    }
  };


  if (error) return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-900 text-white gap-4">
      <AlertTriangle className="h-12 w-12 text-red-500" />
      <p className="font-bold italic text-center">{error}</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="border-white/20 text-white">Tentar Novamente</Button>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden select-none relative">
      
      {/* TOOLBAR SUPERIOR - FIXO NO TOPO */}
      <div className="sticky top-0 bg-slate-950 border-b border-white/5 p-2 md:p-4 flex items-center justify-between gap-4 z-40 shadow-2xl overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant={activeTool === 'pan' ? "default" : "ghost"} 
            size="icon" 
            onClick={() => updateTool('pan')}
            className={`h-10 w-10 md:h-12 md:w-12 rounded-xl transition-all ${activeTool === 'pan' ? 'bg-accent text-accent-foreground scale-110 shadow-lg' : 'text-slate-400'}`}
            title="Mover Página"
          >
            <Hand className="h-5 w-5" />
          </Button>
          <Button 
            variant={activeTool === 'pencil' ? "default" : "ghost"} 
            size="icon" 
            onClick={() => updateTool('pencil')}
            className={`h-10 w-10 md:h-12 md:w-12 rounded-xl transition-all ${activeTool === 'pencil' ? 'bg-primary text-white scale-110 shadow-lg' : 'text-slate-400'}`}
            title="Lápis"
          >
            <Pencil className="h-5 w-5" />
          </Button>
          <Button 
            variant={activeTool === 'highlighter' ? "default" : "ghost"} 
            size="icon" 
            onClick={() => updateTool('highlighter')}
            className={`h-10 w-10 md:h-12 md:w-12 rounded-xl transition-all ${activeTool === 'highlighter' ? 'bg-yellow-500 text-black scale-110 shadow-lg' : 'text-slate-400'}`}
            title="Marca-Texto"
          >
            <Highlighter className="h-5 w-5" />
          </Button>
          <Button 
            variant={activeTool === 'eraser' ? "default" : "ghost"} 
            size="icon" 
            onClick={() => updateTool('eraser')}
            className={`h-10 w-10 md:h-12 md:w-12 rounded-xl transition-all ${activeTool === 'eraser' ? 'bg-red-600 text-white scale-110 shadow-lg' : 'text-slate-400'}`}
            title="Borracha"
          >
            <Eraser className="h-5 w-5" />
          </Button>
          
          <div className="w-px h-8 bg-white/10 mx-1" />
          
          <div className="flex gap-1.5 md:gap-2">
            {activeTool === 'pencil' ? (
              ["#FF0000", "#0088FF", "#00FF00", "#FFFFFF"].map(c => (
                <button key={c} onClick={() => { setBrushColor(c); updateTool('pencil'); }} className={`h-6 w-6 md:h-8 md:w-8 rounded-full border-2 ${brushColor === c ? 'border-white scale-110' : 'border-transparent opacity-40'}`} style={{ backgroundColor: c }} />
              ))
            ) : activeTool === 'highlighter' ? (
              ["rgba(255,255,0,0.3)", "rgba(0,255,0,0.2)", "rgba(255,0,255,0.2)", "rgba(0,255,255,0.2)"].map(c => (
                <button key={c} onClick={() => { setHighlightColor(c); updateTool('highlighter'); }} className={`h-6 w-6 md:h-8 md:w-8 rounded-full border-2 ${highlightColor === c ? 'border-white scale-110' : 'border-transparent opacity-40'}`} style={{ backgroundColor: c }} />
              ))
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pr-4">
          <Button variant="ghost" size="icon" onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))} className="text-white hover:bg-white/10"><ZoomOut className="h-5 w-5" /></Button>
          <span className="text-[10px] font-black text-white/65 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={() => setZoom(prev => Math.min(3, prev + 0.25))} className="text-white hover:bg-white/10"><ZoomIn className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setZoom(1.0)} className="text-white hover:bg-white/10" title="Reset Zoom"><Maximize2 className="h-4 w-4" /></Button>
          <div className="w-px h-8 bg-white/10 mx-1" />
          <Button variant="ghost" size="icon" onClick={syncWithSupabase} disabled={isSaving} className="text-slate-400 hover:text-accent">
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Cloud className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* ÁREA DO DOCUMENTO */}
      <div 
        ref={containerRef} 
        style={{ touchAction: activeTool === 'pan' ? 'auto' : 'none' }}
        className={`flex-1 overflow-auto p-4 md:p-10 flex items-start bg-slate-900 no-swipe scroll-smooth ${
          activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
      >
        <div 
          className="relative shadow-[0_50px_100px_rgba(0,0,0,0.6)] rounded-sm bg-white overflow-hidden shrink-0 mx-auto"
          style={{ 
            width: displaySize.width || 'auto',
            height: displaySize.height || 'auto'
          }}
        >
          {loading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-accent" />
              <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Sintonizando...</p>
            </div>
          )}
          <canvas 
            ref={canvasRef} 
            className="block origin-top-left"
            style={{
              width: '100%',
              height: '100%'
            }} 
          />
          <div className={`absolute inset-0 z-10 ${activeTool === 'pan' ? 'pointer-events-none' : 'pointer-events-auto'}`}>
            <canvas id="fabric-layer" />
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO INFERIOR - FIXA NO RODAPÉ */}
      <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur-2xl border-t border-white/5 p-4 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 z-40 shadow-2xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="text-white hover:bg-white/10 h-10 w-10"><ChevronsLeft className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="text-white hover:bg-white/10 h-10 w-10"><ChevronLeft className="h-6 w-6" /></Button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); let p = parseInt(inputPage); if(p > numPages) p = numPages; if(p < 1) p = 1; setCurrentPage(p); setInputPage(p.toString()); }} className="flex items-center gap-3 bg-white/5 px-5 py-2 rounded-2xl border border-white/10 group focus-within:border-accent/50 transition-all">
          <Hash className="h-3.5 w-3.5 text-accent" />
          <Input 
            value={inputPage}
            onChange={(e) => setInputPage(e.target.value)}
            className="w-14 h-8 bg-transparent border-none text-center font-black text-white p-0 focus-visible:ring-0 text-xl italic"
          />
          <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">DE {numPages}</span>
        </form>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.min(numPages, p+1))} disabled={currentPage === numPages} className="text-white hover:bg-white/10 h-10 w-10"><ChevronRight className="h-6 w-6" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentPage(numPages)} disabled={currentPage === numPages} className="text-white hover:bg-white/10 h-10 w-10"><ChevronsRight className="h-5 w-5" /></Button>
        </div>
      </div>
    </div>
  );
}