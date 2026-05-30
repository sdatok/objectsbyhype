import { buildPublicWheelState } from "@/lib/wheel-spin";
import { initWheelData } from "@/lib/wheel-db";
import WheelClient from "@/components/wheel/WheelClient";

export const dynamic = "force-dynamic";

export default async function WheelOfHypePage() {
  await initWheelData();
  const state = await buildPublicWheelState().catch(() => null);

  if (!state?.enabled) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-6">
        <div className="text-center max-w-md border border-fuchsia-500/40 bg-black/80 p-8">
          <p className="font-pixel text-[10px] sm:text-xs text-fuchsia-400 tracking-widest">
            WHEEL OF HYPE
          </p>
          <h1 className="font-pixel text-sm sm:text-base mt-4 text-white">
            Offline
          </h1>
          <p className="font-pixel-body text-lg text-neutral-400 mt-3">
            The wheel isn&apos;t spinning right now. Check back soon.
          </p>
        </div>
      </main>
    );
  }

  return <WheelClient initialState={state} />;
}
