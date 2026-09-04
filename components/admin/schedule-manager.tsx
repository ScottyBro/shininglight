"use client"

import { useActionState } from "react"
import { Trash2 } from "lucide-react"

import {
  createShift,
  deleteShift,
  type ScheduleState,
} from "@/app/(app)/admin/schedule/actions"
import { dateLabel } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const initial: ScheduleState = {}

export type ShiftRow = {
  id: string
  date: string
  start_time: string
  end_time: string
  notes: string | null
  teacher: { id: string; full_name: string | null } | null
  classroom: { id: string; name: string } | null
}
type Person = { id: string; full_name: string | null }
type Room = { id: string; name: string }

function timeRange(start: string, end: string) {
  const fmt = (t: string) => t.slice(0, 5)
  return `${fmt(start)} – ${fmt(end)}`
}

export function ScheduleManager({
  shifts,
  teachers,
  classrooms,
}: {
  shifts: ShiftRow[]
  teachers: Person[]
  classrooms: Room[]
}) {
  const [state, action, pending] = useActionState(createShift, initial)

  const teacherItems: Record<string, string> = Object.fromEntries(
    teachers.map((t) => [t.id, t.full_name ?? "Unnamed teacher"])
  )
  const classroomItems: Record<string, string> = {
    none: "Unassigned",
    ...Object.fromEntries(classrooms.map((c) => [c.id, c.name])),
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a shift</CardTitle>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a teacher account first (People → Create an account).
            </p>
          ) : (
            <form action={action} className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="teacher_id">Teacher</Label>
                <Select name="teacher_id" items={teacherItems}>
                  <SelectTrigger id="teacher_id" className="w-full">
                    <SelectValue placeholder="Choose a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name ?? "Unnamed teacher"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="classroom_id">Classroom (optional)</Label>
                <Select name="classroom_id" defaultValue="none" items={classroomItems}>
                  <SelectTrigger id="classroom_id" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {classrooms.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="start_time">Start</Label>
                  <Input id="start_time" name="start_time" type="time" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_time">End</Label>
                  <Input id="end_time" name="end_time" type="time" required />
                </div>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" name="notes" rows={2} placeholder="Covering morning drop-off" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Add shift"}
                </Button>
              </div>
              {state.error ? (
                <p className="text-sm text-destructive sm:col-span-2" role="alert">
                  {state.error}
                </p>
              ) : null}
              {state.message ? (
                <p className="text-sm text-primary sm:col-span-2" role="status">
                  {state.message}
                </p>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming shifts</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Classroom</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{dateLabel(s.date)}</TableCell>
                  <TableCell className="font-medium">
                    {s.teacher?.full_name ?? "—"}
                  </TableCell>
                  <TableCell>{timeRange(s.start_time, s.end_time)}</TableCell>
                  <TableCell>{s.classroom?.name ?? "—"}</TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">
                    {s.notes ?? ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={deleteShift.bind(null, s.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete shift"
                        className="text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
              {shifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No upcoming shifts.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
