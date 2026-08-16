"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Loader2, 
  Search, 
  Printer, 
  GraduationCap, 
  FileCheck,
  CheckCircle,
  HelpCircle,
  AlertCircle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { distinctOptions } from "@/components/secretary/StudentFilterBar";

export default function SecretaryDocumentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  
  // Estados do formulário
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [docType, setDocType] = useState("declaracao");
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  
  // Campos adicionais
  const [studentCpf, setStudentCpf] = useState("");
  const [studentRg, setStudentRg] = useState("");
  const [workload, setWorkload] = useState("120"); // para certificados
  const [observations, setObservations] = useState("");

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, course, institution, birth_date")
        .eq("role", "student")
        .order("name");

      if (error) throw error;
      setStudents(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao buscar alunos", description: err.message, variant: "destructive" });
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Efeito para preencher automaticamente se houvesse no banco (mockup por enquanto)
  useEffect(() => {
    if (selectedStudent) {
      setStudentCpf("");
      setStudentRg("");
      setObservations("");
    }
  }, [selectedStudentId]);

  // Função para abrir o layout de impressão A4 em outra aba
  const handleGeneratePrint = async () => {
    if (!selectedStudent) {
      toast({ title: "Erro", description: "Selecione um estudante primeiro.", variant: "destructive" });
      return;
    }

    // Dados extras conforme o tipo de documento
    let attendanceInfo: { present: number; total: number; pct: number } | null = null;
    if (docType === "frequencia") {
      const { data: recs } = await supabase
        .from("attendance_records")
        .select("status")
        .eq("student_id", selectedStudent.id);
      const total = recs?.length || 0;
      const present = (recs || []).filter((r: any) => r.status === "presente").length;
      attendanceInfo = { present, total, pct: total > 0 ? Math.round((present / total) * 100) : 0 };
    }

    let guardian: { name: string; relationship: string | null; cpf: string | null } | null = null;
    if (docType === "responsavel") {
      const { data: gs } = await supabase
        .from("student_guardians")
        .select("name, relationship, cpf, is_primary")
        .eq("student_id", selectedStudent.id)
        .order("is_primary", { ascending: false })
        .limit(1);
      if (gs && gs.length > 0) guardian = gs[0] as any;
      if (!guardian) {
        toast({ title: "Sem responsável cadastrado", description: "Cadastre um responsável no perfil do aluno antes de emitir esta declaração.", variant: "destructive" });
        return;
      }
    }

    const todayStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const birthStr = selectedStudent.birth_date
      ? format(new Date(selectedStudent.birth_date + "T12:00:00"), "dd/MM/yyyy")
      : "___/___/______";

    // Segurança: escapa qualquer valor vindo do banco/UI antes de injetar no HTML de impressão.
    // Evita XSS armazenado (ex.: um nome ou observação com <script> executaria na janela de impressão).
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    let title = "";
    let contentHtml = "";

    if (docType === "declaracao") {
      title = "Declaração de Matrícula";
      contentHtml = `
        <p>Declaramos, para os devidos fins de direito, que o(a) estudante <strong>${esc(selectedStudent.name).toUpperCase()}</strong>,
        nascido(a) em <strong>${esc(birthStr)}</strong>, inscrito(a) no CPF sob o nº <strong>${esc(studentCpf) || "___________________"}</strong>
        e no RG sob o nº <strong>${esc(studentRg) || "___________________"}</strong>, encontra-se regularmente matriculado(a)
        e frequentando as aulas do curso preparatório de <strong>${esc(selectedStudent.course) || "Ensino Geral"}</strong>
        no polo <strong>${esc(selectedStudent.institution) || "Unidade Geral"}</strong>.</p>

        <p>Por ser verdade, firmamos o presente documento para que surta seus devidos efeitos legais.</p>
      `;
    } else if (docType === "frequencia") {
      title = "Declaração de Frequência";
      const freqLine = attendanceInfo && attendanceInfo.total > 0
        ? `Até a presente data, o(a) estudante registra <strong>${attendanceInfo.present}</strong> presença(s) em
           <strong>${attendanceInfo.total}</strong> aula(s) computada(s), correspondendo a uma frequência de
           <strong>${attendanceInfo.pct}%</strong>.`
        : `A frequência do(a) estudante encontra-se em acompanhamento pela secretaria.`;
      contentHtml = `
        <p>Declaramos, para os devidos fins, que o(a) estudante <strong>${esc(selectedStudent.name).toUpperCase()}</strong>,
        matriculado(a) no curso preparatório de <strong>${esc(selectedStudent.course) || "Ensino Geral"}</strong>
        no polo <strong>${esc(selectedStudent.institution) || "Unidade Geral"}</strong>, frequenta regularmente as
        atividades letivas.</p>

        <p>${freqLine}</p>

        <p>Por ser expressão da verdade, firmamos a presente declaração.</p>
      `;
    } else if (docType === "responsavel") {
      title = "Declaração para o Responsável";
      contentHtml = `
        <p>Declaramos, a pedido e para os devidos fins, que o(a) estudante <strong>${esc(selectedStudent.name).toUpperCase()}</strong>,
        nascido(a) em <strong>${esc(birthStr)}</strong>, encontra-se regularmente matriculado(a) no curso preparatório de
        <strong>${esc(selectedStudent.course) || "Ensino Geral"}</strong> no polo
        <strong>${esc(selectedStudent.institution) || "Unidade Geral"}</strong>.</p>

        <p>Fica esta declaração aos cuidados de seu(sua) responsável legal
        <strong>${esc(guardian?.name).toUpperCase()}</strong>${guardian?.relationship ? ` (${esc(guardian.relationship)})` : ""}${guardian?.cpf ? `, CPF nº <strong>${esc(guardian.cpf)}</strong>` : ""}.</p>

        <p>Por ser verdade, firmamos o presente documento para que surta seus devidos efeitos.</p>
      `;
    } else if (docType === "certificado") {
      title = "Certificado de Conclusão";
      contentHtml = `
        <p>Certificamos que o(a) estudante <strong>${esc(selectedStudent.name).toUpperCase()}</strong> concluiu com êxito
        as trilhas de aprendizado e atividades complementares no curso preparatório de <strong>${esc(selectedStudent.course) || "Ensino Geral"}</strong>,
        realizado no polo <strong>${esc(selectedStudent.institution) || "Unidade Geral"}</strong>, com carga horária total
        de <strong>${esc(workload)} horas</strong>.</p>

        <p>O presente certificado atesta o empenho acadêmico e a prontidão do estudante nas competências avaliadas.</p>
      `;
    } else {
      title = "Ficha de Acompanhamento";
      contentHtml = `
        <p>Documento de acompanhamento da secretaria escolar referente ao estudante <strong>${esc(selectedStudent.name).toUpperCase()}</strong>,
        regularmente matriculado(a) na turma <strong>${esc(selectedStudent.course) || "Ensino Geral"}</strong>.</p>

        <p><strong>Observações da Secretaria:</strong></p>
        <p style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; font-style: italic;">
          ${esc(observations) || "Nenhuma observação ou ocorrência registrada para este período acadêmico."}
        </p>
      `;
    }

    // Cria a janela de impressão
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${esc(title)} — ${esc(selectedStudent.name)}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              padding: 50px;
              color: #1e293b;
              line-height: 1.8;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              border: 1px solid #e2e8f0;
              padding: 60px;
              border-radius: 8px;
              position: relative;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 50px;
              border-bottom: 2px solid #ea580c;
              padding-bottom: 25px;
            }
            .logo-text {
              font-size: 26px;
              font-weight: 800;
              color: #ea580c;
              font-style: italic;
              letter-spacing: -1px;
            }
            .sub-header {
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 2px;
              color: #64748b;
              font-weight: 800;
              margin-top: 5px;
            }
            .doc-title {
              text-align: center;
              font-size: 22px;
              font-weight: 800;
              text-transform: uppercase;
              margin-bottom: 40px;
              color: #0f172a;
              letter-spacing: 0.5px;
            }
            .content {
              font-size: 14px;
              text-align: justify;
              margin-bottom: 60px;
              color: #334155;
            }
            .content p {
              margin-bottom: 20px;
              text-indent: 30px;
            }
            .footer {
              text-align: center;
              margin-top: 80px;
            }
            .date-place {
              font-size: 12px;
              color: #64748b;
              margin-bottom: 50px;
            }
            .signature-line {
              width: 250px;
              border-top: 1px solid #94a3b8;
              margin: 0 auto 10px auto;
            }
            .signature-title {
              font-size: 11px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .watermark {
              position: absolute;
              bottom: 20px;
              right: 20px;
              font-size: 8px;
              color: #cbd5e1;
              font-weight: 600;
              letter-spacing: 1px;
            }
            @media print {
              body {
                padding: 0;
              }
              .container {
                border: none;
                box-shadow: none;
                padding: 40px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo-text">PLATAFORMA</div>
              <div class="sub-header">Secretaria Geral e Atendimento Acadêmico</div>
            </div>
            
            <div class="doc-title">${title}</div>
            
            <div class="content">
              ${contentHtml}
            </div>
            
            <div class="footer">
              <div class="date-place">São Paulo, ${todayStr}.</div>
              <div class="signature-line"></div>
              <div class="signature-title">Secretaria Acadêmica</div>
            </div>

            <div class="watermark">Código de Verificação: DOC-${Math.floor(100000 + Math.random() * 900000)}</div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const courseOptions = useMemo(() => distinctOptions(students, "course"), [students]);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (!courseFilter || (s.course || "") === courseFilter)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1">
      {/* Cabeçalho */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-primary italic leading-none">
          Central de Documentos
        </h1>
        <p className="text-muted-foreground font-medium italic text-sm">
          Gere declarações e certificados com validade interna instantaneamente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel de Seleção */}
        <Card className="lg:col-span-1 border-none shadow-2xl rounded-[2.5rem] bg-white p-6 space-y-5">
          <h2 className="text-lg font-black text-primary italic leading-none flex items-center gap-2">
            <FileText className="h-5 w-5" /> Tipo & Estudante
          </h2>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Tipo do Documento</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="declaracao" className="font-bold text-xs">Declaração de Matrícula</SelectItem>
                  <SelectItem value="frequencia" className="font-bold text-xs">Declaração de Frequência</SelectItem>
                  <SelectItem value="responsavel" className="font-bold text-xs">Declaração para Responsável</SelectItem>
                  <SelectItem value="certificado" className="font-bold text-xs">Certificado de Conclusão</SelectItem>
                  <SelectItem value="historico" className="font-bold text-xs">Ficha / Ocorrência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Buscar Aluno</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Pesquisar..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-10 pl-9 pr-3 rounded-xl bg-slate-50 border-none text-xs"
                />
              </div>
            </div>

            {courseOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Turma</Label>
                <Select value={courseFilter || "__all__"} onValueChange={(v) => setCourseFilter(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none font-bold text-xs">
                    <SelectValue placeholder="Todas as turmas" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="__all__" className="font-bold text-xs">Todas as turmas</SelectItem>
                    {courseOptions.map((c) => (
                      <SelectItem key={c} value={c} className="font-bold text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Estudante *</Label>
              {loadingStudents ? (
                <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : (
                <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-xl p-2 space-y-1 bg-slate-50/50">
                  {filteredStudents.map(s => (
                    <div 
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`p-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold ${
                        selectedStudentId === s.id 
                          ? 'bg-primary text-white' 
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Formulário de Parâmetros e Visualização */}
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[3rem] bg-white p-8 flex flex-col justify-between">
          {selectedStudent ? (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Preenchimento de Parâmetros</span>
                    <h3 className="font-extrabold text-slate-800 text-lg leading-snug italic mt-0.5">{selectedStudent.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">
                      Curso: {selectedStudent.course || 'Ensino Geral'} • Polo: {selectedStudent.institution || 'Geral'}
                    </p>
                  </div>
                  <Badge className="bg-primary/5 text-primary border-none font-bold text-xs uppercase px-3 py-1">
                    {docType === 'declaracao' ? 'Declaração' : docType === 'frequencia' ? 'Frequência' : docType === 'responsavel' ? 'Responsável' : docType === 'certificado' ? 'Certificado' : 'Histórico'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {docType === "declaracao" && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">CPF do Aluno</Label>
                        <Input 
                          placeholder="Ex: 000.000.000-00" 
                          value={studentCpf}
                          onChange={e => setStudentCpf(e.target.value)}
                          className="h-12 bg-slate-50 border-none rounded-xl font-bold text-sm" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">RG do Aluno</Label>
                        <Input 
                          placeholder="Ex: 00.000.000-0" 
                          value={studentRg}
                          onChange={e => setStudentRg(e.target.value)}
                          className="h-12 bg-slate-50 border-none rounded-xl font-bold text-sm" 
                        />
                      </div>
                    </>
                  )}

                  {docType === "certificado" && (
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Carga Horária (Horas)</Label>
                      <Input 
                        type="number"
                        placeholder="Ex: 120" 
                        value={workload}
                        onChange={e => setWorkload(e.target.value)}
                        className="h-12 bg-slate-50 border-none rounded-xl font-bold text-sm" 
                      />
                    </div>
                  )}

                  {docType === "responsavel" && (
                    <div className="md:col-span-2 flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                      <HelpCircle className="h-4 w-4 text-blue-500 shrink-0" />
                      <p className="text-[11px] font-semibold text-blue-700">
                        Os dados do responsável (nome, parentesco, CPF) são puxados do perfil do aluno. Cadastre-os lá se ainda não houver.
                      </p>
                    </div>
                  )}

                  {docType === "frequencia" && (
                    <div className="md:col-span-2 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <p className="text-[11px] font-semibold text-emerald-700">
                        A frequência (presenças / total de aulas) é calculada automaticamente a partir do diário de classe.
                      </p>
                    </div>
                  )}

                  {docType === "historico" && (
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Observações / Ocorrência</Label>
                      <textarea 
                        rows={4}
                        placeholder="Preencha as ocorrências ou observações do estudante..." 
                        value={observations}
                        onChange={e => setObservations(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-semibold focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 mt-8 flex gap-3">
                <Button 
                  onClick={handleGeneratePrint} 
                  className="flex-1 h-14 bg-primary text-white font-black text-xs uppercase shadow-xl hover:scale-[1.01] transition-all border-none"
                >
                  <Printer className="mr-2 h-4 w-4" /> Gerar & Imprimir Documento Oficial
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
              <Printer className="h-16 w-16 text-slate-300 mb-4" />
              <p className="font-bold text-slate-500 text-sm">Nenhum aluno selecionado</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                Selecione um estudante e o tipo de certidão no painel esquerdo para liberar o preenchimento da ficha.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
