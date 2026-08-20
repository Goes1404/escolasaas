"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ExternalLink,
  Upload,
  FileText,
  X,
  AlertCircle,
  Trash2
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DOC_TYPES: Record<string, { label: string; color: string }> = {
  atestado:               { label: 'Atestado Médico',           color: 'bg-red-100 text-red-700' },
  rg:                     { label: 'RG',                        color: 'bg-blue-100 text-blue-700' },
  cpf:                    { label: 'CPF',                       color: 'bg-indigo-100 text-indigo-700' },
  historico:              { label: 'Histórico Escolar',         color: 'bg-purple-100 text-purple-700' },
  comprovante_residencia: { label: 'Comprovante de Residência', color: 'bg-green-100 text-green-700' },
  certidao:               { label: 'Certidão',                  color: 'bg-yellow-100 text-yellow-700' },
  comprovante_renda:      { label: 'Comprovante de Renda',      color: 'bg-orange-100 text-orange-700' },
  outro:                  { label: 'Outro',                     color: 'bg-slate-100 text-slate-700' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pendente:  { label: 'Aguardando',  color: 'bg-amber-100 text-amber-700' },
  aprovado:  { label: 'Aprovado',    color: 'bg-emerald-100 text-emerald-700' },
  rejeitado: { label: 'Rejeitado',   color: 'bg-red-100 text-red-700' },
};

interface StudentUpload {
  id: string;
  doc_type: string;
  title: string;
  file_url: string;
  file_path: string;
  status: string;
  notes: string | null;
  uploaded_at: string;
}

export default function StudentDocumentsUploadPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [uploads, setUploads] = useState<StudentUpload[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('outro');
  const [uploadTitle, setUploadTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUploads = useCallback(async () => {
    if (!user) return;
    setLoadingUploads(true);
    const { data } = await supabase
      .from('student_uploads')
      .select('id,doc_type,title,file_url,file_path,status,notes,uploaded_at')
      .eq('student_id', user.id)
      .order('uploaded_at', { ascending: false });
    setUploads(data || []);
    setLoadingUploads(false);
  }, [user]);

  useEffect(() => {
    fetchUploads();
  }, [user, fetchUploads]);

  const handleUpload = async () => {
    if (!user || !selectedFile) {
      toast({ title: 'Selecione um arquivo', variant: 'destructive' }); return;
    }
    if (!uploadTitle.trim()) {
      toast({ title: 'Informe um título para o documento', variant: 'destructive' }); return;
    }
    setUploading(true);
    try {
      const ext = selectedFile.name.split('.').pop() || 'pdf';
      const filePath = `${user.id}/${Date.now()}_${uploadDocType}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('student-documents')
        .upload(filePath, selectedFile, { upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from('student-documents')
        .getPublicUrl(filePath);

      const { error: dbErr } = await supabase.from('student_uploads').insert({
        student_id: user.id,
        student_name: profile?.name || profile?.full_name || null,
        doc_type: uploadDocType,
        title: uploadTitle.trim(),
        file_url: urlData.publicUrl,
        file_path: filePath,
        status: 'pendente',
      });
      if (dbErr) throw dbErr;

      toast({ title: 'Documento enviado com sucesso!' });
      setUploadTitle('');
      setSelectedFile(null);
      setUploadDocType('outro');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchUploads();
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteUpload = async (upload: StudentUpload) => {
    if (upload.status !== 'pendente') {
      toast({ title: 'Não é possível remover documentos já revisados', variant: 'destructive' }); return;
    }
    try {
      await supabase.storage.from('student-documents').remove([upload.file_path]);
      await supabase.from('student_uploads').delete().eq('id', upload.id);
      setUploads(prev => prev.filter(u => u.id !== upload.id));
      toast({ title: 'Documento removido.' });
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 px-1">
      <section className="bg-primary p-8 md:p-12 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
        <div className="relative z-10 space-y-4">
          <div className="space-y-2">
            <Badge className="bg-accent text-accent-foreground border-none font-black text-[9px] px-3 py-1 uppercase tracking-widest mb-2">Envios Oficiais</Badge>
            <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter leading-none">Enviar <span className="text-white">Documentos</span></h1>
            <p className="text-sm md:text-lg text-white/90 font-medium italic">Envie seus atestados, comprovantes e outros documentos para a secretaria.</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário de Upload */}
        <div className="lg:col-span-1">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden sticky top-4">
            <CardHeader className="bg-primary p-8">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                <Upload className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-2xl font-black italic text-white leading-none">Enviar Documento</CardTitle>
              <CardDescription className="text-white/70 font-medium italic text-sm mt-1">
                Envie documentos em formato PDF ou Imagem.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tipo de Documento</Label>
                <Select value={uploadDocType} onValueChange={setUploadDocType}>
                  <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {Object.entries(DOC_TYPES).map(([val, meta]) => (
                      <SelectItem key={val} value={val} className="font-bold text-xs">{meta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Título / Descrição</Label>
                <Input
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="Ex: Atestado médico 20/05/2026"
                  className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Arquivo (PDF ou imagem)</Label>
                <label className="flex flex-col items-center justify-center h-28 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  {selectedFile ? (
                    <div className="flex items-center gap-2 p-4 text-center">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-xs font-bold text-primary truncate max-w-[180px]">{selectedFile.name}</span>
                      <button type="button" onClick={e => { e.preventDefault(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                        <X className="h-4 w-4 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-1">
                      <Upload className="h-6 w-6 text-primary/40 mx-auto" />
                      <p className="text-[11px] font-bold text-slate-400">Clique para selecionar</p>
                      <p className="text-[9px] text-slate-300 font-medium uppercase tracking-widest">PDF · JPG · PNG · WEBP · Máx 10MB</p>
                    </div>
                  )}
                </label>
              </div>

              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl border-none text-sm"
              >
                {uploading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Upload className="h-5 w-5 mr-2" />}
                Enviar para a Secretaria
              </Button>

              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                  Seus documentos ficam disponíveis para revisão da secretaria. Documentos pendentes podem ser removidos por você.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Uploads */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-primary italic">Documentos Enviados</h2>
            {uploads.length > 0 && (
              <Badge className="bg-primary/10 text-primary border-none font-black text-xs">
                {uploads.length} {uploads.length === 1 ? 'arquivo' : 'arquivos'}
              </Badge>
            )}
          </div>

          {loadingUploads ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : uploads.length === 0 ? (
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white">
              <CardContent className="py-16 flex flex-col items-center text-center gap-3">
                <div className="h-16 w-16 rounded-3xl bg-primary/5 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-primary/30" />
                </div>
                <p className="font-black text-primary/40 italic text-sm">Nenhum documento enviado ainda</p>
                <p className="text-xs text-muted-foreground font-medium">Envie seus documentos usando o formulário ao lado.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {uploads.map(upload => {
                const typeMeta = DOC_TYPES[upload.doc_type] || DOC_TYPES.outro;
                const statusMeta = STATUS_META[upload.status] || STATUS_META.pendente;
                return (
                  <Card key={upload.id} className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden hover:shadow-2xl transition-all duration-200">
                    <CardContent className="p-5 flex items-start gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0">
                        <FileText className="h-6 w-6 text-primary/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-sm text-primary italic truncate">{upload.title}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge className={`${statusMeta.color} border-none font-black text-[9px] uppercase px-2`}>
                              {statusMeta.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className={`${typeMeta.color} border-none font-bold text-[9px] px-2`}>
                            {typeMeta.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {format(new Date(upload.uploaded_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        {upload.notes && (
                          <p className="text-[11px] text-slate-500 mt-2 p-2.5 bg-slate-50 rounded-xl font-medium border border-slate-100">
                            <span className="font-black text-primary/60">Nota da secretaria:</span> {upload.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          title="Visualizar documento"
                          className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <a href={upload.file_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        {upload.status === 'pendente' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Remover documento"
                            onClick={() => handleDeleteUpload(upload)}
                            className="h-9 w-9 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
