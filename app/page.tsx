"use client";

import { useRef, useState, type MutableRefObject } from "react";
import { Header } from "@/components/Header";
import { MerchCatalog } from "@/components/MerchCatalog";
import { Uploader } from "@/components/Uploader";
import {
  CanvasWorkspace,
  type CanvasWorkspaceHandle,
} from "@/components/CanvasWorkspace";
import type { MerchItem } from "@/lib/types";

export default function Home() {
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [activeIds, setActiveIds] = useState<ReadonlySet<string>>(new Set());
  const canvasRef = useRef<CanvasWorkspaceHandle | null>(null);

  function handleSelectMerch(item: MerchItem) {
    canvasRef.current?.addOverlay(item);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {!photoDataUrl ? <Landing onPhoto={setPhotoDataUrl} /> : (
          <Studio
            photoDataUrl={photoDataUrl}
            activeIds={activeIds}
            onPhoto={setPhotoDataUrl}
            onActiveItemsChange={setActiveIds}
            onSelectMerch={handleSelectMerch}
            canvasRef={canvasRef}
          />
        )}
      </main>

      <footer className="border-t border-brand-line/70 bg-white/60 py-4 text-center text-xs text-brand-smoke">
        © {new Date().getFullYear()} Virtry. All rights reserved.
      </footer>
    </div>
  );
}

function Landing({ onPhoto }: { onPhoto: (dataUrl: string) => void }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-8 py-6 sm:py-10">
      <div className="text-center">

        <h2 className="mt-4 text-3xl font-bold leading-tight text-brand-ink sm:text-4xl">
          See yourself in the <span className="text-brand-red">Youth Week</span> merch
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base text-brand-smoke">
          Virtry lets you upload a photo, try on the official tees, hoodies and caps, and share your look — all in your browser.
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
    { n: 2, title: "Try on", body: "Tap a piece of merch to see it on you." },
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
  onActiveItemsChange: (ids: ReadonlySet<string>) => void;
  onSelectMerch: (item: MerchItem) => void;
  canvasRef: MutableRefObject<CanvasWorkspaceHandle | null>;
}

function Studio({
  photoDataUrl,
  activeIds,
  onPhoto,
  onActiveItemsChange,
  onSelectMerch,
  canvasRef,
}: StudioProps) {
  return (
    <section className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-brand-ink sm:text-2xl">
            Style your look
          </h2>
          <p className="text-sm text-brand-smoke">
            Tap items on the right · drag, scale, rotate to fit · download when you're done
          </p>
        </div>
        <Uploader hasPhoto onPhotoSelected={onPhoto} />
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="order-2 lg:order-1">
          <CanvasWorkspace
            ref={canvasRef}
            photoDataUrl={photoDataUrl}
            onActiveItemsChange={onActiveItemsChange}
          />
        </div>
        <div className="order-1 max-h-[44vh] rounded-2xl border border-brand-line bg-white p-4 shadow-card lg:order-2 lg:max-h-none">
          <MerchCatalog onSelect={onSelectMerch} activeIds={activeIds} />
        </div>
      </div>
    </section>
  );
}
