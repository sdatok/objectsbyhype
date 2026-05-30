import type { Viewport } from "next";
import { gameFontVariables } from "@/lib/game-fonts";

export const metadata = {
  title: "Escape Luna — OBJECTSBYHYPE",
  description: "Run from Luna the dog. Last one standing wins.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function EscapeLunaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${gameFontVariables} fixed inset-0 flex flex-col overflow-hidden bg-black text-white antialiased overscroll-none touch-manipulation`}
    >
      {children}
    </div>
  );
}
