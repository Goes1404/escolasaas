
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
import { fmtNumber, txt, VAZIO } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
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
      toast({ title: "Turmas unidas" });
      fetchData();
      setIsMergeOpen(false);
    } catch (e: any) {
      toast({ title: "Não foi possível concluir", description: e.message, variant: "destructive" });
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
      toast({ title: "Dados do aluno atualizados" });
      setEditingStudent(null);
      fetchData();
    } catch (e: any) {
      toast({ title: "Não foi possível concluir", description: e.message, variant: "destructive" });
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
      toast({ title: "Aluno removido" });
    } catch (e: any) {
      toast({ title: "Não foi possível concluir", description: e.message, variant: "destructive" });
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

  const openEdit = (student: any) => {
    setEditingStudent(student);
    setNewEmail(student.email || "");
    setNewInstitution(student.institution || "");
    setNewCourse(student.course || "");
    setNewExamTarget(student.exam_target || "ENEM");
  };

  const rowActions = (student: any) => (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" title="Ver desempenho" aria-label="Ver desempenho" asChild className="h-10 w-10 rounded-control">
        <Link href={`/dashboard/admin/students/${student.id}`}>
          <Eye className="h-4 w-4" />
        </Link>
      </Button>
      <Button variant="ghost" size="icon" title="Editar dados" aria-label="Editar dados" onClick={() => openEdit(student)} className="h-10 w-10 rounded-control">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Remover aluno"
        aria-label="Remover aluno"
        onClick={() => handleDeleteStudent(student.id)}
        className="h-10 w-10 rounded-control text-red-500 hover:bg-red-50 hover:text-red-600"
      >
        {deletingId === student.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );

  const segmentBadge = (student: any) => (
    <Badge variant="outline" className="font-bold uppercase text-[10px]">
      {txt(student.exam_target, "ENEM")}
    </Badge>
  );

  return (
    <div className="space-y-6 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Coordenação · alunos</p>
          <h1 className="u-page-title text-3xl mt-1">Turmas e alunos</h1>
          <p className="text-muted-foreground text-sm mt-2">Lista completa dos alunos, com agrupamento por turma e segmento (ETEC/ENEM).</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Dialog open={isMergeOpen} onOpenChange={setIsMergeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-control h-11 font-bold px-5 flex items-center justify-center gap-2">
                <GitMerge className="h-4 w-4" />
                <span>Juntar turmas</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-card p-6 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">Juntar turmas</DialogTitle>
                <DialogDescription className="text-sm">Move todos os alunos de uma turma para outra.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="u-label ml-1">Origem</Label>
                  <Select value={sourceCohortId} onValueChange={setSourceCohortId}>
                    <SelectTrigger className="h-11 rounded-control text-sm">
                      <SelectValue placeholder="Escolha a turma de origem..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="u-label ml-1">Destino</Label>
                  <Select value={destCohortId} onValueChange={setDestCohortId}>
                    <SelectTrigger className="h-11 rounded-control text-sm">
                      <SelectValue placeholder="Escolha a turma de destino..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts.map(c => <SelectItem key={c.id} value={c.id} disabled={c.id === sourceCohortId}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleMergeCohorts} disabled={isSubmitting || !sourceCohortId || !destCohortId} className="w-full h-11 font-bold rounded-control">
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Juntar turmas"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { icon: Users, label: "Total", sub: "Alunos na base", value: counts.total },
          { icon: GraduationCap, label: "ETEC", sub: "Preparatório ETEC", value: counts.etec },
          { icon: GraduationCap, label: "ENEM", sub: "Preparatório ENEM", value: counts.enem },
        ].map((k) => (
          <Card key={k.label} className="rounded-card p-4 sm:p-6">
            <div className="u-label flex items-center gap-2"><k.icon className="h-3.5 w-3.5 shrink-0" /> {k.label}</div>
            <p className="u-num text-2xl sm:text-3xl tabular-nums mt-2">{loading ? VAZIO : fmtNumber(k.value, 0, "0")}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
          </Card>
        ))}
      </div>

      <Card className="rounded-card overflow-hidden">
        <CardHeader className="p-4 md:p-6 border-b space-y-4">
          <CardTitle className="text-base font-bold text-foreground">
            Lista de alunos (<span className="tabular-nums">{filteredStudents.length}</span>)
          </CardTitle>
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
          {loading ? (
            <div className="h-40 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
              <p className="u-label">Carregando alunos…</p>
            </div>
          ) : pagedStudents.length === 0 ? (
            <div className="p-4 md:p-6">
              <EmptyState
                compact
                icon={Users}
                title={students.length === 0 ? "Nenhum aluno cadastrado" : "Nenhum aluno encontrado"}
                description={students.length === 0
                  ? "Cadastre o primeiro aluno para ele aparecer nesta lista."
                  : "Nenhum aluno corresponde à busca e aos filtros escolhidos."}
                action={students.length === 0
                  ? { label: "Cadastrar aluno", href: "/dashboard/admin/users/new", icon: PlusCircle }
                  : { label: "Limpar filtros", onClick: () => { setSearchTerm(""); setCourseFilter(""); setExamTargetFilter(""); setSelectedPoloName(null); } }}
              />
            </div>
          ) : (
            <>
              <ul className="sm:hidden divide-y">
                {pagedStudents.map((student) => (
                  <li key={student.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground break-words">{txt(student.name, "Aluno sem nome")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">{txt(student.institution, "Escola não definida")}</p>
                      </div>
                      {segmentBadge(student)}
                    </div>
                    {rowActions(student)}
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="px-6 u-label min-w-[140px]">Aluno</TableHead>
                      <TableHead className="u-label min-w-[120px]">Escola / polo</TableHead>
                      <TableHead className="u-label min-w-[80px]">Segmento</TableHead>
                      <TableHead className="text-right px-6 u-label">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedStudents.map((student) => (
                      <TableRow key={student.id} className="hover:bg-muted/20">
                        <TableCell className="px-6 py-3 font-semibold text-foreground">{txt(student.name, "Aluno sem nome")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{txt(student.institution, "Não definida")}</TableCell>
                        <TableCell>{segmentBadge(student)}</TableCell>
                        <TableCell className="text-right px-6">{rowActions(student)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {!loading && hasMore && (
            <div className="p-6 flex justify-center border-t">
              <Button
                variant="outline"
                onClick={() => setDisplayCount(prev => prev + 100)}
                className="rounded-control font-bold px-8 h-11"
              >
                Carregar mais alunos (+100)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingStudent} onOpenChange={() => setEditingStudent(null)}>
        <DialogContent className="rounded-card p-0 overflow-hidden max-w-md">
          <DialogHeader className="p-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-control bg-primary/10 flex items-center justify-center font-bold text-primary text-lg shrink-0">
                {editingStudent?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                  Editar aluno
                </DialogTitle>
                <DialogDescription className="text-sm mt-0.5 text-muted-foreground">
                  {editingStudent?.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="u-label ml-1">E-mail</Label>
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="h-12 bg-muted/30 border-none rounded-control font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="u-label ml-1">Escola / Polo</Label>
              <Input
                value={newInstitution}
                onChange={(e) => setNewInstitution(e.target.value)}
                placeholder="Nome da escola ou polo"
                className="h-12 bg-muted/30 border-none rounded-control font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="u-label ml-1">Sala / Turma</Label>
              <Input
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                placeholder="Ex: 3ª Série A, Turma Manhã"
                className="h-12 bg-muted/30 border-none rounded-control font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="u-label ml-1">Segmento</Label>
              <div className="flex gap-3">
                {['ENEM', 'ETEC'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setNewExamTarget(opt)}
                    aria-pressed={newExamTarget === opt}
                    className={`flex-1 h-11 rounded-control font-bold text-sm transition-colors border ${
                      newExamTarget === opt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <Button
              onClick={handleUpdateStudent}
              disabled={isSubmitting}
              className="w-full h-11 font-bold rounded-control"
            >
              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
