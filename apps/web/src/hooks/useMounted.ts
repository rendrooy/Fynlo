import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True only in the browser, after hydration finishes. */
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
