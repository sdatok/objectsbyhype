"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const WORDS = ["Buy", "Sell", "Trade"];
const TYPE_SPEED   = 110;
const DELETE_SPEED = 70;
const PAUSE_AFTER  = 1400;

function useTypewriter() {
  const [display, setDisplay] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pausing" | "deleting">("typing");

  useEffect(() => {
    const word = WORDS[wordIdx];

    if (phase === "typing") {
      if (display.length < word.length) {
        const t = setTimeout(() => setDisplay(word.slice(0, display.length + 1)), TYPE_SPEED);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("deleting"), PAUSE_AFTER);
      return () => clearTimeout(t);
    }

    if (phase === "deleting") {
      if (display.length > 0) {
        const t = setTimeout(() => setDisplay((d) => d.slice(0, -1)), DELETE_SPEED);
        return () => clearTimeout(t);
      }
      setWordIdx((i) => (i + 1) % WORDS.length);
      setPhase("typing");
    }
  }, [display, phase, wordIdx]);

  return display;
}

export default function HeroSection() {
  const typed = useTypewriter();

  return (
    <section className="border-b border-neutral-200">
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      <div className="max-w-[1400px] mx-auto px-4 py-12 md:py-20 flex flex-col items-center text-center">
        <h1 className="text-[42px] md:text-[72px] font-black uppercase tracking-[-0.03em] leading-none mb-6">
          OBJECTSBYHYPE
        </h1>

        <p className="text-[12px] md:text-[13px] text-neutral-500 uppercase tracking-[0.3em] mb-10 h-5 flex items-center">
          <span>{typed}</span>
          <span
            className="inline-block w-[1.5px] h-[1em] bg-neutral-500 ml-[3px]"
            style={{ animation: "blink 0.85s step-end infinite" }}
          />
        </p>

        <Link
          href="/shop"
          className="btn-invert inline-block border border-black px-10 py-3 text-[11px] uppercase tracking-widest font-medium"
        >
          Shop Now
        </Link>
      </div>
    </section>
  );
}
