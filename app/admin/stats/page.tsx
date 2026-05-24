import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOrCreateGameConfig } from "@/lib/game-config";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Tiny helper so a single query failure (e.g. PageView table missing on a
 * stale DB, transient connection error) can't take down the whole stats page.
 * Logs the failure and falls back to a default value.
 */
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[admin/stats] ${label} failed`, err);
    return fallback;
  }
}

interface TopPathRow {
  path: string;
  _count: { _all: number };
}

export default async function AdminStatsPage() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const config = await safe("getOrCreateGameConfig", getOrCreateGameConfig, null);

  const [
    paidCount,
    paidRevenue,
    profileCount,
    pendingCount,
    totalPlays,
    playsLast24h,
    playsThisWindow,
    distinctPlayerEmails,
    topScoreAllTime,
    viewsToday,
    viewsLast7d,
    topPaths,
  ] = await Promise.all([
    safe("paidCount", () => prisma.order.count({ where: { status: "PAID" } }), 0),
    safe(
      "paidRevenue",
      async () => {
        const r = await prisma.order.aggregate({
          where: { status: "PAID" },
          _sum: { total: true },
        });
        return Number(r._sum.total ?? 0);
      },
      0
    ),
    safe("profileCount", () => prisma.customerProfile.count(), 0),
    safe(
      "pendingCount",
      () => prisma.order.count({ where: { status: "PENDING" } }),
      0
    ),
    safe("totalPlays", () => prisma.gameScore.count(), 0),
    safe(
      "playsLast24h",
      () => prisma.gameScore.count({ where: { createdAt: { gte: oneDayAgo } } }),
      0
    ),
    safe(
      "playsThisWindow",
      () =>
        config
          ? prisma.gameScore.count({
              where: { windowStartedAt: config.windowStartedAt },
            })
          : Promise.resolve(0),
      0
    ),
    safe(
      "distinctPlayerEmails",
      () =>
        prisma.gameScore.findMany({
          distinct: ["email"],
          select: { email: true },
        }),
      [] as { email: string }[]
    ),
    safe(
      "topScoreAllTime",
      () =>
        prisma.gameScore.findFirst({
          orderBy: [{ score: "desc" }, { secondsPlayed: "asc" }],
          select: { score: true, displayName: true, email: true },
        }),
      null as null | { score: number; displayName: string | null; email: string }
    ),
    safe(
      "viewsToday",
      () =>
        prisma.pageView.count({
          where: { createdAt: { gte: todayStart } },
        }),
      0
    ),
    safe(
      "viewsLast7d",
      () =>
        prisma.pageView.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
      0
    ),
    safe<TopPathRow[]>(
      "topPaths",
      () =>
        prisma.pageView.groupBy({
          by: ["path"],
          where: { createdAt: { gte: sevenDaysAgo } },
          _count: { _all: true },
          orderBy: { _count: { path: "desc" } },
          take: 5,
        }) as unknown as Promise<TopPathRow[]>,
      []
    ),
  ]);

  const revenue = paidRevenue;
  const uniquePlayers = distinctPlayerEmails.length;

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
        >
          ← Admin home
        </Link>
        <h1 className="text-[18px] font-bold mt-3">Store stats</h1>
        <p className="text-[12px] text-neutral-500 mt-0.5">
          Pulled from the database. Detailed funnel data lives in{" "}
          <a
            href="https://vercel.com/docs/analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Vercel Analytics
          </a>
          .
        </p>
      </div>

      {/* Commerce */}
      <div className="mb-10">
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-3">
          Commerce
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Paid orders" value={paidCount.toString()} />
          <StatCard
            label="Paid revenue (USD)"
            value={`$${revenue.toFixed(2)}`}
          />
          <StatCard
            label="Customer accounts"
            value={profileCount.toString()}
            hint="Profiles created after sign-in"
          />
          <StatCard
            label="Pending checkouts"
            value={pendingCount.toString()}
            hint="Abandoned or in progress"
          />
        </div>
      </div>

      {/* Game */}
      <div className="mb-10">
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-3">
          Giveaway game
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total plays"
            value={totalPlays.toString()}
            hint="All-time submitted scores"
          />
          <StatCard
            label="Unique players"
            value={uniquePlayers.toString()}
            hint="Distinct emails"
          />
          <StatCard
            label="Plays this window"
            value={playsThisWindow.toString()}
            hint={
              config
                ? `Started ${config.windowStartedAt.toLocaleString()}`
                : "No active window"
            }
          />
          <StatCard
            label="Plays last 24h"
            value={playsLast24h.toString()}
          />
          <StatCard
            label="All-time top score"
            value={
              topScoreAllTime
                ? topScoreAllTime.score.toString().padStart(4, "0")
                : "—"
            }
            hint={
              topScoreAllTime
                ? topScoreAllTime.displayName ||
                  topScoreAllTime.email.split("@")[0]
                : "No scores yet"
            }
          />
        </div>
      </div>

      {/* Traffic */}
      <div>
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-3">
          Traffic
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard
            label="Page views today"
            value={viewsToday.toString()}
            hint="Storefront only"
          />
          <StatCard
            label="Page views last 7 days"
            value={viewsLast7d.toString()}
          />
        </div>
        <div className="bg-white border border-neutral-200 rounded p-5">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
            Top paths · last 7 days
          </p>
          {topPaths.length === 0 ? (
            <p className="text-[12px] text-neutral-400 italic">
              No traffic recorded yet. Storefront beacons will populate this
              over time.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {topPaths.map((row, i) => (
                <li
                  key={row.path}
                  className="flex items-center justify-between text-[12px] border-b border-neutral-100 pb-1.5"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] uppercase tracking-widest text-neutral-300 w-5 shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate font-mono">{row.path}</span>
                  </span>
                  <span className="font-mono tabular-nums shrink-0 ml-3">
                    {row._count._all}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded p-5">
      <p className="text-[10px] uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p className="text-[24px] font-bold mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-neutral-400 mt-1">{hint}</p>}
    </div>
  );
}
