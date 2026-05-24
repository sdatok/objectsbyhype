"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Lightweight storefront page-view beacon. Fires one POST per client-side
 * navigation (and once on initial mount) so the admin stats page has a
 * self-hosted counter in addition to Vercel Analytics.
 *
 * Uses sendBeacon when available — survives unloads and won't block UX —
 * and falls back to fetch with keepalive otherwise.
 */
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const payload = JSON.stringify({ path: pathname });
    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/track-view", blob);
        return;
      }
    } catch {
      // fall through to fetch
    }
    fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
