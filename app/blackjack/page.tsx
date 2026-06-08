import { buildPublicBlackjackState } from "@/lib/blackjack-config";
import BlackjackClient from "@/components/blackjack/BlackjackClient";

export const dynamic = "force-dynamic";

export default async function BlackjackPage() {
  const state = await buildPublicBlackjackState();

  if (!state.enabled) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 text-center overflow-y-auto">
        <div className="max-w-md border border-amber-500/30 bg-black/40 p-8 rounded-lg">
          <p className="text-[10px] uppercase tracking-[0.35em] text-amber-400">
            ♠ Blackjack
          </p>
          <h1 className="text-lg font-bold mt-4">Table closed</h1>
          <p className="text-sm text-neutral-400 mt-3">
            The blackjack table isn&apos;t live right now. Check back soon.
          </p>
        </div>
      </main>
    );
  }

  return <BlackjackClient initialState={state} />;
}
