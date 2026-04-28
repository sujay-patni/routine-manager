"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import VacationEditorSheet, { type EditorMode } from "@/components/VacationEditorSheet";
import { endVacationNow, removeVacation } from "@/app/actions/vacations";
import type { Habit, Group, Vacation } from "@/lib/notion/types";

interface Props {
  vacations: Vacation[];
  templates: Vacation[];
  habits: Habit[];
  groups: Group[];
  today: string; // YYYY-MM-DD in user's timezone
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sameYear = s.getFullYear() === e.getFullYear();
  const sFmt = s.toLocaleDateString(undefined, { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
  const eFmt = e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${sFmt} – ${eFmt}`;
}

function countPausedHabits(v: Vacation, habits: Habit[]): number {
  const ids = new Set(v.habit_ids);
  const groupSet = new Set(v.group_ids);
  for (const h of habits) {
    if (h.group_id && groupSet.has(h.group_id)) ids.add(h.id);
  }
  return ids.size;
}

export default function VacationsClient({ vacations, templates, habits, groups, today }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editor, setEditor] = useState<{ mode: EditorMode; vacation: Vacation | null; templateSource: Vacation | null } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const { current, upcoming, past } = useMemo(() => {
    const c: Vacation[] = [], u: Vacation[] = [], p: Vacation[] = [];
    for (const v of vacations) {
      if (!v.start_date || !v.end_date) continue;
      if (v.end_date < today) p.push(v);
      else if (v.start_date > today) u.push(v);
      else c.push(v);
    }
    u.sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
    return { current: c, upcoming: u, past: p };
  }, [vacations, today]);

  function refreshAndClose() {
    setEditor(null);
    router.refresh();
  }

  function handleDelete(id: string) {
    if (confirmingDelete !== id) {
      setConfirmingDelete(id);
      return;
    }
    setConfirmingDelete(null);
    setOpenMenu(null);
    startTransition(async () => {
      const res = await removeVacation(id);
      if (res.error) console.error(res.error);
      router.refresh();
    });
  }

  function handleEndNow(id: string) {
    setOpenMenu(null);
    startTransition(async () => {
      const res = await endVacationNow(id);
      if (res.error) console.error(res.error);
      router.refresh();
    });
  }

  function VacationCard({ v, kind }: { v: Vacation; kind: "current" | "upcoming" | "past" }) {
    const pausedCount = countPausedHabits(v, habits);
    const groupCount = v.group_ids.length;
    const menuOpen = openMenu === v.id;
    const showActions = kind !== "past";
    return (
      <div className="rounded-2xl border bg-card card-elevated p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{v.name || "Untitled vacation"}</p>
            <p className="text-xs text-muted-foreground">{formatDateRange(v.start_date, v.end_date)}</p>
          </div>
          <div className="relative flex-shrink-0">
            {kind === "current" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs mr-1"
                onClick={() => handleEndNow(v.id)}
              >
                End now
              </Button>
            )}
            {showActions && (
              <button
                type="button"
                aria-label="More actions"
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                onClick={() => setOpenMenu(menuOpen ? null : v.id)}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
              </button>
            )}
            {showActions && menuOpen && (
              <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border bg-popover shadow-lg p-1 text-sm">
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 rounded-md hover:bg-muted"
                  onClick={() => { setOpenMenu(null); setEditor({ mode: "instance", vacation: v, templateSource: null }); }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 rounded-md hover:bg-muted"
                  onClick={() => { setOpenMenu(null); setEditor({ mode: "template", vacation: null, templateSource: v }); }}
                >
                  Save as preset
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 rounded-md text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(v.id)}
                >
                  {confirmingDelete === v.id ? "Tap again to confirm" : "Delete"}
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Pausing {pausedCount} habit{pausedCount === 1 ? "" : "s"}
          {groupCount > 0 && ` across ${groupCount} group${groupCount === 1 ? "" : "s"}`}
        </p>
      </div>
    );
  }

  function PresetCard({ v }: { v: Vacation }) {
    const pausedCount = countPausedHabits(v, habits);
    const menuOpen = openMenu === v.id;
    return (
      <div className="rounded-2xl border bg-card card-elevated p-4 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{v.name || "Untitled preset"}</p>
          <p className="text-xs text-muted-foreground">{pausedCount} habit{pausedCount === 1 ? "" : "s"}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs flex-shrink-0"
          onClick={() => setEditor({ mode: "apply", vacation: null, templateSource: v })}
        >
          Use
        </Button>
        <div className="relative flex-shrink-0">
          <button
            type="button"
            aria-label="More actions"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            onClick={() => setOpenMenu(menuOpen ? null : v.id)}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border bg-popover shadow-lg p-1 text-sm">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 rounded-md hover:bg-muted"
                onClick={() => { setOpenMenu(null); setEditor({ mode: "template", vacation: v, templateSource: null }); }}
              >
                Edit preset
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 rounded-md text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(v.id)}
              >
                {confirmingDelete === v.id ? "Tap again to confirm" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-fraunces font-normal text-[28px] tracking-tight leading-tight">Vacations</h1>
        </div>
      </header>

      <main
        className="flex-1 overflow-y-auto px-4 py-4 pb-32 max-w-2xl mx-auto w-full space-y-6"
        onClick={() => { if (openMenu) setOpenMenu(null); }}
      >
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => { e.stopPropagation(); setEditor({ mode: "instance", vacation: null, templateSource: null }); }}
          >
            + New vacation
          </Button>
        </div>

        {vacations.length === 0 && templates.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No vacations yet. Create one to pause habits while you&apos;re away.
          </p>
        )}

        {current.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Current</h2>
            <div className="space-y-2">
              {current.map((v) => <VacationCard key={v.id} v={v} kind="current" />)}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Upcoming</h2>
            <div className="space-y-2">
              {upcoming.map((v) => <VacationCard key={v.id} v={v} kind="upcoming" />)}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Presets</h2>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={(e) => { e.stopPropagation(); setEditor({ mode: "template", vacation: null, templateSource: null }); }}
            >
              + New preset
            </Button>
          </div>
          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Save a reusable selection of habits — handy for trips you take repeatedly.
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((v) => <PresetCard key={v.id} v={v} />)}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Past</h2>
            <div className="space-y-2">
              {past.map((v) => <VacationCard key={v.id} v={v} kind="past" />)}
            </div>
          </section>
        )}
      </main>

      {editor && (
        <VacationEditorSheet
          open={true}
          mode={editor.mode}
          vacation={editor.vacation}
          templateSource={editor.templateSource}
          templates={templates}
          habits={habits}
          groups={groups}
          today={today}
          onOpenChange={(o) => { if (!o) refreshAndClose(); }}
        />
      )}
    </div>
  );
}
