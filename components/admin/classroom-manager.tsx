"use client"

import { useActionState, useEffect, useState } from "react"
import { Pencil, Trash2, Users } from "lucide-react"

import {
  assignTeacher,
  createClassroom,
  deleteClassroom,
  moveChildClassroom,
  updateClassroomDetails,
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
import type { EnrollmentStatus } from "@/lib/types/database"

const initialState: FormState = {}

type Teacher = { id: string; full_name: string | null }
export type RosterChild = {
  id: string
  full_name: string
  enrollment_status: EnrollmentStatus
}
type Room = {
  id: string
  name: string
  max_capacity: number
  teacher_id: string | null
  child_count: number
  roster: RosterChild[]
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
  const roomItems: Record<string, string> = {
    none: "Unassigned",
    ...Object.fromEntries(classrooms.map((c) => [c.id, c.name])),
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
          {classrooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              teachers={teachers}
              teacherItems={teacherItems}
              roomItems={roomItems}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RoomCard({
  room,
  teachers,
  teacherItems,
  roomItems,
}: {
  room: Room
  teachers: Teacher[]
  teacherItems: Record<string, string>
  roomItems: Record<string, string>
}) {
  const [editing, setEditing] = useState(false)
  const [editState, editAction, editPending] = useActionState(
    updateClassroomDetails,
    initialState
  )
  const full = room.child_count >= room.max_capacity

  useEffect(() => {
    if (editState.message) setEditing(false)
  }, [editState.message])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        {editing ? (
          <span className="text-sm font-medium text-muted-foreground">
            Edit classroom
          </span>
        ) : (
          <CardTitle>{room.name}</CardTitle>
        )}
        <div className="flex items-center gap-1.5">
          <Badge variant={full ? "destructive" : "secondary"} className="gap-1">
            <Users className="size-3.5" />
            {room.child_count}/{room.max_capacity}
          </Badge>
          {!editing ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Edit classroom"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {editing ? (
          <form action={editAction} className="grid gap-2 sm:grid-cols-[1fr_110px]">
            <input type="hidden" name="id" value={room.id} />
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input name="name" defaultValue={room.name} required />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Capacity</Label>
              <Input
                name="max_capacity"
                type="number"
                min={1}
                defaultValue={room.max_capacity}
                required
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={editPending}>
                {editPending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
            {editState.error ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {editState.error}
              </p>
            ) : null}
          </form>
        ) : null}

        <div className="grid gap-2">
          <Label className="text-xs text-muted-foreground">Lead teacher</Label>
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

        <div className="grid gap-2">
          <Label className="text-xs text-muted-foreground">
            Roster ({room.roster.length})
          </Label>
          {room.roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">No children assigned.</p>
          ) : (
            <ul className="grid gap-1.5">
              {room.roster.map((child) => (
                <li
                  key={child.id}
                  className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {child.full_name}
                    {child.enrollment_status === "waitlisted" ? (
                      <Badge variant="secondary" className="ml-1.5">
                        Waitlisted
                      </Badge>
                    ) : null}
                  </span>
                  <Select
                    defaultValue={room.id}
                    onValueChange={(v) => moveChildClassroom(child.id, v ?? "none")}
                    items={roomItems}
                  >
                    <SelectTrigger size="sm" className="w-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassign</SelectItem>
                      {Object.entries(roomItems)
                        .filter(([id]) => id !== "none")
                        .map(([id, name]) => (
                          <SelectItem key={id} value={id}>
                            {name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
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
}
