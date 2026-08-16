'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function CadastroForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inviteToken = searchParams.get('invite');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    cpf: '',
    examTarget: 'ENEM',
    institution: '',
    sala: '',
    turno: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!inviteToken) {
      setError('Token de convite não encontrado. Use o link fornecido pelo coordenador.');
      return;
    }

    if (!formData.sala) {
      setError('Selecione o número da sua sala.');
      return;
    }

    if (!formData.turno) {
      setError('Selecione o turno em que você estuda.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (formData.password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/student/self-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: inviteToken,
          fullName: formData.fullName,
          cpf: formData.cpf,
          examTarget: formData.examTarget,
          institution: formData.institution,
          sala: formData.sala,
          turno: formData.turno,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao realizar o cadastro.');
      }

      setSuccess(`Cadastro realizado com sucesso! Seu usuário é: ${data.email}`);
      
      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto py-12">
        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-gray-900 italic">Bem-vindo(a) à Plataforma!</h2>
          <p className="text-gray-500 font-medium">{success}</p>
        </div>
        <p className="text-sm text-gray-400">Redirecionando para a tela de login...</p>
        <Button asChild className="w-full h-12 mt-4 bg-orange-600 hover:bg-orange-700 font-bold">
          <Link href="/login">Ir para o Login Agora</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-3xl font-black italic text-gray-900 mb-2">Crie sua Conta</h1>
        <p className="text-gray-500 text-sm">
          Preencha os dados abaixo para ativar seu perfil de aluno na plataforma.
        </p>
      </div>

      {!inviteToken && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 mb-6">
          Atenção: O link acessado parece inválido (faltando o token de convite). Solicite um novo link ao coordenador.
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="font-bold text-gray-700">Nome Completo</Label>
          <Input
            id="fullName"
            name="fullName"
            placeholder="Ex: João da Silva"
            value={formData.fullName}
            onChange={handleChange}
            required
            className="h-12 bg-gray-50/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cpf" className="font-bold text-gray-700">CPF <span className="text-gray-400 font-normal">(Opcional)</span></Label>
            <Input
              id="cpf"
              name="cpf"
              placeholder="000.000.000-00"
              value={formData.cpf}
              onChange={handleChange}
              className="h-12 bg-gray-50/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="examTarget" className="font-bold text-gray-700">Foco Principal</Label>
            <Select 
              value={formData.examTarget} 
              onValueChange={(val) => setFormData({ ...formData, examTarget: val })}
            >
              <SelectTrigger className="h-12 bg-gray-50/50">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENEM">ENEM</SelectItem>
                <SelectItem value="ETEC">ETEC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="institution" className="font-bold text-gray-700">Escola / Instituição <span className="text-gray-400 font-normal">(Opcional)</span></Label>
          <Input
            id="institution"
            name="institution"
            placeholder="Ex: Escola Estadual Machado de Assis"
            value={formData.institution}
            onChange={handleChange}
            className="h-12 bg-gray-50/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-bold text-gray-700">Número da Sala <span className="text-red-500">*</span></Label>
            <Select
              value={formData.sala}
              onValueChange={(val) => setFormData({ ...formData, sala: val })}
            >
              <SelectTrigger className="h-12 bg-gray-50/50">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 15 }, (_, i) => String(i + 1)).map(n => (
                  <SelectItem key={n} value={n}>Sala {n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-bold text-gray-700">Turno <span className="text-red-500">*</span></Label>
            <Select
              value={formData.turno}
              onValueChange={(val) => setFormData({ ...formData, turno: val })}
            >
              <SelectTrigger className="h-12 bg-gray-50/50">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">Manhã</SelectItem>
                <SelectItem value="tarde">Tarde</SelectItem>
                <SelectItem value="integral">Integral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="password" className="font-bold text-gray-700">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              value={formData.password}
              onChange={handleChange}
              className="h-12 bg-gray-50/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="font-bold text-gray-700">Repetir Senha</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              value={formData.confirmPassword}
              onChange={handleChange}
              className="h-12 bg-gray-50/50"
            />
          </div>
        </div>

        <Button 
          type="submit" 
          disabled={isLoading || !inviteToken} 
          className="w-full h-12 mt-6 bg-orange-600 hover:bg-orange-700 text-white font-black text-sm uppercase tracking-wide transition-colors"
        >
          {isLoading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>
          ) : (
            'Finalizar Cadastro'
          )}
        </Button>
      </form>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <div className="flex flex-col min-h-screen overflow-hidden bg-white font-sans">
      <div className="flex flex-1 flex-col md:flex-row">
        
        {/* Lado da Imagem (Hero) */}
        <div className="hidden md:flex md:w-1/2 relative bg-[#002f6c] border-b-2 md:border-b-0 border-[#002f6c] overflow-hidden">
          <Image 
            src="/images/login_hero.jpg"
            alt="Estudantes"
            fill
            className="object-cover brightness-75 contrast-125 saturate-100 transition-transform duration-1000 hover:scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#002f6c]/60 to-transparent mix-blend-overlay pointer-events-none" />
          <div className="absolute inset-0 flex flex-col justify-end p-12 text-white z-10">
            <h2 className="text-4xl font-black italic mb-4">A sua jornada começa aqui.</h2>
            <p className="text-lg font-medium text-blue-100 max-w-md">
              Junte-se à plataforma e tenha acesso aos melhores recursos de estudo para o seu exame.
            </p>
          </div>
        </div>
        
        {/* Lado do Formulário */}
        <div className="w-full md:w-1/2 flex flex-col bg-white relative overflow-y-auto">
          <div className="flex justify-end p-4 md:p-8 w-full z-10 shrink-0">
            <Link 
              href="/login" 
              className="group flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors font-medium bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-full border border-gray-200"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Já tem conta? Entrar
            </Link>
          </div>
          <div className="flex-1 flex flex-col justify-center p-6 sm:p-10 md:p-12 lg:p-16">
            <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-orange-600" /></div>}>
              <CadastroForm />
            </Suspense>
          </div>
        </div>

      </div>
      
      {/* Footer */}
      <footer className="bg-[#002f6c] text-white text-xs py-4 text-center shrink-0">
        <p>Copyright © 1997-2026 Plataforma. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
