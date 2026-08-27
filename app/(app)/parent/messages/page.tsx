import { requireRole } from "@/lib/auth"
import { getParentChildren } from "@/lib/parent"
import { getThreadMessages } from "@/lib/thread"
import { PageHeader } from "@/components/page-header"
import { MessageList } from "@/components/messages/message-list"
import { MessageCompose } from "@/components/messages/message-compose"
import { RealtimeRefresh } from "@/components/realtime-refresh"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const metadata = { title: "Messages" }

export default async function ParentMessagesPage() {
  const profile = await requireRole("parent")
  const children = await getParentChildren(profile.id)

  const threads = await Promise.all(
    children.map(async (child) => ({
      child,
      messages: await getThreadMessages(child.id),
    }))
  )

  return (
    <>
      <RealtimeRefresh table="messages" channel="parent-messages" />
      <PageHeader
        title="Messages"
        description="Chat with your child's teacher."
      />

      {threads.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Messaging opens once your child is linked to your account.
          </CardContent>
        </Card>
      ) : threads.length === 1 ? (
        <div>
          <MessageList messages={threads[0].messages} currentUserId={profile.id} />
          <MessageCompose childId={threads[0].child.id} />
        </div>
      ) : (
        <Tabs defaultValue={threads[0].child.id}>
          <TabsList>
            {threads.map((t) => (
              <TabsTrigger key={t.child.id} value={t.child.id}>
                {t.child.full_name.split(" ")[0]}
              </TabsTrigger>
            ))}
          </TabsList>
          {threads.map((t) => (
            <TabsContent key={t.child.id} value={t.child.id} className="mt-4">
              <MessageList messages={t.messages} currentUserId={profile.id} />
              <MessageCompose childId={t.child.id} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  )
}
