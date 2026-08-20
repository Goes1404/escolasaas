export default function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-pulse px-4 py-6">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-muted" />
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-xl bg-muted" />
          <div className="h-4 w-72 rounded-lg bg-muted/60" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-[2rem] bg-muted" />
        ))}
      </div>

      <div className="h-64 rounded-[2.5rem] bg-muted" />
      <div className="h-48 rounded-[2.5rem] bg-muted/60" />
    </div>
  );
}
