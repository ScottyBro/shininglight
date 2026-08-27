"use client"

import { useActionState } from "react"
import { Trash2, Users } from "lucide-react"

import {
  assignTeacher,
  createClassroom,
  deleteClassroom,
  type FormState,
} from "@/app/(app)/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const initialState: FormState = {}

type Teacher = { id: string; full_name: string | null }
type Room = {
  id: string
  name: string
  max_capacity: number
  teacher_id: string | null
  child_count: number
}

export function ClassroomManager({
  classrooms,
  teachers,
}: {
  classrooms: Room[]
  teachers: Teacher[]
}) {
  const [state, formAction, pending] = useActionState(
    createClassroom,
    initialState
  )

  // Base UI's Select only shows the raw `value` in the trigger unless an
  // `items` value->label map is given — without it every select here would
  // display a teacher's raw id instead of their name.
  const teacherItems: Record<string, string> = {
    none: "Unassigned",
    ...Object.fromEntries(teachers.map((t) => [t.id, t.full_name ?? "Unnamed teacher"])),
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>New classroom</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={formAction}
            className="grid gap-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end"
          >
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Sunflowers" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="max_capacity">Capacity</Label>
              <Input
                id="max_capacity"
                name="max_capacity"
                type="number"
                min={1}
                defaultValue={20}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="teacher_id">Lead teacher</Label>
              <Select name="teacher_id" defaultValue="none" items={teacherItems}>
                <SelectTrigger id="teacher_id" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name ?? "Unnamed teacher"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </form>
          {state.error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {classrooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">No classrooms yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {classrooms.map((room) => {
            const full = room.child_count >= room.max_capacity
            return (
              <Card key={room.id}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>{room.name}</CardTitle>
                  <Badge variant={full ? "destructive" : "secondary"} className="gap-1">
                    <Users className="size-3.5" />
                    {room.child_count}/{room.max_capacity}
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Lead teacher
                    </Label>
                    <Select
                      defaultValue={room.teacher_id ?? "none"}
                      onValueChange={(v) => assignTeacher(room.id, v ?? "none")}
                      items={teacherItems}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.full_name ?? "Unnamed teacher"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <form
                    action={deleteClassroom.bind(null, room.id)}
                    className="flex justify-end"
                  >
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                    >
                      <Trash2 className="size-4" /> Delete
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
