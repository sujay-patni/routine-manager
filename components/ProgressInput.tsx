"use client";

import { useState, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressInputProps {
  metric: string;
  target: number;
  start?: number;
  current: number;
  onUpdate: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function ProgressInput({
  metric,
  target,
  start = 0,
  current,
  onUpdate,
  disabled,
  className,
}: ProgressInputProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(current));
  const inputRef = useRef<HTMLInputElement>(null);

  const range = target - start;
  const progress = range > 0 ? Math.min(100, ((current - start) / range) * 100) : 0;
  const isDone = current >= target;

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled) return;
    setInputVal(String(current));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const val = Math.max(start, Math.min(target * 2, Number(inputVal) || 0));
    onUpdate(val);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className={cn("flex items-center gap-2 mt-1.5", className)}
      >
        <input
          ref={inputRef}
          type="number"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSubmit}
          min={start}
          className="w-20 text-sm border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground">/ {target} {metric}</span>
        <button type="submit" className="text-xs text-primary font-medium">Save</button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={disabled}
      className={cn("w-full text-left mt-1.5 space-y-1", className)}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {current} / {target} {metric}
        </span>
        {isDone && (
          <span className="text-xs text-emerald-600 font-medium">Done ✓</span>
        )}
      </div>
      <Progress
        value={progress}
        className={cn("h-1.5", isDone && "[&>div]:bg-emerald-500")}
      />
    </button>
  );
}
