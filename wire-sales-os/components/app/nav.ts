import {
  BarChart3,
  Building2,
  CheckSquare,
  Columns3,
  Crosshair,
  FileText,
  Gauge,
  LayoutDashboard,
  Megaphone,
  Settings,
  Sparkles,
  Telescope,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; shortcut?: string };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Command Center", icon: Gauge, shortcut: "G C" },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
    ],
  },
  {
    label: "Prospect",
    items: [
      { href: "/leads", label: "Leads", icon: Crosshair, shortcut: "G L" },
      { href: "/prospects", label: "Prospects", icon: Telescope, shortcut: "G F" },
      { href: "/companies", label: "Companies", icon: Building2, shortcut: "G O" },
      { href: "/contacts", label: "Contacts", icon: Users },
    ],
  },
  {
    label: "Sell",
    items: [
      { href: "/pipeline", label: "Pipeline", icon: Columns3, shortcut: "G P" },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/tasks", label: "Tasks", icon: CheckSquare, shortcut: "G T" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3, shortcut: "G A" },
      { href: "/copilot", label: "AI Copilot", icon: Sparkles, shortcut: "G I" },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/templates", label: "Templates", icon: FileText },
      { href: "/settings", label: "Settings", icon: Settings, shortcut: "G S" },
    ],
  },
];

export const NAV_ITEMS = NAV.flatMap((g) => g.items);

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
