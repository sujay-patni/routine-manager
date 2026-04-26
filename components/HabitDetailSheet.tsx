"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Habit } from "@/lib/notion/types";
import { useIsMobile } from "@/lib/useMediaQuery";

interface HabitDetailSheetProps {
  habit: Habit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

const FREQ_LABELS: Record<string, string> = {
  daily: "Every day",
  weekly: "Weekly",
  specific_days_weekly: "Specific days of the week",
  specific_dates_monthly: "Specific dates each month",
  specific_dates_yearly: "Specific dates each year",
};

const PERIOD_LABELS: Record<string, string> = {
  daily: "per day",
  weekly: "per week",
  monthly: "per month",
  yearly: "per year",
};

const DAY_ABBR: Record<string, string> = {
  MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun",
};

const TIME_OF_DAY_LABELS: Record<string, string> = {
  morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night",
};

function formatExactTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm flex-1">{value}</span>
    </div>
  );
}

export default function HabitDetailSheet({ habit, open, onOpenChange, onEdit }: HabitDetailSheetProps) {
  const isMobile = useIsMobile();

  if (!habit) return null;

  const specificDaysLabel = (() => {
    if (!habit.specific_days) return null;
    if (habit.frequency === "specific_days_weekly") {
      return habit.specific_days.split(",").map(d => DAY_ABBR[d.trim()] ?? d.trim()).join(", ");
    }
    if (habit.frequency === "specific_dates_monthly") {
      const dates = habit.specific_days.split(",").map(d => {
        const n = parseInt(d.trim(), 10);
        const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
        return `${n}${suffix}`;
      });
      return dates.join(", ") + " of each month";
    }
    if (habit.frequency === "specific_dates_yearly") {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return habit.specific_days.split(",").map(s => {
        const [mo, d] = s.trim().split("-");
        return `${months[parseInt(mo, 10) - 1]} ${parseInt(d, 10)}`;
      }).join(", ");
    }
    return null;
  })();

  const content = (
    <div className="space-y-5 px-4 pb-4">
      {/* Description */}
      {habit.description && (
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{habit.description}</p>
        </div>
      )}
      {!habit.description && (
        <p className="text-sm text-muted-foreground italic">No description added.</p>
      )}

      {/* Details */}
      <div className="space-y-3">
        <DetailRow label="Frequency" value={FREQ_LABELS[habit.frequency] ?? habit.frequency} />

        {specificDaysLabel && (
          <DetailRow label="On" value={specificDaysLabel} />
        )}

        {habit.frequency === "weekly" && habit.weekly_target && (
          <DetailRow label="Weekly target" value={`${habit.weekly_target}× per week`} />
        )}

        {habit.time_of_day && (
          <DetailRow label="Time of day" value={TIME_OF_DAY_LABELS[habit.time_of_day] ?? habit.time_of_day} />
        )}

        {habit.exact_time && (
          <DetailRow label="Exact time" value={formatExactTime(habit.exact_time)} />
        )}

        {habit.progress_metric && habit.progress_target != null && (
          <DetailRow
            label="Progress goal"
            value={`${habit.progress_start ?? 0} → ${habit.progress_target} ${habit.progress_metric} ${PERIOD_LABELS[habit.progress_period ?? "daily"] ?? ""}`}
          />
        )}
      </div>

      {/* Edit button */}
      {onEdit && (
        <Button
          className="w-full"
          variant="outline"
          onClick={() => { onOpenChange(false); onEdit(); }}
        >
          Edit habit
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto pb-safe-offset-6">
          <SheetHeader className="pb-0">
            <SheetTitle className="text-left">{habit.name}</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{habit.name}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
