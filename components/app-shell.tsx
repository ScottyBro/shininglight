"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { signout } from "@/app/auth/actions"
import { BrandLockup, BrandMark } from "@/components/brand"
import { NavIcon } from "@/components/nav-icon"
import { Button } from "@/components/ui/button"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import type { NavItem } from "@/lib/nav"
import type { UserRole } from "@/lib/types/database"
import { cn } from "@/lib/utils"

function initials(name: string | null) {
  if (!name) return "?"
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  parent: "Parent",
}

function isActive(pathname: string, href: string) {
  if (href.split("/").length <= 2) return pathname === href
  return pathname === href || pathname.startsWith(href + "/")
}

function NavBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
      {count > 9 ? "9+" : count}
    </span>
  )
}

export function AppShell({
  role,
  fullName,
  navItems,
  badges,
  children,
}: {
  role: UserRole
  fullName: string | null
  navItems: NavItem[]
  badges?: Record<string, number>
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar: floating glass panel, inset from the edge */}
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col self-start p-4 md:ml-4 md:flex">
        <div className="glass flex h-full flex-col rounded-3xl p-4 shadow-[0_8px_30px_-8px_rgb(80_60_140_/_0.18)]">
          <div className="px-2 py-3">
            <BrandLockup />
          </div>
          <nav className="mt-4 flex flex-1 flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium transition-all",
                  isActive(pathname, item.href)
                    ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-2px_var(--primary)]"
                    : "text-muted-foreground hover:glass-strong hover:text-foreground"
                )}
              >
                <NavIcon name={item.icon} className="size-5" />
                {item.label}
                {badges?.[item.href] ? <NavBadge count={badges[item.href]} /> : null}
              </Link>
            ))}
          </nav>
          <UserFooter fullName={fullName} role={role} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-3 z-30 mx-3 flex items-center justify-between rounded-full px-4 py-2.5 md:hidden glass shadow-[0_8px_30px_-8px_rgb(80_60_140_/_0.18)]">
        <Link href={navItems[0].href} className="flex items-center gap-2">
          <BrandMark size={32} />
          <span className="font-heading font-extrabold">Shining Light</span>
        </Link>
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">
              {initials(fullName)}
            </AvatarFallback>
          </Avatar>
          <form action={signout}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-28 md:pb-4">
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">{children}</div>
      </main>

      {/* Mobile bottom nav: floating glass pill bar */}
      <nav className="fixed inset-x-3 bottom-3 z-30 flex items-stretch rounded-full px-1 py-1 md:hidden glass shadow-[0_8px_30px_-8px_rgb(80_60_140_/_0.25)]">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-medium transition-colors",
              isActive(pathname, item.href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            )}
          >
            <span className="relative">
              <NavIcon name={item.icon} className="size-5" />
              {badges?.[item.href] ? (
                <span className="absolute -right-1.5 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-semibold text-white">
                  {badges[item.href] > 9 ? "9+" : badges[item.href]}
                </span>
              ) : null}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

function UserFooter({
  fullName,
  role,
}: {
  fullName: string | null
  role: UserRole
}) {
  return (
    <div className="mt-2 border-t border-glass-border pt-3">
      <div className="flex items-center gap-3 px-1">
        <Avatar className="size-9">
          <AvatarFallback>{initials(fullName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {fullName ?? "Account"}
          </div>
          <div className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</div>
        </div>
      </div>
      <form action={signout} className="mt-2">
        <Button type="submit" variant="outline" size="sm" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  )
}
