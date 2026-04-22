"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

/** Ensures CustomerProfile exists after sign-in (welcome discount eligibility). */
export default function StoreAccountSync() {
  const { isSignedIn, userId } = useAuth();
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      done.current = null;
      return;
    }
    if (done.current === userId) return;
    done.current = userId;

    void fetch("/api/account/ensure-profile", { method: "POST" }).catch(() => {
      done.current = null;
    });
  }, [isSignedIn, userId]);

  return null;
}
