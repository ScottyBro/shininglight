import { differenceInMonths } from "date-fns"

/** Format a numeric amount as USD currency (the school bills in USD). */
export function currency(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(n) ? n : 0)
}

/** Human age from a date-of-birth string ("3y 4m", "7m"), or null. */
export function ageLabel(dob: string | null | undefined): string | null {
  if (!dob) return null
  const months = differenceInMonths(new Date(), new Date(dob))
  if (!Number.isFinite(months) || months < 0) return null
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years <= 0) return `${months}m`
  return rem === 0 ? `${years}y` : `${years}y ${rem}m`
}

/** Turn free text (commas or newlines) into a trimmed, de-duped string array. */
export function parseList(input: string | null | undefined): string[] {
  if (!input) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input.split(/[\n,]/)) {
    const v = raw.trim()
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase())
      out.push(v)
    }
  }
  return out
}
