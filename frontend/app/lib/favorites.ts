const KEY = "soldryck_favorites";

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
