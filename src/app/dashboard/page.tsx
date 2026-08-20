"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { Loader2, BookOpen, Sparkles } from "lucide-react";

/**
 * Raiz do Dashboard: Redirecionamento instantâneo baseado no papel (role).
 * Removidos delays para performance fluida na apresentação.
 */
export default function DashboardRoot() {
  const { userRole, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
        return;
      }

      // Redirecionamento atômico
      if (userRole === 'admin') {
        router.replace("/dashboard/admin/home");
      } else if (userRole === 'teacher') {
        router.replace("/dashboard/teacher/home");
      } else if (userRole === 'staff') {
        router.replace("/dashboard/admin/home"); // Por enquanto equipe técnica vê o admin ou criamos uma própria
      } else {
        router.replace("/dashboard/home");
      }
    }
  }, [userRole, loading, user, router]);

  return null;
}