import { AppShell } from "@/components/app-shell"
import { OfflineProvider } from "@/components/pwa/offline-provider"
import { requireProfile } from "@/lib/auth"
import { NAV_BY_ROLE } from "@/lib/nav"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireProfile()

  return (
    <AppShell
      role={profile.role}
      fullName={profile.full_name}
      navItems={NAV_BY_ROLE[profile.role]}
    >
      {children}
      <OfflineProvider />
    </AppShell>
  )
}
