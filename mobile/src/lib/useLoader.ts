import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDataVersion } from "./store";

/** Runs `load` on mount, whenever `deps` change, when the screen regains
 *  focus, and after any write (notifyDataChanged). Keeps showing the last
 *  result while reloading so screens don't flash. */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[]) {
  const version = useDataVersion();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const loadRef = useRef(load);
  const seq = useRef(0);
  // Declared before the effects below so they always call the latest `load`.
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    const id = ++seq.current;
    try {
      const result = await loadRef.current();
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(e);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [version, reload, ...deps]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, error, reload };
}
