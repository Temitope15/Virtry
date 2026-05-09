"use client";

import { useCallback, useRef, useState, type MutableRefObject } from "react";
import { Header } from "@/components/Header";
import { MerchCatalog } from "@/components/MerchCatalog";
import { Uploader } from "@/components/Uploader";
import {
  TryOnViewer,
  type TryOnViewerHandle,
} from "@/components/TryOnViewer";
import type { MerchItem } from "@/lib/types";

export default function Home() {
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [activeMerchId, setActiveMerchId] = useState<string | null>(null);
  const viewerRef = useRef<TryOnViewerHandle | null>(null);

  const handleSelectMerch = useCallback((item: MerchItem) => {
    void viewerRef.current?.generate(item);
  }, []);

  const activeIds = activeMerchId ? new Set([activeMerchId]) : EMPTY_SET;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {!photoDataUrl ? (
          <Landing onPhoto={setPhotoDataUrl} />
        ) : (
          <Studio
            photoDataUrl={photoDataUrl}
            activeIds={activeIds}
            onPhoto={setPhotoDataUrl}
            onActiveMerchChange={setActiveMerchId}
            onSelectMerch={handleSelectMerch}
            viewerRef={viewerRef}
          />
        )}
      </main>

      <footer className="border-t border-brand-line/70 bg-white/60 py-4 text-center text-xs text-brand-smoke">
        © {new Date().getFullYear()} Virtry. All rights reserved.
      </footer>
    </div>
  );
}

const EMPTY_SET: ReadonlySet<string> = new Set();

function Landing({ onPhoto }: { onPhoto: (dataUrl: string) => void }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-8 py-6 sm:py-10">
      <div className="text-center">
        <h2 className="mt-4 text-3xl font-bold leading-tight text-brand-ink sm:text-4xl">
          See yourself in the <span className="text-brand-red">Youth Week</span> merch
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base text-brand-smoke">
          Virtry lets you upload a photo and try on the official tees, hoodies and caps with AI — all in your browser.
        </p>
      </div>

      <Uploader hasPhoto={false} onPhotoSelected={onPhoto} />

      <StepRibbon />
    </section>
  );
}

function StepRibbon() {
  const steps = [
    { n: 1, title: "Upload", body: "A clear photo of you facing the camera." },
    { n: 2, title: "Try on", body: "Tap a piece of merch — AI fits it on you." },
    { n: 3, title: "Share", body: "Download and post it to your story." },
  ];
  return (
    <ul className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
      {steps.map((s) => (
        <li
          key={s.n}
          className="rounded-2xl border border-brand-line bg-white p-4 shadow-card"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-red text-xs font-bold text-white">
            {s.n}
          </span>
          <p className="mt-2 text-sm font-semibold text-brand-ink">{s.title}</p>
          <p className="mt-0.5 text-xs text-brand-smoke">{s.body}</p>
        </li>
      ))}
    </ul>
  );
}

interface StudioProps {
  photoDataUrl: string;
  activeIds: ReadonlySet<string>;
  onPhoto: (dataUrl: string) => void;
  onActiveMerchChange: (id: string | null) => void;
  onSelectMerch: (item: MerchItem) => void;
  viewerRef: MutableRefObject<TryOnViewerHandle | null>;
}

function Studio({
  photoDataUrl,
  activeIds,
  onPhoto,
  onActiveMerchChange,
  onSelectMerch,
  viewerRef,
}: StudioProps) {
  return (
    <section className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-brand-ink sm:text-2xl">
            Style your look
          </h2>
          <p className="text-sm text-brand-smoke">
            Tap any item — Gemini will render it on you · download when you're done
          </p>
        </div>
        <Uploader hasPhoto onPhotoSelected={onPhoto} />
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="order-2 lg:order-1">
          <TryOnViewer
            ref={viewerRef}
            photoDataUrl={photoDataUrl}
            onActiveMerchChange={onActiveMerchChange}
          />
        </div>
        <div className="order-1 max-h-[44vh] rounded-2xl border border-brand-line bg-white p-4 shadow-card lg:order-2 lg:max-h-none">
          <MerchCatalog onSelect={onSelectMerch} activeIds={activeIds} />
        </div>
      </div>
    </section>
  );
}
