import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  BLACKJACK_WHEEL_WINNERS,
  getOrCreateBlackjackConfig,
  ensureOpenRound,
} from "@/lib/blackjack-config";
import BlackjackConfigForm from "@/components/admin/BlackjackConfigForm";

export const dynamic = "force-dynamic";

export default async function AdminBlackjackPage() {
  let config = await getOrCreateBlackjackConfig();
  const { round: current } = await ensureOpenRound(config);

  const entryCount = await prisma.blackjackEntry.count({
    where: { roundId: current.id },
  });

  const recentRounds = await prisma.blackjackRound.findMany({
    where: { status: "SETTLED" },
    orderBy: { settledAt: "desc" },
    take: 5,
    include: {
      entries: {
        where: { placement: { lte: BLACKJACK_WHEEL_WINNERS } },
        orderBy: { placement: "asc" },
      },
    },
  });

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
        >
          ← Admin home
        </Link>
        <h1 className="text-[18px] font-bold mt-3">Blackjack</h1>
        <p className="text-[12px] text-neutral-500 mt-0.5">
          One hand every 3 minutes at <code>/blackjack</code>. Top{" "}
          {BLACKJACK_WHEEL_WINNERS} hands each round win a{" "}
          <Link href="/giveawaywheel" className="underline">
            giveaway wheel
          </Link>{" "}
          spin.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
        <BlackjackConfigForm
          initialConfig={{
            enabled: config.enabled,
            prizeTitle: config.prizeTitle,
            prizeDescription: config.prizeDescription ?? "",
            roundSeconds: config.roundSeconds,
            roundEndsAt: current.endsAt.toISOString(),
            entryCount,
          }}
        />

        <div>
          <h2 className="text-[11px] uppercase tracking-widest font-bold mb-4">
            Recent rounds
          </h2>
          {recentRounds.length === 0 ? (
            <p className="text-[11px] text-neutral-400 italic">
              No settled rounds yet.
            </p>
          ) : (
            <div className="space-y-5">
              {recentRounds.map((round) => (
                <div
                  key={round.id}
                  className="bg-white border border-neutral-200 rounded p-4"
                >
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <p className="text-[11px] uppercase tracking-widest font-bold">
                      Settled
                      <span className="ml-2 text-neutral-400 font-normal">
                        · {round.entries.length} wheel winners
                      </span>
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      {round.settledAt?.toLocaleString()}
                    </p>
                  </div>
                  <ol className="space-y-1.5">
                    {round.entries.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between text-[12px] border-b border-neutral-100 pb-1.5"
                      >
                        <span>
                          <span className="text-[10px] text-neutral-400 w-6 inline-block">
                            #{e.placement}
                          </span>
                          <span className="font-medium">{e.displayName}</span>{" "}
                          <span className="text-neutral-500">{e.email}</span>
                        </span>
                        <span className="font-mono text-[10px]">
                          {e.outcome} · {e.handValue}
                          {e.wheelCode && (
                            <span className="ml-2 text-emerald-600">
                              {e.wheelCode}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
