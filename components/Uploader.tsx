"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw, User } from "lucide-react";

interface UploaderProps {
  hasPhoto: boolean;
  onPhotoSelected: (dataUrl: string) => void;
}

export function Uploader({ hasPhoto, onPhotoSelected }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onPhotoSelected(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  if (hasPhoto) {
    return (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink shadow-card transition hover:border-brand-red/50 hover:text-brand-red"
      >
        <RefreshCw className="h-4 w-4" />
        Use a different photo
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={onChange}
        />
      </button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <label
        htmlFor="photo-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={[
          "group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center shadow-card transition",
          isDragging
            ? "border-brand-red bg-brand-redTint"
            : "border-brand-line hover:border-brand-red hover:bg-brand-redTint/40",
        ].join(" ")}
      >
        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-redSoft text-brand-red transition group-hover:scale-105">
          <ImagePlus className="h-8 w-8" />
        </span>
        <div>
          <p className="text-lg font-semibold text-brand-ink">
            Pick a photo of yourself
          </p>
          <p className="mt-1.5 text-sm text-brand-smoke">
            Drop it here, or tap to choose from your phone
          </p>
        </div>
        <span className="rounded-full bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-glow transition group-hover:bg-brand-redDeep">
          Choose photo
        </span>
        <input
          id="photo-upload"
          ref={inputRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={onChange}
        />
      </label>

      <PhotoTips />
    </div>
  );
}

function PhotoTips() {
  return (
    <div id="how-it-works" className="mt-5 rounded-2xl border border-brand-line bg-white p-4 shadow-card">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-smoke">
        For best results
      </p>
      <ul className="space-y-2.5 text-sm text-brand-ink">
        <li className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-redSoft text-brand-red">
            <User className="h-3 w-3" />
          </span>
          <span>Face the camera with your shoulders visible</span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-redSoft text-brand-red">
            <Camera className="h-3 w-3" />
          </span>
          <span>Stand against a plain wall or background if you can</span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-redSoft text-brand-red text-[10px] font-bold">
            !
          </span>
          <span>Good lighting helps the merch blend in nicely</span>
        </li>
      </ul>
    </div>
  );
}
