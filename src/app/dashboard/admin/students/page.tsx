
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Send,
  Loader2,
  Users,
  GraduationCap,
  ArrowUpRight,
  PlusCircle,
  Database,
  Trash2,
  Settings2,
  Building2,
  X,
  Sparkles,
  MapPin,
  Layers,
  ExternalLink,
  GitMerge,
  ZapOff,
  Eye,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { StudentFilterBar, distinctOptions } from "@/components/secretary/StudentFilterBar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminStudentsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [examTargetFilter, setExamTargetFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(50); // Pagination
  
  const [students, setStudents] = useState<any[]>([]);

  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [selectedPoloName, setSelectedPoloName] = useState<string | null>(null);

  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [newInstitution, setNewInstitution] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newExamTarget, setNewExamTarget] = useState("");

  const [sourceCohortId, setSourceCohortId] = useState<string>("");
  const [destCohortId, setDestCohortId] = useState<string>("");
  const [cohorts, setCohorts] = useState<any[]>([]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: studentProfiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('name')
        .limit(500);

      if (pError) throw pError;

      setStudents(studentProfiles || []);

      const { data: classData } = await supabase.from('classes').select('*');
      if (classData) setCohorts(classData);

    } catch (e) {
      console.error("Erro buscar alunos:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleMergeCohorts = async () => {
    if (!sourceCohortId || !destCohortId || sourceCohortId === destCohortId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ class_id: destCohortId })
        .eq('class_id', sourceCohortId);
      if (error) throw error;
      toast({ title: "Grupos Mesclados!" });
      fetchData();
      setIsMergeOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    setIsSubmitting(true);
    try {
      const updates: Record<string, string> = {};
      if (newEmail.trim()) updates.email = newEmail.trim();
      if (newInstitution.trim()) updates.institution = newInstitution.trim();
      if (newCourse.trim()) updates.course = newCourse.trim();
      if (newExamTarget) updates.exam_target = newExamTarget;

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', editingStudent.id);
      if (error) throw error;
      toast({ title: "Dados do aluno atualizados!" });
      setEditingStudent(null);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      setStudents(prev => prev.filter(s => s.id !== id));
      toast({ title: "Removido!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const counts = useMemo(() => {
    const total = students.length;
    const etec = students.filter(s => (s.exam_target || '').toLowerCase().includes('etec')).length;
    const enem = students.filter(s => (s.exam_target || '').toLowerCase().includes('enem')).length;
    return { total, etec, enem };
  }, [students]);

  const courseOptions = useMemo(() => distinctOptions(students, "course"), [students]);
  const institutionOptions = useMemo(() => distinctOptions(students, "institution"), [students]);

  const filteredStudents = students.filter(s => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (s.name || '').toLowerCase().includes(searchLower) ||
      (s.email || '').toLowerCase().includes(searchLower);
    const matchesPolo = !selectedPoloName || (s.institution || '').toLowerCase().includes(selectedPoloName.toLowerCase());
    const matchesCourse = !courseFilter || (s.course || '') === courseFilter;
    const matchesExamTarget = !examTargetFilter || (s.exam_target || '').toUpperCase().includes(examTargetFilter);
    return matchesSearch && matchesPolo && matchesCourse && matchesExamTarget;
  });

  const pagedStudents = filteredStudents.slice(0, displayCount);
  const hasMore = displayCount < filteredStudents.length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-primary italic leading-none">Gestão de Turmas & Lista Mestra</h1>
          <p className="text-muted-foreground font-medium italic">Administração centralizada e agrupamento de alunos (ETEC/ENEM).</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Dialog open={isMergeOpen} onOpenChange={setIsMergeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-2xl h-14 border-dashed border-primary/20 text-primary font-black px-6 hover:bg-primary/5 transition-all flex items-center justify-center gap-3">
                <GitMerge className="h-5 w-5 text-accent" />
                <span>Mesclar Grupos</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2rem] p-6 bg-white max-w-lg border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black italic text-primary">Mesclar Cohorts</DialogTitle>
                <DialogDescription className="italic text-xs">Isso moverá todos os alunos de uma turma para outra.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase opacity-40 ml-2">Origem</Label>
                  <Select value={sourceCohortId} onValueChange={setSourceCohortId}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none font-bold italic text-sm">
                      <SelectValue placeholder="Selecione a origem..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase opacity-40 ml-2">Destino</Label>
                  <Select value={destCohortId} onValueChange={setDestCohortId}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none font-bold italic text-sm">
                      <SelectValue placeholder="Selecione o destino..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts.map(c => <SelectItem key={c.id} value={c.id} disabled={c.id === sourceCohortId}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleMergeCohorts} disabled={isSubmitting || !sourceCohortId || !destCohortId} className="w-full h-12 bg-primary text-white font-black rounded-xl shadow-xl">
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Unificar Grupos"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden p-6 md:p-8">
            <div className="flex items-center justify-between">
              <Users className="h-8 w-8 opacity-40" />
              <Badge className="bg-accent text-accent-foreground font-black">TOTAL</Badge>
            </div>
            <div className="mt-6">
              <p className="text-5xl font-black italic">{counts.total}</p>
              <p className="text-[10px] font-black uppercase tracking-widest mt-2 opacity-60">Alunos na Base</p>
            </div>
          </Card>

          <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden p-6 md:p-8 border-l-[12px] border-orange-500">
            <div className="flex items-center justify-between font-black">
              <GraduationCap className="h-8 w-8 text-orange-500" />
              <Badge className="bg-orange-100 text-orange-700">ETEC</Badge>
            </div>
            <div className="mt-6">
              <p className="text-5xl font-black italic text-primary">{counts.etec}</p>
              <p className="text-[10px] font-black uppercase tracking-widest mt-2 text-muted-foreground">Preparatório ETEC</p>
            </div>
          </Card>

          <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden p-6 md:p-8 border-l-[12px] border-blue-500">
            <div className="flex items-center justify-between font-black">
              <ZapOff className="h-8 w-8 text-blue-500" />
              <Badge className="bg-blue-100 text-blue-700">ENEM</Badge>
            </div>
            <div className="mt-6">
              <p className="text-5xl font-black italic text-primary">{counts.enem}</p>
              <p className="text-[10px] font-black uppercase tracking-widest mt-2 text-muted-foreground">Preparatório ENEM</p>
            </div>
          </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
        <CardHeader className="p-4 md:p-8 border-b border-muted/10 space-y-4">
          <CardTitle className="text-xl font-black text-primary italic">Lista Mestra de Alunos ({filteredStudents.length})</CardTitle>
          <StudentFilterBar
            search={searchTerm}
            onSearchChange={setSearchTerm}
            course={courseFilter}
            onCourseChange={setCourseFilter}
            courseOptions={courseOptions}
            institution={selectedPoloName || ""}
            onInstitutionChange={(v) => setSelectedPoloName(v || null)}
            institutionOptions={institutionOptions}
            examTarget={examTargetFilter}
            onExamTargetChange={setExamTargetFilter}
            resultCount={filteredStudents.length}
            totalCount={students.length}
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="h-12 md:h-16">
                <TableHead className="px-4 md:px-8 font-black uppercase text-[10px] min-w-[140px]">Estudante</TableHead>
                <TableHead className="font-black uppercase text-[10px] min-w-[120px] hidden sm:table-cell">Instituição / Escola</TableHead>
                <TableHead className="font-black uppercase text-[10px] min-w-[80px]">Segmento</TableHead>
                <TableHead className="text-right px-4 md:px-8 font-black uppercase text-[10px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></TableCell></TableRow>
              ) : pagedStudents.map((student) => (
                <TableRow key={student.id} className="h-16 hover:bg-muted/10 transition-colors">
                  <TableCell className="px-4 md:px-8 font-black text-primary italic">{student.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50 font-bold uppercase text-[9px]">{student.institution || 'Não definido'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`font-black uppercase text-[9px] ${student.exam_target?.includes('ETEC') ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'}`}>
                      {student.exam_target || 'ENEM'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-4 md:px-8">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ver desempenho"
                        asChild
                        className="h-10 w-10 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Link href={`/dashboard/admin/students/${student.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar dados"
                        onClick={() => { setEditingStudent(student); setNewEmail(student.email || ""); setNewInstitution(student.institution || ""); setNewCourse(student.course || ""); setNewExamTarget(student.exam_target || "ENEM"); }}
                        className="h-10 w-10 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remover aluno"
                        onClick={() => handleDeleteStudent(student.id)}
                        className="h-10 w-10 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        {deletingId === student.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>

          {hasMore && (
            <div className="p-8 flex justify-center">
              <Button 
                variant="outline" 
                onClick={() => setDisplayCount(prev => prev + 100)}
                className="rounded-2xl border-dashed border-primary/20 font-black italic px-12 hover:bg-primary/5 h-14"
              >
                Carregar Mais Alunos (+100)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingStudent} onOpenChange={() => setEditingStudent(null)}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden max-w-md">
          <DialogHeader className="p-8 pb-4 bg-primary/5 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center font-black text-white text-lg shadow">
                {editingStudent?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <DialogTitle className="text-xl font-black italic text-primary leading-none uppercase tracking-tight">
                  Editar Aluno
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5 font-medium text-muted-foreground">
                  {editingStudent?.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">E-mail</Label>
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="h-12 bg-muted/30 border-none rounded-xl font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Escola / Polo</Label>
              <Input
                value={newInstitution}
                onChange={(e) => setNewInstitution(e.target.value)}
                placeholder="Nome da escola ou polo"
                className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Sala / Turma</Label>
              <Input
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                placeholder="Ex: 3ª Série A, Turma Manhã"
                className="h-12 bg-muted/30 border-none rounded-xl font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Segmento</Label>
              <div className="flex gap-3">
                {['ENEM', 'ETEC'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setNewExamTarget(opt)}
                    className={`flex-1 h-12 rounded-xl font-black text-sm transition-all border-2 ${
                      newExamTarget === opt
                        ? opt === 'ETEC'
                          ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200'
                          : 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-200'
                        : 'bg-white border-muted text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-8 pb-8">
            <Button
              onClick={handleUpdateStudent}
              disabled={isSubmitting}
              className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 uppercase tracking-widest text-xs transition-all active:scale-95"
            >
              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
