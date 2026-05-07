"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const FULL_WIDTH_ON = ["/blocked", "/unlock"];

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullWidth = FULL_WIDTH_ON.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  return (
    <div className={cn("flex flex-col flex-1 min-w-0", !fullWidth && "lg:pl-56")}>
      {children}
    </div>
  );
}
