import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 mt-20">
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <p className="text-[11px] uppercase tracking-widest font-bold">
            OBJECTSBYHYPE
          </p>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { label: "Shop", href: "/shop" },
              { label: "Carpets", href: "/shop?category=Carpets" },
              { label: "Lamps", href: "/shop?category=Lamps" },
              { label: "Contact", href: "mailto:hello@objectsbyhype.com" },
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="text-[11px] text-neutral-400">
            © {new Date().getFullYear()} OBJECTSBYHYPE
          </p>
        </div>
      </div>
    </footer>
  );
}
