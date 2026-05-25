import { Press_Start_2P, VT323 } from "next/font/google";

/** Pixel fonts for the giveaway mini-game only — do not apply on <html>. */
const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
});

export const gameFontVariables = `${pressStart.variable} ${vt323.variable}`;
