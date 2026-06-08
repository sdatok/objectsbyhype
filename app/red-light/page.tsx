import { buildPublicRedLightState } from "@/lib/red-light-config";
import RedLightClient from "@/components/red-light/RedLightClient";

export const dynamic = "force-dynamic";

export default async function RedLightPage() {
  const state = await buildPublicRedLightState();

  if (!state.enabled) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 text-center overflow-y-auto">
        <div className="max-w-md">
          <p
            className="font-pixel text-[8px] tracking-[0.35em] text-pink-400"
            style={{ textShadow: "0 0 16px rgba(236,72,153,0.6)" }}
          >
            Red Light Green Light
          </p>
          <h1 className="font-pixel text-xs sm:text-sm mt-5 uppercase leading-relaxed">
            Currently offline
          </h1>
          <p className="font-pixel-body text-lg text-pink-200/50 mt-4">
            The doll is resting. Check back when the next game opens.
          </p>
        </div>
      </main>
    );
  }

  return <RedLightClient initialState={state} />;
}
