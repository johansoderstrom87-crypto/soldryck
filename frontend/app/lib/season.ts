/**
 * Soldryck's shadow pipeline only computes data for April–October (Stockholm's
 * outdoor-seating season). Outside that window every venue would look grey,
 * giving first-time winter visitors the impression that the app is broken.
 *
 * These helpers detect the off-season and snap dates forward to the next
 * available in-season date so the app always shows meaningful data, while
 * the OffSeasonBanner component explains the seasonal nature to the user.
 */

// Month indices are 0-based (April = 3, October = 9).
export const SEASON_START_MONTH = 3;
export const SEASON_END_MONTH = 9;

export function isInSeason(date: Date): boolean {
  const m = date.getMonth();
  return m >= SEASON_START_MONTH && m <= SEASON_END_MONTH;
}

/**
 * Returns `date` unchanged if already in-season. Otherwise returns the next
 * April 1 — same calendar year if we're in Jan–March, next year if Nov–Dec.
 */
export function snapToSeason(date: Date): Date {
  if (isInSeason(date)) return date;
  const m = date.getMonth();
  const year = m > SEASON_END_MONTH ? date.getFullYear() + 1 : date.getFullYear();
  const d = new Date(year, SEASON_START_MONTH, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MONTH_NAMES_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function formatShortDate(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES_SHORT[date.getMonth()]}`;
}
