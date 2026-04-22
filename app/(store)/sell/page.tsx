import type { Metadata } from "next";
import SellForm from "@/components/store/SellForm";

export const metadata: Metadata = {
  title: "Sell - OBJECTSBYHYPE",
  description:
    "Sell or consign your designer, luxury, and streetwear pieces with OBJECTSBYHYPE.",
};

export default function SellPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-12 md:py-20">
      {/* Header */}
      <div className="max-w-2xl mb-12">
        <h1 className="text-[32px] md:text-[48px] font-black uppercase tracking-tight leading-none mb-4">
          Sell or Consign
        </h1>
        <p className="text-[13px] text-neutral-500 leading-relaxed">
          Have a piece you're looking to move? We buy outright or list it on
          consignment. Submit your item below and we'll get back to you within
          48 hours.
        </p>
      </div>

      {/* Two columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12 lg:gap-20">
        <SellForm />

        {/* Info sidebar */}
        <div className="space-y-8">
          <div className="border border-neutral-200 p-6">
            <h3 className="text-[11px] uppercase tracking-widest font-bold mb-4">
              We Buy
            </h3>
            <p className="text-[13px] text-neutral-500 leading-relaxed">
              We purchase items outright. You get paid immediately, with no
              waiting and no commission. Best for pieces you want to move fast.
            </p>
          </div>

          <div className="border border-neutral-200 p-6">
            <h3 className="text-[11px] uppercase tracking-widest font-bold mb-4">
              We Consign
            </h3>
            <p className="text-[13px] text-neutral-500 leading-relaxed">
              We list your item in our store and handle everything. You get paid
              when it sells. Best for high-value pieces where you want top
              dollar.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
