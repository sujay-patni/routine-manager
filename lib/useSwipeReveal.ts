"use client";
import { useState, useRef, useCallback } from "react";

interface Options {
  actionWidth?: number;
  threshold?: number;
}

export function useSwipeReveal({ actionWidth = 88, threshold = 50 }: Options = {}) {
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const startRef = useRef({ x: 0, y: 0 });
  const dirRef = useRef<"h" | "v" | null>(null);
  const openRef = useRef(false);

  const close = useCallback(() => {
    setIsSnapping(true);
    setIsOpen(false);
    openRef.current = false;
    setTranslateX(0);
  }, []);

  const handlers = {
    onTouchStart(e: React.TouchEvent) {
      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dirRef.current = null;
      setIsSnapping(false);
    },
    onTouchMove(e: React.TouchEvent) {
      const dx = startRef.current.x - e.touches[0].clientX;
      const dy = Math.abs(startRef.current.y - e.touches[0].clientY);
      if (dirRef.current === null && (Math.abs(dx) > 6 || dy > 6)) {
        dirRef.current = Math.abs(dx) > dy ? "h" : "v";
      }
      if (dirRef.current !== "h") return;
      const base = openRef.current ? actionWidth : 0;
      setTranslateX(Math.max(0, Math.min(actionWidth, base + dx)));
    },
    onTouchEnd(e: React.TouchEvent) {
      if (dirRef.current !== "h") return;
      dirRef.current = null;
      setIsSnapping(true);
      const dx = startRef.current.x - e.changedTouches[0].clientX;
      if (!openRef.current && dx > threshold) {
        openRef.current = true;
        setIsOpen(true);
        setTranslateX(actionWidth);
      } else if (openRef.current && dx < -(threshold / 2)) {
        openRef.current = false;
        setIsOpen(false);
        setTranslateX(0);
      } else {
        setTranslateX(openRef.current ? actionWidth : 0);
      }
    },
  };

  return { isOpen, translateX, isSnapping, close, handlers, actionWidth };
}
