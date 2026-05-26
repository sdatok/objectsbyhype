"use client";

import { useEffect } from "react";

/**
 * Route-level boundary for /survivor. Any uncaught client error in
 * SurvivorClient or GameCanvas lands here instead of the browser's
 * generic "page couldn't load" screen. Logging to console lets us read
 * the stack from the user's devtools without a full crash log pipeline.
 */
export default function SurvivorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[survivor] route error", error);
  }, [error]);

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-400">
          Survivor
        </p>
        <h1 className="text-2xl font-bold">Something tripped the lobby.</h1>
        <p className="text-sm text-neutral-400 break-words">
          {error.message || "Unexpected error"}
        </p>
        {error.digest && (
          <p className="text-[10px] text-neutral-600 font-mono">
            ref · {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={reset}
            className="text-xs tracking-widest uppercase px-4 py-2 border border-white hover:bg-white hover:text-black transition-colors"
          >
            Retry
          </button>
          <a
            href="/"
            className="text-xs tracking-widest uppercase px-4 py-2 border border-white/20 text-neutral-300 hover:border-white hover:text-white transition-colors"
          >
            Back to store
          </a>
        </div>
      </div>
    </main>
  );
}
