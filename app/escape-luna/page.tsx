import { buildPublicLunaState } from "@/lib/luna-config";
import LunaClient from "@/components/luna/LunaClient";

export const dynamic = "force-dynamic";

export default async function EscapeLunaPage() {
  const state = await buildPublicLunaState();

  if (!state.enabled) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 text-center overflow-y-auto">
        <div className="max-w-md">
          <p
            className="font-pixel text-[8px] tracking-[0.35em] text-red-500"
            style={{ textShadow: "0 0 16px rgba(220,38,38,0.6)" }}
          >
            Escape Luna
          </p>
          <h1 className="font-pixel text-xs sm:text-sm mt-5 uppercase leading-relaxed">
            Currently offline
          </h1>
          <p className="font-pixel-body text-lg text-neutral-500 mt-4">
            Luna is resting. Check back when the next chase opens.
          </p>
        </div>
      </main>
    );
  }

  return <LunaClient initialState={state} />;
}