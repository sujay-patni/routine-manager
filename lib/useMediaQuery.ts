"use client";

import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, serverSnapshot = false) {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", onStoreChange);
      return () => mediaQuery.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => serverSnapshot
  );
}

export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)", true);
}
