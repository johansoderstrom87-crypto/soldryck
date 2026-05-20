// URL-säkert slug-format för venue-sidor. Namnet slugifieras (för läsbar
// URL i sökresultat) och venue-id:t läggs på som suffix så två venues med
// samma namn (många "Espresso House" osv) får distinkta URL:er. Eftersom
// vissa id:n innehåller bindestreck själva använder vi en Map vid lookup
// istället för att försöka parsa tillbaka — slugify är enkelriktat.

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/å|ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é|è|ê/g, "e")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

export function venueSlug(venue: { id: string; name: string }): string {
  const namePart = slugify(venue.name);
  const idPart = slugify(venue.id);
  if (!namePart) return idPart || venue.id;
  if (!idPart) return namePart;
  return `${namePart}-${idPart}`;
}
