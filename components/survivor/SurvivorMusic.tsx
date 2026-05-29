"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export const SURVIVOR_MUSIC_SRC = encodeURI(
  "/1 hour of the age of war theme song.mp4"
);
const MUTE_KEY = "obh-survivor-music-muted";
const MUSIC_VOLUME = 0.42;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

interface SurvivorMusicContextValue {
  muted: boolean;
  toggleMute: () => void;
}

const SurvivorMusicContext = createContext<SurvivorMusicContextValue | null>(
  null
);

export function useSurvivorMusic(): SurvivorMusicContextValue {
  const ctx = useContext(SurvivorMusicContext);
  if (!ctx) {
    throw new Error("useSurvivorMusic must be used within SurvivorMusicProvider");
  }
  return ctx;
}

export function SurvivorMusicProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMuted(readMuted());
    setReady(true);
  }, []);

  const ensurePlaying = useCallback(async () => {
    const el = audioRef.current;
    if (!el || muted) return;
    try {
      if (el.paused) await el.play();
    } catch {
      /* blocked until user gesture */
    }
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const el = audioRef.current;
    if (!el) return;
    el.volume = MUSIC_VOLUME;
    el.muted = muted;
    if (!muted) void ensurePlaying();
  }, [muted, ready, ensurePlaying]);

  useEffect(() => {
    const kick = () => {
      if (!readMuted()) void ensurePlaying();
    };
    window.addEventListener("pointerdown", kick, { once: true });
    window.addEventListener("keydown", kick, { once: true });
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
  }, [ensurePlaying]);

  return (
    <SurvivorMusicContext.Provider value={{ muted, toggleMute }}>
      <audio
        ref={audioRef}
        src={SURVIVOR_MUSIC_SRC}
        loop
        preload="auto"
        playsInline
      />
      {children}
    </SurvivorMusicContext.Provider>
  );
}

export function MusicMuteButton({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { muted, toggleMute } = useSurvivorMusic();
  return (
    <button
      type="button"
      onClick={toggleMute}
      aria-pressed={muted}
      aria-label={muted ? "Unmute music" : "Mute music"}
      className={`pointer-events-auto border border-white/25 bg-black/65 backdrop-blur-sm text-white hover:border-fuchsia-400/60 hover:bg-black/80 transition-colors uppercase tracking-[0.2em] ${
        compact ? "px-2 py-1 text-[9px]" : "px-3 py-1.5 text-[10px]"
      } ${className}`}
    >
      {muted ? "Music off" : "Music on"}
    </button>
  );
}
