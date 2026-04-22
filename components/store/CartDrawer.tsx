"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

export default function CartDrawer() {
  const { isSignedIn } = useAuth();
  const { isOpen, closeCart, items, removeItem, updateQty, subtotal } = useCart();
  const [promoCode, setPromoCode] = useState("");
  const [useWelcome, setUseWelcome] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setError(null);
    if (items.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            size: i.size,
            quantity: i.quantity,
          })),
          promoCode: promoCode.trim() || undefined,
          useWelcomeDiscount: isSignedIn ? useWelcome : false,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Checkout failed");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No checkout URL returned");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={closeCart}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full max-w-[380px] bg-white z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200">
          <h2 className="text-[11px] uppercase tracking-widest font-bold">
            Your Cart
          </h2>
          <button
            onClick={closeCart}
            className="text-[11px] uppercase tracking-widest hover:text-neutral-500 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[12px] text-neutral-400 uppercase tracking-widest">
                Your cart is empty
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {items.map((item) => (
                <li
                  key={`${item.productId}-${item.size}`}
                  className="flex gap-4 px-6 py-5"
                >
                  <div className="relative w-20 h-24 bg-neutral-100 flex-shrink-0">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-200" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-neutral-400 uppercase tracking-widest truncate">
                      {item.brand}
                    </p>
                    <p className="text-[12px] font-medium mt-0.5 leading-tight">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Size: {item.size}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateQty(
                              item.productId,
                              item.size,
                              item.quantity - 1
                            )
                          }
                          className="w-5 h-5 flex items-center justify-center border border-neutral-300 text-[12px] hover:border-black transition-colors"
                        >
                          −
                        </button>
                        <span className="text-[12px] w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQty(
                              item.productId,
                              item.size,
                              item.quantity + 1
                            )
                          }
                          className="w-5 h-5 flex items-center justify-center border border-neutral-300 text-[12px] hover:border-black transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[12px] font-medium">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId, item.size)}
                      className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-black transition-colors mt-2"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-neutral-200 px-6 py-6 space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                Promo code
              </label>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setUseWelcome(false);
                }}
                disabled={loading}
                placeholder="Optional"
                className="w-full border border-neutral-300 px-3 py-2 text-[12px] focus:outline-none focus:border-black uppercase"
              />
            </div>

            {isSignedIn ? (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useWelcome}
                  onChange={(e) => {
                    setUseWelcome(e.target.checked);
                    if (e.target.checked) setPromoCode("");
                  }}
                  disabled={loading || Boolean(promoCode.trim())}
                  className="mt-1 h-3.5 w-3.5 border-neutral-300"
                />
                <span className="text-[11px] text-neutral-600 leading-snug">
                  Apply one-time welcome discount (10% off). Sign up free if you
                  don&apos;t have an account.
                </span>
              </label>
            ) : (
              <p className="text-[10px] text-neutral-500 leading-relaxed">
                <Link
                  href="/sign-up"
                  className="underline underline-offset-2"
                  onClick={closeCart}
                >
                  Create an account
                </Link>{" "}
                for a one-time 10% welcome discount on your first order.
              </p>
            )}

            {error && (
              <p className="text-[11px] text-red-600 leading-snug">{error}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] uppercase tracking-widest text-neutral-500">
                Subtotal
              </span>
              <span className="text-[14px] font-medium">
                ${subtotal.toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">
              Discounts (if any) apply at checkout. Taxes and shipping may be
              added in Stripe.
            </p>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-black text-white text-[11px] uppercase tracking-widest py-3.5 hover:bg-neutral-800 transition-colors disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              {loading ? "Redirecting…" : "Checkout"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
