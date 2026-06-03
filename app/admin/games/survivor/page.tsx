import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  getOrCreateSurvivorConfig,
  getCurrentMatch,
} from "@/lib/survivor-config";
import SurvivorConfigForm from "@/components/admin/SurvivorConfigForm";
import SurvivorMatchControls from "@/components/admin/SurvivorMatchControls";

export const dynamic = "force-dynamic";

export default async function AdminSurvivorPage() {
  const config = await getOrCreateSurvivorConfig();
  const current = await getCurrentMatch(config);

  let serverHealth: {
    ok: boolean;
    build?: string;
    gitSha?: string;
    error?: string;
  } | null = null;
  const gameServerUrl = process.env.SURVIVOR_GAME_SERVER_URL;
  if (gameServerUrl) {
    try {
      const res = await fetch(`${gameServerUrl.replace(/\/$/, "")}/healthz`, {
        cache: "no-store",
        next: { revalidate: 0 },
      });
      const body = (await res.json().catch(() => ({}))) as {
        build?: string;
        gitSha?: string;
        features?: string[];
      };
      const hasSurvivor = body.features?.includes("survivor") ?? false;
      serverHealth = {
        ok: res.ok && hasSurvivor,
        build: body.build,
        gitSha: body.gitSha,
      };
    } catch (err) {
      serverHealth = {
        ok: false,
        error: err instanceof Error ? err.message : "unreachable",
      };
    }
  }

  const recent = await prisma.survivorMatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      participants: {
        orderBy: [{ placement: "asc" }, { joinedAt: "asc" }],
      },
    },
  });

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
        >
          ← Admin home
        </Link>
        <h1 className="text-[18px] font-bold mt-3">Survivor (50-player shooter)</h1>
        <p className="text-[12px] text-neutral-500 mt-0.5">
          Lobby + match controls for <code>/survivor</code>. The actual game
          runs on Railway (Colyseus); this page just talks to it via signed
          admin commands.
        </p>
        {serverHealth && (
          <div
            className={`mt-3 text-[11px] border rounded px-3 py-2 ${
              serverHealth.ok
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-amber-300 bg-amber-50 text-amber-950"
            }`}
          >
            <strong>Game server (Railway):</strong>{" "}
            {serverHealth.ok ? (
              <>
                survivor live · build{" "}
                <code>{serverHealth.build ?? "?"}</code> · git{" "}
                <code>{serverHealth.gitSha ?? "?"}</code>
              </>
            ) : serverHealth.error ? (
              <>unreachable — {serverHealth.error}. Check Railway root dir is{" "}
                <code>game-server</code> and redeploy.</>
            ) : (
              <>
                outdated build (<code>{serverHealth.build ?? "unknown"}</code>
                ). Railway must deploy latest <code>main</code> with root{" "}
                <code>game-server</code> (expect <code>survivor</code> in
                features), then open a <strong>new</strong> match.
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
        <SurvivorConfigForm
          initialConfig={{
            enabled: config.enabled,
            prizeTitle: config.prizeTitle,
            prizeDescription: config.prizeDescription ?? "",
            matchSeconds: config.matchSeconds,
          }}
        />

        <SurvivorMatchControls
          initial={{
            hasActive: !!current && current.status !== "ENDED",
            currentMatchId: current?.id ?? null,
            currentStatus: current?.status ?? null,
            defaultMatchSeconds: config.matchSeconds,
          }}
        />
      </div>

      <section>
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-4">
          Recent matches
        </h2>
        {recent.length === 0 ? (
          <p className="text-[12px] text-neutral-400 italic">
            No matches yet. Open one with the controls above.
          </p>
        ) : (
          <div className="space-y-4">
            {recent.map((m) => (
              <div
                key={m.id}
                className="bg-white border border-neutral-200 rounded p-4"
              >
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <p className="text-[11px] uppercase tracking-widest font-bold">
                    {m.status}{" "}
                    <span className="ml-2 text-neutral-400 font-normal">
                      · {m.participants.length} players
                    </span>
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    {m.startedAt
                      ? `Started ${m.startedAt.toLocaleString()}`
                      : `Opened ${m.createdAt.toLocaleString()}`}
                    {m.endedAt && ` · Ended ${m.endedAt.toLocaleString()}`}
                  </p>
                </div>
                <p className="text-[12px] text-neutral-600 mb-3">
                  Prize: <strong>{m.prizeTitle}</strong>
                  {m.winnerEmail && (
                    <>
                      {" "}
                      · Winner:{" "}
                      <span className="text-fuchsia-700 font-bold">
                        {m.winnerEmail}
                      </span>
                    </>
                  )}
                </p>
                {m.participants.length > 0 && (
                  <ol className="space-y-1">
                    {m.participants.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between text-[12px] border-b border-neutral-100 pb-1.5"
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] uppercase tracking-widest text-neutral-300 w-7 shrink-0">
                            {p.placement ?? "—"}
                          </span>
                          <span className="truncate">
                            <span className="font-medium">{p.displayName}</span>{" "}
                            <span className="text-neutral-500">{p.email}</span>
                          </span>
                        </span>
                        <span className="font-mono tabular-nums text-right text-[11px] shrink-0 ml-3">
                          {p.kills} kills · {p.survivedSeconds}s
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
