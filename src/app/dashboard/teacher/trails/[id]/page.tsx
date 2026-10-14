'use client';

export const runtime = "edge";

/**
 * @fileOverview Gestão de Conteúdo de Trilha - Visão do Mentor.
 * - handleAddModule: Cria novos capítulos.
 * - handleBatchSaveContent: Publica materiais em massa.
 * - handleEditContent: Permite alterar materiais existentes.
 * - Integração com Apostilas: Vincula recursos da biblioteca às aulas.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  ChevronLeft,
  Trash2,
  FileText,
  Loader2,
  Youtube,
  Sparkles,
  Eye,
  CheckCircle2,
  Globe,
  BrainCircuit,
  Settings2,
  Video,
  ListPlus,
  X,
  Layers,
  PlusCircle,
  FileUp,
  Link2,
  Layout,
  Pencil,
  BookOpen,
  Save,
  Unlink
} from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { EDUCATIONAL_CATEGORIES } from '@/lib/constants';
import { EmptyState } from '@/components/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabase';
import { ScrollArea } from '@/components/ui/scroll-area';
import YouTubeUploadModal from '@/components/teacher/YouTubeUploadModal';

// O valor gravado continua em inglês; só o rótulo na tela é traduzido.
const TIPO_CONTEUDO: Record<string, string> = {
  video: 'Videoaula',
  quiz: 'Quiz',
  pdf: 'PDF',
  text: 'Texto',
  file: 'Anexo',
  link: 'Link',
  book: 'Livro',
};
const tipoConteudo = (t?: string | null) => (t ? TIPO_CONTEUDO[t] ?? t : 'Material');

export default function TrailManagementPage() {
  const params = useParams();
  const trailId = params?.id as string;
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [trail, setTrail] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [contents, setContents] = useState<Record<string, any[]>>({});
  const [libraryResources, setLibraryResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detachingId, setDetachingId] = useState<string | null>(null);

  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false);
  const [isEditTrailDialogOpen, setIsEditTrailDialogOpen] = useState(false);
  const [isEditModuleDialogOpen, setIsEditModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<any>(null);
  const [editModuleTitle, setEditModuleTitle] = useState('');
  
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const activeModuleRef = useRef<string | null>(null);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);

  const [editTrailForm, setEditTrailForm] = useState({ title: '', category: '', description: '', image_url: '' });
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: '' });
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [contentForm, setContentForm] = useState({
    title: '',
    type: 'video',
    url: '',
    description: '',
    workbook_id: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState<number>(Date.now());
  const [ytModalOpen, setYtModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!trailId) return;
    setLoading(true);
    try {
      // 1. Trail & Modules
      const { data: trailData, error: trailError } = await supabase
        .from('trails')
        .select('*')
        .eq('id', trailId)
        .single();

      if (trailError) throw trailError;
      setTrail(trailData);

      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .eq('trail_id', trailId)
        .order('order_index');

      if (modulesError) throw modulesError;
      const sortedModules = modulesData || [];
      setModules(sortedModules);

      // 2. Learning Contents
      if (sortedModules.length > 0) {
        const moduleIds = sortedModules.map((m) => m.id);
        const { data: contentsData, error: contentsError } = await supabase
          .from('learning_contents')
          .select('*')
          .in('module_id', moduleIds)
          .order('order_index');

        if (contentsError) throw contentsError;

        const contentMap: Record<string, any[]> = {};
        contentsData?.forEach((c) => {
          if (!contentMap[c.module_id]) contentMap[c.module_id] = [];
          contentMap[c.module_id].push(c);
        });
        setContents(contentMap);
      }

      const { data: resources } = await supabase
        .from('library_resources')
        .select('id, title, category')
        .order('title');
      setLibraryResources(resources || []);

    } catch (e: any) {
      console.error('Erro ao carregar estúdio:', e);
      toast({
        title: 'Erro de Conexão',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [trailId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Detecta retorno do OAuth do YouTube
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const yt = params.get('youtube');
    if (yt === 'connected') {
      toast({ title: 'YouTube conectado', description: 'Seu canal foi vinculado. Agora você pode publicar vídeos diretamente.' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (yt === 'error') {
      toast({ title: 'Erro ao conectar YouTube', description: 'Verifique as credenciais e tente novamente.', variant: 'destructive' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

  const handlePublish = async () => {
    if (isPublishing || !trail) return;
    setIsPublishing(true);

    const newStatus = trail.status === 'active' ? 'draft' : 'active';

    const { error } = await supabase
      .from('trails')
      .update({ status: newStatus })
      .eq('id', trailId);

    if (!error) {
      setTrail({ ...trail, status: newStatus });
      toast({
        title: newStatus === 'active' ? 'Trilha Publicada!' : 'Trilha em Rascunho',
        description:
          newStatus === 'active'
            ? 'Os alunos já podem iniciar os estudos.'
            : 'A trilha foi ocultada dos alunos.',
      });
      router.refresh();
    }
    setIsPublishing(false);
  };

  const openEditTrailDialog = () => {
    if (trail) {
      setEditTrailForm({
        title: trail.title || '',
        category: trail.category || 'Multidisciplinar e Geral',
        description: trail.description || '',
        image_url: trail.image_url || ''
      });
      setEditCoverFile(null);
      setIsEditTrailDialogOpen(true);
    }
  };

  const handleUpdateTrail = async () => {
    if (!editTrailForm.title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      let finalImageUrl = editTrailForm.image_url;

      if (editCoverFile) {
        setUploading(true);
        const fileExt = editCoverFile.name.split('.').pop();
        const fileName = `cover-${Date.now()}.${fileExt}`;
        const filePath = `trails/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('learning-contents')
          .upload(filePath, editCoverFile);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('learning-contents')
            .getPublicUrl(filePath);
          finalImageUrl = publicUrlData.publicUrl;
        }
        setUploading(false);
      }

      const { error } = await supabase
        .from('trails')
        .update({
          title: editTrailForm.title,
          category: editTrailForm.category,
          description: editTrailForm.description,
          image_url: finalImageUrl
        })
        .eq('id', trailId);

      if (error) throw error;
      
      setTrail((prev: any) => ({ ...prev, ...editTrailForm, image_url: finalImageUrl }));
      toast({ title: 'Detalhes atualizados' });
      setIsEditTrailDialogOpen(false);
      router.refresh();
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrail = async () => {
    if (confirm('ATENÇÃO: Deseja realmente excluir esta trilha inteira? Esta ação apagará todas as aulas e módulos associados irreversivelmente.')) {
      setIsSubmitting(true);
      const { error } = await supabase.from('trails').delete().eq('id', trailId);
      if (error) {
        toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
        setIsSubmitting(false);
      } else {
        toast({ title: 'Trilha excluída', description: 'Todo o conteúdo foi apagado.' });
        router.refresh();
        router.push('/dashboard/teacher/trails');
      }
    }
  };

  const handleAddModule = async () => {
    if (!moduleForm.title.trim() || isSubmitting || !user) return;
    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('modules')
      .insert({
        trail_id: trailId,
        title: moduleForm.title,
        order_index: modules.length,
      })
      .select()
      .single();

    if (!error) {
      setModules((prev) => [...prev, data]);
      setContents((prev) => ({ ...prev, [data.id]: [] }));
      toast({ title: 'Capítulo criado' });
      router.refresh();
      
      setTimeout(() => {
        setModuleForm({ title: '' });
        setIsModuleDialogOpen(false);
        setTimeout(() => { document.body.style.pointerEvents = ""; }, 500);
      }, 50);
    }
    setIsSubmitting(false);
  };

  const startEditContent = (content: any) => {
    setActiveModuleId(content.module_id);
    setEditingContentId(content.id);
    setContentForm({
      title: content.title || '',
      type: content.type || 'video',
      url: content.url || '',
      description: content.description || '',
      workbook_id: content.workbook_id || '',
    });
    setPendingItems([]);
    setIsContentDialogOpen(true);
  };

  const addToQueue = async () => {
    if (!contentForm.title.trim()) {
      toast({ title: 'Informe o título', variant: 'destructive' });
      return;
    }

    let fileUrl = contentForm.url;

    if (file) {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from('learning-contents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { publicUrl } = supabase.storage
          .from('learning-contents')
          .getPublicUrl(filePath).data;

        fileUrl = publicUrl;
      } catch (uploadError: any) {
        toast({
          title: 'Erro no Upload',
          description: uploadError.message,
          variant: 'destructive',
        });
        setUploading(false);
        return;
      } finally {
        setFile(null);
      }
    }

    const finalWorkbookId = contentForm.workbook_id === 'none' || !contentForm.workbook_id ? null : contentForm.workbook_id;

    if (editingContentId) {
      setIsSubmitting(true);
      try {
        let { error } = await supabase
          .from('learning_contents')
          .update({
            title: contentForm.title,
            type: contentForm.type,
            url: fileUrl,
            description: contentForm.description,
            workbook_id: finalWorkbookId,
          })
          .eq('id', editingContentId);

        if (error && error.code === '42703') {
           const retry = await supabase.from('learning_contents').update({
             title: contentForm.title,
             type: contentForm.type,
             url: fileUrl,
             description: contentForm.description
           }).eq('id', editingContentId);
           error = retry.error;
        }

        if (error) throw error;

        toast({ title: 'Aula atualizada' });
        router.refresh();
        
        setTimeout(() => {
          setIsContentDialogOpen(false);
          setEditingContentId(null);
          setTimeout(() => { document.body.style.pointerEvents = ""; }, 500);
        }, 50);
        
        loadData();
      } catch (e: any) {
        toast({ title: 'Erro ao atualizar', description: e.message, variant: 'destructive' });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setPendingItems([
        ...pendingItems,
        { ...contentForm, url: fileUrl, workbook_id: finalWorkbookId, id: Date.now().toString() },
      ]);
      setContentForm({ title: '', type: 'video', url: '', description: '', workbook_id: '' });
      setUploading(false);
      setFileInputKey(Date.now()); // Força a DOM a limpar o input de arquivos
    }
  };

  const removeFromQueue = (id: string) => {
    setPendingItems(pendingItems.filter((item) => item.id !== id));
  };

  const handleBatchSaveContent = async (moduleId: string | null) => {
    // Use a ref como fallback caso o estado seja limpo antes da execução
    const resolvedModuleId = moduleId || activeModuleRef.current;
    if (!resolvedModuleId || pendingItems.length === 0 || isSubmitting) return;
    moduleId = resolvedModuleId;
    setIsSubmitting(true);

    const currentModuleContents = contents[moduleId] || [];
    const itemsToInsert = pendingItems.map((item, idx) => ({
      module_id: moduleId,
      title: item.title,
      type: item.type,
      url: item.url,
      description: item.description,
      workbook_id: item.workbook_id,
      order_index: currentModuleContents.length + idx,
    }));

    try {
      let { data, error } = await supabase
        .from('learning_contents')
        .insert(itemsToInsert)
        .select();

      if (error && error.code === '42703') {
        const fallbackItems = itemsToInsert.map(({workbook_id, ...rest}) => rest);
        const retry = await supabase.from('learning_contents').insert(fallbackItems).select();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      if (data) {
        setContents((prev) => ({
          ...prev,
          [moduleId]: [...(prev[moduleId] || []), ...data],
        }));
        toast({
          title: 'Materiais Publicados!',
          description: `${data.length} itens foram adicionados ao capítulo.`,
        });
        router.refresh();
        
        setTimeout(() => {
          setPendingItems([]);
          setIsContentDialogOpen(false);
          setTimeout(() => { document.body.style.pointerEvents = ""; }, 500);
        }, 50);
      }
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message || 'Ocorreu um erro desconhecido', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteModule = async (id: string) => {
    if (deletingId || !confirm('Excluir este capítulo e todo seu conteúdo?'))
      return;
    setDeletingId(id);
    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (!error) {
      setModules((prev) => prev.filter((m) => m.id !== id));
      toast({ title: 'Capítulo removido' });
      router.refresh();
    }
    setDeletingId(null);
  };

  const handleDetachModule = async (mod: any) => {
    if (detachingId) return;
    if (!confirm(`Tornar "${mod.title}" uma aula independente? Ela será desvinculada desta série e criará uma nova trilha avulsa.`)) return;

    setDetachingId(mod.id);
    try {
      // Get the title of the video if it exists in the module
      const moduleContents = contents[mod.id] || [];
      const videoContent = moduleContents.find((c: any) => c.type === 'video');
      const newTrailTitle = videoContent?.title || mod.title;

      // 1. Cria nova trilha standalone com os dados da série atual
      const { data: newTrail, error: trailErr } = await supabase
        .from('trails')
        .insert({
          title: newTrailTitle,
          category: trail.category,
          description: trail.description,
          teacher_id: trail.teacher_id,
          teacher_name: trail.teacher_name,
          status: trail.status,
          image_url: trail.image_url,
          target_audience: trail.target_audience,
          trail_type: 'standalone',
        })
        .select()
        .single();

      if (trailErr) throw trailErr;

      // 2. Reassocia o módulo à nova trilha
      const { error: modErr } = await supabase
        .from('modules')
        .update({ trail_id: newTrail.id })
        .eq('id', mod.id);

      if (modErr) throw modErr;

      // 3. Atualiza estado local — remove o módulo da série atual
      setModules((prev) => prev.filter((m) => m.id !== mod.id));
      setContents((prev) => {
        const next = { ...prev };
        delete next[mod.id];
        return next;
      });

      toast({
        title: 'Aula desvinculada!',
        description: `"${mod.title}" agora é uma trilha independente.`,
      });

      router.refresh();
    } catch (err: any) {
      toast({ title: 'Erro ao desvincular', description: err.message, variant: 'destructive' });
    } finally {
      setDetachingId(null);
    }
  };

  const startEditModule = (mod: any) => {
    setEditingModule(mod);
    setEditModuleTitle(mod.title || '');
    setIsEditModuleDialogOpen(true);
  };

  const handleUpdateModule = async () => {
    if (!editModuleTitle.trim() || !editingModule || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('modules')
        .update({ title: editModuleTitle.trim() })
        .eq('id', editingModule.id);

      if (error) throw error;

      setModules(prev => prev.map(m => m.id === editingModule.id ? { ...m, title: editModuleTitle.trim() } : m));
      toast({ title: 'Capítulo atualizado' });
      setIsEditModuleDialogOpen(false);
      setEditingModule(null);
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar capítulo', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContent = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    const { error } = await supabase
      .from('learning_contents')
      .delete()
      .eq('id', id);
    if (!error) {
      setContents((prev) => {
        const newContents = { ...prev };
        for (const modId in newContents) {
          newContents[modId] = newContents[modId].filter((c) => c.id !== id);
        }
        return newContents;
      });
      toast({ title: 'Item removido' });
      router.refresh();
    }
    setDeletingId(null);
  };

  if (loading) {
    return (
      <div className='flex flex-col h-96 items-center justify-center gap-4'>
        <Loader2 className='animate-spin h-8 w-8 text-muted-foreground' />
        <p className='u-label'>Carregando…</p>
      </div>
    );
  }

  const isPublished = trail?.status === 'active';

  return (
    <div className='max-w-6xl mx-auto w-full space-y-6 pb-24 px-1'>
      {/* Cabeçalho */}
      <div className='flex flex-col lg:flex-row lg:items-end justify-between gap-4'>
        <div className='flex items-start gap-3 min-w-0'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => router.back()}
            aria-label='Voltar'
            className='rounded-control h-10 w-10 shrink-0'
          >
            <ChevronLeft className='h-5 w-5' />
          </Button>
          <div className='min-w-0'>
            <p className='u-label'>Professor · trilhas</p>
            <h1 className='u-page-title text-2xl md:text-3xl mt-1 line-clamp-2'>
              {trail?.title || 'Trilha'}
            </h1>
            <div className='flex flex-wrap items-center gap-2 mt-2'>
              <Badge
                variant='outline'
                className={`text-[11px] font-bold px-2 h-5 ${
                  isPublished
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'text-muted-foreground'
                }`}
              >
                {isPublished ? 'Publicada' : 'Rascunho'}
              </Badge>
              <Badge variant='outline' className='text-[11px] font-bold px-2 h-5 text-muted-foreground'>
                {trail?.trail_type === 'serie' ? 'Série' : 'Aula avulsa'}
              </Badge>
            </div>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            variant='outline'
            onClick={openEditTrailDialog}
            className='rounded-control h-11 font-bold px-4'
          >
            <Pencil className='h-4 w-4 mr-2' /> Detalhes
          </Button>
          <Button
            variant='outline'
            className='rounded-control h-11 font-bold px-4'
            asChild
          >
            <Link href={`/dashboard/classroom/${trailId}`}>
              <Eye className='h-4 w-4 mr-2' /> Ver como aluno
            </Link>
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={handleDeleteTrail}
            title='Excluir trilha definitivamente'
            aria-label='Excluir trilha'
            className='rounded-control h-11 w-11 text-muted-foreground hover:bg-red-50 hover:text-red-600 shrink-0'
          >
            <Trash2 className='h-5 w-5' />
          </Button>
          <Button
            variant='arcade'
            onClick={() => setIsModuleDialogOpen(true)}
            className='rounded-control h-11 px-5 font-bold w-full sm:w-auto'
          >
            <Plus className='h-4 w-4 mr-2' /> Novo capítulo
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
        <div className='lg:col-span-8 space-y-4'>
          {modules.length === 0 ? (
            <EmptyState
              icon={ListPlus}
              title='Esta trilha ainda não tem capítulos'
              description='Crie o primeiro capítulo e depois adicione as aulas e materiais dele.'
              action={{ label: 'Criar primeiro capítulo', icon: Plus, onClick: () => setIsModuleDialogOpen(true) }}
            />
          ) : (
            modules.map((mod, idx) => (
              <Card
                key={mod.id}
                className='overflow-hidden rounded-card'
              >
                <CardHeader className='p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 border-b border-border'>
                  <div className='flex items-center gap-3 min-w-0'>
                    <div className='h-11 w-11 rounded-control border border-border flex items-center justify-center shrink-0'>
                      <span className='u-num text-base'>{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
                    </div>
                    <div className='min-w-0'>
                      <div className="flex items-center gap-1.5">
                        <CardTitle className='text-base font-bold text-foreground leading-tight truncate'>
                          {mod.title}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditModule(mod)}
                          className="h-7 w-7 rounded-control text-muted-foreground hover:text-foreground shrink-0"
                          title="Editar título do capítulo"
                          aria-label="Editar título do capítulo"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className='u-label !tracking-[0.16em] mt-1'>
                        {contents[mod.id]?.length || 0} {(contents[mod.id]?.length || 0) === 1 ? 'material' : 'materiais'}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-1.5 self-end sm:self-auto'>
                    {trail?.trail_type === 'serie' && (
                      <Button
                        variant='ghost'
                        size='icon'
                        title='Tornar aula avulsa'
                        aria-label='Tornar aula avulsa'
                        onClick={() => handleDetachModule(mod)}
                        disabled={!!detachingId}
                        className='text-muted-foreground hover:text-foreground rounded-control h-9 w-9'
                      >
                        {detachingId === mod.id ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : (
                          <Unlink className='h-4 w-4' />
                        )}
                      </Button>
                    )}
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => handleDeleteModule(mod.id)}
                      disabled={deletingId === mod.id}
                      aria-label='Excluir capítulo'
                      className='text-muted-foreground hover:text-red-600 rounded-control h-9 w-9 hover:bg-red-50'
                    >
                      {deletingId === mod.id ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <Trash2 className='h-4 w-4' />
                      )}
                    </Button>
                    <Button
                      variant='outline'
                      onClick={() => {
                        activeModuleRef.current = mod.id;
                        setActiveModuleId(mod.id);
                        setEditingContentId(null);
                        setPendingItems([]);
                        setContentForm({ title: '', type: 'video', url: '', description: '', workbook_id: '' });
                        setIsContentDialogOpen(true);
                      }}
                      className='font-bold text-sm rounded-control h-9 px-3'
                    >
                      <Plus className='h-4 w-4 mr-1.5' /> Adicionar aula
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className='p-4 md:p-5 space-y-2'>
                  {(contents[mod.id] || []).map((content) => (
                    <div
                      key={content.id}
                      className='flex items-center justify-between gap-3 p-3 rounded-control border border-border hover:bg-muted/40 transition-colors group/item'
                    >
                      <div className='flex items-center gap-3 overflow-hidden'>
                        <div className='h-10 w-10 rounded-control bg-primary/10 text-primary flex items-center justify-center shrink-0'>
                          {content.type === 'video' ? (
                            <Youtube className='h-5 w-5' />
                          ) : content.type === 'quiz' ? (
                            <BrainCircuit className='h-5 w-5' />
                          ) : (
                            <FileText className='h-5 w-5' />
                          )}
                        </div>
                        <div className='min-w-0'>
                          <div className='flex items-center gap-2 min-w-0'>
                            <p className='font-semibold text-sm text-foreground truncate leading-tight'>
                              {content.title}
                            </p>
                            {content.workbook_id && (
                              <Badge variant='outline' className='text-[10px] font-bold h-5 px-1.5 flex items-center gap-1 shrink-0 text-muted-foreground'>
                                <BookOpen className='h-3 w-3' /> Apostila
                              </Badge>
                            )}
                          </div>
                          <p className='u-label !tracking-[0.16em] mt-1'>
                            {tipoConteudo(content.type)}
                          </p>
                        </div>
                      </div>
                      <div className='flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover/item:opacity-100 md:focus-within:opacity-100 transition-opacity'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-9 w-9 rounded-control text-muted-foreground hover:text-foreground'
                          onClick={() => startEditContent(content)}
                          aria-label='Editar material'
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-9 w-9 rounded-control text-muted-foreground hover:bg-red-50 hover:text-red-600'
                          onClick={() => handleDeleteContent(content.id)}
                          disabled={deletingId === content.id}
                          aria-label='Remover material'
                        >
                          {deletingId === content.id ? (
                            <Loader2 className='h-4 w-4 animate-spin' />
                          ) : (
                            <Trash2 className='h-4 w-4' />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!contents[mod.id] || contents[mod.id].length === 0) && (
                    <EmptyState
                      compact
                      icon={FileText}
                      title='Capítulo sem materiais'
                      description='Adicione uma videoaula, PDF ou quiz a este capítulo.'
                      action={{
                        label: 'Adicionar aula',
                        icon: Plus,
                        onClick: () => {
                          activeModuleRef.current = mod.id;
                          setActiveModuleId(mod.id);
                          setEditingContentId(null);
                          setPendingItems([]);
                          setContentForm({ title: '', type: 'video', url: '', description: '', workbook_id: '' });
                          setIsContentDialogOpen(true);
                        },
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className='lg:col-span-4 space-y-4'>
          <Card className='rounded-card p-5 md:p-6'>
            <div className='space-y-4'>
              <div className='flex items-center gap-3'>
                <div className={`h-11 w-11 rounded-control flex items-center justify-center shrink-0 ${isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                  {isPublished ? (
                    <Globe className='h-5 w-5' />
                  ) : (
                    <Settings2 className='h-5 w-5' />
                  )}
                </div>
                <div>
                  <p className='u-label'>Situação</p>
                  <p className={`text-lg font-bold ${isPublished ? 'text-emerald-700' : 'text-foreground'}`}>
                    {isPublished ? 'Publicada' : 'Rascunho'}
                  </p>
                </div>
              </div>

              <p className='text-sm text-muted-foreground leading-relaxed'>
                {isPublished
                  ? 'Todos os alunos com acesso já podem ver esta trilha.'
                  : 'Só você e a coordenação veem esta trilha por enquanto.'}
              </p>

              <Button
                onClick={handlePublish}
                disabled={isPublishing || !trail}
                variant={isPublished ? 'outline' : 'default'}
                className='w-full font-bold h-11 rounded-control text-sm'>
                {isPublishing ? (
                  <Loader2 className='animate-spin h-4 w-4 mr-2' />
                ) : (
                  <CheckCircle2 className='h-4 w-4 mr-2' />
                )}
                {isPublished
                  ? 'Voltar para rascunho'
                  : 'Publicar para os alunos'}
              </Button>
            </div>
          </Card>

          <Card className='rounded-card p-5 md:p-6 space-y-3'>
            <div className="flex items-center gap-2">
              <Sparkles className='h-4 w-4 text-primary' />
              <h3 className='u-label'>Dica</h3>
            </div>
            <p className='text-sm text-muted-foreground leading-relaxed'>
              Organize as aulas em blocos de até 15 minutos para ajudar os alunos a manter o foco.
            </p>
          </Card>
        </div>
      </div>

      {/* MODAL DE UPLOAD PARA O YOUTUBE */}
      <YouTubeUploadModal
        open={ytModalOpen}
        onClose={() => setYtModalOpen(false)}
        trailId={trailId}
        onSuccess={(url) => setContentForm((prev) => ({ ...prev, url }))}
        defaultTitle={contentForm.title}
      />

      {/* DIÁLOGO EDITAR TRILHA */}
      <Dialog open={isEditTrailDialogOpen} onOpenChange={setIsEditTrailDialogOpen}>
        <DialogContent className='rounded-card p-5 md:p-6 w-[95vw] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='text-lg font-bold text-foreground'>Editar detalhes da trilha</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label className="u-label">Título</Label>
              <Input placeholder="Ex.: Fundamentos de redação" className="h-10 rounded-control font-medium" value={editTrailForm.title} onChange={(e) => setEditTrailForm({ ...editTrailForm, title: e.target.value })} disabled={isSubmitting} />
            </div>
            <div className="space-y-1.5">
              <Label className="u-label">Matéria</Label>
              <Select value={editTrailForm.category} onValueChange={(v) => setEditTrailForm({ ...editTrailForm, category: v })} disabled={isSubmitting}>
                <SelectTrigger className="h-10 rounded-control font-medium">
                  <SelectValue placeholder="Selecione a matéria" />
                </SelectTrigger>
                <SelectContent className="rounded-control max-h-60">
                    {EDUCATIONAL_CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="u-label">Capa da trilha (arquivo ou link)</Label>
              <div className="flex flex-col gap-2">
                <Input 
                  type="file" 
                  accept="image/*"
                  onChange={e => setEditCoverFile(e.target.files?.[0] || null)} 
                  className="h-10 rounded-control border-2 border-dashed border-border cursor-pointer hover:border-primary/40 p-1.5 file:mr-4 file:py-1 file:px-4 file:rounded-control file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground"
                  disabled={isSubmitting || uploading}
                />
                {!editCoverFile && (
                  <Input placeholder="Ou cole o link da imagem..." className="h-10 rounded-control font-medium" value={editTrailForm.image_url} onChange={(e) => setEditTrailForm({ ...editTrailForm, image_url: e.target.value })} disabled={isSubmitting || uploading} />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="u-label">Descrição</Label>
              <Textarea placeholder="Qual o propósito deste conjunto de módulos?" className="min-h-[60px] rounded-control resize-none" value={editTrailForm.description} onChange={(e) => setEditTrailForm({ ...editTrailForm, description: e.target.value })} disabled={isSubmitting || uploading} />
            </div>
          </div>
          <DialogFooter className="mt-2 text-center items-center justify-center">
            <Button onClick={handleUpdateTrail} disabled={isSubmitting || !editTrailForm.title} className="w-full h-11 font-bold text-sm rounded-control">
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO EDITAR CAPÍTULO */}
      <Dialog open={isEditModuleDialogOpen} onOpenChange={setIsEditModuleDialogOpen}>
        <DialogContent className='rounded-card p-5 md:p-6 w-[95vw] sm:w-full max-w-lg'>
          <DialogHeader>
            <DialogTitle className='text-lg font-bold text-foreground'>Editar título do capítulo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label className="u-label">Título do capítulo</Label>
              <Input
                placeholder="Ex.: Introdução às funções"
                className="h-10 rounded-control font-medium"
                value={editModuleTitle}
                onChange={(e) => setEditModuleTitle(e.target.value)}
                disabled={isSubmitting}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateModule(); }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditModuleDialogOpen(false)} className="flex-1 h-11 rounded-control font-bold">
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateModule}
              disabled={isSubmitting || !editModuleTitle.trim()}
              className="flex-1 h-11 rounded-control font-bold"
            >
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO MÓDULO */}
      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
        <DialogContent className='rounded-card p-5 md:p-6 w-[95vw] sm:w-full max-w-sm mx-auto'>
          <DialogHeader>
            <DialogTitle className='text-lg font-bold text-foreground'>
              Novo capítulo
            </DialogTitle>
          </DialogHeader>
          <div className='py-2 space-y-2'>
            <Label className='u-label'>
              Título do capítulo
            </Label>
            <Input
              placeholder='Ex.: Introdução à matéria'
              value={moduleForm.title}
              onChange={(e) => setModuleForm({ title: e.target.value || '' })}
              disabled={isSubmitting}
              className='h-10 rounded-control font-medium text-sm'
            />
          </div>
          <DialogFooter className="mt-2">
            <Button
              onClick={handleAddModule}
              disabled={isSubmitting || !moduleForm.title}
              className='w-full h-11 font-bold rounded-control text-sm'
            >
              {isSubmitting ? (
                <Loader2 className='h-4 w-4 animate-spin mr-2' />
              ) : (
                'Criar capítulo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO CONTEÚDO (CRIAÇÃO/EDIÇÃO) */}
      <Dialog open={isContentDialogOpen} onOpenChange={(open) => {
        // Só reseta o estado quando fechar (não ao abrir)
        if (!open) {
          // Preserva o activeModuleRef para não perder o contexto
          setIsContentDialogOpen(false);
        } else {
          setIsContentDialogOpen(true);
        }
      }}>
        <DialogContent className='rounded-card max-h-[95vh] p-0 w-[95vw] sm:w-full max-w-4xl overflow-hidden mx-auto flex flex-col'>
          <div className="flex flex-col h-full max-h-[90vh]">
            <DialogHeader className="p-5 md:p-6 border-b border-border shrink-0 text-left">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-control bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {editingContentId ? <Pencil className="h-5 w-5 md:h-5 md:w-5" /> : <PlusCircle className="h-5 w-5 md:h-5 md:w-5" />}
                </div>
                <div>
                  <DialogTitle className='text-lg font-bold text-foreground leading-tight'>
                    {editingContentId ? 'Editar material' : 'Adicionar materiais'}
                  </DialogTitle>
                  <p className='text-muted-foreground text-sm mt-1'>
                    {editingContentId ? 'Altere os dados deste material.' : 'Monte a lista de materiais do capítulo e depois publique.'}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1 overflow-auto">
              <div className={`grid grid-cols-1 ${editingContentId ? '' : 'lg:grid-cols-2'} gap-0 h-full`}>
                <div className={`p-4 md:p-6 space-y-4 ${editingContentId ? '' : 'lg:border-r border-dashed border-border'} bg-muted/30`}>
                  <div className='space-y-3'>
                    <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                      <div className='space-y-1.5'>
                        <Label className='u-label'>
                          Tipo
                        </Label>
                        <Select
                          value={contentForm.type}
                          onValueChange={(v) =>
                            setContentForm((prev) => ({ ...prev, type: v }))
                          }
                          disabled={isSubmitting || uploading}
                        >
                          <SelectTrigger className='h-10 rounded-control bg-background font-medium text-sm'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className='rounded-control p-1'>
                            <SelectItem value='video' className='py-2 font-bold'>🎞️ Videoaula</SelectItem>
                            <SelectItem value='quiz' className='py-2 font-bold'>🧠 Quiz</SelectItem>
                            <SelectItem value='pdf' className='py-2 font-bold'>📄 PDF</SelectItem>
                            <SelectItem value='text' className='py-2 font-bold'>📝 Texto</SelectItem>
                            <SelectItem value='file' className='py-2 font-bold'>📎 Anexo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-1.5'>
                        <Label className='u-label flex items-center gap-2'>
                          Apostila
                        </Label>
                        <Select
                          value={contentForm.workbook_id}
                          onValueChange={(v) =>
                            setContentForm((prev) => ({ ...prev, workbook_id: v }))
                          }
                          disabled={isSubmitting || uploading}
                        >
                          <SelectTrigger className='h-10 rounded-control bg-background font-medium text-sm'>
                            <SelectValue placeholder="Nenhuma" />
                          </SelectTrigger>
                          <SelectContent className='rounded-control p-1 max-h-40'>
                            <SelectItem value="none" className='py-2 font-bold'>Sem apostila</SelectItem>
                            {libraryResources.map(res => {
                              const isBook = res.category?.startsWith('LIVRO|');
                              return (
                                <SelectItem key={res.id} value={res.id} className='py-2 font-bold'>
                                  {isBook ? '📖 Livro: ' : '📚 '}{res.title}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className='space-y-1.5'>
                      <Label className='u-label'>
                        Título do material
                      </Label>
                      <Input
                        placeholder='Ex.: Aula 01 — Conceitos básicos'
                        value={contentForm.title}
                        onChange={(e) =>
                          setContentForm((prev) => ({ ...prev, title: e.target.value || '' }))
                        }
                        disabled={isSubmitting || uploading}
                        className='h-10 rounded-control bg-background font-medium text-sm'
                      />
                    </div>

                    {contentForm.type === 'file' || contentForm.type === 'pdf' ? (
                      <div className='space-y-1.5'>
                        <Label className='u-label'>
                          Arquivo {editingContentId && '(vazio = manter o atual)'}
                        </Label>
                        <div className="relative group">
                          <Input
                            key={fileInputKey}
                            type='file'
                            accept={contentForm.type === 'pdf' ? '.pdf' : '*'}
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            disabled={isSubmitting || uploading}
                            className='h-10 rounded-control bg-background border-2 border-dashed border-border p-1.5 cursor-pointer transition-colors hover:border-primary/40 file:mr-2 file:py-1 file:px-3 file:rounded-control file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground text-xs'
                          />
                          <FileUp className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ) : (
                      <div className='space-y-1.5'>
                        <Label className='u-label'>
                          Link externo
                        </Label>
                        <div className="relative">
                          <Input
                            placeholder='https://...'
                            value={contentForm.url}
                            onChange={(e) =>
                              setContentForm((prev) => ({ ...prev, url: e.target.value || '' }))
                            }
                            disabled={isSubmitting || uploading}
                            className='h-10 rounded-control bg-background font-medium pl-10 text-sm'
                          />
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        {contentForm.type === 'video' && (
                          <button
                            type="button"
                            onClick={() => setYtModalOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground mt-1 ml-1 transition-colors"
                          >
                            <Youtube className="h-3.5 w-3.5" />
                            Ou publicar diretamente no YouTube
                          </button>
                        )}
                      </div>
                    )}

                    <div className='space-y-1.5'>
                      <Label className='u-label'>
                        Orientação para o aluno (opcional)
                      </Label>
                      <Textarea
                        placeholder='Oriente o aluno sobre como usar este material...'
                        value={contentForm.description}
                        onChange={(e) =>
                          setContentForm((prev) => ({
                            ...prev,
                            description: e.target.value || '',
                          }))
                        }
                        disabled={isSubmitting || uploading}
                        className='min-h-[50px] rounded-control bg-background resize-none text-sm p-3'
                      />
                    </div>

                    {!editingContentId && (
                      <Button
                        onClick={addToQueue}
                        disabled={isSubmitting || uploading || !contentForm.title || ((contentForm.type === 'file' || contentForm.type === 'pdf') && !file)}
                        variant='outline'
                        className='w-full h-11 rounded-control font-bold text-sm gap-2 mt-2'
                      >
                        {uploading ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : (
                          <PlusCircle className='h-4 w-4' />
                        )}
                        {uploading ? 'Enviando...' : 'Adicionar à lista'}
                      </Button>
                    )}
                  </div>
                </div>

                {!editingContentId && (
                  <div className='p-4 md:p-6 space-y-4 bg-card'>
                    <div className="flex items-center justify-between">
                      <h3 className='u-label flex items-center gap-2'>
                        <Layers className='h-4 w-4 text-primary' /> 
                        Lista para publicar
                      </h3>
                      <Badge variant="outline" className="font-bold text-[11px] px-2 tabular-nums">
                        {pendingItems.length}
                      </Badge>
                    </div>

                    <div className='space-y-2 min-h-[150px]'>
                      {pendingItems.length === 0 ? (
                        <EmptyState
                          compact
                          icon={Layout}
                          title='Nenhum material na lista'
                          description='Preencha o formulário e toque em "Adicionar à lista". Os itens aparecem aqui antes de publicar.'
                        />
                      ) : (
                        pendingItems.map((item) => (
                          <div
                            key={item.id}
                            className='flex items-center justify-between gap-2 p-3 rounded-control border border-border group'
                          >
                            <div className='flex items-center gap-3 overflow-hidden'>
                              <div
                                className='h-10 w-10 rounded-control flex items-center justify-center shrink-0 bg-primary/10 text-primary'>
                                {item.type === 'video' ? (
                                  <Video className='h-4 w-4' />
                                ) : (
                                  <FileText className='h-4 w-4' />
                                )}
                              </div>
                              <div className="min-w-0 pr-2">
                                <p className='font-semibold text-sm text-foreground truncate max-w-[180px]'>
                                  {item.title}
                                </p>
                                <Badge variant="outline" className="text-[10px] font-bold h-5 mt-1 text-muted-foreground">
                                  {tipoConteudo(item.type)}
                                </Badge>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFromQueue(item.id)}
                              aria-label='Tirar da lista'
                              className='h-8 w-8 rounded-control text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 shrink-0'
                            >
                              <X className='h-3 w-3' />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className='p-4 md:p-5 bg-muted/30 border-t border-border shrink-0 flex flex-col md:flex-row md:justify-between items-center gap-3'> 
              {/* Alerta de Item Não Salvo */}
              <div className="flex-1 w-full text-left">
                {!editingContentId && contentForm.title.trim() && (
                  <p className="text-xs font-semibold text-foreground bg-brand-yellow/30 p-2 rounded-control border border-foreground/15">
                    Você começou a preencher um item, mas ainda não tocou em "Adicionar à lista".
                  </p>
                )}
              </div>

              <Button
                onClick={() => {
                  if (!editingContentId && contentForm.title.trim()) {
                     toast({ title: 'Adicione o item à lista primeiro', variant: 'destructive', description: 'Toque em "Adicionar à lista" antes de publicar.' });
                     return;
                  }
                  editingContentId ? addToQueue() : handleBatchSaveContent(activeModuleId);
                }}
                disabled={isSubmitting || (!editingContentId && pendingItems.length === 0)}
                className='w-full md:w-auto h-11 font-bold text-sm rounded-control px-6'
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className='animate-spin h-4 w-4' /> 
                    <span>Salvando...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className='h-4 w-4' /> 
                    <span>{editingContentId ? 'Salvar alterações' : 'Publicar no capítulo'}</span>
                  </div>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
