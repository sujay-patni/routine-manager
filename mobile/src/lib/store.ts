import { useEffect, useState } from "react";

// Tiny change signal: services call notifyDataChanged() after every write,
// and screens re-load their data when the version number moves.
let version = 0;
const listeners = new Set<(v: number) => void>();

export function notifyDataChanged() {
  version += 1;
  for (const l of listeners) l(version);
}

export function useDataVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    listeners.add(setV);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}
