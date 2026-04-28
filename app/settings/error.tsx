"use client";

export default function SettingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 flex flex-col items-center justify-center px-4 bottom-nav-offset lg:pb-8 text-center gap-4">
        <p className="text-4xl">⚠️</p>
        <h2 className="font-semibold text-lg">Couldn&apos;t load settings</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Notion timed out. Your settings are unchanged — tap retry to try again.
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
