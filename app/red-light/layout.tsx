import type { Viewport } from "next";
import { gameFontVariables } from "@/lib/game-fonts";

export const metadata = {
  title: "Red Light Green Light — OBJECTSBYHYPE",
  description: "Squid Game–style red light green light. Hold to move — don't get caught.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RedLightLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${gameFontVariables} fixed inset-0 flex flex-col overflow-hidden bg-[#1a0a12] text-white antialiased overscroll-none touch-manipulation`}
    >
      {children}
    </div>
  );
}
