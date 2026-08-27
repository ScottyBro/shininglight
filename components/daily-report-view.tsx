import { Utensils, Moon, Baby, Smile, Palette, StickyNote } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type {
  BathroomEntry,
  MealEntry,
  NapEntry,
} from "@/lib/types/database"

const AMOUNT_LABEL: Record<string, string> = {
  none: "ate none",
  some: "ate some",
  most: "ate most",
  all: "ate all",
}
const BATHROOM_LABEL: Record<string, string> = {
  wet: "Wet",
  bm: "BM",
  dry: "Dry",
  potty: "Potty",
}

function napDuration(start?: string, end?: string): string {
  if (!start || !end) return ""
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return ""
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export type ReportViewData = {
  meals: MealEntry[]
  naps: NapEntry[]
  bathroom: BathroomEntry[]
  mood: string | null
  activities: string | null
  notes: string | null
  photoUrls: (string | null)[]
}

export function DailyReportView({ report }: { report: ReportViewData }) {
  const hasMeals = report.meals.length > 0
  const hasNaps = report.naps.length > 0
  const hasBathroom = report.bathroom.length > 0
  const photos = report.photoUrls.filter((u): u is string => Boolean(u))

  return (
    <Card>
      <CardContent className="grid gap-4 py-4">
        {report.mood ? (
          <Section icon={<Smile className="size-4" />} title="Mood">
            <p>{report.mood}</p>
          </Section>
        ) : null}

        {report.activities ? (
          <Section icon={<Palette className="size-4" />} title="Activities">
            <p className="whitespace-pre-wrap">{report.activities}</p>
          </Section>
        ) : null}

        {hasMeals ? (
          <Section icon={<Utensils className="size-4" />} title="Meals">
            <ul className="grid gap-0.5">
              {report.meals.map((m, i) => (
                <li key={i}>
                  {[m.time, m.food, m.amount ? `(${AMOUNT_LABEL[m.amount]})` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {hasNaps ? (
          <Section icon={<Moon className="size-4" />} title="Naps">
            <ul className="grid gap-0.5">
              {report.naps.map((n, i) => {
                const dur = napDuration(n.start, n.end)
                return (
                  <li key={i}>
                    {[n.start, n.end].filter(Boolean).join("–")}
                    {dur ? ` · ${dur}` : ""}
                  </li>
                )
              })}
            </ul>
          </Section>
        ) : null}

        {hasBathroom ? (
          <Section icon={<Baby className="size-4" />} title="Bathroom">
            <ul className="grid gap-0.5">
              {report.bathroom.map((b, i) => (
                <li key={i}>
                  {[b.time, b.type ? BATHROOM_LABEL[b.type] : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {report.notes ? (
          <Section icon={<StickyNote className="size-4" />} title="Notes">
            <p className="whitespace-pre-wrap">{report.notes}</p>
          </Section>
        ) : null}

        {photos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {photos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt="From the day"
                className="size-28 rounded-lg object-cover"
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1 text-sm">
      <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
        {icon}
        {title}
      </div>
      <div>{children}</div>
    </div>
  )
}
