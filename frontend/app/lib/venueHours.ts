// Shared formatting for opening-hours status. Both the venue popup
// (SunMap) and the area-search panel render the same "Stängt — öppnar
// snart, 17" / "öppnar imorgon 08" copy, so the logic lives here once
// instead of drifting between two implementations.

const DAYS_SHORT = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"];

export interface DaySegment {
  open: string;   // "HH:MM"
  close: string;  // "HH:MM"
}

// Strip trailing ":00" so an on-the-hour open time reads as "17" instead
// of "17:00"; half-hour times stay intact ("17:30").
function formatTime(time: string): string {
  return time.endsWith(":00") ? time.slice(0, -3) : time;
}

/**
 * Human description of when the venue next opens after `now`.
 *
 * Returns suffix only (no leading "öppnar"), e.g.:
 *   "snart, 17"          — opens today within `soonThresholdMinutes`
 *   "17"                 — opens later today
 *   "imorgon 08"         — opens tomorrow
 *   "fre 18"             — opens later in the week
 *
 * Returns `null` if no future opening is found within 7 days.
 */
export function computeOpensAt(
  week: DaySegment[][],
  now: Date = new Date(),
  soonThresholdMinutes: number = 120,
): string | null {
  const todayMon0 = (now.getDay() + 6) % 7;
  const pad = (n: number) => String(n).padStart(2, "0");
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let d = 0; d <= 7; d++) {
    const dayIdx = (todayMon0 + d) % 7;
    const segs = week[dayIdx] || [];
    for (const seg of segs) {
      if (d === 0 && seg.open <= currentTime) continue;
      const formatted = formatTime(seg.open);

      if (d === 0) {
        const [h, m] = seg.open.split(":").map(Number);
        const openMinutes = h * 60 + m;
        const diff = openMinutes - currentMinutes;
        return diff <= soonThresholdMinutes ? `snart, ${formatted}` : formatted;
      }
      if (d === 1) return `imorgon ${formatted}`;
      return `${DAYS_SHORT[dayIdx]} ${formatted}`;
    }
  }
  return null;
}

/** Full status line for the closed-now case. */
export function buildClosedStatus(week: DaySegment[][] | null | undefined): string {
  if (!week) return "Stängt";
  const opensAt = computeOpensAt(week);
  return opensAt ? `Stängt — öppnar ${opensAt}` : "Stängt just nu";
}
