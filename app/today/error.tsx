"use client";

export default function TodayError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="h-4 w-24 bg-muted rounded mb-2" />
          <div className="h-2 w-48 bg-muted rounded" />
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-32 text-center gap-4">
        <p className="text-4xl">⚠️</p>
        <h2 className="font-semibold text-lg">Notion isn&apos;t responding</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          The sync timed out. Your data is safe — tap retry to try again.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-95 transition-all"
        >
          Retry sync
        </button>
      </main>
    </div>
  );
}
