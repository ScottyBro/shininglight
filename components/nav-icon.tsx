import {
  Baby,
  ClipboardCheck,
  Home,
  LayoutDashboard,
  MessageCircle,
  NotebookPen,
  Receipt,
  School,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react"

const ICONS: Record<string, LucideIcon> = {
  Baby,
  ClipboardCheck,
  Home,
  LayoutDashboard,
  MessageCircle,
  NotebookPen,
  Receipt,
  School,
  Sun,
  Users,
}

export function NavIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Icon = ICONS[name] ?? LayoutDashboard
  return <Icon className={className} aria-hidden />
}
