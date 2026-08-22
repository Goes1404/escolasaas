
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GraduationCap, School, User, ArrowRight, Loader2, Mail, Lock, Sparkles, UserPlus, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSupabaseConfigured } from "@/app/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { SCHOOL_LIST } from "@/lib/constants";
import { useTenant } from "@/components/TenantProvider";

type Step = 1 | 2 | 3;
type ProfileType = "etec" | "enem";

export default function RegisterPage() {
  const [step, setStep] = useState<Step>(1);
  const [profileType, setProfileType] = useState<ProfileType>("etec");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { tenant } = useTenant();
  const logoUrl = tenant.branding.logoUrl;

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    cpf: "",
    password: "",
    school: "",
    course: "",
    university: "",
    major: "",
    interests: ""
  });
  const [showPassword, setShowPassword] = useState(false);

  const nextStep = () => {
    if (step === 1 && (!formData.email || !formData.password || !formData.firstName || !formData.lastName || !formData.cpf)) {
      toast({ title: "Dados Incompletos", description: "Nome, sobrenome, CPF, e-mail e senha são obrigatórios.", variant: "destructive" });
      return;
    }
    
    if (step === 1 && formData.cpf.length < 14) {
      toast({ title: "CPF Inválido", description: "Por favor, insira um CPF válido.", variant: "destructive" });
      return;
    }

    setStep((s) => (s + 1) as Step);
  };
  
  const prevStep = () => setStep((s) => (s - 1) as Step);

  const updateField = (field: string, value: string) => {
    let finalValue = value;
    
    // Máscara de CPF simples
    if (field === 'cpf') {
      finalValue = value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
    }

    setFormData(prev => ({ ...prev, [field]: finalValue }));
  };

  const handleFinish = async () => {
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      toast({ variant: "destructive", title: "Dados Incompletos", description: "Preencha todos os campos obrigatórios." });
      return;
    }

    if (!isSupabaseConfigured) {
      toast({ variant: "destructive", title: "Erro de Configuração", description: "O sistema não está conectado ao banco de dados." });
      return;
    }

    setLoading(true);

    try {
      // PADRÃO CORPORATIVO: Nome de exibição é sempre Primeiro + Último
      const firstName = formData.firstName.trim();
      const lastName = formData.lastName.trim();
      const fullName = `${firstName} ${lastName}`;
      
      // Validação de E-mail: Caso seja professor, ou se quisermos padronizar geral
      // A pedido do usuário: "manter um padrao de emails. com o primeiro e ultimo nome do aluno e professor"
      const expectedEmailPart = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/[^a-z0-9]/g, "");
      
      if (!formData.email.toLowerCase().includes(expectedEmailPart)) {
        toast({ 
          title: "Sugestão de E-mail", 
          description: `Para manter o padrão institucional, utilize um e-mail contendo '${expectedEmailPart}'.`, 
          variant: "default" 
        });
      }

      // CONTROLE DE DUPLICIDADE: Username gerado
      const rawUsername = `${firstName}${lastName}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "");

      let institutionValue = "";
      let courseValue = "";

      if (profileType === 'etec') {
        institutionValue = formData.school || "ETEC";
        courseValue = formData.course;
      } else if (profileType === 'enem') {
        institutionValue = formData.school || formData.university || "ENEM";
        courseValue = formData.major || "Vestibulando";
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: fullName,
            username: rawUsername,
            profile_type: profileType,
            institution: institutionValue,
            course: courseValue,
            cpf: formData.cpf.replace(/\D/g, '')
          }
        }
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          toast({ 
            title: "Conta já existe", 
            description: "Este e-mail já está cadastrado. Tente fazer login.", 
            variant: "default" 
          });
          router.push("/login");
          return;
        }
        throw authError;
      }

      toast({ 
        title: "Cadastro Realizado! 🚀", 
        description: "Seu perfil foi criado com sucesso. Redirecionando..." 
      });
      
      setTimeout(() => {
        window.location.href = "/dashboard/home";
      }, 1000);

    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      toast({ 
        title: "Falha no Cadastro", 
        description: err.message || "Ocorreu um erro no servidor.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-login-gradient p-4 sm:p-8 relative overflow-y-auto py-12 md:py-8">
      <div className="absolute top-4 left-4 md:top-8 md:left-8 z-50">
        <Button asChild className="bg-white/10 text-white hover:bg-white/20 font-bold uppercase text-[10px] tracking-[0.15em] gap-2 rounded-xl backdrop-blur-md transition-all active:scale-95 border border-white/10 h-10 px-4 md:px-6">
          <Link href="/">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar ao Início</span>
            <span className="sm:hidden">Início</span>
          </Link>
        </Button>
      </div>

      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#4CCCED]/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-[#4CCCED]/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
        <div className="space-y-4 text-center">
          <div className="relative h-16 w-16 md:h-20 md:w-20 mx-auto overflow-hidden rounded-2xl shadow-xl bg-white p-2">
            <Image 
              src={logoUrl} 
              alt="Logo"
              fill 
              unoptimized
              priority
              className="object-contain p-1"
            />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white flex items-center justify-center gap-3 italic">
            Criar <span className="text-accent">Cadastro</span>
          </h1>
          <p className="text-white/70 text-lg font-medium italic">Sua rota de aprovação começa agora.</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between text-[10px] font-black text-white uppercase tracking-widest">
            <span>Passo {step} de 3: {step === 1 ? "Acesso" : step === 2 ? "Perfil" : "Detalhes"}</span>
            <span className="text-accent italic">{Math.round((step / 3) * 100)}%</span>
          </div>
          <Progress value={(step / 3) * 100} className="h-2 bg-white/20 rounded-full overflow-hidden" />
        </div>

        <Card className="shadow-[0_30px_80px_rgba(0,0,0,0.1)] border-none overflow-hidden bg-white/95 backdrop-blur-md rounded-[3rem]">
          <CardHeader className="bg-primary/5 pb-8 pt-8 border-b border-dashed">
            <CardTitle className="text-xl font-bold text-primary flex items-center gap-3 italic">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground text-sm font-black shadow-lg">
                {step}
              </span>
              {step === 1 && "Credenciais de Acesso"}
              {step === 2 && "Escolha sua Categoria"}
              {step === 3 && "Configurações Acadêmicas"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 md:pt-8 min-h-[auto] md:min-h-[400px]">
             {step === 1 && (
              <div key="step1" className="grid gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="font-bold text-primary/60 ml-2">Nome</Label>
                    <Input id="firstName" placeholder="Seu nome" value={formData.firstName} onChange={(e) => updateField("firstName", e.target.value)} className="h-12 bg-white/50 rounded-2xl border-muted/20" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middleName" className="font-bold text-primary/60 ml-2">Nome do Meio</Label>
                    <Input id="middleName" placeholder="Opcional" value={formData.middleName} onChange={(e) => updateField("middleName", e.target.value)} className="h-12 bg-white/50 rounded-2xl border-muted/20" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="font-bold text-primary/60 ml-2">Sobrenome</Label>
                    <Input id="lastName" placeholder="Seu sobrenome" value={formData.lastName} onChange={(e) => updateField("lastName", e.target.value)} className="h-12 bg-white/50 rounded-2xl border-muted/20" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpf" className="font-bold text-primary/60 ml-2">CPF</Label>
                    <div className="relative group">
                      <User className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                      <Input id="cpf" placeholder="000.000.000-00" value={formData.cpf} onChange={(e) => updateField("cpf", e.target.value)} className="pl-12 h-12 bg-white/50 rounded-2xl border-muted/20" maxLength={14} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-bold text-primary/60 ml-2">E-mail</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                      <Input id="email" type="email" placeholder="nome@exemplo.com" value={formData.email} onChange={(e) => updateField("email", e.target.value)} className="pl-12 h-12 bg-white/50 rounded-2xl border-muted/20" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" title="Senha" className="font-bold text-primary/60 ml-2">Senha de Segurança</Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"} 
                      value={formData.password} 
                      onChange={(e) => setFormData({...formData, password: e.target.value})} 
                      className="pl-12 pr-12 h-12 bg-white/50 rounded-2xl border-muted/20" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
               <div key="step2" className="animate-in fade-in slide-in-from-right-4 duration-500">
                 <RadioGroup 
                  value={profileType} 
                  onValueChange={(v) => setProfileType(v as ProfileType)} 
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  <div key="etec">
                    <Label
                      htmlFor="etec"
                      className={`flex flex-col items-center justify-center rounded-card border-4 p-8 hover:bg-white cursor-pointer transition-all h-full text-center group ${
                        profileType === "etec" ? "border-accent bg-white shadow-xl ring-8 ring-accent/5" : "border-transparent bg-white/50"
                      }`}
                    >
                      <RadioGroupItem value="etec" id="etec" className="sr-only" />
                      <div className={`p-6 rounded-2xl mb-4 transition-all shadow-md ${profileType === "etec" ? "bg-accent text-accent-foreground scale-110" : "bg-muted text-primary"}`}>
                        <School className="h-10 w-10" />
                      </div>
                      <p className="font-black text-primary italic leading-none text-lg">Aluno ETEC</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-3">Formação Técnica</p>
                    </Label>
                  </div>

                  <div key="enem">
                    <Label
                      htmlFor="enem"
                      className={`flex flex-col items-center justify-center rounded-card border-4 p-8 hover:bg-white cursor-pointer transition-all h-full text-center group ${
                        profileType === "enem" ? "border-accent bg-white shadow-xl ring-8 ring-accent/5" : "border-transparent bg-white/50"
                      }`}
                    >
                      <RadioGroupItem value="enem" id="enem" className="sr-only" />
                      <div className={`p-6 rounded-2xl mb-4 transition-all shadow-md ${profileType === "enem" ? "bg-accent text-accent-foreground scale-110" : "bg-muted text-primary"}`}>
                        <GraduationCap className="h-10 w-10" />
                      </div>
                      <p className="font-black text-primary italic leading-none text-lg">Aluno ENEM</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-3">Foco Vestibular</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {step === 3 && (
              <div key="step3" className="grid gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
                {profileType === "etec" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="school" className="font-bold text-primary/60 ml-2">Unidade Escolar / Polo</Label>
                      <Select value={formData.school} onValueChange={(v) => updateField("school", v)}>
                        <SelectTrigger className="h-12 bg-white/50 rounded-xl border-muted/20">
                          <SelectValue placeholder="Selecione sua escola..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-xl max-h-80">
                          {SCHOOL_LIST.map(school => (
                            <SelectItem key={school} value={school}>{school}</SelectItem>
                          ))}
                          <SelectItem value="Outra Rede">Outra Rede / Não Listada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="course" className="font-bold text-primary/60 ml-2">Curso Atual ou Série</Label>
                      <Input id="course" placeholder="Ex: Informática ou 3º Ano Médio" value={formData.course} onChange={(e) => updateField("course", e.target.value)} className="h-12 bg-white/50 rounded-xl" />
                    </div>
                  </div>
                )}

                {profileType === "enem" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="school" className="font-bold text-primary/60 ml-2">Unidade Escolar / Polo Atual</Label>
                      <Select value={formData.school} onValueChange={(v) => updateField("school", v)}>
                        <SelectTrigger className="h-12 bg-white/50 rounded-xl border-muted/20">
                          <SelectValue placeholder="Selecione sua escola atual..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-xl max-h-80">
                          {SCHOOL_LIST.map(school => (
                            <SelectItem key={school} value={school}>{school}</SelectItem>
                          ))}
                          <SelectItem value="Outra Rede">Outra Rede / Não Listada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                       <Label htmlFor="university" className="font-bold text-primary/60 ml-2">Instituição Alvo (Opcional)</Label>
                       <Input id="university" placeholder="Ex: USP, FATEC, UNESP" value={formData.university} onChange={(e) => updateField("university", e.target.value)} className="h-12 bg-white/50 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="major" className="font-bold text-primary/60 ml-2">Carreira Desejada</Label>
                      <Input id="major" placeholder="Ex: Medicina, Engenharia..." value={formData.major} onChange={(e) => updateField("major", e.target.value)} className="h-12 bg-white/50 rounded-xl" />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="interests" className="font-bold text-primary/60 ml-2">O que você busca na plataforma?</Label>
                  <Input id="interests" placeholder="Ex: Mentoria em Redação, Simulados..." value={formData.interests} onChange={(e) => updateField("interests", e.target.value)} className="h-12 bg-white/50 rounded-xl" />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between border-t border-border/10 p-6 md:p-10 bg-muted/5 gap-4">
            <Button 
              variant="ghost" 
              onClick={step === 1 ? () => router.push("/login") : prevStep} 
              disabled={loading}
              className="w-full sm:w-auto px-8 font-black text-primary/60 hover:text-primary transition-all rounded-2xl h-12 order-2 sm:order-1"
            >
              {step === 1 ? "Voltar ao Login" : "Voltar"}
            </Button>
            {step < 3 ? (
              <Button onClick={nextStep} className="w-full sm:w-auto bg-primary text-primary-foreground px-12 h-12 font-black rounded-2xl group shadow-xl transition-all order-1 sm:order-2">
                Continuar
                <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-2 transition-transform" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={loading} className="w-full sm:w-auto bg-accent text-accent-foreground px-12 h-14 font-black rounded-2xl shadow-xl shadow-accent/20 group transition-all text-lg order-1 sm:order-2">
                {loading ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <UserPlus className="mr-2 h-6 w-6" /> }
                Finalizar Matrícula
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
