"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminDeleteScoreButton({
  scoreId,
  score,
}: {
  scoreId: string;
  score: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (
      !window.confirm(
        `Remove score ${score.toLocaleString()} from the leaderboard?`
      )
    ) {
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/admin/game/scores/${scoreId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? "Could not delete score");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="text-[10px] uppercase tracking-widest text-red-600 hover:text-red-800 disabled:opacity-50 shrink-0 ml-2"
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}
