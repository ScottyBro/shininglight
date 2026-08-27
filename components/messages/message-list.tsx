import { timeLabel, dateLabel } from "@/lib/date"
import { cn } from "@/lib/utils"

export type ThreadMessage = {
  id: string
  body: string
  created_at: string
  sender_id: string
  sender_name: string
  sender_role: string
}

/** A simple chat transcript, newest at the bottom. */
export function MessageList({
  messages,
  currentUserId,
}: {
  messages: ThreadMessage[]
  currentUserId: string
}) {
  if (messages.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No messages yet. Say hello 👋
      </p>
    )
  }

  return (
    <div className="grid gap-2">
      {messages.map((m) => {
        const mine = m.sender_id === currentUserId
        return (
          <div
            key={m.id}
            className={cn("flex flex-col", mine ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                mine
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-muted"
              )}
            >
              {!mine ? (
                <div className="mb-0.5 text-xs font-semibold opacity-80">
                  {m.sender_name}
                </div>
              ) : null}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
            </div>
            <div className="mt-0.5 px-1 text-[11px] text-muted-foreground">
              {dateLabel(m.created_at)} · {timeLabel(m.created_at)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
