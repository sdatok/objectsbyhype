import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getOrCreateLunaConfig } from "@/lib/luna-config";
import { getOrCreateSurvivorConfig } from "@/lib/survivor-config";

export default async function HomeLiveGames() {
  noStore();

  const [survivor, luna] = await Promise.all([
    getOrCreateSurvivorConfig().catch(() => null),
    getOrCreateLunaConfig().catch(() => null),
  ]);

  const survivorOn = survivor?.enabled ?? false;
  const lunaOn = luna?.enabled ?? false;

  if (!survivorOn && !lunaOn) return null;

  return (
    <section
      aria-label="Live games"
      className="bg-black text-white border-y border-neutral-800"
    >
      <div className="max-w-[1600px] mx-auto px-4 py-8 md:py-10">
        <p className="text-center text-[10px] uppercase tracking-[0.35em] text-neutral-500 mb-5">
          Live now — free to play
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch max-w-2xl mx-auto">
          {survivorOn && (
            <Link
              href="/survivor"
              className="flex-1 text-center px-6 py-4 border-2 border-white font-bold text-xs sm:text-sm uppercase tracking-[0.2em] transition-transform hover:scale-[1.02] active:scale-[0.99]"
              style={{
                background: "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
                boxShadow: "4px 4px 0 rgba(255,255,255,0.85)",
              }}
            >
              Play Survivor
              <span className="block mt-1 text-[10px] font-normal tracking-widest text-white/80 normal-case">
                50-player arena · last alive wins
              </span>
            </Link>
          )}
          {lunaOn && (
            <Link
              href="/escape-luna"
              className="flex-1 text-center px-6 py-4 border-2 border-white font-bold text-xs sm:text-sm uppercase tracking-[0.2em] transition-transform hover:scale-[1.02] active:scale-[0.99]"
              style={{
                background: "linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)",
                boxShadow: "4px 4px 0 rgba(255,255,255,0.85)",
              }}
            >
              Escape Luna
              <span className="block mt-1 text-[10px] font-normal tracking-widest text-white/80 normal-case">
                Run from the dog · survive the chase
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
