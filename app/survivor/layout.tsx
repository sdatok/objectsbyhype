import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Survivor — OBJECTSBYHYPE",
  description:
    "50-player top-down arena. Last alive wins. Free to play. Open lobbies announced on Instagram.",
};

/**
 * Standalone layout for /survivor — keeps the storefront nav off this route
 * so the game can take the whole viewport.
 */
export default function SurvivorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-black text-white antialiased overscroll-none touch-manipulation">
      {children}
    </div>
  );
}
