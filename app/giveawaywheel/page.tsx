import { gameFontVariables } from "@/lib/game-fonts";
import { buildPublicGiveawayWheelState } from "@/lib/giveaway-wheel-spin";
import { initGiveawayWheelData } from "@/lib/giveaway-wheel-db";
import GiveawayWheelClient from "@/components/giveaway-wheel/GiveawayWheelClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Giveaway Wheel — OBJECTSBYHYPE",
  description:
    "Game winners spin once with a GW code for giveaway prizes.",
};

export default async function GiveawayWheelPage() {
  await initGiveawayWheelData();
  const state = await buildPublicGiveawayWheelState().catch(() => null);

  if (!state?.enabled) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-6">
        <div className="text-center max-w-md border border-emerald-500/40 bg-black/80 p-8">
          <p className="font-pixel text-[10px] sm:text-xs text-emerald-400 tracking-widest">
            🎡 GIVEAWAY WHEEL
          </p>
          <h1 className="font-pixel text-sm sm:text-base mt-4 text-white">
            Offline
          </h1>
          <p className="font-pixel-body text-lg text-neutral-400 mt-3">
            The giveaway wheel isn&apos;t live right now. Win a game and check back when it opens.
          </p>
        </div>
      </main>
    );
  }

  return <GiveawayWheelClient initialState={state} />;
}
