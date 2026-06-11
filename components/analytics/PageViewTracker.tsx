"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const body = JSON.stringify({ event: "page_view", path: pathname });
    fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
  }, [pathname]);
  return null;
}
