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

export function AppShell({
  role,
  fullName,
  navItems,
  children,
}: {
  role: UserRole
  fullName: string | null
  navItems: NavItem[]
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <div className="px-2 py-3">
          <BrandLockup />
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(pathname, item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <NavIcon name={item.icon} className="size-5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <UserFooter fullName={fullName} role={role} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/95 px-4 py-3 backdrop-blur md:hidden">
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
      <main className="flex-1 pb-24 md:pb-0">
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t bg-card/95 backdrop-blur md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              isActive(pathname, item.href)
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <NavIcon name={item.icon} className="size-6" />
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
    <div className="mt-2 border-t pt-3">
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
