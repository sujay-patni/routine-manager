"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveVacation, applyTemplate } from "@/app/actions/vacations";
import { useIsMobile } from "@/lib/useMediaQuery";
import type { Habit, Group, Vacation } from "@/lib/notion/types";

export type EditorMode = "instance" | "template" | "apply";

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: EditorMode;
  vacation: Vacation | null;       // for instance/template edit
  templateSource: Vacation | null; // for "apply" or "save current as preset"
  templates: Vacation[];
  habits: Habit[];
  groups: Group[];
  today: string;
}

export default function VacationEditorSheet({
  open, onOpenChange, mode, vacation, templateSource, templates, habits, groups, today,
}: Props) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const seed = vacation ?? templateSource;

  const [name, setName] = useState(seed?.name ?? "");
  const [startDate, setStartDate] = useState(vacation?.start_date ?? (mode === "apply" ? today : ""));
  const [endDate, setEndDate] = useState(vacation?.end_date ?? "");
  const [note, setNote] = useState(seed?.note ?? "");
  const [selectedHabits, setSelectedHabits] = useState<Set<string>>(new Set(seed?.habit_ids ?? []));
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set(seed?.group_ids ?? []));
  const [savePreset, setSavePreset] = useState(false);
  const [editingApplySelection, setEditingApplySelection] = useState(false);
  const [appliedPresetId, setAppliedPresetId] = useState(templateSource?.id ?? "");

  const showDates = mode !== "template";
  const selectionLocked = mode === "apply" && !editingApplySelection;
  const allowSavePreset = mode === "instance" && !vacation; // creating a new instance
  const allowPresetPicker = mode === "instance" && !vacation && templates.length > 0;
  const appliedPresetName = appliedPresetId
    ? templates.find((tpl) => tpl.id === appliedPresetId)?.name || "Untitled preset"
    : "Start with a preset";

  const habitsByGroup = useMemo(() => {
    const m = new Map<string, Habit[]>();
    for (const h of habits) {
      const k = h.group_id ?? "__nogroup__";
      const list = m.get(k) ?? [];
      list.push(h);
      m.set(k, list);
    }
    return m;
  }, [habits]);

  const habitsBySection = useMemo(() => {
    const m: Record<SectionKey, Habit[]> = { morning: [], afternoon: [], evening: [], night: [], all_day: [] };
    for (const h of habits) m[getHabitSection(h)].push(h);
    for (const k of SECTION_ORDER) {
      m[k].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
    }
    return m;
  }, [habits]);

  const effectiveHabitIds = useMemo(() => {
    const ids = new Set(selectedHabits);
    for (const h of habits) {
      if (h.group_id && selectedGroups.has(h.group_id)) ids.add(h.id);
    }
    return ids;
  }, [selectedHabits, selectedGroups, habits]);

  function toggleGroup(id: string) {
    if (selectionLocked) return;
    setSelectedGroups((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleHabit(id: string) {
    if (selectionLocked) return;
    setSelectedHabits((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function isHabitDisabledByGroup(h: Habit) {
    return !!(h.group_id && selectedGroups.has(h.group_id));
  }

  function handlePresetChange(id: string) {
    setAppliedPresetId(id);
    if (!id) {
      setNote("");
      setSelectedHabits(new Set());
      setSelectedGroups(new Set());
      return;
    }

    const preset = templates.find((t) => t.id === id);
    if (!preset) return;
    setName(preset.name);
    setNote(preset.note ?? "");
    setSelectedHabits(new Set(preset.habit_ids));
    setSelectedGroups(new Set(preset.group_ids));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("Name is required"); return; }
    const isTemplate = mode === "template";
    if (!isTemplate) {
      if (!startDate || !endDate) { setError("Pick a start and end date"); return; }
      if (startDate > endDate) { setError("End date must be on or after start date"); return; }
    }
    if (effectiveHabitIds.size === 0 && selectedGroups.size === 0) {
      setError("Select at least one habit or group to pause");
      return;
    }

    startTransition(async () => {
      let res;
      if (mode === "apply" && templateSource && !editingApplySelection) {
        res = await applyTemplate(templateSource.id, {
          start_date: startDate,
          end_date: endDate,
          name: name.trim(),
        });
      } else {
        res = await saveVacation({
          id: vacation?.id,
          name: name.trim(),
          is_template: isTemplate,
          start_date: isTemplate ? null : startDate,
          end_date: isTemplate ? null : endDate,
          habit_ids: Array.from(selectedHabits),
          group_ids: Array.from(selectedGroups),
          note: note.trim() || null,
        });

        if (!res.error && allowSavePreset && savePreset) {
          await saveVacation({
            name: name.trim(),
            is_template: true,
            habit_ids: Array.from(selectedHabits),
            group_ids: Array.from(selectedGroups),
            note: note.trim() || null,
          });
        }
      }

      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      onOpenChange(false);
    });
  }

  const title =
    mode === "apply" ? `Apply preset` :
    mode === "template" ? (vacation ? "Edit preset" : "New preset") :
    (vacation ? "Edit vacation" : "New vacation");

  const formContent = (
    <>
      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-5">
        {allowPresetPicker && (
          <div className="space-y-2">
            <Label>Preset</Label>
            <Select value={appliedPresetId} onValueChange={(v) => handlePresetChange(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue>{appliedPresetName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Custom vacation</SelectItem>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name || "Untitled preset"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === "template" ? "e.g. Jaipur" : "e.g. Japan trip"}
            required
          />
        </div>

        {showDates && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End date</Label>
              <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>What to pause</Label>
            <p className="text-xs text-muted-foreground">
              Pausing {effectiveHabitIds.size} habit{effectiveHabitIds.size === 1 ? "" : "s"}
            </p>
          </div>

          {selectionLocked ? (
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Using selection from preset “{templateSource?.name}”.
              </p>
              <button
                type="button"
                className="text-xs text-primary"
                onClick={() => setEditingApplySelection(true)}
              >
                Edit selection
              </button>
            </div>
          ) : (
            <Tabs defaultValue="groups">
              <TabsList className="w-full h-auto">
                <TabsTrigger value="groups" className="flex-1 text-xs py-2">By group</TabsTrigger>
                <TabsTrigger value="habits" className="flex-1 text-xs py-2">By habit</TabsTrigger>
              </TabsList>

              <TabsContent value="groups">
                <div className="space-y-1.5 mt-2">
                  {groups.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">No groups yet — switch to “By habit”.</p>
                  )}
                  {groups.map((g) => {
                    const inGroup = habitsByGroup.get(g.id)?.length ?? 0;
                    return (
                      <label
                        key={g.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl border bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <Checkbox
                          checked={selectedGroups.has(g.id)}
                          onCheckedChange={() => toggleGroup(g.id)}
                        />
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="text-sm flex-1">{g.name}</span>
                        <span className="text-xs text-muted-foreground">{inGroup} habit{inGroup === 1 ? "" : "s"}</span>
                      </label>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="habits">
                <div className="space-y-3 mt-2">
                  {SECTION_ORDER.map((sec) => {
                    const list = habitsBySection[sec];
                    if (list.length === 0) return null;
                    return (
                      <div key={sec} className="space-y-1">
                        <p className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{SECTION_LABELS[sec]}</p>
                        <div className="space-y-1">
                          {list.map((h) => {
                            const disabled = isHabitDisabledByGroup(h);
                            const checked = selectedHabits.has(h.id) || disabled;
                            const groupColor = groups.find((g) => g.id === h.group_id)?.color;
                            return (
                              <label
                                key={h.id}
                                className={`flex items-center gap-3 p-2.5 rounded-xl border bg-card transition-colors ${
                                  disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/30"
                                }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={disabled}
                                  onCheckedChange={() => toggleHabit(h.id)}
                                />
                                {groupColor && (
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: groupColor }} />
                                )}
                                <span className="text-sm flex-1 truncate">{h.name}</span>
                                {disabled && <span className="text-[10px] text-muted-foreground">via group</span>}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {mode !== "apply" && (
          <div className="space-y-2">
            <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything to remember…" />
          </div>
        )}

        {allowSavePreset && (
          <label className="flex items-center gap-3 p-2.5 rounded-xl border bg-card cursor-pointer hover:bg-muted/30 transition-colors">
            <Checkbox checked={savePreset} onCheckedChange={(c) => setSavePreset(!!c)} />
            <span className="text-sm flex-1">Also save as preset for next time</span>
          </label>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Saving…" : mode === "apply" ? "Apply preset" : "Save"}
        </Button>
      </form>
    </>
  );

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto px-6 pb-6">
          <DialogHeader className="mb-5">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-y-auto rounded-t-3xl px-4 pb-10">
        <SheetHeader className="mb-5" showHandle>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        {formContent}
      </SheetContent>
    </Sheet>
  );
}
