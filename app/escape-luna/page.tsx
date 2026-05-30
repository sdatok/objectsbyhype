import { buildPublicLunaState } from "@/lib/luna-config";
import LunaClient from "@/components/luna/LunaClient";

export const dynamic = "force-dynamic";

export default async function EscapeLunaPage() {
  const state = await buildPublicLunaState();

  if (!state.enabled) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 text-center overflow-y-auto">
        <div className="max-w-md">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400">
            Escape Luna
          </p>
          <h1 className="text-3xl font-bold mt-3">Currently offline</h1>
          <p className="text-sm text-neutral-400 mt-3">
            Luna is resting. Check back when the next chase opens.
          </p>
        </div>
      </main>
    );
  }

  return <LunaClient initialState={state} />;
}