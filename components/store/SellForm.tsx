"use client";

import { useState, useRef } from "react";
import Image from "next/image";

const CONDITIONS = [
  "New with tags",
  "New without tags",
  "Like new",
  "Good",
  "Fair",
];

interface UploadedPhoto {
  url: string;
  name: string;
}

export default function SellForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    itemName: "",
    brand: "",
    description: "",
    askingPrice: "",
    condition: "",
  });
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function uploadFiles(files: File[]) {
    setUploading(true);
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const data = new FormData();
      data.append("file", file);
      try {
        const res = await fetch("/api/submissions/upload", {
          method: "POST",
          body: data,
        });
        if (res.ok) {
          const { url } = await res.json();
          setPhotos((prev) => [...prev, { url, name: file.name }]);
        }
      } catch {}
    }
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    uploadFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.condition) {
      setError("Please select a condition.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          askingPrice: form.askingPrice ? parseFloat(form.askingPrice) : null,
          imageUrls: photos.map((p) => p.url),
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-16 flex flex-col items-start">
        <div className="w-8 h-px bg-black mb-8" />
        <h2 className="text-[22px] font-bold mb-3">We got it.</h2>
        <p className="text-[13px] text-neutral-500 leading-relaxed max-w-md">
          Thanks for submitting your item. We'll review it and get back to you
          at <span className="text-black font-medium">{form.email}</span> within
          48 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Your info */}
      <div>
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-5">
          Your Info
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              required
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Item info */}
      <div>
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-5">
          Item Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Item Name *
            </label>
            <input
              type="text"
              value={form.itemName}
              onChange={(e) => update("itemName", e.target.value)}
              placeholder="e.g. Arc'teryx Beta SL Jacket"
              required
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Brand *
            </label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => update("brand", e.target.value)}
              placeholder="e.g. Arc'teryx"
              required
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Asking Price (USD)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.askingPrice}
              onChange={(e) => update("askingPrice", e.target.value)}
              placeholder="Leave blank if flexible"
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Condition *
            </label>
            <select
              value={form.condition}
              onChange={(e) => update("condition", e.target.value)}
              required
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors bg-white"
            >
              <option value="">Select condition</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Description *
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              required
              placeholder="Size, colourway, any flaws, original packaging, etc."
              className="w-full border border-neutral-300 px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors resize-none"
            />
          </div>
        </div>
      </div>

      {/* Photos */}
      <div>
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-5">
          Photos
        </h2>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-10 transition-colors ${
            dragOver
              ? "border-black bg-neutral-50"
              : "border-neutral-300 hover:border-neutral-400"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          {uploading ? (
            <p className="text-[12px] text-neutral-500">Uploading...</p>
          ) : (
            <>
              <p className="text-[13px] font-medium">
                Drop photos here or click to upload
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">
                Front, back, tags, any flaws; the more the better
              </p>
            </>
          )}
        </div>

        {photos.length > 0 && (
          <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 gap-2">
            {photos.map((photo, idx) => (
              <div key={photo.url + idx} className="relative group">
                <div className="relative aspect-square bg-neutral-100 overflow-hidden">
                  <Image
                    src={photo.url}
                    alt={photo.name}
                    fill
                    className="object-cover"
                    sizes="100px"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPhotos((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black text-white text-[11px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      {error && (
        <p className="text-[12px] text-red-500">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-black text-white text-[11px] uppercase tracking-widest px-10 py-4 hover:bg-neutral-800 transition-colors disabled:bg-neutral-400 w-full sm:w-auto"
      >
        {submitting ? "Submitting..." : "Submit Item"}
      </button>
    </form>
  );
}
