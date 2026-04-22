"use client";

import Link from "next/link";
import { useState } from "react";

interface FaqItem {
  id: string;
  question: string;
  /** Intro / main copy */
  paragraphs: string[];
  /** Optional list (e.g. regions & processing times) */
  bullets?: string[];
  /** Copy shown after bullets */
  closingParagraphs?: string[];
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "authenticity",
    question: "How do you verify authenticity?",
    paragraphs: [
      "Every piece we sell is reviewed for authenticity before it is listed. We work with established suppliers and consignors, inspect construction, materials, labels, and provenance where applicable, and only list items we are confident are genuine.",
      "If you receive an item that you believe is not authentic, contact us within seven days of delivery with clear photos and details. After review, if we confirm the item is inauthentic, we will issue a full refund of the purchase price, with no exceptions.",
    ],
  },
  {
    id: "shipping",
    question: "Where do you ship, and how long does processing take?",
    paragraphs: [
      "OBJECTSBYHYPE currently operates with a direct supplier fulfillment model. We collect your order details at checkout, place your order with our manufacturing partner, and your piece ships directly to you.",
      "As inventory transitions to our U.S. warehouse, we will fulfill directly in-house. Available regions and rates are shown at checkout based on your address.",
    ],
    bullets: [
      "Supplier-fulfilled orders: approximately 3–7 business days processing",
      "U.S. warehouse orders (future): approximately 1–2 business days processing",
      "International delivery windows vary by destination and customs",
    ],
    closingParagraphs: [
      "Transit and delivery times depend on the carrier and destination and are estimated at checkout where possible. Rural or remote areas may take longer.",
      "International orders may be subject to customs duties, taxes, or import fees assessed by your country. Those charges are the responsibility of the buyer and are not included in our product or shipping prices.",
    ],
  },
  {
    id: "returns",
    question: "What is your return policy?",
    paragraphs: [
      "We want you to be happy with your purchase. If your item is not as described or you change your mind within our return window, you may be eligible for a return or exchange, subject to the conditions below.",
      "Returned items must be unworn, with original tags attached where applicable, and in the same condition as received. We reserve the right to refuse returns that do not meet these criteria.",
      "Return shipping is paid by the buyer unless we shipped the wrong item or the product was misdescribed. Once we receive and inspect your return, approved refunds are processed to the original payment method.",
    ],
  },
  {
    id: "payments",
    question: "Which payment methods do you accept?",
    paragraphs: [
      "We accept major credit and debit cards (Visa, Mastercard, American Express) and other secure payment options presented at checkout, including digital wallets where enabled.",
      "All transactions are processed through encrypted, PCI-compliant providers. We do not store your full card number on our servers.",
    ],
  },
  {
    id: "orders",
    question: "How will I know when my order ships?",
    paragraphs: [
      "You will receive an order confirmation email when your purchase is placed. A separate email with tracking information is sent when your order ships so you can follow delivery with the carrier.",
      "If you do not see these messages, check your spam folder or contact us with your order details so we can resend them.",
    ],
  },
  {
    id: "contact",
    question: "How can I reach you?",
    paragraphs: [
      "For questions about an order, product details, custom sourcing, or anything else, reply to your order confirmation email or write to us directly. We aim to respond within one to two business days.",
    ],
  },
];

const CONTACT_EMAIL = "hello@objectsbyhype.com";

function FaqAnswer({ item }: { item: FaqItem }) {
  return (
    <>
      {item.paragraphs.map((p, i) => (
        <p key={`p-${i}`} className="mb-3 last:mb-0">
          {p}
        </p>
      ))}
      {item.id === "contact" && (
        <p className="mb-3">
          <Link
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline decoration-neutral-300 underline-offset-4 hover:decoration-black hover:text-black transition-colors"
          >
            {CONTACT_EMAIL}
          </Link>
        </p>
      )}
      {item.bullets && item.bullets.length > 0 && (
        <ul className="my-3 list-none space-y-2 border-l border-neutral-200 pl-4">
          {item.bullets.map((b, i) => (
            <li key={i} className="text-[13px] text-neutral-600 leading-relaxed">
              {b}
            </li>
          ))}
        </ul>
      )}
      {item.closingParagraphs?.map((p, i) => (
        <p key={`c-${i}`} className="mb-3 last:mb-0">
          {p}
        </p>
      ))}
    </>
  );
}

export default function StoreFaq() {
  const [openId, setOpenId] = useState<string | null>("authenticity");

  return (
    <section className="border-t border-neutral-200 py-16 md:py-20">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-400 mb-2">
            Help
          </p>
          <h2 className="text-[11px] uppercase tracking-widest font-bold mb-10">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="max-w-3xl divide-y divide-neutral-200 border-t border-b border-neutral-200">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div key={item.id} className="py-0">
                <button
                  type="button"
                  id={`faq-${item.id}-trigger`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-${item.id}-panel`}
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-neutral-600"
                >
                  <span className="text-[11px] uppercase tracking-widest font-medium text-black pr-4">
                    {item.question}
                  </span>
                  <span
                    className="shrink-0 text-[18px] font-light text-neutral-400 tabular-nums w-6 text-center leading-none"
                    aria-hidden
                  >
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <div
                  id={`faq-${item.id}-panel`}
                  role="region"
                  aria-labelledby={`faq-${item.id}-trigger`}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="pb-5 text-[13px] leading-relaxed text-neutral-600">
                      <FaqAnswer item={item} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
