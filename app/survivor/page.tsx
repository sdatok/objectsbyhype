import { buildPublicSurvivorState } from "@/lib/survivor-config";
import SurvivorClient from "@/components/survivor/SurvivorClient";

export const dynamic = "force-dynamic";

export default async function SurvivorPage() {
  const state = await buildPublicSurvivorState();

  if (!state.enabled) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-400">
            Survivor
          </p>
          <h1 className="text-3xl font-bold mt-3">Currently offline</h1>
          <p className="text-sm text-neutral-400 mt-3">
            We&apos;re prepping the next match. Follow us on Instagram for the
            drop time.
          </p>
        </div>
      </main>
    );
  }

  return <SurvivorClient initialState={state} />;
}
