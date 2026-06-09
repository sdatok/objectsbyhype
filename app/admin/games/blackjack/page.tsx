import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  getOrCreateBlackjackConfig,
  ensureOpenRound,
} from "@/lib/blackjack-config";
import {
  IM_DAILY_GRANT,
  IM_MILESTONE_GIVEAWAY,
  IM_MILESTONE_WOH,
} from "@/lib/blackjack-economy";
import { getLeaderboard } from "@/lib/blackjack-economy";
import BlackjackConfigForm from "@/components/admin/BlackjackConfigForm";

export const dynamic = "force-dynamic";

export default async function AdminBlackjackPage() {
  let config = await getOrCreateBlackjackConfig();
  const { round: current } = await ensureOpenRound(config);

  const seatedCount = await prisma.blackjackSeat.count();
  const leaderboard = await getLeaderboard(5);

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
          Live table at <code>/blackjack</code>. Players get {IM_DAILY_GRANT}{" "}
          internet monies daily. Hit {IM_MILESTONE_GIVEAWAY} IM for a{" "}
          <Link href="/giveawaywheel" className="underline">
            giveaway wheel
          </Link>{" "}
          spin, {IM_MILESTONE_WOH} IM for{" "}
          <Link href="/wheelofhype" className="underline">
            Wheel of Hype
          </Link>
          .
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
            seatedCount,
          }}
        />

        <div>
          <h2 className="text-[11px] uppercase tracking-widest font-bold mb-4">
            Leaderboard (peak stack)
          </h2>
          {leaderboard.length === 0 ? (
            <p className="text-[11px] text-neutral-400 italic">
              No players on the board yet.
            </p>
          ) : (
            <ol className="space-y-1.5 bg-white border border-neutral-200 rounded p-4">
              {leaderboard.map((row) => (
                <li
                  key={row.rank}
                  className="flex items-center justify-between text-[12px] border-b border-neutral-100 pb-1.5 last:border-0"
                >
                  <span>
                    <span className="text-[10px] text-neutral-400 w-6 inline-block">
                      #{row.rank}
                    </span>
                    <span className="font-medium">{row.displayName}</span>{" "}
                    <span className="text-neutral-500">{row.email}</span>
                  </span>
                  <span className="font-mono text-[10px]">
                    {row.peakStack} IM peak
                    {row.savedCredits > 0 && ` · ${row.savedCredits} banked`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
