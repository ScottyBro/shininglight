"use client"

import { allOps, removeOp, type QueuedOp } from "@/lib/offline/queue"
import {
  checkIn,
  checkOut,
  undoCheckIn,
  undoCheckOut,
} from "@/app/(app)/teacher/attendance/actions"
import { saveDailyReport } from "@/app/(app)/teacher/reports/actions"

async function runOp(op: QueuedOp): Promise<void> {
  switch (op.kind) {
    case "att-checkin":
      await checkIn(op.childId)
      return
    case "att-checkout":
      await checkOut(op.childId)
      return
    case "att-undo-checkin":
      await undoCheckIn(op.childId)
      return
    case "att-undo-checkout":
      await undoCheckOut(op.childId)
      return
    case "report-save": {
      const fd = new FormData()
      for (const [k, v] of Object.entries(op.payload)) fd.set(k, v)
      // Queued reports always replay as drafts (see report-form offline path).
      fd.set("intent", "draft")
      await saveDailyReport({}, fd)
      return
    }
  }
}

let draining = false

/** Replay queued ops oldest-first. Stops at the first failure (likely still
 *  offline) so nothing is lost. Returns how many replayed. */
export async function drainQueue(): Promise<number> {
  if (draining || (typeof navigator !== "undefined" && !navigator.onLine)) return 0
  draining = true
  let done = 0
  try {
    const ops = await allOps()
    for (const op of ops) {
      try {
        await runOp(op)
        await removeOp(op.id)
        done++
      } catch {
        break
      }
    }
  } finally {
    draining = false
  }
  return done
}
