"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Download, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { downsizeDataUrl } from "@/lib/imageUtils";
import type { MerchItem } from "@/lib/types";

export interface TryOnViewerHandle {
  generate: (item: MerchItem) => Promise<void>;
  reset: () => void;
}

interface TryOnViewerProps {
  /** The original photo the user uploaded — never mutated. */
  photoDataUrl: string;
  /** Reports the merch id currently shown (or null if showing the original). */
  onActiveMerchChange?: (id: string | null) => void;
}

interface ApiResponse {
  imageDataUrl?: string;
  error?: string;
}

export const TryOnViewer = forwardRef<TryOnViewerHandle, TryOnViewerProps>(
  function TryOnViewer({ photoDataUrl, onActiveMerchChange }, ref) {
    const [displayUrl, setDisplayUrl] = useState(photoDataUrl);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loadingItem, setLoadingItem] = useState<MerchItem | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Cache generated results per merch id, keyed against the source photo
    // so a fresh upload invalidates everything.
    const cacheRef = useRef<{ source: string; map: Map<string, string> }>({
      source: photoDataUrl,
      map: new Map(),
    });
    const abortRef = useRef<AbortController | null>(null);

    // Reset state when the user uploads a different photo.
    useEffect(() => {
      cacheRef.current = { source: photoDataUrl, map: new Map() };
      setDisplayUrl(photoDataUrl);
      setActiveId(null);
      setError(null);
      setLoadingItem(null);
      abortRef.current?.abort();
      abortRef.current = null;
      onActiveMerchChange?.(null);
    }, [photoDataUrl, onActiveMerchChange]);

    const reset = useCallback(() => {
      abortRef.current?.abort();
      abortRef.current = null;
      setDisplayUrl(photoDataUrl);
      setActiveId(null);
      setError(null);
      setLoadingItem(null);
      onActiveMerchChange?.(null);
    }, [photoDataUrl, onActiveMerchChange]);

    const generate = useCallback(
      async (item: MerchItem) => {
        // Tap the active item again → revert to the original photo.
        if (activeId === item.id && !loadingItem) {
          reset();
          return;
        }

        // Use cached result if we already generated this item for this photo.
        const cached = cacheRef.current.map.get(item.id);
        if (cached) {
          setDisplayUrl(cached);
          setActiveId(item.id);
          setError(null);
          onActiveMerchChange?.(item.id);
          return;
        }

        // Kick off a new request, cancelling any in-flight one.
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoadingItem(item);
        setError(null);

        try {
          const compactPhoto = await downsizeDataUrl(photoDataUrl, 1024);
          const res = await fetch("/api/try-on", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photoDataUrl: compactPhoto,
              merchId: item.id,
            }),
            signal: controller.signal,
          });
          const data = (await res.json()) as ApiResponse;
          if (!res.ok || !data.imageDataUrl) {
            throw new Error(data.error ?? `Request failed (${res.status})`);
          }
          // Only commit if this request is still the active one and the
          // source photo hasn't changed underneath us.
          if (
            abortRef.current === controller &&
            cacheRef.current.source === photoDataUrl
          ) {
            cacheRef.current.map.set(item.id, data.imageDataUrl);
            setDisplayUrl(data.imageDataUrl);
            setActiveId(item.id);
            onActiveMerchChange?.(item.id);
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
          if (abortRef.current === controller) {
            abortRef.current = null;
            setLoadingItem(null);
          }
        }
      },
      [activeId, loadingItem, onActiveMerchChange, photoDataUrl, reset],
    );

    useImperativeHandle(ref, () => ({ generate, reset }), [generate, reset]);

    function handleDownload() {
      const link = document.createElement("a");
      link.href = displayUrl;
      link.download = `virtry-${activeId ?? "original"}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    const hasTryOn = activeId !== null;
    const isLoading = loadingItem !== null;

    return (
      <div className="flex h-full flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={!hasTryOn || isLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink shadow-card transition hover:border-brand-red/50 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Show original
            </button>
            {hasTryOn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-redTint px-2.5 py-1 text-[11px] font-semibold text-brand-redDeep">
                <Sparkles className="h-3 w-3" />
                AI try-on
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-redDeep disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>

        <div className="canvas-checker relative flex min-h-[360px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-brand-line bg-white shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt={hasTryOn ? "AI try-on result" : "Your photo"}
            className="max-h-[80vh] max-w-full object-contain"
          />

          {isLoading && (
            <div className="absolute inset-0 grid place-items-center bg-black/30 backdrop-blur-[2px]">
              <div className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-brand-ink shadow-glow">
                <Loader2 className="h-4 w-4 animate-spin text-brand-red" />
                Trying on {loadingItem!.shortName}…
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10">
              <div className="pointer-events-auto flex items-start gap-2 rounded-2xl border border-brand-red/30 bg-white/95 px-3 py-2 text-xs text-brand-ink shadow-card">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" />
                <div className="flex-1">
                  <p className="font-semibold text-brand-red">Try-on failed</p>
                  <p className="mt-0.5 text-brand-smoke">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-brand-smoke hover:text-brand-ink"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-brand-smoke">
          {isLoading
            ? "Hang tight — Gemini is rendering your try-on. This usually takes a few seconds."
            : hasTryOn
              ? "Tap another item on the right to swap, or tap the same item again to see the original."
              : "Tap a piece of merch from the right to try it on with AI."}
        </p>
      </div>
    );
  },
);
