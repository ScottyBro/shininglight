/**
 * Date helpers anchored to the school's local timezone so "today" and
 * displayed times are correct regardless of where the server runs (Vercel
 * runs in UTC). Zimbabwe is UTC+2 with no DST.
 */
export const SCHOOL_TZ = process.env.NEXT_PUBLIC_SCHOOL_TZ ?? "Africa/Harare"

/** Current date in the school timezone as an ISO "YYYY-MM-DD" string. */
export function schoolToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

/** Format a timestamp as a short local time, e.g. "8:05 AM". */
export function timeLabel(iso: string | null | undefined): string {
  if (!iso) return ""
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso))
}

/** Format a date string ("YYYY-MM-DD" or ISO) as e.g. "Wed, 27 Aug 2026". */
export function dateLabel(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}
