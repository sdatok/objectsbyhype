"use client";

import { useState } from "react";

const REVIEWS = [
  {
    id: 1,
    name: "Jordan M.",
    location: "Los Angeles, CA",
    rating: 5,
    date: "March 2025",
    item: "Modern Wool Area Rug",
    text: "The rug quality is unreal in person. It was packed well and looked exactly like the photos.",
  },
  {
    id: 2,
    name: "Priya S.",
    location: "New York, NY",
    rating: 5,
    date: "February 2025",
    item: "Boucle Accent Chair",
    text: "Super clean build quality and the fabric feels premium. Support answered sizing questions quickly before I ordered.",
  },
  {
    id: 3,
    name: "Marcus T.",
    location: "London, UK",
    rating: 5,
    date: "January 2025",
    item: "Smoked Glass Coffee Table",
    text: "I was worried about shipping glass, but it arrived perfect. Assembly was easy and the finish is beautiful.",
  },
  {
    id: 4,
    name: "Camille R.",
    location: "Chicago, IL",
    rating: 5,
    date: "March 2025",
    item: "Chrome Floor Lamp",
    text: "Looks high-end and gives amazing warm light in my living room. Product was exactly as described.",
  },
  {
    id: 5,
    name: "Ethan K.",
    location: "Miami, FL",
    rating: 5,
    date: "April 2025",
    item: "Velvet Cushion Set",
    text: "Easy checkout and really good value for the quality. Colors matched the photos perfectly.",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={i < count ? "text-black" : "text-neutral-300"}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function Reviews() {
  const [active, setActive] = useState(0);
  const visible = REVIEWS;

  return (
    <section className="border-t border-neutral-200 py-16">
      <div className="max-w-[1400px] mx-auto px-4">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-400 mb-2">
              What People Say
            </p>
            <h2 className="text-[22px] font-black uppercase tracking-tight leading-none">
              Reviews
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <Stars count={5} />
            <span className="text-[11px] text-neutral-500 ml-2">
              5.0 · {REVIEWS.length} reviews
            </span>
          </div>
        </div>

        {/* Cards: horizontal scroll on mobile, grid on desktop */}
        <div className="hidden md:grid grid-cols-3 lg:grid-cols-5 gap-px bg-white">
          {visible.map((review) => (
            <div key={review.id} className="flex flex-col gap-3 bg-white p-5">
              <Stars count={review.rating} />
              <p className="text-[12px] leading-relaxed text-neutral-700 flex-1">
                "{review.text}"
              </p>
              <div>
                <p className="text-[11px] font-semibold">{review.name}</p>
                <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-0.5">
                  {review.location}
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  {review.item}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile carousel */}
        <div className="md:hidden">
          <div className="bg-white border border-neutral-200 p-6 min-h-[220px] flex flex-col gap-3">
            <Stars count={visible[active].rating} />
            <p className="text-[13px] leading-relaxed text-neutral-700 flex-1">
              "{visible[active].text}"
            </p>
            <div>
              <p className="text-[12px] font-semibold">{visible[active].name}</p>
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-0.5">
                {visible[active].location}
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                {visible[active].item}
              </p>
            </div>
          </div>
          {/* Dots */}
          <div className="flex justify-center gap-2 mt-4">
            {visible.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === active ? "bg-black" : "bg-neutral-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
