import type { Viewport } from "next";
import { gameFontVariables } from "@/lib/game-fonts";

export const metadata = {
  title: "Blackjack — OBJECTSBYHYPE",
  description:
    "One hand every 3 minutes. Top 10 players win a spin on the giveaway wheel.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function BlackjackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${gameFontVariables} fixed inset-0 flex flex-col overflow-hidden bg-[#0a2818] text-white antialiased overscroll-none touch-manipulation`}
    >
      {children}
    </div>
  );
}
