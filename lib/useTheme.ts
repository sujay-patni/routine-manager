"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function getBrowserTheme(): Theme {
  const saved = localStorage.getItem("rt-theme") as Theme | null;
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "light";
  return getBrowserTheme();
}

function subscribeTheme(onStoreChange: () => void) {
  listeners.add(onStoreChange);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    listeners.forEach((listener) => listener());
  };

  window.addEventListener("storage", handleChange);
  media.addEventListener("change", handleChange);
  queueMicrotask(handleChange);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", handleChange);
    media.removeEventListener("change", handleChange);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function setTheme(t: Theme) {
    localStorage.setItem("rt-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
    listeners.forEach((listener) => listener());
  }

  return { theme, setTheme };
}
