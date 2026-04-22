"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";

export interface UploadedImage {
  url: string;
  displayOrder: number;
}

interface ImageUploaderProps {
  existingImages?: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
}

export default function ImageUploader({
  existingImages = [],
  onChange,
}: ImageUploaderProps) {
  const [images, setImages] = useState<UploadedImage[]>(existingImages);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Keep parent form in sync without calling onChange inside setState updaters
  // (that triggers "Cannot update ProductForm while rendering ImageUploader").
  useEffect(() => {
    onChangeRef.current(images);
  }, [images]);

  const updateImages = useCallback((updated: UploadedImage[]) => {
    const reordered = updated.map((img, idx) => ({
      ...img,
      displayOrder: idx,
    }));
    setImages(reordered);
  }, []);

  async function uploadFiles(files: File[]) {
    setUploading(true);
    setUploadError(null);
    const newImages: UploadedImage[] = [];

    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.url) newImages.push({ url: data.url, displayOrder: 0 });
        } else {
          const data = await res.json().catch(() => ({}));
          const msg =
            data.error ??
            (res.status === 401
              ? "Session expired, sign in again"
              : `Upload failed (${res.status})`);
          setUploadError(msg);
        }
      }

      if (newImages.length > 0) {
        setImages((prev) => {
          const merged = [...prev, ...newImages];
          return merged.map((img, idx) => ({
            ...img,
            displayOrder: idx,
          }));
        });
      }
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    uploadFiles(files);
    e.target.value = "";
  }

  function removeImage(index: number) {
    updateImages(images.filter((_, i) => i !== index));
  }

  function moveImage(from: number, to: number) {
    const updated = [...images];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    updateImages(updated);
  }

  return (
    <div>
      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded cursor-pointer transition-colors flex flex-col items-center justify-center py-10 ${
          dragOver
            ? "border-black bg-neutral-50"
            : "border-neutral-300 hover:border-neutral-400"
        }`}
      >
        <input
          ref={inputRef}
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
              Drop images here or click to upload
            </p>
            <p className="text-[11px] text-neutral-400 mt-1">
              JPG, PNG, WEBP, multiple files supported
            </p>
          </>
        )}
      </div>

      {uploadError && (
        <p className="mt-3 text-[11px] text-red-600 uppercase tracking-widest">
          {uploadError}
        </p>
      )}

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 gap-2">
          {images.map((img, idx) => (
            <div key={img.url + idx} className="relative group">
              <div className="relative aspect-square bg-neutral-100 overflow-hidden rounded">
                <Image
                  src={img.url}
                  alt={`Upload ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="100px"
                  unoptimized={
                    img.url.startsWith("/api/") || img.url.startsWith("/products/")
                  }
                />
                {idx === 0 && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] uppercase tracking-wider text-center py-0.5">
                    Primary
                  </div>
                )}
              </div>

              {/* Overlay controls */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-1">
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(idx, idx - 1);
                    }}
                    className="w-6 h-6 bg-white text-black text-[11px] flex items-center justify-center rounded"
                    title="Move left"
                  >
                    ←
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(idx);
                  }}
                  className="w-6 h-6 bg-white text-red-500 text-[11px] flex items-center justify-center rounded"
                  title="Remove"
                >
                  ×
                </button>
                {idx < images.length - 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(idx, idx + 1);
                    }}
                    className="w-6 h-6 bg-white text-black text-[11px] flex items-center justify-center rounded"
                    title="Move right"
                  >
                    →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
