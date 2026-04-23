"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/today", label: "Today", icon: "☀️" },
  { href: "/calendar", label: "Calendar", icon: "📆" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/92 backdrop-blur border-t safe-bottom">
      <div className="grid grid-cols-3 max-w-lg mx-auto px-2.5 py-2 pb-[22px]">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "?");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className={cn("text-xl leading-none", !active && "opacity-85 saturate-[.4]")}>{item.icon}</span>
              <span className={cn("text-[10px] tracking-[.04em]", active ? "font-semibold" : "font-medium")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
