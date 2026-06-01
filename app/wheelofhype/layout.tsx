import { gameFontVariables } from "@/lib/game-fonts";

export const metadata = {
  title: "Wheel of Hype — OBJECTSBYHYPE",
  description:
    "PRO members spin monthly with a code. Extra spins are $50 — open a ticket on Discord.",
};

export default function WheelLayout({
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
