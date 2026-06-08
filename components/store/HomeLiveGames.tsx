import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getOrCreateLunaConfig } from "@/lib/luna-config";
import { getOrCreateRedLightConfig } from "@/lib/red-light-config";
import { getOrCreateSurvivorConfig } from "@/lib/survivor-config";

export default async function HomeLiveGames() {
  noStore();

  const [survivor, luna, redLight] = await Promise.all([
    getOrCreateSurvivorConfig().catch(() => null),
    getOrCreateLunaConfig().catch(() => null),
    getOrCreateRedLightConfig().catch(() => null),
  ]);

  const survivorOn = survivor?.enabled ?? false;
  const lunaOn = luna?.enabled ?? false;
  const redLightOn = redLight?.enabled ?? false;

  if (!survivorOn && !lunaOn && !redLightOn) return null;

  return (
    <section
      aria-label="Live games"
      className="bg-black text-white border-y border-neutral-800"
    >
      <div className="max-w-[1600px] mx-auto px-4 py-8 md:py-10">
        <p className="text-center text-[10px] uppercase tracking-[0.35em] text-neutral-500 mb-5">
          Live now — free to play
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center items-stretch max-w-3xl mx-auto">
          {survivorOn && (
            <Link
              href="/survivor"
              className="flex-1 min-w-[220px] text-center px-6 py-4 border-2 border-white font-bold text-xs sm:text-sm uppercase tracking-[0.2em] transition-transform hover:scale-[1.02] active:scale-[0.99]"
              style={{
                background: "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
                boxShadow: "4px 4px 0 rgba(255,255,255,0.85)",
              }}
            >
              Play Survivor
              <span className="block mt-1 text-[10px] font-normal tracking-widest text-white/80 normal-case">
                100-player arena · last alive wins
              </span>
            </Link>
          )}
          {lunaOn && (
            <Link
              href="/escape-luna"
              className="flex-1 min-w-[220px] text-center px-6 py-4 border-2 border-white font-bold text-xs sm:text-sm uppercase tracking-[0.2em] transition-transform hover:scale-[1.02] active:scale-[0.99]"
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
          {redLightOn && (
            <Link
              href="/red-light"
              className="flex-1 min-w-[220px] text-center px-6 py-4 border-2 font-bold text-xs sm:text-sm uppercase tracking-[0.2em] transition-transform hover:scale-[1.02] active:scale-[0.99] text-[#2a1020]"
              style={{
                background:
                  "linear-gradient(165deg, #F5C4B8 0%, #E8998D 42%, #E91E8C 100%)",
                borderColor: "#22c55e",
                boxShadow:
                  "4px 4px 0 rgba(34,197,94,0.85), inset 0 0 0 1px rgba(255,255,255,0.35)",
              }}
            >
              <span
                className="block text-[9px] tracking-[0.45em] text-[#2a1020]/70 mb-1"
                style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
              >
                무궁화 꽃이 피었습니다
              </span>
              Red Light Green Light
              <span className="block mt-1.5 text-[10px] font-normal tracking-widest text-[#2a1020]/75 normal-case">
                100 players · hold on green · freeze on red
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
