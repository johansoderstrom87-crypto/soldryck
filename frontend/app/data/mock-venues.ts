export type SunStatus = "sun" | "shade" | "partial";

export interface Venue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "restaurant" | "cafe" | "bar";
  /** Sun status per hour (8-22) keyed by "MM-DD" then hour */
  schedule: Record<string, Record<number, SunStatus>>;
}

// Mock data — will be replaced by real computed data from the Python pipeline
export const mockVenues: Venue[] = [
  {
    id: "1",
    name: "Mosebacke Terrassen",
    lat: 59.3178,
    lng: 18.0735,
    type: "bar",
    schedule: {
      "04-01": { 8: "shade", 9: "shade", 10: "partial", 11: "sun", 12: "sun", 13: "sun", 14: "sun", 15: "sun", 16: "partial", 17: "shade", 18: "shade", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
      "04-15": { 8: "shade", 9: "partial", 10: "sun", 11: "sun", 12: "sun", 13: "sun", 14: "sun", 15: "sun", 16: "sun", 17: "partial", 18: "shade", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
    },
  },
  {
    id: "2",
    name: "Stureplan Uteservering",
    lat: 59.3369,
    lng: 18.0726,
    type: "restaurant",
    schedule: {
      "04-01": { 8: "shade", 9: "shade", 10: "shade", 11: "partial", 12: "sun", 13: "sun", 14: "partial", 15: "shade", 16: "shade", 17: "shade", 18: "shade", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
      "04-15": { 8: "shade", 9: "shade", 10: "partial", 11: "sun", 12: "sun", 13: "sun", 14: "sun", 15: "partial", 16: "shade", 17: "shade", 18: "shade", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
    },
  },
  {
    id: "3",
    name: "Fotografiska Cafe",
    lat: 59.3179,
    lng: 18.0855,
    type: "cafe",
    schedule: {
      "04-01": { 8: "partial", 9: "sun", 10: "sun", 11: "sun", 12: "sun", 13: "sun", 14: "sun", 15: "sun", 16: "sun", 17: "partial", 18: "shade", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
      "04-15": { 8: "sun", 9: "sun", 10: "sun", 11: "sun", 12: "sun", 13: "sun", 14: "sun", 15: "sun", 16: "sun", 17: "sun", 18: "partial", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
    },
  },
  {
    id: "4",
    name: "Oaxen Slip",
    lat: 59.3245,
    lng: 18.0915,
    type: "restaurant",
    schedule: {
      "04-01": { 8: "shade", 9: "shade", 10: "shade", 11: "shade", 12: "partial", 13: "sun", 14: "sun", 15: "sun", 16: "sun", 17: "sun", 18: "partial", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
      "04-15": { 8: "shade", 9: "shade", 10: "partial", 11: "sun", 12: "sun", 13: "sun", 14: "sun", 15: "sun", 16: "sun", 17: "sun", 18: "sun", 19: "partial", 20: "shade", 21: "shade", 22: "shade" },
    },
  },
  {
    id: "5",
    name: "Gondolen",
    lat: 59.3195,
    lng: 18.0718,
    type: "bar",
    schedule: {
      "04-01": { 8: "sun", 9: "sun", 10: "sun", 11: "sun", 12: "sun", 13: "sun", 14: "sun", 15: "sun", 16: "partial", 17: "shade", 18: "shade", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
      "04-15": { 8: "sun", 9: "sun", 10: "sun", 11: "sun", 12: "sun", 13: "sun", 14: "sun", 15: "sun", 16: "sun", 17: "partial", 18: "shade", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
    },
  },
  {
    id: "6",
    name: "Rosendals Tradgard",
    lat: 59.3268,
    lng: 18.1133,
    type: "cafe",
    schedule: {
      "04-01": { 8: "sun", 9: "sun", 10: "sun", 11: "sun", 12: "sun", 13: "sun", 14: "sun", 15: "sun", 16: "sun", 17: "sun", 18: "partial", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
      "04-15": { 8: "sun", 9: "sun", 10: "sun", 11: "sun", 12: "sun", 13: "sun", 14: "sun", 15: "sun", 16: "sun", 17: "sun", 18: "sun", 19: "partial", 20: "shade", 21: "shade", 22: "shade" },
    },
  },
  {
    id: "7",
    name: "Bleck Cafe",
    lat: 59.3252,
    lng: 18.0713,
    type: "cafe",
    schedule: {
      "04-01": { 8: "shade", 9: "shade", 10: "shade", 11: "shade", 12: "shade", 13: "partial", 14: "sun", 15: "sun", 16: "partial", 17: "shade", 18: "shade", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
      "04-15": { 8: "shade", 9: "shade", 10: "shade", 11: "partial", 12: "sun", 13: "sun", 14: "sun", 15: "sun", 16: "sun", 17: "partial", 18: "shade", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
    },
  },
  {
    id: "8",
    name: "Hermans Tradgardscafe",
    lat: 59.3163,
    lng: 18.0842,
    type: "restaurant",
    schedule: {
      "04-01": { 8: "partial", 9: "sun", 10: "sun", 11: "sun", 12: "sun", 13: "sun", 14: "partial", 15: "shade", 16: "shade", 17: "shade", 18: "shade", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
      "04-15": { 8: "sun", 9: "sun", 10: "sun", 11: "sun", 12: "sun", 13: "sun", 14: "sun", 15: "partial", 16: "shade", 17: "shade", 18: "shade", 19: "shade", 20: "shade", 21: "shade", 22: "shade" },
    },
  },
];

/** Find closest available date key for a given date */
export function getClosestDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = date.getDate();
  // Snap to 1st or 15th
  const snapDay = day < 8 ? "01" : day < 23 ? "15" : "01";
  const snapMonth =
    day >= 23
      ? String(Math.min(date.getMonth() + 2, 12)).padStart(2, "0")
      : month;
  return `${snapMonth}-${snapDay}`;
}

/** Get sun status for a venue at a specific date and hour */
export function getVenueStatus(
  venue: Venue,
  dateKey: string,
  hour: number
): SunStatus {
  return venue.schedule[dateKey]?.[hour] ?? "shade";
}

/** Count sun hours for a venue on a given date */
export function getSunHours(venue: Venue, dateKey: string): number {
  const daySchedule = venue.schedule[dateKey];
  if (!daySchedule) return 0;
  return Object.values(daySchedule).filter((s) => s === "sun").length;
}
