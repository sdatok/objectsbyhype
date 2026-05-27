import { unstable_noStore as noStore } from "next/cache";
import { buildPublicGameState } from "@/lib/game-config";
import HomeGame from "./HomeGame";

/** Always read fresh enabled flag — home page ISR must not serve a stale game. */
export default async function HomeGameSection() {
  noStore();
  const state = await buildPublicGameState().catch(() => null);
  if (!state?.enabled) return null;
  return <HomeGame initialState={state} />;
}
