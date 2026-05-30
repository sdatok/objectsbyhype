"use client";

import SlimeAvatar from "@/components/survivor/SlimeAvatar";
import type { SlimeColor } from "@/lib/survivor-slime";

const MONO_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

export interface LunaEndSnapshot {
  selfPlacement: number;
  selfDisplayName: string;
  selfSlimeColor: SlimeColor;
  selfSlimeFace: number;
  selfSlimeAccessories: number;
  selfNameColor: string;
  selfAlive: boolean;
  selfPuppyMode: boolean;
  prizeTitle: string;
  survivedSeconds: number;
  playerCount: number;
}

export default function LunaMatchEndOverlay({
  snapshot,
  onLeave,
}: {
  snapshot: LunaEndSnapshot;
  onLeave: () => void;
}) {
  const won = snapshot.selfPlacement === 1;
  const podium = snapshot.selfPlacement >= 2 && snapshot.selfPlacement <= 3;
  const placement = snapshot.selfPlacement;

  const headline = won
    ? "LAST ONE STANDING"
    : podium
      ? "SO CLOSE"
      : placement > 0
        ? "CAUGHT"
        : "MATCH COMPLETE";

  const subline = won
    ? "You outran Luna and the puppy swarm."
    : podium
      ? `#${placement} — almost escaped the dog.`
      : placement > 0
        ? `#${placement} of ${Math.max(snapshot.playerCount, placement)} — infected or caught.`
        : "Thanks for watching the chaos.";

  const tagline = won
    ? "The island is yours. For now."
    : snapshot.selfPuppyMode
      ? "You joined the swarm."
      : snapshot.survivedSeconds > 0
        ? `${snapshot.survivedSeconds}s on the run — run it back.`
        : "Next drop, different story.";

  return (
    <div className="absolute inset-0 bg-black/88 backdrop-blur-md flex items-center justify-center p-6 pointer-events-auto overflow-hidden z-30">
      {won && <ConfettiBurst />}
      <div className="relative max-w-lg w-full text-center space-y-5">
        <div
          className={`inline-block border-2 px-4 py-1.5 ${
            won
              ? "border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.45)]"
              : podium
                ? "border-amber-500/70"
                : "border-rose-400/70"
          }`}
        >
          <p
            className={`text-[10px] uppercase tracking-[0.4em] font-bold ${
              won ? "text-amber-300" : podium ? "text-amber-200" : "text-rose-300"
            }`}
            style={{ fontFamily: MONO_FONT }}
          >
            {won ? "Escape Luna" : "Match over"}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <SlimeAvatar
            color={snapshot.selfSlimeColor}
            face={snapshot.selfSlimeFace}
            accessories={snapshot.selfSlimeAccessories}
            size={won ? 128 : 96}
          />
          {snapshot.selfDisplayName && (
            <p
              className="text-lg font-bold tracking-[0.25em] uppercase"
              style={{
                color: snapshot.selfNameColor,
                fontFamily: MONO_FONT,
              }}
            >
              {snapshot.selfDisplayName}
            </p>
          )}
        </div>

        <h2
          className={`text-4xl sm:text-5xl font-black tracking-tight uppercase ${
            won
              ? "bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent"
              : podium
                ? "text-amber-300"
                : "text-white"
          }`}
        >
          {headline}
        </h2>

        <p className="text-base text-neutral-200">{subline}</p>
        <p
          className="text-sm text-amber-300/90 italic"
          style={{ fontFamily: MONO_FONT }}
        >
          {tagline}
        </p>

        <div className="flex justify-center gap-6 pt-1">
          {placement > 0 && (
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.3em] text-neutral-500">
                Place
              </p>
              <p className="text-2xl font-bold text-white">#{placement}</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-[0.3em] text-neutral-500">
              Survived
            </p>
            <p className="text-2xl font-bold text-emerald-400">
              {snapshot.survivedSeconds}s
            </p>
          </div>
        </div>

        {snapshot.prizeTitle && (
          <p className="text-xs text-neutral-400">
            Prize: <span className="text-amber-200">{snapshot.prizeTitle}</span>
          </p>
        )}

        {won && (
          <p className="text-xs text-neutral-400 pt-1">
            Prize details coming to your inbox. Go flex.
          </p>
        )}

        <button
          type="button"
          onClick={onLeave}
          className={`text-xs tracking-widest uppercase px-6 py-3 border transition-colors ${
            won
              ? "border-amber-400 text-amber-200 hover:bg-amber-500 hover:text-black"
              : "border-white text-white hover:bg-white hover:text-black"
          }`}
        >
          Back to lobby
        </button>
      </div>
    </div>
  );
}

function ConfettiBurst() {
  const colors = ["#fbbf24", "#f59e0b", "#fcd34d", "#fde68a", "#fb923c"];
  const pieces = Array.from({ length: 48 }, (_, i) => ({
    id: i,
    left: `${(i * 17 + 7) % 100}%`,
    delay: `${(i % 8) * 0.25}s`,
    duration: `${2.5 + (i % 5) * 0.4}s`,
    color: colors[i % colors.length],
    size: 6 + (i % 4),
    rotate: (i * 47) % 360,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <style>{`
        @keyframes luna-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.35; }
        }
        .luna-confetti-piece {
          animation: luna-confetti-fall linear forwards;
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="luna-confetti-piece absolute top-0"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.size * 1.4,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
