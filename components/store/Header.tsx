"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";
import CartDrawer from "./CartDrawer";
import { useState } from "react";
import { UserButton, useAuth } from "@clerk/nextjs";

export default function Header() {
  const { itemCount, toggleCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSignedIn } = useAuth();

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-neutral-200">
        <div className="max-w-[1400px] mx-auto px-4 h-11 flex items-center justify-between">
          <button
            className="md:hidden text-[11px] uppercase tracking-widest font-medium"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>

          <nav className="hidden md:flex items-center gap-7">
            <Link
              href="/shop"
              className="text-black text-[11px] uppercase tracking-widest font-medium hover:text-neutral-500 transition-colors"
            >
              Shop
            </Link>
            <Link
              href="/shop?category=Carpets"
              className="text-black text-[11px] uppercase tracking-widest font-medium hover:text-neutral-500 transition-colors"
            >
              Carpets
            </Link>
            <Link
              href="/shop?category=Lamps"
              className="text-black text-[11px] uppercase tracking-widest font-medium hover:text-neutral-500 transition-colors"
            >
              Lamps
            </Link>
          </nav>

          <Link
            href="/"
            className="text-black absolute left-1/2 -translate-x-1/2 text-[13px] uppercase tracking-[0.2em] font-black"
          >
            OBJECTSBYHYPE
          </Link>

          <div className="flex items-center gap-5 md:gap-6">
            {!isSignedIn ? (
              <Link
                href="/sign-in"
                className="text-[11px] uppercase tracking-widest font-medium hover:text-neutral-500 transition-colors"
              >
                Sign in
              </Link>
            ) : (
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-7 w-7",
                  },
                }}
              />
            )}
            <button
              type="button"
              onClick={toggleCart}
              className="text-[11px] uppercase tracking-widest font-medium hover:text-neutral-500 transition-colors"
            >
              Cart
              {itemCount > 0 && (
                <span className="ml-1 text-[10px]">({itemCount})</span>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-neutral-200 bg-white">
            <nav className="flex flex-col px-4 py-4 gap-4">
              <Link
                href="/shop"
                className="text-[11px] uppercase tracking-widest font-medium"
                onClick={() => setMenuOpen(false)}
              >
                Shop
              </Link>
              <Link
                href="/shop?category=Carpets"
                className="text-[11px] uppercase tracking-widest font-medium"
                onClick={() => setMenuOpen(false)}
              >
                Carpets
              </Link>
              <Link
                href="/shop?category=Lamps"
                className="text-[11px] uppercase tracking-widest font-medium"
                onClick={() => setMenuOpen(false)}
              >
                Lamps
              </Link>
              {!isSignedIn ? (
                <Link
                  href="/sign-in"
                  className="text-[11px] uppercase tracking-widest font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  Sign in
                </Link>
              ) : (
                <div className="pt-2 border-t border-neutral-100 mt-2 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-neutral-400">
                    Account
                  </span>
                  <UserButton
                    appearance={{
                      elements: { avatarBox: "h-7 w-7" },
                    }}
                  />
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      <CartDrawer />
    </>
  );
}
