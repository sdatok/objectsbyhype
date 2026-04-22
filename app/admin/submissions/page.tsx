import { prisma } from "@/lib/db";
import SubmissionsTable from "@/components/admin/SubmissionsTable";

export const dynamic = "force-dynamic";

async function getSubmissions() {
  try {
    return await prisma.submission.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export default async function AdminSubmissionsPage() {
  const submissions = await getSubmissions();

  const counts = {
    total: submissions.length,
    pending: submissions.filter((s) => s.status === "PENDING").length,
    reviewing: submissions.filter((s) => s.status === "REVIEWING").length,
    accepted: submissions.filter(
      (s) => s.status === "ACCEPTED_BUY" || s.status === "ACCEPTED_CONSIGN"
    ).length,
    declined: submissions.filter((s) => s.status === "DECLINED").length,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[18px] font-bold">Sell Submissions</h1>
        <p className="text-[12px] text-neutral-500 mt-0.5">
          {counts.total} total · {counts.pending} pending · {counts.reviewing}{" "}
          reviewing · {counts.accepted} accepted · {counts.declined} declined
        </p>
      </div>
      <SubmissionsTable submissions={submissions.map((s) => ({
        ...s,
        askingPrice: s.askingPrice ? Number(s.askingPrice) : null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }))} />
    </div>
  );
}
