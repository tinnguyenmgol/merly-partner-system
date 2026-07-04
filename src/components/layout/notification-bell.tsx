"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
export function NotificationBell({ href, count, label, countUrl }: { href: string; count: number; label: string; countUrl: string }) {
  const [currentCount, setCurrentCount] = useState(count);

  useEffect(() => {
    let cancelled = false;
    async function refreshCount() {
      try {
        const response = await fetch(countUrl, { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const payload = (await response.json()) as { count?: unknown };
        const nextCount = typeof payload.count === "number" && Number.isFinite(payload.count) ? Math.max(0, Math.floor(payload.count)) : 0;
        if (!cancelled) setCurrentCount(nextCount);
      } catch {
        // Keep the server-rendered count when a transient refresh fails.
      }
    }

    refreshCount();
    const interval = window.setInterval(refreshCount, 45_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshCount();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [countUrl]);

  return (
    <Link aria-label={label} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-rose-100 bg-white text-xl text-merly-700 shadow-sm hover:bg-merly-50" href={href}>
      <span aria-hidden="true">🔔</span>
      {currentCount > 0 ? <span className="absolute -right-1 -top-1 min-w-6 rounded-full bg-merly-700 px-1.5 py-0.5 text-center text-xs font-bold text-white">{currentCount > 99 ? "99+" : currentCount}</span> : null}
    </Link>
  );
}
