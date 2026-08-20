"use client";

import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const TeacherAnalyticsDashboard = dynamic(
  () => import("@/components/TeacherAnalyticsDashboard"),
  { ssr: false }
);

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('user') || undefined;

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <TeacherAnalyticsDashboard userId={userId} />
    </div>
  );
}
