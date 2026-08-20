
"use client";

import { ForgotPasswordForm } from "./ForgotPasswordForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-gradient p-4 relative overflow-y-auto py-20 md:py-8">
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="absolute top-8 left-8 z-50">
        <Button asChild variant="ghost" className="text-white hover:bg-white/10 font-black uppercase text-[10px] tracking-widest gap-2 rounded-xl transition-all">
          <Link href="/login">
            <ChevronLeft className="h-4 w-4 text-accent" />
            Voltar ao Login
          </Link>
        </Button>
      </div>

      <ForgotPasswordForm />
    </div>
  );
}
