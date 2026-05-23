"use client";

import { useState } from "react";

const FULFILLMENT_STATUSES = [
  "PAID",
  "SUPPLIER_ORDERED",
  "SUPPLIER_SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

interface OrderRowActionsProps {
  orderId: string;
  currentStatus: FulfillmentStatus;
  supplierOrderReference: string;
  shippingCarrier: string;
  trackingNumber: string;
  fulfillmentNotes: string;
  /** When the order has no notes yet, the textarea pre-fills with a template
   *  listing these URLs so the admin only has to type the supplier order #. */
  etsyUrlsForNotes?: string[];
}

function buildNotesTemplate(urls: string[]): string {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const lines = unique.map((u) => `Etsy: ${u}`);
  lines.push("Etsy order #: ");
  lines.push("Tracking pending.");
  return lines.join("\n");
}

export default function OrderRowActions({
  orderId,
  currentStatus,
  supplierOrderReference,
  shippingCarrier,
  trackingNumber,
  fulfillmentNotes,
  etsyUrlsForNotes,
}: OrderRowActionsProps) {
  const [status, setStatus] = useState<FulfillmentStatus>(currentStatus);
  const [supplierRef, setSupplierRef] = useState(supplierOrderReference);
  const [carrier, setCarrier] = useState(shippingCarrier);
  const [tracking, setTracking] = useState(trackingNumber);
  const [notes, setNotes] = useState(
    fulfillmentNotes ||
      (etsyUrlsForNotes && etsyUrlsForNotes.length > 0
        ? buildNotesTemplate(etsyUrlsForNotes)
        : "")
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");

    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        supplierOrderReference: supplierRef,
        shippingCarrier: carrier,
        trackingNumber: tracking,
        fulfillmentNotes: notes,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setMessage(data?.error ?? "Save failed");
      return;
    }

    setMessage("Saved");
  }

  return (
    <div className="space-y-2 md:min-w-[280px]">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as FulfillmentStatus)}
        className="w-full border border-neutral-300 px-2 py-2 min-h-[40px] text-base md:text-[11px] uppercase tracking-widest bg-white"
      >
        {FULFILLMENT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <input
        value={supplierRef}
        onChange={(e) => setSupplierRef(e.target.value)}
        placeholder="Supplier / Etsy order #"
        className="w-full border border-neutral-300 px-2 py-2 min-h-[40px] text-base md:text-[11px]"
      />
      <input
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
        placeholder="Carrier"
        className="w-full border border-neutral-300 px-2 py-2 min-h-[40px] text-base md:text-[11px]"
      />
      <input
        value={tracking}
        onChange={(e) => setTracking(e.target.value)}
        placeholder="Tracking number"
        className="w-full border border-neutral-300 px-2 py-2 min-h-[40px] text-base md:text-[11px]"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Fulfillment notes"
        rows={3}
        className="w-full border border-neutral-300 px-2 py-2 text-base md:text-[11px] resize-y font-mono"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full border border-black bg-black text-white px-2 py-2.5 min-h-[44px] text-[11px] uppercase tracking-widest disabled:bg-neutral-400 disabled:border-neutral-400"
      >
        {saving ? "Saving..." : "Update Order"}
      </button>
      {message && <p className="text-[10px] text-neutral-500">{message}</p>}
    </div>
  );
}
