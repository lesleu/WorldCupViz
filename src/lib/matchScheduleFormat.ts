/** Parse API-Football fixture datetime into catalog display fields. */
export function formatKickoffFromIso(isoDate: string): {
  date: string;
  dateSort: string;
  kickoffAt: string;
  kickoffTime: string;
} {
  const parsed = new Date(isoDate);
  const dateSort = parsed.toISOString().slice(0, 10);
  const date = parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const kickoffTime = parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return { date, dateSort, kickoffAt: isoDate, kickoffTime };
}
