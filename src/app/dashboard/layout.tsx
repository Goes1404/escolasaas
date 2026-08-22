
"use client";

import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarTrigger, SidebarInset, SidebarFooter, useSidebar, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar";
import { Home, Compass, BookOpen, Video, Library, LogOut, Bell, LayoutDashboard, ClipboardList, ClipboardCheck, BarChart3, MessageSquare, MessagesSquare, MonitorPlay, FileText, Database, Sparkles, ShieldCheck, Users, Settings, Eye, FileCheck, FilePenLine, Gavel, AlertCircle, HelpCircle, Menu, BrainCircuit, Scroll, ChevronRight, CalendarDays, NotebookPen, Network, StickyNote, BookMarked, FolderOpen, Upload, Calculator, TrendingUp, Target, BookHeart, Flame, Zap, Trophy, Layers, GraduationCap, Wallet, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEffect, useState, useMemo, memo, Suspense } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import Image from "next/image";
import { OnboardingTour } from "@/components/OnboardingTour";
import { LoadingShell } from "@/components/LoadingShell";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UrgentNotice } from "@/components/UrgentNotice";
import { PhoneGate } from "@/components/PhoneGate";
import { TelemetryProvider } from "@/components/TelemetryProvider";
import { PushPermissionBanner } from "@/components/push-permission-banner";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { ExtractionProvider } from "@/lib/ExtractionContext";
import { FloatingExtractionBubble } from "@/components/FloatingExtractionBubble";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { useTenant } from "@/components/TenantProvider";

type NavChild = { icon: any; label: string; href: string; id: string; badge?: boolean };
type NavItem  = { icon: any; label: string; href?: string; id: string; badge?: boolean; initialOpen?: boolean; children?: NavChild[] };

/* ─── ALUNO ─────────────────────────────────────────────────── */
const studentItems: NavItem[] = [
  { icon: Home, label: "Meu Painel", href: "/dashboard/home", id: "nav-home" },
  {
    icon: BookOpen, label: "Conteúdos", id: "nav-conteudos",
    children: [
      { icon: Compass,    label: "Assistir Aulas",    href: "/dashboard/trails",             id: "nav-trails" },
      { icon: FolderOpen, label: "Materiais de Aula", href: "/dashboard/student/materials",  id: "nav-student-materials" },
      { icon: BookOpen,   label: "Livros",            href: "/dashboard/books",              id: "nav-books" },
      { icon: Library,    label: "Biblioteca",        href: "/dashboard/library",            id: "nav-library" },
    ],
  },
  {
    icon: BrainCircuit, label: "Provas & Estudo", id: "nav-provas-estudo",
    children: [
      { icon: Zap,         label: "Desafio Diário 🎯",        href: "/dashboard/student/daily",      id: "nav-daily" },
      { icon: FileText,    label: "Simulados por Matéria", href: "/dashboard/student/simulados",   id: "nav-simulados" },
      { icon: Scroll,      label: "Provas Completas",      href: "/dashboard/student/provas",      id: "nav-provas" },
      { icon: FilePenLine, label: "Treinar Redação",       href: "/dashboard/student/essays",      id: "nav-essays" },
      { icon: Layers,      label: "Flash Cards 🧠",         href: "/dashboard/student/flashcards",  id: "nav-flashcards" },
      { icon: BarChart3,   label: "Meu Desempenho",        href: "/dashboard/student/performance", id: "nav-performance" },
    ],
  },
  {
    icon: NotebookPen, label: "Meu Caderno", id: "nav-caderno",
    children: [
      { icon: StickyNote, label: "Minhas Notas", href: "/dashboard/student/notes",       id: "nav-notes-list" },
      { icon: Network,    label: "Grafo",         href: "/dashboard/student/notes/graph", id: "nav-notes-graph" },
    ],
  },
  {
    icon: Flame, label: "Meu Progresso", id: "nav-progresso", initialOpen: true,
    children: [
      { icon: Sparkles,   label: "Meu Bichinho 🐾", href: "/dashboard/student/bichinho", id: "nav-student-bichinho" },
      { icon: Target,     label: "Metas",   href: "/dashboard/student/goals",   id: "nav-student-goals" },
      { icon: GraduationCap, label: "Meu Boletim", href: "/dashboard/student/report-card", id: "nav-student-report-card" },
      { icon: BookHeart,  label: "Diário",  href: "/dashboard/student/journal", id: "nav-student-journal" },
      { icon: Trophy,     label: "Ranking Semanal", href: "/dashboard/student/ranking", id: "nav-student-ranking" },
    ],
  },
  { icon: Video, label: "Aulas ao Vivo", href: "/dashboard/live", id: "nav-live" },
  {
    icon: MessagesSquare, label: "Comunidade", id: "nav-comunidade",
    children: [
      { icon: MessagesSquare, label: "Fórum Geral",   href: "/dashboard/forum", id: "nav-forum" },
      { icon: MessageSquare,  label: "Tirar Dúvidas", href: "/dashboard/chat",  id: "nav-chat", badge: true },
    ],
  },
  {
    icon: CalendarDays, label: "Agenda", id: "nav-agenda",
    children: [
      { icon: CalendarDays,   label: "Calendário", href: "/dashboard/student/calendar",   id: "nav-calendar" },
      { icon: ClipboardCheck, label: "Frequência",  href: "/dashboard/student/attendance", id: "nav-student-attendance" },
    ],
  },
  {
    icon: FileCheck, label: "Matrícula & Isenção", id: "nav-matricula-isenção",
    children: [
      { icon: ClipboardList, label: "Checklist de Matrícula", href: "/dashboard/student/documents", id: "nav-student-documents" },
      { icon: Upload, label: "Enviar Documentos", href: "/dashboard/student/documents/uploads", id: "nav-student-uploads" },
      { icon: Calculator, label: "Simulador de Isenção", href: "/dashboard/student/documents/exemption", id: "nav-student-exemption" },
    ],
  },
  { icon: Sparkles, label: "Novidades", href: "/dashboard/updates", id: "nav-updates" },
  {
    icon: Settings, label: "Conta", id: "nav-conta",
    children: [
      { icon: Wallet,      label: "Financeiro",      href: "/dashboard/student/finance",      id: "nav-student-finance" },
      { icon: FilePenLine, label: "Rematrícula",     href: "/dashboard/student/reenrollment", id: "nav-student-reenrollment" },
      { icon: Settings,    label: "Meu Perfil",      href: "/dashboard/settings",             id: "nav-settings" },
    ],
  },
];

/* ─── PROFESSOR ─────────────────────────────────────────────── */
const teacherItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Painel de Gestão", href: "/dashboard/teacher/home", id: "nav-teacher-home" },
  {
    icon: BookOpen, label: "Conteúdo", id: "nav-teacher-conteudo",
    children: [
      { icon: ClipboardList, label: "Minhas Trilhas",       href: "/dashboard/teacher/trails",    id: "nav-teacher-trails" },
      { icon: FolderOpen,    label: "Materiais de Aula",    href: "/dashboard/teacher/materials", id: "nav-teacher-materials" },
      { icon: BookOpen,      label: "Gestão de Livros",     href: "/dashboard/teacher/books",     id: "nav-teacher-books" },
      { icon: Library,       label: "Gestão da Biblioteca", href: "/dashboard/teacher/library",   id: "nav-teacher-library" },
    ],
  },
  {
    icon: Database, label: "Avaliação", id: "nav-teacher-avaliacao",
    children: [
      { icon: Database,    label: "Banco de Questões",    href: "/dashboard/teacher/questions",           id: "nav-teacher-questions" },
      { icon: FilePenLine, label: "Correção de Redações", href: "/dashboard/teacher/essays",              id: "nav-teacher-essays" },
      { icon: ClipboardList, label: "Correção de Simulado", href: "/dashboard/teacher/simulado-correcao", id: "nav-teacher-simulado-correcao" },
      { icon: Trophy,        label: "Ranking por Prova",   href: "/dashboard/teacher/ranking",            id: "nav-teacher-ranking" },
    ],
  },
  {
    icon: ClipboardCheck, label: "Turma", id: "nav-teacher-turma",
    children: [
      { icon: ClipboardCheck, label: "Chamadas",        href: "/dashboard/teacher/attendance",    id: "nav-teacher-attendance" },
      { icon: CalendarDays,   label: "Calendário",      href: "/dashboard/teacher/calendar",      id: "nav-teacher-calendar" },
      { icon: Bell,           label: "Mural de Avisos", href: "/dashboard/teacher/communication", id: "nav-teacher-communication" },
    ],
  },
  { icon: MonitorPlay, label: "Gerenciar Lives", href: "/dashboard/teacher/live",      id: "nav-teacher-live" },
  { icon: BarChart3,   label: "BI & Analytics",  href: "/dashboard/teacher/analytics", id: "nav-teacher-analytics" },
  {
    icon: MessagesSquare, label: "Comunidade", id: "nav-teacher-comunidade",
    children: [
      { icon: MessagesSquare, label: "Fórum Pedagógico", href: "/dashboard/forum", id: "nav-teacher-forum" },
      { icon: MessageSquare,  label: "Chats com Alunos", href: "/dashboard/chat",  id: "nav-teacher-chat", badge: true },
    ],
  },
  { icon: Sparkles, label: "Novidades", href: "/dashboard/updates", id: "nav-teacher-updates" },
  {
    icon: Settings, label: "Conta", id: "nav-teacher-conta",
    children: [
      { icon: HelpCircle, label: "Central de Ajuda", href: "/dashboard/teacher/help", id: "nav-teacher-help" },
      { icon: Settings,   label: "Configurações",    href: "/dashboard/settings",     id: "nav-teacher-settings" },
    ],
  },
];

/* ─── ADMIN ─────────────────────────────────────────────────── */
const adminItems: NavItem[] = [
  { icon: ShieldCheck, label: "Gestão 360", href: "/dashboard/admin/home", id: "nav-admin-home" },
  {
    icon: Users, label: "Usuários", id: "nav-admin-usuarios",
    children: [
      { icon: Users,       label: "Diretório",      href: "/dashboard/admin/users",      id: "nav-admin-users" },
      { icon: Database,    label: "Turmas",          href: "/dashboard/admin/students",   id: "nav-admin-students" },
      { icon: AlertCircle, label: "Alunos em Risco", href: "/dashboard/teacher/students", id: "nav-admin-risk" },
    ],
  },
  {
    icon: BookMarked, label: "Conteúdo", id: "nav-admin-conteudo",
    children: [
      { icon: BookMarked,    label: "Provas PDF",         href: "/dashboard/admin/exams",  id: "nav-admin-exams" },
      { icon: ClipboardList, label: "Aprovação de Trilhas", href: "/dashboard/admin/trails", id: "nav-admin-trails" },
      { icon: Upload,        label: "Importar Boletim",     href: "/dashboard/admin/report-card-import",    id: "nav-admin-report-card-import" },
      { icon: FileCheck,     label: "Boletins Pendentes",   href: "/dashboard/admin/report-card-approvals", id: "nav-admin-report-card-approvals" },
    ],
  },
  {
    icon: Wallet, label: "Financeiro", id: "nav-admin-financeiro",
    children: [
      { icon: FileText,    label: "Mensalidades",          href: "/dashboard/secretary/tuition",      id: "nav-admin-tuition" },
      { icon: FilePenLine, label: "Rematrícula",           href: "/dashboard/secretary/reenrollment", id: "nav-admin-reenrollment" },
      { icon: Wallet,      label: "Professores & Recibos", href: "/dashboard/secretary/finance",      id: "nav-admin-teacher-finance" },
    ],
  },
  {
    icon: BarChart3, label: "Monitoramento", id: "nav-admin-monitoramento",
    children: [
      { icon: BarChart3,      label: "BI & Analytics",     href: "/dashboard/teacher/analytics", id: "nav-admin-analytics" },
      { icon: MonitorSmartphone, label: "Onde o aluno para", href: "/dashboard/admin/uso",      id: "nav-admin-uso" },
      { icon: Trophy,         label: "Ranking por Prova",  href: "/dashboard/admin/ranking",     id: "nav-admin-ranking" },
      { icon: ClipboardCheck, label: "Frequência",          href: "/dashboard/admin/attendance",  id: "nav-admin-attendance" },
      { icon: FileCheck,      label: "Status de Documentos", href: "/dashboard/admin/checklists", id: "nav-admin-checklists" },
    ],
  },
  {
    icon: Gavel, label: "Moderação", id: "nav-admin-moderacao",
    children: [
      { icon: Gavel, label: "Moderação de Fórum", href: "/dashboard/admin/forums", id: "nav-admin-forums" },
      { icon: Eye,   label: "Auditoria de Chats", href: "/dashboard/admin/chats",  id: "nav-admin-chats" },
    ],
  },
  {
    icon: Bell, label: "Comunicação", id: "nav-admin-comunicacao",
    children: [
      { icon: Bell,         label: "Comunicados Globais", href: "/dashboard/teacher/communication", id: "nav-admin-communication" },
      { icon: CalendarDays, label: "Calendário",          href: "/dashboard/admin/calendar",        id: "nav-admin-calendar" },
    ],
  },
  { icon: Sparkles, label: "Novidades", href: "/dashboard/updates", id: "nav-admin-updates" },
  { icon: Settings, label: "Configurações", href: "/dashboard/settings", id: "nav-admin-settings" },
];

/* ─── SECRETARIA ────────────────────────────────────────────── */
const secretaryItems: NavItem[] = [
  { icon: ShieldCheck, label: "Painel Secretaria", href: "/dashboard/secretary/home", id: "nav-secretary-home" },
  { icon: BarChart3,   label: "Painel de KPIs",   href: "/dashboard/secretary/kpi",  id: "nav-secretary-kpi" },
  {
    icon: Users, label: "Matrículas", id: "nav-secretary-matriculas",
    children: [
      { icon: Users,       label: "Diretório de Alunos", href: "/dashboard/secretary/enrollments", id: "nav-secretary-enrollments" },
      { icon: TrendingUp,  label: "Renda Per Capita",    href: "/dashboard/secretary/income",      id: "nav-secretary-income" },
      { icon: Database,    label: "Gestão de Turmas",    href: "/dashboard/admin/students",        id: "nav-secretary-students" },
    ],
  },
  {
    icon: ClipboardCheck, label: "Operações", id: "nav-secretary-operacoes",
    children: [
      { icon: ClipboardCheck, label: "Frequência / Chamada",    href: "/dashboard/secretary/attendance",       id: "nav-secretary-attendance" },
      { icon: FileCheck,      label: "Emissão de Documentos",  href: "/dashboard/secretary/documents",        id: "nav-secretary-documents" },
      { icon: FolderOpen,     label: "Docs dos Alunos",        href: "/dashboard/secretary/uploads",          id: "nav-secretary-uploads",   badge: true },
      { icon: ClipboardList,  label: "Checklist de Docs",      href: "/dashboard/admin/checklists",           id: "nav-secretary-checklists" },
      { icon: Trophy,         label: "Importar Simulado",      href: "/dashboard/secretary/simulado-import", id: "nav-secretary-simulado" },
      { icon: Upload,         label: "Importar Boletim",       href: "/dashboard/admin/report-card-import",  id: "nav-secretary-report-card-import" },
      { icon: FileCheck,      label: "Boletins Pendentes",     href: "/dashboard/secretary/report-card-approvals", id: "nav-secretary-report-card-approvals" },
    ],
  },
  {
    icon: Wallet, label: "Financeiro", id: "nav-secretary-financeiro",
    children: [
      { icon: FileText,    label: "Mensalidades",          href: "/dashboard/secretary/tuition",      id: "nav-secretary-tuition" },
      { icon: FilePenLine, label: "Rematrícula",           href: "/dashboard/secretary/reenrollment", id: "nav-secretary-reenrollment" },
      { icon: Wallet,      label: "Professores & Recibos", href: "/dashboard/secretary/finance",      id: "nav-secretary-finance" },
    ],
  },
  {
    icon: Bell, label: "Comunicação", id: "nav-secretary-comunicacao",
    children: [
      { icon: Bell,         label: "Comunicados Globais", href: "/dashboard/secretary/communication", id: "nav-secretary-communication" },
      { icon: CalendarDays, label: "Calendário Escolar",   href: "/dashboard/admin/calendar",        id: "nav-secretary-calendar" },
    ],
  },
  {
    icon: MessagesSquare, label: "Comunidade", id: "nav-secretary-comunidade",
    children: [
      { icon: MessagesSquare, label: "Fórum Geral",   href: "/dashboard/forum", id: "nav-secretary-forum" },
      { icon: MessageSquare,  label: "Chats com Alunos", href: "/dashboard/chat",  id: "nav-secretary-chat", badge: true },
    ],
  },
  { icon: Sparkles, label: "Novidades", href: "/dashboard/updates", id: "nav-secretary-updates" },
  {
    icon: Settings, label: "Conta", id: "nav-secretary-conta",
    children: [
      { icon: Settings,   label: "Meu Perfil",       href: "/dashboard/settings",     id: "nav-secretary-settings" },
    ],
  },
];

/* ─── NavMenu component ──────────────────────────────────────── */
const NavMenu = memo(({ items, pathname, unreadCount }: { items: NavItem[]; pathname: string; unreadCount: number }) => {
  const { setOpenMobile, isMobile } = useSidebar();

  const isItemActive = (itemHref: string) => {
    if (pathname === itemHref) return true;
    if (pathname.startsWith(itemHref + '/')) return true;
    if (itemHref === '/dashboard/trails'  && pathname.startsWith('/dashboard/classroom/')) return true;
    if (itemHref === '/dashboard/library' && pathname.startsWith('/dashboard/library/book/')) return true;
    if (itemHref === '/dashboard/books'   && pathname.startsWith('/dashboard/books/read/')) return true;
    return false;
  };

  const isGroupActive = (children: NavChild[]) => children.some(c => isItemActive(c.href));

  const itemClass =
    "h-10 rounded-xl data-[active=true]:bg-gradient-to-r data-[active=true]:from-accent data-[active=true]:to-accent/90 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-accent/20 hover:bg-white/[0.07] transition-all duration-150";

  return (
    <SidebarMenu className="gap-0.5">
      {items.map((item) => {
        if (item.children) {
          const groupActive    = isGroupActive(item.children);
          const groupHasBadge  = item.children.some(c => c.badge) && unreadCount > 0;
          return (
            <Collapsible key={item.id} defaultOpen={groupActive || !!item.initialOpen} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={groupActive}
                    className={itemClass}
                  >
                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="font-bold text-sm">{item.label}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {groupHasBadge && (
                        <Badge className="bg-accent text-white text-[9px] font-black h-4 min-w-4 rounded-full px-1 shadow-lg shadow-accent/30">
                          {unreadCount}
                        </Badge>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 opacity-50 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </span>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="border-l border-white/[0.08] ml-3">
                    {item.children.map((child) => (
                      <SidebarMenuSubItem key={child.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isItemActive(child.href)}
                          className="rounded-lg data-[active=true]:bg-accent/20 data-[active=true]:text-white hover:bg-white/[0.06] transition-all"
                        >
                          <Link
                            id={child.id}
                            href={child.href}
                            onClick={() => isMobile && setOpenMobile(false)}
                            className="flex items-center gap-2"
                          >
                            <child.icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-semibold text-xs">{child.label}</span>
                            {child.badge && unreadCount > 0 && (
                              <Badge className="ml-auto bg-accent text-white text-[9px] font-black h-4 min-w-4 rounded-full px-1">
                                {unreadCount}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        }

        return (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              asChild
              isActive={isItemActive(item.href!)}
              tooltip={item.label}
              className={itemClass}
            >
              <Link
                id={item.id}
                href={item.href!}
                onClick={() => isMobile && setOpenMobile(false)}
                className="flex items-center gap-3"
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                <span className="font-bold text-sm">{item.label}</span>
                {item.badge && unreadCount > 0 && (
                  <Badge className="ml-auto bg-accent text-white text-[10px] font-black h-5 min-w-5 rounded-full shadow-lg shadow-accent/30 animate-in zoom-in">
                    {unreadCount}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
});
NavMenu.displayName = "NavMenu";

/* ─── Layout ─────────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const router     = useRouter();
  const { user, profile, userRole, loading: isUserLoading, signOut } = useAuth();
  const { tenant } = useTenant();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useTimeTracker(user?.id);
  useEffect(() => { setHasHydrated(true); }, []);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count, error } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      if (!error) setUnreadCount(count || 0);
    };
    fetchUnread();
    const channel = supabase
      .channel('unread_sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const navItems = useMemo(() => {
    if (userRole === 'admin') return adminItems;
    if (userRole === 'staff') return secretaryItems;
    if (userRole === 'teacher') return teacherItems;
    return studentItems;
  }, [userRole]);

  useEffect(() => {
    if (hasHydrated && !isUserLoading) {
      if (!user) {
        router.replace("/login");
      }
    }
  }, [user, isUserLoading, router, hasHydrated, pathname]);

  const isFullBleedPage = useMemo(
    () => pathname.includes('/chat/') || pathname.includes('/forum/') || pathname.includes('/classroom/') || pathname.includes('/live/') || pathname.includes('/library/book/') || (pathname.includes('/student/provas/') && pathname !== '/dashboard/student/provas'),
    [pathname]
  );

  const hideLayoutHeader = useMemo(
    () => pathname.includes('/library/book/') || (pathname.includes('/student/provas/') && pathname !== '/dashboard/student/provas'),
    [pathname]
  );

  if (!hasHydrated || isUserLoading) return <LoadingShell />;
  if (!user) return null;

  const userAvatar = profile?.avatar_url || `https://picsum.photos/seed/${user.id}/100/100`;

  return (
    <ExtractionProvider>
    <SidebarProvider>
      {/* ── Sidebar ── */}
      <Sidebar
        side="left"
        collapsible="icon"
        className="border-none bg-sidebar overflow-hidden
          [background-image:linear-gradient(135deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.02)_35%,transparent_58%),linear-gradient(to_bottom,rgba(255,255,255,0.04)_0%,transparent_35%),linear-gradient(to_top,rgba(0,0,0,0.12)_0%,transparent_40%)]"
      >
        {/* Top gloss streak — extra highlight along top edge */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-20"
        />
        {/* Right edge gloss */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent z-20"
        />

        <SidebarHeader className="p-4 pb-3">
          <div id="sidebar-logo" className="flex items-center gap-2.5">
            <div className="relative h-10 w-10 shrink-0 flex items-center justify-center">
              <Image
                src={tenant.branding.logoUrl}
                alt="Logo"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden gap-0.5">
              <span className="text-sm font-black text-white italic leading-tight">{tenant.branding.appName}</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2.5">
          <SidebarGroup>
            <NavMenu items={navItems} pathname={pathname || ''} unreadCount={unreadCount} />
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-white/[0.06] space-y-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => signOut()}
                className="text-red-400/80 hover:text-red-400 hover:bg-red-500/10 h-10 rounded-xl transition-all"
              >
                <LogOut className="h-4 w-4" />
                <span className="font-bold text-xs">Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* ── Main content ── */}
      <SidebarInset className="bg-background flex flex-col h-[100dvh] overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/[0.02] via-transparent to-accent/[0.02] pointer-events-none" />

        {!hideLayoutHeader && (
          <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur-sm px-4 md:px-6 shrink-0 print:hidden">
            <SidebarTrigger className="h-10 w-10 rounded-xl hover:bg-muted text-primary">
              <Menu className="h-6 w-6" />
            </SidebarTrigger>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <NotificationBell />
              <Link id="header-profile" href="/dashboard/settings" className="flex items-center gap-3 md:gap-4 group hover:opacity-80 transition-opacity ml-2">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-black text-primary italic leading-none group-hover:text-accent transition-colors">
                    {profile?.name || user.user_metadata?.full_name
                      ? ((profile?.name || user.user_metadata?.full_name).trim().split(' ').length > 1
                          ? `${(profile?.name || user.user_metadata?.full_name).trim().split(' ')[0]} ${(profile?.name || user.user_metadata?.full_name).trim().split(' ').pop()}`
                          : (profile?.name || user.user_metadata?.full_name))
                      : "Usuário"}
                  </span>
                  <span className="text-[8px] font-black text-accent uppercase tracking-widest">
                    {profile?.profile_type === 'student' || user.user_metadata?.profile_type === 'student' || userRole === 'student'
                      ? `${profile?.exam_target || user.user_metadata?.exam_target || 'ENEM'} • ${profile?.institution || user.user_metadata?.institution || 'Colégio'}`
                      : (profile?.profile_type || user.user_metadata?.profile_type || (
                          userRole === 'admin' ? 'Coordenação' :
                          userRole === 'teacher' ? 'Professor' :
                          userRole === 'staff' ? 'Secretaria' : 'User'))}
                  </span>
                </div>
                <Avatar className="h-9 w-9 md:h-10 md:w-10 border-2 border-primary/5 shadow-xl group-hover:border-accent transition-[border-color]">
                  <AvatarImage src={userAvatar} />
                  <AvatarFallback className="bg-primary text-white text-xs">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </header>
        )}

        <main className={`flex-1 flex flex-col min-h-0 overflow-y-auto ${isFullBleedPage ? 'p-0' : 'p-4 md:p-8'} ${!isFullBleedPage ? 'pb-20 lg:pb-8' : ''}`}>
          <div className={isFullBleedPage ? 'flex-1 flex flex-col min-h-0' : 'max-w-7xl mx-auto w-full'}>
            <Suspense fallback={<div className="p-8 opacity-20 animate-pulse"><Sparkles className="h-10 w-10 text-accent" /></div>}>
              {children}
            </Suspense>
          </div>
        </main>

        <TelemetryProvider />
        <OnboardingTour />
        <PhoneGate />
        <UrgentNotice />
        <PushPermissionBanner />
        <FloatingExtractionBubble />
        <FeedbackWidget />
      </SidebarInset>
      {!isFullBleedPage && <MobileBottomNav />}
    </SidebarProvider>
    </ExtractionProvider>
  );
}
