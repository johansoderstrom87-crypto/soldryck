const KEY = "soldryck_favorites";
const SYNC_KEY = "soldryck_sync_code";

export function getSyncCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SYNC_KEY);
}

export function setSyncCode(code: string | null): void {
  if (typeof window === "undefined") return;
  if (code) localStorage.setItem(SYNC_KEY, code);
  else localStorage.removeItem(SYNC_KEY);
}

/**
 * Push the current favorite list to the cloud — generates a fresh code if
 * we don't have one cached, reuses the stored one otherwise. Returns the
 * code on success, null on failure (UI keeps working from local storage).
 */
export async function pushFavoritesToCloud(): Promise<string | null> {
  const favs = Array.from(getFavorites());
  const existing = getSyncCode();
  try {
    const res = await fetch("/api/favorites-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favoriteIds: favs, code: existing }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.code === "string") {
      setSyncCode(data.code);
      return data.code as string;
    }
    return null;
  } catch {
    return null;
  }
}

/** Pull favorites for a code and OVERWRITE local list. Returns true on success. */
export async function pullFavoritesFromCloud(code: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/favorites-sync?code=${encodeURIComponent(code)}`);
    if (!res.ok) return false;
    const data = await res.json();
    const ids = Array.isArray(data?.favoriteIds) ? data.favoriteIds : [];
    saveFavorites(new Set(ids));
    setSyncCode(code);
    return true;
  } catch {
    return false;
  }
}

export type Favorites = Set<string>;

export function getFavorites(): Favorites {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function saveFavorites(favs: Favorites): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(Array.from(favs)));
  window.dispatchEvent(new CustomEvent("soldryck-favorites-changed"));
  // Sync to push backend if subscribed
  import("./push").then(({ syncFavoritesToPush }) => {
    syncFavoritesToPush(Array.from(favs)).catch(() => {});
  });
}

export function toggleFavorite(id: string): Favorites {
  const favs = getFavorites();
  if (favs.has(id)) favs.delete(id);
  else favs.add(id);
  saveFavorites(favs);
  return favs;
}

export function isFavorite(id: string): boolean {
  return getFavorites().has(id);
}
