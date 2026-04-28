export default function TodayLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="h-4 w-32 bg-muted rounded animate-pulse mb-2" />
          <div className="h-2 w-full bg-muted rounded animate-pulse" />
        </div>
      </header>
      <main className="flex-1 px-4 py-4 bottom-nav-offset lg:pb-8 max-w-2xl mx-auto w-full space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </main>
    </div>
  );
}
