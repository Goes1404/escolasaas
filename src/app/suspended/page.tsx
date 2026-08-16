"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, LogOut, MessageCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import Link from "next/link";

export default function SuspendedPage() {
  const { signOut, profile } = useAuth();

  return (
    <div className="h-screen w-full flex items-center justify-center bg-primary p-6 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-slate-950">
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-accent/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-accent/10 rounded-full blur-[100px]" />

      <Card className="w-full max-w-lg border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] bg-white/95 backdrop-blur-xl rounded-[3rem] overflow-hidden animate-in zoom-in-95 duration-700">
        <CardContent className="p-12 text-center space-y-8">
          <div className="flex justify-center">
            <div className="h-24 w-24 rounded-[2rem] bg-red-50 text-red-600 flex items-center justify-center shadow-xl rotate-3">
              <ShieldAlert className="h-12 w-12" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-black text-primary italic tracking-tight leading-none uppercase">
              Acesso <span className="text-red-600">Restrito</span>
            </h1>
            <p className="text-muted-foreground font-medium italic">
              Olá, <strong>{profile?.name}</strong>. Identificamos uma irregularidade ou manutenção pendente em seu cadastro.
            </p>
          </div>

          <div className="p-6 rounded-[2rem] bg-red-50/50 border border-red-100 space-y-2">
            <p className="text-xs font-black uppercase text-red-800 tracking-widest">Status da Conta</p>
            <p className="text-sm font-bold text-red-700 italic">SUSPENSÃO TEMPORÁRIA ATIVA</p>
          </div>

          <div className="space-y-4 pt-4">
            <Button asChild className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl gap-3">
              <Link href="/dashboard/chat/aurora-ai">
                <MessageCircle className="h-5 w-5 text-accent" />
                Contatar Suporte Aurora
              </Link>
            </Button>
            <Button variant="ghost" onClick={() => signOut()} className="w-full h-12 text-muted-foreground font-black uppercase text-[10px] tracking-widest gap-2 hover:bg-red-50 hover:text-red-600">
              <LogOut className="h-4 w-4" /> Sair da Conta
            </Button>
          </div>

          <div className="pt-6 border-t border-dashed flex items-center justify-center gap-2 opacity-40">
            <Sparkles className="h-3 w-3 text-accent" />
            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-primary">Plataforma Smart Education</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}