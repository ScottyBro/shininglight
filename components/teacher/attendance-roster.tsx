"use client"

import { useState, useTransition } from "react"
import { LogIn, LogOut, ShieldCheck } from "lucide-react"

import {
  checkIn,
  checkOut,
  undoCheckIn,
  undoCheckOut,
} from "@/app/(app)/teacher/attendance/actions"
import { enqueue, type QueuedOp } from "@/lib/offline/queue"
import { timeLabel } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChildSafetyBadges } from "@/components/child-badges"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export type AttendancePickup = {
  name: string
  relationship: string
  pin: string
  photoUrl: string | null
}

export type AttendanceChild = {
  id: string
  full_name: string
  photoUrl: string | null
  allergies: string[]
  medical_notes: string | null
  pickups: AttendancePickup[]
  checkInAt: string | null
  checkOutAt: string | null
  checkInBy: string | null
  checkOutBy: string | null
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

export function AttendanceRoster({ items }: { items: AttendanceChild[] }) {
  return (
    <div className="grid gap-3">
      {items.map((child) => (
        <AttendanceRow key={child.id} child={child} />
      ))}
    </div>
  )
}

type Override = Partial<
  Pick<AttendanceChild, "checkInAt" | "checkOutAt" | "checkInBy" | "checkOutBy">
>
type AttKind = Extract<QueuedOp, { kind: `att-${string}` }>["kind"]

function AttendanceRow({ child }: { child: AttendanceChild }) {
  const [pending, startTransition] = useTransition()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [override, setOverride] = useState<Override>({})

  const eff = { ...child, ...override }
  const isIn = !!eff.checkInAt && !eff.checkOutAt
  const isOut = !!eff.checkOutAt

  const run = (fn: () => Promise<void>) => startTransition(() => void fn())

  // Offline-aware: when there is no connection, apply the change optimistically
  // and queue it (IndexedDB) to replay on reconnect. Single-writer LWW.
  function act(kind: AttKind, online: () => Promise<void>, optimistic: Override) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOverride((o) => ({ ...o, ...optimistic }))
      void enqueue({ kind, childId: child.id })
    } else {
      run(online)
    }
  }

  const now = () => new Date().toISOString()

  return (
    <Card className={isOut ? "opacity-70" : undefined}>
      <CardContent className="flex flex-wrap items-center gap-3 py-3">
        <Avatar className="size-12">
          {child.photoUrl ? (
            <AvatarImage src={child.photoUrl} alt={child.full_name} />
          ) : null}
          <AvatarFallback>{initials(child.full_name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="font-semibold">{child.full_name}</div>
          <StatusLine child={eff} isIn={isIn} isOut={isOut} />
          <ChildSafetyBadges
            allergies={child.allergies}
            medicalNotes={child.medical_notes}
            className="mt-1.5"
          />
        </div>

        <div className="flex items-center gap-2">
          {!eff.checkInAt ? (
            <Button
              size="lg"
              className="h-12 px-5"
              disabled={pending}
              onClick={() =>
                act("att-checkin", () => checkIn(child.id), {
                  checkInAt: now(),
                  checkInBy: "you",
                })
              }
            >
              <LogIn className="size-5" /> Check in
            </Button>
          ) : isIn ? (
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-5"
              disabled={pending}
              onClick={() => setCheckoutOpen(true)}
            >
              <LogOut className="size-5" /> Check out
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                act("att-undo-checkout", () => undoCheckOut(child.id), {
                  checkOutAt: null,
                  checkOutBy: null,
                })
              }
            >
              Undo
            </Button>
          )}
        </div>

        {eff.checkInAt && isIn ? (
          <button
            type="button"
            className="w-full text-left text-xs text-muted-foreground hover:text-foreground"
            disabled={pending}
            onClick={() =>
              act("att-undo-checkin", () => undoCheckIn(child.id), {
                checkInAt: null,
                checkInBy: null,
              })
            }
          >
            Undo check-in
          </button>
        ) : null}
      </CardContent>

      <CheckoutDialog
        child={child}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onConfirm={() => {
          setCheckoutOpen(false)
          act("att-checkout", () => checkOut(child.id), {
            checkOutAt: now(),
            checkOutBy: "you",
          })
        }}
      />
    </Card>
  )
}

function StatusLine({
  child,
  isIn,
  isOut,
}: {
  child: AttendanceChild
  isIn: boolean
  isOut: boolean
}) {
  if (isOut) {
    return (
      <div className="text-sm text-muted-foreground">
        Checked out {timeLabel(child.checkOutAt)}
        {child.checkOutBy ? ` · by ${child.checkOutBy}` : ""}
      </div>
    )
  }
  if (isIn) {
    return (
      <div className="text-sm text-primary">
        Checked in {timeLabel(child.checkInAt)}
        {child.checkInBy ? ` · by ${child.checkInBy}` : ""}
      </div>
    )
  }
  return <div className="text-sm text-muted-foreground">Not checked in</div>
}

function CheckoutDialog({
  child,
  open,
  onOpenChange,
  onConfirm,
}: {
  child: AttendanceChild
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check out {child.full_name}</DialogTitle>
          <DialogDescription>
            Only release to an authorized person. Verify their identity — and
            PIN if set — before confirming.
          </DialogDescription>
        </DialogHeader>

        {child.pickups.length === 0 ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            No authorized pickups on file. Confirm identity against emergency
            contacts before releasing.
          </p>
        ) : (
          <ul className="grid gap-2">
            {child.pickups.map((p, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border p-2.5"
              >
                <Avatar className="size-10">
                  {p.photoUrl ? (
                    <AvatarImage src={p.photoUrl} alt={p.name} />
                  ) : null}
                  <AvatarFallback>{initials(p.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name}</div>
                  {p.relationship ? (
                    <div className="text-xs text-muted-foreground">
                      {p.relationship}
                    </div>
                  ) : null}
                </div>
                {p.pin ? <Badge variant="secondary">PIN {p.pin}</Badge> : null}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter showCloseButton>
          <Button onClick={onConfirm}>
            <ShieldCheck className="size-4" /> Confirm check-out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
