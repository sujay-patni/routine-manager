"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateHabit, getAllHabits, reorderHabits } from "@/app/actions/habits";
import AddItemSheet from "@/components/AddItemSheet";
import EditHabitSheet from "@/components/EditHabitSheet";
import type { Habit, Group } from "@/lib/notion/types";

type SectionKey = "morning" | "afternoon" | "evening" | "night" | "all_day";

const SECTION_LABELS: Record<SectionKey, string> = {
  morning: "🌅 Morning",
  afternoon: "☀️ Afternoon",
  evening: "🌆 Evening",
  night: "🌙 Night",
  all_day: "🗓 All Day",
};

const SECTION_ORDER: SectionKey[] = ["morning", "afternoon", "evening", "night", "all_day"];

function getHabitSection(habit: Habit): SectionKey {
  if (habit.time_of_day) return habit.time_of_day as SectionKey;
  if (habit.exact_time) {
    const h = parseInt(habit.exact_time.split(":")[0], 10);
    if (h >= 4 && h < 12) return "morning";
    if (h >= 12 && h < 16) return "afternoon";
    if (h >= 16 && h < 20) return "evening";
    return "night";
  }
  return "all_day";
}

interface Props {
  habits: Habit[];
  groups: Group[];
}

export default function HabitsClient({ habits: initialHabits, groups }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [addHabitOpen, setAddHabitOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habits, setHabits] = useState(initialHabits);

  const [sectionOrder, setSectionOrder] = useState<Record<SectionKey, string[]>>(() => {
    const groups: Record<SectionKey, Habit[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
      all_day: [],
    };
    for (const h of initialHabits) {
      groups[getHabitSection(h)].push(h);
    }
    const result = {} as Record<SectionKey, string[]>;
    for (const key of SECTION_ORDER) {
      result[key] = groups[key]
        .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))
        .map((h) => h.id);
    }
    return result;
  });

  async function toggleHabitActive(habit: Habit) {
    await updateHabit(habit.id, { is_active: !habit.is_active });
    setHabits((prev) =>
      prev.map((h) => (h.id === habit.id ? { ...h, is_active: !h.is_active } : h))
    );
    router.refresh();
  }

  async function handleHabitAdded() {
    const updated = await getAllHabits();
    setHabits(updated);
    setSectionOrder((prev) => {
      const existingIds = new Set(Object.values(prev).flat());
      const newGroups = { ...prev };
      for (const h of updated) {
        if (!existingIds.has(h.id)) {
          const sec = getHabitSection(h);
          newGroups[sec] = [...newGroups[sec], h.id];
        }
      }
      return newGroups;
    });
  }

  async function handleHabitUpdated() {
    const updated = await getAllHabits();
    setHabits(updated);
    const groups: Record<SectionKey, Habit[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
      all_day: [],
    };
    for (const h of updated) groups[getHabitSection(h)].push(h);
    const newOrder = {} as Record<SectionKey, string[]>;
    for (const key of SECTION_ORDER) {
      newOrder[key] = groups[key]
        .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))
        .map((h) => h.id);
    }
    setSectionOrder(newOrder);
  }

  function moveHabit(sectionKey: SectionKey, index: number, direction: "up" | "down") {
    const ids = sectionOrder[sectionKey];
    const newIds = [...ids];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newIds.length) return;
    [newIds[index], newIds[swapIdx]] = [newIds[swapIdx], newIds[index]];
    setSectionOrder((prev) => ({ ...prev, [sectionKey]: newIds }));
    startTransition(async () => {
      const result = await reorderHabits(newIds);
      if (result.error) {
        console.error("Failed to save order:", result.error);
        setSectionOrder((prev) => ({ ...prev, [sectionKey]: ids }));
      }
    });
  }

  const habitById = new Map(habits.map((h) => [h.id, h]));

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
          <h1 className="font-fraunces font-normal text-[28px] tracking-tight leading-tight">Habits</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 bottom-nav-offset lg:pb-8 max-w-2xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Manage Habits</h2>
          <Button size="sm" variant="outline" onClick={() => setAddHabitOpen(true)}>
            + Add habit
          </Button>
        </div>

        {habits.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No habits yet. Add your first one!</p>
        )}

        {SECTION_ORDER.map((sectionKey) => {
          const ids = sectionOrder[sectionKey];
          const sectionHabits = ids.map((id) => habitById.get(id)).filter(Boolean) as Habit[];
          if (sectionHabits.length === 0) return null;

          return (
            <div key={sectionKey} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {SECTION_LABELS[sectionKey]}
              </h3>
              <div className="space-y-1">
                {sectionHabits.map((habit, idx) => (
                  <div
                    key={habit.id}
                    className="flex items-center gap-2 p-3 rounded-2xl border bg-card card-elevated"
                  >
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => moveHabit(sectionKey, idx, "up")}
                        disabled={idx === 0}
                        className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        aria-label="Move up"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveHabit(sectionKey, idx, "down")}
                        disabled={idx === sectionHabits.length - 1}
                        className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        aria-label="Move down"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate flex items-center gap-1.5">
                        {(() => {
                          const groupColor = groups.find((g) => g.id === habit.group_id)?.color;
                          return groupColor ? (
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: groupColor }} />
                          ) : null;
                        })()}
                        {habit.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {habit.frequency === "daily"
                          ? "Daily"
                          : habit.frequency === "weekly"
                            ? `${habit.weekly_target ?? 1}× per week`
                            : habit.frequency === "specific_days_weekly"
                              ? `${habit.specific_days ?? "custom"} weekly`
                              : habit.frequency === "specific_dates_monthly"
                                ? "Monthly"
                                : "Yearly"}
                        {habit.progress_metric ? ` · ${habit.progress_target} ${habit.progress_metric}` : ""}
                        {!habit.is_active && " · paused"}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingHabit(habit)}
                      className="text-xs flex-shrink-0"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={habit.is_active ? "outline" : "secondary"}
                      onClick={() => toggleHabitActive(habit)}
                      className="text-xs flex-shrink-0"
                    >
                      {habit.is_active ? "Pause" : "Resume"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>

      <AddItemSheet
        open={addHabitOpen}
        onOpenChange={(o) => {
          setAddHabitOpen(o);
          if (!o) handleHabitAdded();
        }}
        defaultTab="habit"
        groups={groups}
      />
      <EditHabitSheet
        habit={editingHabit}
        open={!!editingHabit}
        onOpenChange={(o) => {
          if (!o) setEditingHabit(null);
        }}
        onSaved={handleHabitUpdated}
        groups={groups}
      />
    </div>
  );
}
