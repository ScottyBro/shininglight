import { AppShell } from "@/components/app-shell"
import { OfflineProvider } from "@/components/pwa/offline-provider"
import { requireProfile } from "@/lib/auth"
import { NAV_BY_ROLE } from "@/lib/nav"
import { getUnreadMessageCount } from "@/lib/thread"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireProfile()
  const unread = await getUnreadMessageCount(profile)
  const messagesHref = profile.role === "parent" ? "/parent/messages" : "/teacher/messages"

  return (
    <AppShell
      role={profile.role}
      fullName={profile.full_name}
      navItems={NAV_BY_ROLE[profile.role]}
      badges={unread > 0 ? { [messagesHref]: unread } : undefined}
    >
      {children}
      <OfflineProvider />
    </AppShell>
  )
}
