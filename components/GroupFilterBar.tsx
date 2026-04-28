"use client";

import { cn } from "@/lib/utils";
import type { Group } from "@/lib/notion/types";

interface GroupFilterBarProps {
  groups: Group[];
  activeFilters: string[];
  onFilterChange: (filters: string[]) => void;
  showUnassigned?: boolean;
}

export default function GroupFilterBar({
  groups,
  activeFilters,
  onFilterChange,
  showUnassigned = true,
}: GroupFilterBarProps) {
  if (groups.length === 0 && !showUnassigned) return null;

  const pills: Array<{ id: string; label: string; color?: string }> = [
    { id: "all", label: "All" },
    ...(showUnassigned ? [{ id: "unassigned", label: "Not Assigned" }] : []),
    ...groups.map((g) => ({ id: g.id, label: g.name, color: g.color })),
  ];

  function handleClick(id: string) {
    if (id === "all") {
      onFilterChange([]);
      return;
    }
    const next = activeFilters.includes(id)
      ? activeFilters.filter((f) => f !== id)
      : [...activeFilters, id];
    onFilterChange(next);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {pills.map((pill) => {
        const isActive = pill.id === "all" ? activeFilters.length === 0 : activeFilters.includes(pill.id);
        return (
          <button
            key={pill.id}
            onClick={() => handleClick(pill.id)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              isActive
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
            )}
            style={
              isActive && pill.color
                ? { backgroundColor: pill.color, borderColor: pill.color, color: "#fff" }
                : undefined
            }
          >
            {pill.color && !isActive && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: pill.color }}
              />
            )}
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
