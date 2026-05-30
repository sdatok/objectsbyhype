import { gameFontVariables } from "@/lib/game-fonts";

export const metadata = {
  title: "Escape Luna — OBJECTSBYHYPE",
  description: "Run from Luna the dog. Last one standing wins.",
};

export default function EscapeLunaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${gameFontVariables} min-h-[100dvh] bg-black text-white`}>
      {children}
    </div>
  );
}
