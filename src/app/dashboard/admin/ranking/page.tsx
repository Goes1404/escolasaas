import ExamRankingPanel from "@/components/ranking/ExamRankingPanel";

export const metadata = { title: "Ranking por prova" };

export default function AdminRankingPage() {
  return (
    <div className="mx-auto max-w-4xl px-1 pb-24">
      <ExamRankingPanel />
    </div>
  );
}
