"use client"

/**
 * A tiny IndexedDB-backed queue for staff write actions taken while offline
 * (attendance and daily-report entry). Single-writer-per-record is assumed, so
 * queued ops simply replay on reconnect with last-write-wins.
 */

export type QueuedOp =
  | { id: string; kind: "att-checkin"; childId: string; ts: number }
  | { id: string; kind: "att-checkout"; childId: string; ts: number }
  | { id: string; kind: "att-undo-checkin"; childId: string; ts: number }
  | { id: string; kind: "att-undo-checkout"; childId: string; ts: number }
  | {
      id: string
      kind: "report-save"
      childId: string
      ts: number
      payload: Record<string, string>
    }

const DB_NAME = "shining-light-offline"
const STORE = "queue"
const EVT = "sl-queue-changed"

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return idb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = fn(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result as T)
        req.onerror = () => reject(req.error)
      })
  )
}

function notify() {
  try {
    window.dispatchEvent(new Event(EVT))
  } catch {
    /* SSR / no window */
  }
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never

export async function enqueue(
  op: DistributiveOmit<QueuedOp, "id" | "ts">
): Promise<void> {
  const full = {
    ...op,
    id: crypto.randomUUID(),
    ts: Date.now(),
  } as QueuedOp
  await tx("readwrite", (s) => s.put(full))
  notify()
}

export async function allOps(): Promise<QueuedOp[]> {
  const ops = await tx<QueuedOp[]>("readonly", (s) => s.getAll())
  return (ops ?? []).sort((a, b) => a.ts - b.ts)
}

export async function removeOp(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id))
  notify()
}

export async function queueCount(): Promise<number> {
  try {
    return await tx<number>("readonly", (s) => s.count())
  } catch {
    return 0
  }
}

export function onQueueChanged(cb: () => void): () => void {
  window.addEventListener(EVT, cb)
  return () => window.removeEventListener(EVT, cb)
}
