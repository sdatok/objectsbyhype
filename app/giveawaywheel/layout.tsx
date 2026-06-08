import { gameFontVariables } from "@/lib/game-fonts";

export default function GiveawayWheelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${gameFontVariables} min-h-[100dvh] bg-black text-white overflow-x-hidden`}
    >
      {children}
    </div>
  );
}
