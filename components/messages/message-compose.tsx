"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { Languages, SendHorizontal, Sparkles } from "lucide-react"

import {
  sendMessage,
  draftMessageText,
  translateMessageText,
  type MessageState,
} from "@/lib/messages"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const initial: MessageState = {}

export function MessageCompose({
  childId,
  enableAi = false,
  childFirstName,
}: {
  childId: string
  enableAi?: boolean
  childFirstName?: string
}) {
  const [state, action, pending] = useActionState(sendMessage, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const [body, setBody] = useState("")
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiPending, startAi] = useTransition()

  useEffect(() => {
    if (state.ok) {
      setBody("")
      formRef.current?.reset()
    }
  }, [state.ok])

  function polish() {
    setAiError(null)
    startAi(async () => {
      const r = await draftMessageText(body, childFirstName)
      if (r.error) setAiError(r.error)
      else if (r.text) setBody(r.text)
    })
  }

  function translate(language: string) {
    setAiError(null)
    startAi(async () => {
      const r = await translateMessageText(body, language)
      if (r.error) setAiError(r.error)
      else if (r.text) setBody(r.text)
    })
  }

  return (
    <div className="sticky bottom-16 mt-3 rounded-xl border bg-card/95 p-2 backdrop-blur md:bottom-0">
      {enableAi ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={polish}
            disabled={aiPending || !body.trim()}
          >
            <Sparkles className="size-4" />
            {aiPending ? "Working…" : "Draft with AI"}
          </Button>
          <Select
            onValueChange={(v) => translate(typeof v === "string" ? v : "en")}
          >
            <SelectTrigger size="sm" className="w-auto gap-1" aria-label="Translate">
              <Languages className="size-4" />
              <SelectValue placeholder="Translate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="sn">Shona</SelectItem>
              <SelectItem value="nd">Ndebele</SelectItem>
            </SelectContent>
          </Select>
          {aiError ? (
            <span className="text-xs text-destructive" role="alert">
              {aiError}
            </span>
          ) : null}
        </div>
      ) : null}

      <form ref={formRef} action={action} className="flex items-end gap-2">
        <input type="hidden" name="child_id" value={childId} />
        <Textarea
          name="body"
          rows={1}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="max-h-32 min-h-10 flex-1 resize-none"
        />
        <Button type="submit" size="icon" className="size-10" disabled={pending}>
          <SendHorizontal className="size-5" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
      {state.error ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}
