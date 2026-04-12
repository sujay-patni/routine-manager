"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/today", label: "Today", icon: "☀️" },
  { href: "/schedule", label: "Schedule", icon: "📅" },
  { href: "/weekly", label: "Weekly", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t safe-bottom">
      <div className="flex max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className={cn("font-medium", active && "font-semibold")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
