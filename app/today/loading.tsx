export default function TodayLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b px-4 pt-3.5 pb-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="h-3 w-16 bg-muted rounded animate-pulse mb-2" />
              <div className="h-10 w-48 bg-muted rounded animate-pulse" />
              <div className="h-7 w-36 bg-muted rounded animate-pulse mt-1.5" />
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <div className="flex gap-1">
                <div className="w-10 h-10 bg-muted rounded-xl animate-pulse" />
                <div className="w-10 h-10 bg-muted rounded-xl animate-pulse" />
                <div className="w-10 h-10 bg-muted rounded-xl animate-pulse" />
              </div>
              <div className="w-[46px] h-[46px] bg-muted rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-4 bottom-nav-offset lg:pb-8 max-w-2xl mx-auto w-full space-y-6">
        <div className="h-9 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-3">
          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-[72px] rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
