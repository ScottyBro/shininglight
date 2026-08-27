import type { UserRole } from "@/lib/types/database"

export type NavItem = {
  href: string
  label: string
  /** lucide-react icon name */
  icon: string
}

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Overview", icon: "LayoutDashboard" },
    { href: "/admin/children", label: "Children", icon: "Baby" },
    { href: "/admin/classrooms", label: "Classrooms", icon: "School" },
    { href: "/admin/people", label: "People", icon: "Users" },
    { href: "/admin/billing", label: "Billing", icon: "Receipt" },
  ],
  teacher: [
    { href: "/teacher", label: "Today", icon: "Sun" },
    { href: "/teacher/attendance", label: "Attendance", icon: "ClipboardCheck" },
    { href: "/teacher/reports", label: "Reports", icon: "NotebookPen" },
    { href: "/teacher/messages", label: "Messages", icon: "MessageCircle" },
  ],
  parent: [
    { href: "/parent", label: "Home", icon: "Home" },
    { href: "/parent/reports", label: "Daily reports", icon: "NotebookPen" },
    { href: "/parent/billing", label: "Billing", icon: "Receipt" },
    { href: "/parent/messages", label: "Messages", icon: "MessageCircle" },
  ],
}
