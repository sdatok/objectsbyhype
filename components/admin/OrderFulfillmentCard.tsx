"use client";

import { useState } from "react";
import type { ShippingAddress } from "@/types";

export interface FulfillmentLineItem {
  id: string;
  name: string;
  brand: string;
  size: string;
  quantity: number;
  unitPrice: number;
  variantLabel: string | null;
  /** Final Etsy URL to re-order from (variant override or product fallback). null = not drop-shipped */
  etsyUrl: string | null;
  /** Final note to paste at Etsy checkout (variant override or product fallback) */
  etsyNote: string | null;
  /** Etsy shop name for context */
  etsyShop: string | null;
}

interface OrderFulfillmentCardProps {
  orderId: string;
  email: string | null;
  total: number;
  status: string;
  createdAt: string;
  promoCode: string | null;
  welcomeDiscountApplied: boolean;
  shippingAddress: ShippingAddress | null;
  lineItems: FulfillmentLineItem[];
}

export function formatAddress(addr: ShippingAddress): string {
  const parts: string[] = [];
  if (addr.name) parts.push(addr.name);
  if (addr.line1) parts.push(addr.line1);
  if (addr.line2) parts.push(addr.line2);
  const cityLine = [addr.city, addr.state, addr.postalCode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) parts.push(cityLine);
  if (addr.country) parts.push(addr.country);
  if (addr.phone) parts.push(addr.phone);
  return parts.join("\n");
}

/**
 * Best-effort clipboard write. Modern browsers support navigator.clipboard;
 * older mobile Safari needs the textarea + execCommand fallback so the admin
 * can still copy things from their phone.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface CopyButtonProps {
  text: string;
  label: string;
  className?: string;
}

export function CopyButton({ text, label, className }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  async function handle() {
    const ok = await copyText(text);
    setState(ok ? "ok" : "err");
    setTimeout(() => setState("idle"), 1600);
  }
  const display =
    state === "ok" ? "Copied" : state === "err" ? "Copy failed" : label;
  return (
    <button
      type="button"
      onClick={handle}
      className={
        className ??
        "inline-flex items-center justify-center min-h-[40px] px-3 text-[11px] uppercase tracking-widest border border-neutral-300 bg-white hover:border-black transition-colors"
      }
    >
      {display}
    </button>
  );
}

export default function OrderFulfillmentCard({
  orderId,
  email,
  total,
  status,
  createdAt,
  promoCode,
  welcomeDiscountApplied,
  shippingAddress,
  lineItems,
}: OrderFulfillmentCardProps) {
  const hasDropship = lineItems.some((li) => li.etsyUrl);
  const formattedAddress = shippingAddress
    ? formatAddress(shippingAddress)
    : "";

  return (
    <div className="bg-white border border-neutral-200 rounded p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-neutral-400">
            {new Date(createdAt).toLocaleString()}
          </p>
          <p className="text-[14px] font-medium mt-0.5 truncate">
            ${total.toFixed(2)} · {email ?? "no email"}
          </p>
          {(promoCode || welcomeDiscountApplied) && (
            <p className="text-[10px] text-neutral-500 mt-0.5">
              {promoCode ?? null}
              {welcomeDiscountApplied ? " welcome" : ""}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 inline-flex items-center text-[10px] uppercase tracking-widest px-2 py-1 border rounded ${
            status === "PAID"
              ? "border-yellow-200 bg-yellow-50 text-yellow-800"
              : status === "SUPPLIER_ORDERED"
              ? "border-blue-200 bg-blue-50 text-blue-800"
              : status === "SUPPLIER_SHIPPED"
              ? "border-purple-200 bg-purple-50 text-purple-800"
              : status === "DELIVERED"
              ? "border-green-200 bg-green-50 text-green-800"
              : status === "CANCELLED"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-neutral-200 bg-neutral-50 text-neutral-600"
          }`}
        >
          {status.replaceAll("_", " ")}
        </span>
      </div>

      {/* Ship to */}
      <div className="border border-neutral-100 rounded p-3 bg-neutral-50">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
            Ship to buyer
          </p>
          {shippingAddress && (
            <CopyButton text={formattedAddress} label="Copy address" />
          )}
        </div>
        {shippingAddress ? (
          <pre className="text-[12px] font-sans whitespace-pre-wrap break-words leading-snug">
            {formattedAddress}
          </pre>
        ) : (
          <p className="text-[11px] text-neutral-400 italic">
            No shipping address captured (order may pre-date the shipping
            collection rollout, or the buyer used Apple Pay without one).
          </p>
        )}
      </div>

      {/* Line items + per-item Etsy actions */}
      <div className="space-y-3">
        {lineItems.map((li) => (
          <div
            key={li.id}
            className="border border-neutral-100 rounded p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-snug">
                  {li.name}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {li.brand}
                  {li.variantLabel ? ` · ${li.variantLabel}` : ""} · {li.size}{" "}
                  ×{li.quantity}
                </p>
                {li.etsyShop && (
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    From Etsy shop: {li.etsyShop}
                  </p>
                )}
              </div>
              <p className="text-[12px] font-medium shrink-0">
                ${(li.unitPrice * li.quantity).toFixed(2)}
              </p>
            </div>

            {li.etsyUrl ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={li.etsyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center min-h-[40px] px-3 text-[11px] uppercase tracking-widest border border-black bg-black text-white hover:bg-neutral-800 transition-colors"
                >
                  Order on Etsy ↗
                </a>
                {li.etsyNote && (
                  <CopyButton text={li.etsyNote} label="Copy note" />
                )}
              </div>
            ) : (
              <p className="text-[11px] text-neutral-400 italic">
                No Etsy link configured for this product. Add one on the
                product&apos;s admin page so this becomes one tap.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Reminders — only when drop-shipping */}
      {hasDropship && (
        <ul className="text-[11px] text-neutral-500 leading-relaxed list-disc pl-4 space-y-0.5">
          <li>Ship to the buyer above — not yourself.</li>
          <li>Untick &ldquo;send as gift&rdquo; / gift message on Etsy.</li>
          {lineItems.some((li) => li.etsyUrl && li.etsyNote) && (
            <li>Paste the personalization note in the listing&apos;s notes field.</li>
          )}
        </ul>
      )}

      {/* Order id for reference */}
      <p className="text-[10px] text-neutral-300 font-mono break-all">
        {orderId}
      </p>
    </div>
  );
}
