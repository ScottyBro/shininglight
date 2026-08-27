"use client"

import { useActionState, useRef, useState, useTransition } from "react"
import { Plus, Sparkles, Trash2, X } from "lucide-react"

import {
  saveDailyReport,
  type ReportState,
} from "@/app/(app)/teacher/reports/actions"
import { draftReportSummary } from "@/app/(app)/teacher/reports/ai-actions"
import { enqueue } from "@/lib/offline/queue"
import { downscaleInputFiles } from "@/lib/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  BathroomEntry,
  DailyReport,
  MealEntry,
  NapEntry,
} from "@/lib/types/database"

const initialState: ReportState = {}

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

type MealRow = { time: string; food: string; amount: string }
type NapRow = { start: string; end: string }
type BathroomRow = { time: string; type: string }

export function DailyReportForm({
  childId,
  firstName,
  report,
  existingPhotos,
}: {
  childId: string
  firstName: string
  report: DailyReport | null
  existingPhotos: { path: string; url: string | null }[]
}) {
  const [state, formAction, pending] = useActionState(
    saveDailyReport,
    initialState
  )
  const formRef = useRef<HTMLFormElement>(null)
  const [notes, setNotes] = useState(report?.notes ?? "")
  const [aiGenerated, setAiGenerated] = useState(report?.ai_generated ?? false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiPending, startAi] = useTransition()
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  // Offline: queue the report as a draft (text only) to replay on reconnect.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (typeof navigator !== "undefined" && navigator.onLine) return
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload: Record<string, string> = {}
    for (const key of [
      "child_id",
      "meals",
      "naps",
      "bathroom",
      "mood",
      "activities",
      "notes",
      "existing_photos",
      "ai_generated",
    ]) {
      const v = fd.get(key)
      if (typeof v === "string") payload[key] = v
    }
    void enqueue({ kind: "report-save", childId, payload })
    setOfflineMsg(
      "You're offline — saved as a draft and queued. It'll sync when you're back online. New photos need a connection."
    )
  }

  function handleDraft() {
    setAiError(null)
    const fd = new FormData(formRef.current ?? undefined)
    startAi(async () => {
      const result = await draftReportSummary({
        firstName,
        meals: cleanMeals,
        naps: cleanNaps,
        bathroom: cleanBathroom,
        mood: fd.get("mood")?.toString() || null,
        activities: fd.get("activities")?.toString() || null,
        note: notes || null,
      })
      if (result.error) {
        setAiError(result.error)
      } else if (result.text) {
        setNotes(result.text)
        setAiGenerated(true)
      }
    })
  }

  const [meals, setMeals] = useState<MealRow[]>(
    (report?.meals as MealEntry[] | undefined)?.map((m) => ({
      time: m.time ?? "",
      food: m.food ?? "",
      amount: m.amount ?? "",
    })) ?? []
  )
  const [naps, setNaps] = useState<NapRow[]>(
    (report?.naps as NapEntry[] | undefined)?.map((n) => ({
      start: n.start ?? "",
      end: n.end ?? "",
    })) ?? []
  )
  const [bathroom, setBathroom] = useState<BathroomRow[]>(
    (report?.bathroom as BathroomEntry[] | undefined)?.map((b) => ({
      time: b.time ?? "",
      type: b.type ?? "",
    })) ?? []
  )
  const [keptPhotos, setKeptPhotos] = useState(existingPhotos)

  const cleanMeals = meals.filter((m) => m.time || m.food || m.amount)
  const cleanNaps = naps.filter((n) => n.start || n.end)
  const cleanBathroom = bathroom.filter((b) => b.time || b.type)

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="grid gap-5"
    >
      <input type="hidden" name="child_id" value={childId} />
      <input type="hidden" name="ai_generated" value={String(aiGenerated)} />
      <input type="hidden" name="meals" value={JSON.stringify(cleanMeals)} />
      <input type="hidden" name="naps" value={JSON.stringify(cleanNaps)} />
      <input type="hidden" name="bathroom" value={JSON.stringify(cleanBathroom)} />
      <input
        type="hidden"
        name="existing_photos"
        value={JSON.stringify(keptPhotos.map((p) => p.path))}
      />

      {/* Meals */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Meals</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setMeals((m) => [...m, { time: "", food: "", amount: "" }])
            }
          >
            <Plus className="size-4" /> Add meal
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2">
          {meals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No meals logged.</p>
          ) : (
            meals.map((m, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[120px_1fr_130px_auto]">
                <Input
                  type="time"
                  aria-label="Meal time"
                  value={m.time}
                  onChange={(e) =>
                    setMeals((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, time: e.target.value } : r))
                    )
                  }
                />
                <Input
                  aria-label="Food"
                  placeholder="What they ate"
                  value={m.food}
                  onChange={(e) =>
                    setMeals((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, food: e.target.value } : r))
                    )
                  }
                />
                <select
                  aria-label="Amount eaten"
                  className={SELECT_CLASS}
                  value={m.amount}
                  onChange={(e) =>
                    setMeals((rows) =>
                      rows.map((r, j) =>
                        j === i ? { ...r, amount: e.target.value } : r
                      )
                    )
                  }
                >
                  <option value="">Amount…</option>
                  <option value="none">Ate none</option>
                  <option value="some">Ate some</option>
                  <option value="most">Ate most</option>
                  <option value="all">Ate all</option>
                </select>
                <RemoveButton onClick={() => setMeals((r) => r.filter((_, j) => j !== i))} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Naps */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Naps</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNaps((n) => [...n, { start: "", end: "" }])}
          >
            <Plus className="size-4" /> Add nap
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2">
          {naps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No naps logged.</p>
          ) : (
            naps.map((n, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Fell asleep</Label>
                  <Input
                    type="time"
                    value={n.start}
                    onChange={(e) =>
                      setNaps((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, start: e.target.value } : r))
                      )
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Woke up</Label>
                  <Input
                    type="time"
                    value={n.end}
                    onChange={(e) =>
                      setNaps((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, end: e.target.value } : r))
                      )
                    }
                  />
                </div>
                <div className="flex items-end">
                  <RemoveButton onClick={() => setNaps((r) => r.filter((_, j) => j !== i))} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Bathroom */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Bathroom / diapers</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBathroom((b) => [...b, { time: "", type: "" }])}
          >
            <Plus className="size-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2">
          {bathroom.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged.</p>
          ) : (
            bathroom.map((b, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                <Input
                  type="time"
                  aria-label="Time"
                  value={b.time}
                  onChange={(e) =>
                    setBathroom((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, time: e.target.value } : r))
                    )
                  }
                />
                <select
                  aria-label="Type"
                  className={SELECT_CLASS}
                  value={b.type}
                  onChange={(e) =>
                    setBathroom((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, type: e.target.value } : r))
                    )
                  }
                >
                  <option value="">Type…</option>
                  <option value="wet">Wet</option>
                  <option value="bm">BM</option>
                  <option value="dry">Dry</option>
                  <option value="potty">Potty</option>
                </select>
                <RemoveButton
                  onClick={() => setBathroom((r) => r.filter((_, j) => j !== i))}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Mood, activities, notes */}
      <Card>
        <CardHeader>
          <CardTitle>The day</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="mood">Mood</Label>
            <Input
              id="mood"
              name="mood"
              list="moods"
              defaultValue={report?.mood ?? ""}
              placeholder="Happy, playful, calm…"
            />
            <datalist id="moods">
              <option value="Happy" />
              <option value="Playful" />
              <option value="Calm" />
              <option value="Sleepy" />
              <option value="Fussy" />
              <option value="Under the weather" />
            </datalist>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="activities">Activities</Label>
            <Textarea
              id="activities"
              name="activities"
              rows={3}
              defaultValue={report?.activities ?? ""}
              placeholder="Painting, story time, outdoor play…"
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes">Notes for the family</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDraft}
                disabled={aiPending}
              >
                <Sparkles className="size-4" />
                {aiPending ? "Drafting…" : "Draft with AI"}
              </Button>
            </div>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setAiGenerated(false)
              }}
              placeholder="Anything the parents should know. Or tap “Draft with AI” to generate a warm summary from the day’s entries — then review and edit before publishing."
            />
            {aiGenerated ? (
              <p className="text-xs text-muted-foreground">
                ✨ AI-drafted — please review and edit before publishing.
              </p>
            ) : null}
            {aiError ? (
              <p className="text-xs text-destructive" role="alert">
                {aiError}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {keptPhotos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keptPhotos.map((p) => (
                <div key={p.path} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url ?? ""}
                    alt="Report photo"
                    className="size-20 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Remove photo"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    onClick={() =>
                      setKeptPhotos((ph) => ph.filter((x) => x.path !== p.path))
                    }
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <Input
            name="photos"
            type="file"
            accept="image/*"
            multiple
            onChange={async (e) => {
              const el = e.currentTarget
              setPhotoBusy(true)
              await downscaleInputFiles(el)
              setPhotoBusy(false)
            }}
          />
          <p className="text-xs text-muted-foreground">
            Photos are only visible to the child&apos;s family once published.
          </p>
        </CardContent>
      </Card>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-primary" role="status">
          {state.message}
        </p>
      ) : null}
      {offlineMsg ? (
        <p className="text-sm text-amber-600" role="status">
          {offlineMsg}
        </p>
      ) : null}

      <div className="sticky bottom-16 z-10 flex gap-2 rounded-xl border bg-card/95 p-3 backdrop-blur md:bottom-0">
        <Button
          type="submit"
          name="intent"
          value="draft"
          variant="outline"
          size="lg"
          className="flex-1"
          disabled={pending || photoBusy}
        >
          {photoBusy ? "Processing…" : "Save draft"}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="publish"
          size="lg"
          className="flex-1"
          disabled={pending || photoBusy}
        >
          {photoBusy ? "Processing…" : pending ? "Saving…" : "Publish to family"}
        </Button>
      </div>
    </form>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Remove"
      onClick={onClick}
    >
      <Trash2 className="size-4" />
    </Button>
  )
}
