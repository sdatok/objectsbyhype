import Link from "next/link";
import { getOrCreateGameConfig, computeWindowEndsAt } from "@/lib/game-config";
import { prisma } from "@/lib/db";
import GameConfigForm from "@/components/admin/GameConfigForm";
import AdminDeleteScoreButton from "@/components/admin/AdminDeleteScoreButton";
import AdminAddScoreForm from "@/components/admin/AdminAddScoreForm";

export const dynamic = "force-dynamic";

export default async function AdminGamePage() {
  const config = await getOrCreateGameConfig();

  // Last 4 distinct windows for the leaderboard view.
  const distinctWindows = await prisma.gameScore.findMany({
    distinct: ["windowStartedAt"],
    orderBy: { windowStartedAt: "desc" },
    select: { windowStartedAt: true },
    take: 4,
  });

  const buckets = await Promise.all(
    distinctWindows.map(async (w) => {
      const isCurrent =
        w.windowStartedAt.getTime() === config.windowStartedAt.getTime();
      const scores = await prisma.gameScore.findMany({
        where: { windowStartedAt: w.windowStartedAt },
        orderBy: [
          { score: "desc" },
          { secondsPlayed: "asc" },
          { createdAt: "asc" },
        ],
        // Current window: show every player so admin can email all eligible
        // entrants. Previous windows: cap at 25 to keep the page light.
        ...(isCurrent ? {} : { take: 25 }),
      });
      return { windowStartedAt: w.windowStartedAt, scores };
    })
  );

  const currentEndsAt = computeWindowEndsAt(config);

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
        >
          ← Admin home
        </Link>
        <h1 className="text-[18px] font-bold mt-3">Giveaway Game</h1>
        <p className="text-[12px] text-neutral-500 mt-0.5">
          Settings for the home-page mini-game and the hourly giveaway window.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
        <GameConfigForm
          initialConfig={{
            enabled: config.enabled,
            prizeTitle: config.prizeTitle,
            prizeDescription: config.prizeDescription ?? "",
            windowHours: config.windowHours,
            gameSpeed: config.gameSpeed,
            maxMisses: config.maxMisses,
            taskBaseSeconds: config.taskBaseSeconds,
            windowStartedAt: config.windowStartedAt.toISOString(),
            windowEndsAt: currentEndsAt.toISOString(),
          }}
        />

        <div>
          <h2 className="text-[11px] uppercase tracking-widest font-bold mb-4">
            Recent windows
          </h2>
          {buckets.length === 0 && (
            <p className="text-[11px] text-neutral-400 italic">
              No scores submitted yet.
            </p>
          )}
          <div className="space-y-5">
            {buckets.map((b, idx) => {
              const isCurrent =
                b.windowStartedAt.getTime() ===
                config.windowStartedAt.getTime();
              return (
                <div
                  key={b.windowStartedAt.toISOString()}
                  className="bg-white border border-neutral-200 rounded p-4"
                >
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <p className="text-[11px] uppercase tracking-widest font-bold">
                      {isCurrent ? "Current window" : "Previous"}
                      <span className="ml-2 text-neutral-400 font-normal">
                        · {b.scores.length}{" "}
                        {b.scores.length === 1 ? "entrant" : "entrants"}
                        {!isCurrent && b.scores.length === 25 ? "+" : ""}
                      </span>
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      Started {b.windowStartedAt.toLocaleString()}
                    </p>
                  </div>
                  {isCurrent && <AdminAddScoreForm />}
                  {b.scores.length === 0 ? (
                    <p className="text-[11px] text-neutral-400 italic">
                      No scores in this window.
                    </p>
                  ) : (
                    <ol className="space-y-1.5">
                      {b.scores.map((s, i) => {
                        const isTop3 = i < 3;
                        const medal = ["★", "◆", "▲"][i] ?? "";
                        return (
                          <li
                            key={s.id}
                            className={`flex items-center justify-between text-[12px] border-b border-neutral-100 pb-1.5 ${
                              isTop3 ? "font-medium" : ""
                            }`}
                          >
                            <span className="flex items-center gap-3 min-w-0">
                              <span
                                className={`text-[10px] uppercase tracking-widest w-7 shrink-0 ${
                                  isTop3
                                    ? "text-fuchsia-600"
                                    : "text-neutral-300"
                                }`}
                              >
                                {i + 1}
                                {isTop3 ? medal : ""}
                              </span>
                              <span className="truncate">
                                {s.displayName && (
                                  <span className="font-medium">
                                    {s.displayName}{" "}
                                  </span>
                                )}
                                <span className="text-neutral-500">
                                  {s.email}
                                </span>
                              </span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0 ml-3">
                              <span className="font-mono tabular-nums text-right">
                                <span className="block">{s.score}</span>
                                <span className="text-[9px] text-neutral-400 font-sans">
                                  {s.secondsPlayed}s
                                </span>
                              </span>
                              {isCurrent && (
                                <AdminDeleteScoreButton
                                  scoreId={s.id}
                                  score={s.score}
                                />
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {idx === 0 && isCurrent && b.scores.length > 0 && (
                    <p className="text-[10px] text-neutral-400 mt-3">
                      Top 3 ★◆▲ will win when the window ends.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
