"use client";

// Client-only store for the venues JSON payload. Lives in its own file
// (with "use client") so server routes can keep importing the pure types
// + helpers from venues-computed.ts without dragging React APIs into the
// server bundle — Turbopack treats useSyncExternalStore as a client-only
// import and fails the build when it appears in a server-traced module.

import { useSyncExternalStore } from "react";
import type { ComputedVenue } from "./venues-computed";

let venuesStore: ComputedVenue[] = [];
const listeners = new Set<() => void>();

/** Replace the entire venues store. Called by page.tsx once the JSON arrives. */
export function setVenues(v: ComputedVenue[]): void {
  venuesStore = v;
  for (const fn of listeners) fn();
}

/** Synchronous snapshot — useful outside React (event handlers, refs). */
export function getVenues(): ComputedVenue[] {
  return venuesStore;
}

/** React hook — subscribes to store changes so consumers re-render when data
 *  arrives. Returns an empty array until `setVenues()` has been called. */
export function useVenues(): ComputedVenue[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    () => venuesStore,
    () => venuesStore,
  );
}
