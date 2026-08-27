"use client"

import { useActionState, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { enrollChild, updateChild, type FormState } from "@/app/(app)/admin/actions"
import { downscaleInputFiles } from "@/lib/image"
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
import type {
  AuthorizedPickup,
  Child,
  Classroom,
  EmergencyContact,
} from "@/lib/types/database"

const initialState: FormState = {}

type ContactRow = { name: string; phone: string; relationship: string }
type PickupRow = { name: string; relationship: string; pin: string }

export function ChildForm({
  classrooms,
  child,
}: {
  classrooms: Pick<Classroom, "id" | "name">[]
  child?: Child
}) {
  const isEdit = !!child
  const [state, formAction, pending] = useActionState(
    isEdit ? updateChild : enrollChild,
    initialState
  )

  const [contacts, setContacts] = useState<ContactRow[]>(
    (child?.emergency_contacts as EmergencyContact[] | undefined)?.map((c) => ({
      name: c.name ?? "",
      phone: c.phone ?? "",
      relationship: c.relationship ?? "",
    })) ?? [{ name: "", phone: "", relationship: "" }]
  )
  const [pickups, setPickups] = useState<PickupRow[]>(
    (child?.authorized_pickups as AuthorizedPickup[] | undefined)?.map((p) => ({
      name: p.name ?? "",
      relationship: p.relationship ?? "",
      pin: p.pin ?? "",
    })) ?? []
  )

  const [photoBusy, setPhotoBusy] = useState(false)

  const cleanContacts = contacts.filter((c) => c.name.trim() && c.phone.trim())
  const cleanPickups = pickups.filter((p) => p.name.trim())

  return (
    <form action={formAction} className="grid gap-6">
      {isEdit ? <input type="hidden" name="id" value={child!.id} /> : null}
      <input
        type="hidden"
        name="emergency_contacts"
        value={JSON.stringify(cleanContacts)}
      />
      <input
        type="hidden"
        name="authorized_pickups"
        value={JSON.stringify(cleanPickups)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Child details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              required
              defaultValue={child?.full_name ?? ""}
              placeholder="Tadiwa Moyo"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="date_of_birth">Date of birth</Label>
            <Input
              id="date_of_birth"
              name="date_of_birth"
              type="date"
              defaultValue={child?.date_of_birth ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="classroom_id">Classroom</Label>
            <Select
              name="classroom_id"
              defaultValue={child?.classroom_id ?? "none"}
            >
              <SelectTrigger id="classroom_id" className="w-full">
                <SelectValue placeholder="Unassigned" />
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
            <Label htmlFor="enrollment_status">Enrollment status</Label>
            <Select
              name="enrollment_status"
              defaultValue={child?.enrollment_status ?? "active"}
            >
              <SelectTrigger id="enrollment_status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="waitlisted">Waitlisted</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="photo">Photo</Label>
            <Input
              id="photo"
              name="photo"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const el = e.currentTarget
                setPhotoBusy(true)
                await downscaleInputFiles(el)
                setPhotoBusy(false)
              }}
            />
            {isEdit && child?.photo_url ? (
              <p className="text-xs text-muted-foreground">
                A photo is on file. Uploading a new one replaces it.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safety &amp; medical</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="allergies">Allergies</Label>
            <Input
              id="allergies"
              name="allergies"
              defaultValue={(child?.allergies ?? []).join(", ")}
              placeholder="Peanuts, Dairy, Bee stings"
            />
            <p className="text-xs text-muted-foreground">
              Separate with commas. Shown as high-visibility badges everywhere.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="medical_notes">Medical notes</Label>
            <Textarea
              id="medical_notes"
              name="medical_notes"
              rows={3}
              defaultValue={child?.medical_notes ?? ""}
              placeholder="Asthma — inhaler in bag. Mild eczema."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Emergency contacts</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setContacts((c) => [...c, { name: "", phone: "", relationship: "" }])
            }
          >
            <Plus className="size-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {contacts.map((c, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input
                aria-label="Contact name"
                placeholder="Name"
                value={c.name}
                onChange={(e) =>
                  setContacts((rows) =>
                    rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r))
                  )
                }
              />
              <Input
                aria-label="Contact phone"
                placeholder="Phone"
                inputMode="tel"
                value={c.phone}
                onChange={(e) =>
                  setContacts((rows) =>
                    rows.map((r, j) => (j === i ? { ...r, phone: e.target.value } : r))
                  )
                }
              />
              <Input
                aria-label="Relationship"
                placeholder="Relationship"
                value={c.relationship}
                onChange={(e) =>
                  setContacts((rows) =>
                    rows.map((r, j) =>
                      j === i ? { ...r, relationship: e.target.value } : r
                    )
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove contact"
                onClick={() =>
                  setContacts((rows) => rows.filter((_, j) => j !== i))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts added.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Authorized pickups</CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setPickups((p) => [...p, { name: "", relationship: "", pin: "" }])
            }
          >
            <Plus className="size-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {pickups.map((p, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
              <Input
                aria-label="Pickup name"
                placeholder="Name"
                value={p.name}
                onChange={(e) =>
                  setPickups((rows) =>
                    rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r))
                  )
                }
              />
              <Input
                aria-label="Relationship"
                placeholder="Relationship"
                value={p.relationship}
                onChange={(e) =>
                  setPickups((rows) =>
                    rows.map((r, j) =>
                      j === i ? { ...r, relationship: e.target.value } : r
                    )
                  )
                }
              />
              <Input
                aria-label="Pickup PIN"
                placeholder="PIN (optional)"
                inputMode="numeric"
                value={p.pin}
                onChange={(e) =>
                  setPickups((rows) =>
                    rows.map((r, j) => (j === i ? { ...r, pin: e.target.value } : r))
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove pickup"
                onClick={() => setPickups((rows) => rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {pickups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No authorized pickups yet. Add the people allowed to collect this
              child — a PIN is shown at checkout for verification.
            </p>
          ) : null}
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

      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" disabled={pending || photoBusy}>
          {photoBusy
            ? "Processing photo…"
            : pending
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Enroll child"}
        </Button>
      </div>
    </form>
  )
}
