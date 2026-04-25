"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createGroup, updateGroup, deleteGroup } from "@/app/actions/groups";
import { GROUP_PALETTE, DEFAULT_GROUP_COLOR } from "@/lib/groups-palette";
import type { Group, Habit, AppEvent } from "@/lib/notion/types";

interface Props {
  groups: Group[];
  habits: Habit[];
  events: AppEvent[];
}

function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {GROUP_PALETTE.map((c) => (
        <button
          key={c.hex}
          type="button"
          onClick={() => onChange(c.hex)}
          title={c.name}
          className={cn(
            "w-7 h-7 rounded-full transition-all flex-shrink-0",
            value === c.hex && "ring-2 ring-offset-2 ring-foreground"
          )}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}

export default function GroupsClient({ groups: initialGroups, habits, events }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localGroups, setLocalGroups] = useState(initialGroups);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_GROUP_COLOR);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_GROUP_COLOR);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const habitsByGroup = useMemo(() => {
    const map = new Map<string, Habit[]>();
    for (const h of habits) {
      if (h.group_id) {
        const list = map.get(h.group_id) ?? [];
        list.push(h);
        map.set(h.group_id, list);
      }
    }
    return map;
  }, [habits]);

  const eventsByGroup = useMemo(() => {
    const map = new Map<string, AppEvent[]>();
    for (const e of events) {
      if (e.group_id) {
        const list = map.get(e.group_id) ?? [];
        list.push(e);
        map.set(e.group_id, list);
      }
    }
    return map;
  }, [events]);

  function startEdit(group: Group) {
    setEditingId(group.id);
    setEditName(group.name);
    setEditColor(group.color);
    setExpandedId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    setIsPending(true);
    setError(null);
    const result = await updateGroup(id, { name: editName.trim(), color: editColor });
    setIsPending(false);
    if ("error" in result) {
      setError(result.error ?? null);
      return;
    }
    setLocalGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, name: editName.trim(), color: editColor } : g))
    );
    setEditingId(null);
    startTransition(() => router.refresh());
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setIsPending(true);
    setError(null);
    const result = await createGroup({ name: newName.trim(), color: newColor });
    setIsPending(false);
    if ("error" in result) {
      setError(result.error ?? null);
      return;
    }
    if (result.group) {
      setLocalGroups((prev) => [...prev, result.group!]);
    }
    setNewName("");
    setNewColor(DEFAULT_GROUP_COLOR);
    setAddingNew(false);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    setIsPending(true);
    setError(null);
    const result = await deleteGroup(id);
    setIsPending(false);
    if ("error" in result) {
      setError(result.error ?? null);
      setConfirmDeleteId(null);
      return;
    }
    setLocalGroups((prev) => prev.filter((g) => g.id !== id));
    setConfirmDeleteId(null);
    startTransition(() => router.refresh());
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
          <h1 className="font-fraunces font-normal text-[28px] tracking-tight leading-tight">Groups</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 max-w-2xl mx-auto w-full space-y-3">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {localGroups.length === 0 && !addingNew && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No groups yet. Create one to start organizing your habits and events.
          </p>
        )}

        {localGroups.map((group) => {
          const groupHabits = habitsByGroup.get(group.id) ?? [];
          const groupEvents = eventsByGroup.get(group.id) ?? [];
          const itemCount = groupHabits.length + groupEvents.length;
          const isExpanded = expandedId === group.id;
          const isEditing = editingId === group.id;
          const isConfirmingDelete = confirmDeleteId === group.id;

          return (
            <div key={group.id} className="rounded-2xl border bg-card card-elevated overflow-hidden">
              {isEditing ? (
                <div className="p-4 space-y-3">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Group name"
                    className="text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(group.id)}
                    autoFocus
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => handleSaveEdit(group.id)} disabled={isPending || !editName.trim()}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isPending}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : isConfirmingDelete ? (
                <div className="p-4 space-y-2">
                  <p className="text-sm font-medium">Delete &quot;{group.name}&quot;?</p>
                  <p className="text-xs text-muted-foreground">
                    All {itemCount} item{itemCount !== 1 ? "s" : ""} will become unassigned.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(group.id)} disabled={isPending}>
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)} disabled={isPending}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-4">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{group.name}</p>
                      {itemCount > 0 && (
                        <p className="text-xs text-muted-foreground">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {itemCount > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : group.id)}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
                        >
                          {isExpanded ? "Hide" : "Show"}
                        </button>
                      )}
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => startEdit(group)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-destructive hover:text-destructive"
                        onClick={() => setConfirmDeleteId(group.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (groupHabits.length > 0 || groupEvents.length > 0) && (
                    <div className="border-t px-4 py-3 space-y-3">
                      {groupHabits.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Habits</p>
                          <div className="space-y-1">
                            {groupHabits.map((h) => (
                              <div key={h.id} className="text-sm flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                                <span className="truncate">{h.name}</span>
                                {!h.is_active && <span className="text-xs text-muted-foreground">(paused)</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {groupEvents.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Events</p>
                          <div className="space-y-1">
                            {groupEvents.map((e) => (
                              <div key={e.id} className="text-sm flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                                <span className="truncate">{e.title}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">{e.event_type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {addingNew ? (
          <div className="rounded-2xl border bg-card card-elevated p-4 space-y-3">
            <p className="text-sm font-semibold">New Group</p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name"
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleCreate} disabled={isPending || !newName.trim()}>
                Create
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingNew(false); setNewName(""); setNewColor(DEFAULT_GROUP_COLOR); }} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            className="w-full rounded-2xl border border-dashed bg-card/50 p-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-center"
          >
            + Add Group
          </button>
        )}
      </main>
    </div>
  );
}
