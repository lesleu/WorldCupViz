/** All match schedule display uses US Eastern (World Cup host audience default). */
export const MATCH_DISPLAY_TIME_ZONE = "America/New_York";

const easternDateSortFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MATCH_DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const easternDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MATCH_DISPLAY_TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
});

const easternTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MATCH_DISPLAY_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

/** Calendar key (YYYY-MM-DD) for the current moment in Eastern Time. */
export function easternDateKey(date: Date = new Date()): string {
  return easternDateSortFormatter.format(date);
}

/** Parse API-Football fixture datetime into catalog display fields (Eastern). */
export function formatKickoffFromIso(isoDate: string): {
  date: string;
  dateSort: string;
  kickoffAt: string;
  kickoffTime: string;
} {
  const parsed = new Date(isoDate);
  const dateSort = easternDateSortFormatter.format(parsed);
  const date = easternDateFormatter.format(parsed);
  const kickoffTime = `${easternTimeFormatter.format(parsed)} ET`;

  return { date, dateSort, kickoffAt: isoDate, kickoffTime };
}
