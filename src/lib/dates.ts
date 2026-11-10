/**
 * All "today / overdue / tomorrow at 9" logic runs in one business time zone
 * so the server (UTC on Vercel) and the phone agree.
 */
export const APP_TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/New_York";

type Parts = { y: number; m: number; d: number; h: number; min: number; s: number };

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

export function zonedParts(date: Date, tz = APP_TZ): Parts {
  const p: Record<string, string> = {};
  for (const part of partsFormatter(tz).formatToParts(date)) p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, s: +p.second };
}

function offsetMs(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Wall-clock time in `tz` → real instant. Month is 1-based; day may overflow. */
export function zonedTimeToUtc(y: number, m: number, d: number, h = 0, min = 0, tz = APP_TZ): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const off1 = offsetMs(new Date(guess), tz);
  let t = guess - off1;
  const off2 = offsetMs(new Date(t), tz);
  if (off2 !== off1) t = guess - off2;
  return new Date(t);
}

export function startOfDay(date = new Date(), tz = APP_TZ) {
  const p = zonedParts(date, tz);
  return zonedTimeToUtc(p.y, p.m, p.d, 0, 0, tz);
}

export function addDays(date: Date, days: number, tz = APP_TZ) {
  const p = zonedParts(date, tz);
  return zonedTimeToUtc(p.y, p.m, p.d + days, p.h, p.min, tz);
}

export function todayBounds(now = new Date(), tz = APP_TZ) {
  const start = startOfDay(now, tz);
  const end = startOfDay(addDays(start, 1, tz), tz);
  return { start, end };
}

/** `n` days from today at `hour`:00 local */
export function daysFromNowAt(n: number, hour: number, now = new Date(), tz = APP_TZ) {
  const p = zonedParts(now, tz);
  return zonedTimeToUtc(p.y, p.m, p.d + n, hour, 0, tz);
}

/** Value for <input type="datetime-local"> */
export function toLocalInputValue(date: Date, tz = APP_TZ) {
  const p = zonedParts(date, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

export function fromLocalInputValue(value: string, tz = APP_TZ): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return zonedTimeToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], tz);
}

/** Whole calendar days between today and `date` (negative = past) */
export function dayDiff(date: Date, now = new Date(), tz = APP_TZ) {
  const a = zonedParts(now, tz);
  const b = zonedParts(date, tz);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, ...opts });
    fmtCache.set(key, f);
  }
  return f;
}

const toDate = (v: string | Date) => (typeof v === "string" ? new Date(v) : v);

export const formatDate = (v: string | Date) =>
  fmt({ month: "short", day: "numeric", year: "numeric" }).format(toDate(v));

export const formatShortDate = (v: string | Date) =>
  fmt({ weekday: "short", month: "short", day: "numeric" }).format(toDate(v));

export const formatTime = (v: string | Date) =>
  fmt({ hour: "numeric", minute: "2-digit" }).format(toDate(v));

export const formatDateTime = (v: string | Date) => `${formatShortDate(v)} · ${formatTime(v)}`;

/** "Today 9:00 AM", "Tomorrow 9:00 AM", "Yesterday", "3 days ago", "Thu, Nov 12" */
export function formatRelative(v: string | Date, opts: { withTime?: boolean } = {}) {
  const d = toDate(v);
  const diff = dayDiff(d);
  const time = opts.withTime ? ` ${formatTime(d)}` : "";
  if (diff === 0) return `Today${time}`;
  if (diff === 1) return `Tomorrow${time}`;
  if (diff === -1) return `Yesterday${time}`;
  if (diff < -1 && diff >= -6) return `${-diff} days ago`;
  if (diff < -6) return formatDate(d);
  return `${formatShortDate(d)}${time}`;
}

export type FollowUpState = "overdue" | "today" | "upcoming" | "none";

export function followUpState(iso: string | null, now = new Date()): FollowUpState {
  if (!iso) return "none";
  const diff = dayDiff(new Date(iso), now);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  return "upcoming";
}
