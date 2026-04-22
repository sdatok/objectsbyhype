"use client";

export default function AdminLogout() {

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
    >
      Sign Out
    </button>
  );
}
