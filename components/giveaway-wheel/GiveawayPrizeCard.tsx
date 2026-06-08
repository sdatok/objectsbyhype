import {
  GIVEAWAY_TIER_STYLES,
  giveawayPrizeIconType,
  type GiveawayWheelTier,
} from "@/lib/giveaway-wheel-prize-icons";
import PrizeIcon from "@/components/wheel/PrizeIcon";

export default function GiveawayPrizeCard({
  label,
  tier,
  compact = false,
  glowing = false,
}: {
  label: string;
  tier: GiveawayWheelTier;
  compact?: boolean;
  glowing?: boolean;
}) {
  const style = GIVEAWAY_TIER_STYLES[tier];
  const iconType = giveawayPrizeIconType(label);

  return (
    <div
      className={`flex-shrink-0 flex items-center gap-3 border-2 bg-black/80 text-left transition-shadow ${
        compact ? "px-3 py-2 w-[220px]" : "px-4 py-3 w-[260px]"
      } ${glowing ? "animate-pulse" : ""}`}
      style={{
        borderColor: style.color,
        boxShadow: glowing
          ? `0 0 30px ${style.color}66, inset 0 0 20px ${style.color}22`
          : `0 0 12px ${style.color}33, inset 0 0 12px ${style.color}11`,
      }}
    >
      <PrizeIcon type={iconType} size={compact ? 32 : 40} />
      <div className="min-w-0 flex-1">
        <p
          className="font-pixel text-[7px] tracking-[0.2em]"
          style={{ color: style.color }}
        >
          {style.headline}
        </p>
        <p
          className={`font-pixel text-white leading-snug mt-1 ${
            compact ? "text-[8px]" : "text-[9px] sm:text-[10px]"
          }`}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
