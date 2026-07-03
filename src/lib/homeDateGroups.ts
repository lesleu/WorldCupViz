import type { MatchCatalogEntry } from "@/data/matchCatalog";

export interface DateMatchGroup {
  dateSort: string;
  label: string;
  stageLabel: string;
  isToday: boolean;
  isFuture: boolean;
  matches: MatchCatalogEntry[];
}

export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dayDiff(fromKey: string, toKey: string): number {
  const ms = parseDateKey(toKey).getTime() - parseDateKey(fromKey).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatDateLabel(dateSort: string, todayKey: string): string {
  const diff = dayDiff(todayKey, dateSort);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";

  return parseDateKey(dateSort).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function stageLabelForDay(matches: MatchCatalogEntry[]): string {
  const labels = [...new Set(matches.map((entry) => entry.stageLabel))];
  return labels.join(" · ");
}

function sortDayMatches(matches: MatchCatalogEntry[]): MatchCatalogEntry[] {
  return [...matches].sort((a, b) => {
    if (a.status === "live" && b.status !== "live") return -1;
    if (b.status === "live" && a.status !== "live") return 1;
    if (a.kickoffAt && b.kickoffAt) return a.kickoffAt.localeCompare(b.kickoffAt);
    return a.id.localeCompare(b.id);
  });
}

export function groupMatchesByDate(
  matches: MatchCatalogEntry[],
  todayKey: string = localDateKey()
): DateMatchGroup[] {
  const byDate = new Map<string, MatchCatalogEntry[]>();

  for (const entry of matches) {
    const key = entry.dateSort;
    const bucket = byDate.get(key);
    if (bucket) bucket.push(entry);
    else byDate.set(key, [entry]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateSort, dayMatches]) => ({
      dateSort,
      label: formatDateLabel(dateSort, todayKey),
      stageLabel: stageLabelForDay(dayMatches),
      isToday: dateSort === todayKey,
      isFuture: dayDiff(todayKey, dateSort) > 0,
      matches: sortDayMatches(dayMatches),
    }));
}

export function pickScrollTargetGroup(
  groups: DateMatchGroup[],
  todayKey: string = localDateKey()
): DateMatchGroup | undefined {
  const today = groups.find((group) => group.isToday);
  if (today) return today;

  const future = groups.find((group) => group.dateSort >= todayKey);
  if (future) return future;

  return groups.at(-1);
}
