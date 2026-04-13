"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/today", label: "Today", icon: "☀️" },
  { href: "/calendar", label: "Calendar", icon: "📆" },
  { href: "/schedule", label: "Schedule", icon: "📅" },
  { href: "/weekly", label: "Weekly", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-56 border-r bg-sidebar z-40">
      {/* Logo / brand */}
      <div className="px-5 py-6 border-b">
        <h1 className="text-lg font-bold tracking-tight text-foreground">Routine</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Your daily system</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "?");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t">
        <p className="text-xs text-muted-foreground">Powered by Notion</p>
      </div>
    </aside>
  );
}
