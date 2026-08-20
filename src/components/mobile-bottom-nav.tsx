"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, BookOpen, Zap, BarChart3, User,
  LayoutDashboard, ClipboardCheck, FilePenLine, MessageSquare,
  Users, FolderOpen, ShieldCheck, Database, Settings,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";

type Tab = { label: string; icon: any; href: string; exact?: boolean };

const STUDENT_TABS: Tab[] = [
  { label: "Início",    icon: Home,     href: "/dashboard/home", exact: true },
  { label: "Conteúdo",  icon: BookOpen,  href: "/dashboard/trails" },
  { label: "Praticar",  icon: Zap,       href: "/dashboard/student/simulados" },
  { label: "Progresso", icon: BarChart3, href: "/dashboard/student/performance" },
  { label: "Eu",        icon: User,      href: "/dashboard/settings" },
];

const TEACHER_TABS: Tab[] = [
  { label: "Painel",    icon: LayoutDashboard, href: "/dashboard/teacher/home", exact: true },
  { label: "Trilhas",   icon: BookOpen,        href: "/dashboard/teacher/trails" },
  { label: "Chamada",   icon: ClipboardCheck,  href: "/dashboard/teacher/attendance" },
  { label: "Redações",  icon: FilePenLine,     href: "/dashboard/teacher/essays" },
  { label: "Chat",      icon: MessageSquare,   href: "/dashboard/chat" },
];

const STAFF_TABS: Tab[] = [
  { label: "Painel",    icon: ShieldCheck,    href: "/dashboard/secretary/home", exact: true },
  { label: "Alunos",    icon: Users,          href: "/dashboard/secretary/enrollments" },
  { label: "Chamada",   icon: ClipboardCheck, href: "/dashboard/secretary/attendance" },
  { label: "Docs",      icon: FolderOpen,     href: "/dashboard/secretary/uploads" },
  { label: "Chat",      icon: MessageSquare,  href: "/dashboard/chat" },
];

const ADMIN_TABS: Tab[] = [
  { label: "Gestão",     icon: ShieldCheck,    href: "/dashboard/admin/home", exact: true },
  { label: "Usuários",   icon: Users,          href: "/dashboard/admin/users" },
  { label: "Turmas",     icon: Database,       href: "/dashboard/admin/students" },
  { label: "Frequência", icon: ClipboardCheck, href: "/dashboard/admin/attendance" },
  { label: "Config",     icon: Settings,       href: "/dashboard/settings" },
];

function tabsForRole(role: string | null | undefined): Tab[] {
  if (role === "admin") return ADMIN_TABS;
  if (role === "staff") return STAFF_TABS;
  if (role === "teacher") return TEACHER_TABS;
  return STUDENT_TABS;
}

function isTabActive(tab: Tab, pathname: string) {
  if (tab.exact) return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(tab.href + "/");
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { userRole } = useAuth();
  const tabs = tabsForRole(userRole);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch h-16">
        {tabs.map((tab) => {
          const active = isTabActive(tab, pathname ?? "");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-all duration-150 active:scale-95 ${
                active ? "text-primary" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {/* top indicator bar */}
              <span
                className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-primary transition-all duration-200 ${
                  active ? "w-8 opacity-100" : "w-0 opacity-0"
                }`}
              />
              <tab.icon
                className={`transition-transform duration-150 ${
                  active ? "h-5 w-5 scale-110" : "h-5 w-5 scale-100"
                }`}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span
                className={`text-[11px] font-bold leading-none transition-colors duration-150 ${
                  active ? "text-primary" : "text-slate-400"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
