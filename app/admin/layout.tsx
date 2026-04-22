import Link from "next/link";
import AdminLogout from "@/components/admin/AdminLogout";

export const metadata = {
  title: "Admin - OBJECTSBYHYPE",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Admin nav */}
      <header className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="text-[11px] uppercase tracking-widest font-bold"
            >
              OBJECTSBYHYPE Admin
            </Link>
            <nav className="flex items-center gap-5">
              <Link
                href="/admin"
                className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
              >
                Products
              </Link>
              <Link
                href="/admin/submissions"
                className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
              >
                Supplier Queue
              </Link>
              <Link
                href="/admin/wtf"
                className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
              >
                Gallery
              </Link>
              <Link
                href="/admin/orders"
                className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
              >
                Orders
              </Link>
              <Link
                href="/admin/promos"
                className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
              >
                Promos
              </Link>
              <Link
                href="/admin/stats"
                className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
              >
                Stats
              </Link>
              <Link
                href="/"
                target="_blank"
                className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
              >
                View Store ↗
              </Link>
            </nav>
          </div>
          <AdminLogout />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
