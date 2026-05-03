"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Crosshair,
  Download,
  Eraser,
  MousePointer2,
  RotateCcw,
  Sparkles,
  Undo2,
} from "lucide-react";
import { MERCH_CATALOG } from "@/lib/merchData";
import type { MerchItem } from "@/lib/types";

export interface CanvasWorkspaceHandle {
  addOverlay: (item: MerchItem) => Promise<void>;
}

interface CanvasWorkspaceProps {
  photoDataUrl: string | null;
  onActiveItemsChange?: (ids: ReadonlySet<string>) => void;
}

/** Custom fields we attach to each FabricImage overlay so we can:
 *  - identify the merch item it represents
 *  - swap/remove items of the same type
 *  - paint pixel-level erasures into its source canvas
 *  - undo strokes / reset to the original image */
type FabricImageWithMeta = import("fabric").FabricImage & {
  merchId?: string;
  merchType?: string;
  _sourceCanvas?: HTMLCanvasElement;
  _sourceCtx?: CanvasRenderingContext2D;
  _undoStack?: ImageData[];
};

const DISPLAY_BRUSH_RADIUS_CSS = 22; // visible brush radius in screen pixels
const MAX_UNDO_STEPS = 6;

export const CanvasWorkspace = forwardRef<CanvasWorkspaceHandle, CanvasWorkspaceProps>(
  function CanvasWorkspace({ photoDataUrl, onActiveItemsChange }, ref) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const canvasElRef = useRef<HTMLCanvasElement | null>(null);
    const fabricRef = useRef<import("fabric").Canvas | null>(null);
    const fabricNsRef = useRef<typeof import("fabric") | null>(null);
    const photoSizeRef = useRef<{ w: number; h: number } | null>(null);

    // UI state
    const [hasSelection, setHasSelection] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [overlayCount, setOverlayCount] = useState(0);
    const [eraseMode, setEraseMode] = useState(false);
    const [eraseTargetName, setEraseTargetName] = useState<string | null>(null);

    // Two-tap headwear calibration: user taps top-of-head, then chin,
    // and we use those points to position+scale the cap/headband
    // accurately for *that* photo. No ML — just geometry.
    type PlacementStep = "head-top" | "head-chin";
    const [placementStep, setPlacementStep] = useState<PlacementStep | null>(null);
    const [pendingHeadwearName, setPendingHeadwearName] = useState<string>("");

    // Refs read inside Fabric event handlers.
    const eraseModeRef = useRef(false);
    const eraseTargetRef = useRef<FabricImageWithMeta | null>(null);
    const isStrokingRef = useRef(false);
    const lastSourcePtRef = useRef<{ x: number; y: number } | null>(null);
    const placementStepRef = useRef<PlacementStep | null>(null);
    const pendingHeadwearItemRef = useRef<MerchItem | null>(null);
    const headTopPointRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
      eraseModeRef.current = eraseMode;
    }, [eraseMode]);

    useEffect(() => {
      placementStepRef.current = placementStep;
    }, [placementStep]);

    const reportActive = useCallback(() => {
      const fc = fabricRef.current;
      if (!fc || !onActiveItemsChange) return;
      const ids = new Set<string>();
      fc.getObjects().forEach((o) => {
        const id = (o as FabricImageWithMeta).merchId;
        if (id) ids.add(id);
      });
      onActiveItemsChange(ids);
    }, [onActiveItemsChange]);

    const fitCanvasToWrapper = useCallback(() => {
      const fc = fabricRef.current;
      const wrapper = wrapperRef.current;
      const photoSize = photoSizeRef.current;
      if (!fc || !wrapper || !photoSize) return;

      const maxW = wrapper.clientWidth;
      const maxH = Math.max(360, Math.min(window.innerHeight - 240, 920));

      const aspect = photoSize.w / photoSize.h;
      let displayW = maxW;
      let displayH = displayW / aspect;
      if (displayH > maxH) {
        displayH = maxH;
        displayW = displayH * aspect;
      }

      const prevW = fc.getWidth();
      const scale = prevW > 0 ? displayW / prevW : 1;

      fc.setDimensions({ width: displayW, height: displayH });

      const bg = fc.backgroundImage as
        | import("fabric").FabricImage
        | undefined;
      if (bg) {
        bg.scaleX = displayW / (bg.width ?? displayW);
        bg.scaleY = displayH / (bg.height ?? displayH);
      }

      if (scale !== 1) {
        fc.getObjects().forEach((obj) => {
          obj.scaleX = (obj.scaleX ?? 1) * scale;
          obj.scaleY = (obj.scaleY ?? 1) * scale;
          obj.left = (obj.left ?? 0) * scale;
          obj.top = (obj.top ?? 0) * scale;
          obj.setCoords();
        });
      }

      fc.requestRenderAll();
    }, []);

    // Fabric init.
    useEffect(() => {
      let cancelled = false;
      let fabricCanvas: import("fabric").Canvas | null = null;

      (async () => {
        const fabric = await import("fabric");
        if (cancelled || !canvasElRef.current) return;

        fabricCanvas = new fabric.Canvas(canvasElRef.current, {
          backgroundColor: "#ffffff",
          preserveObjectStacking: true,
          enableRetinaScaling: true,
          selection: true,
        });

        fabric.FabricObject.prototype.set({
          cornerColor: "#ffffff",
          cornerStrokeColor: "#DC2626",
          borderColor: "#DC2626",
          borderScaleFactor: 1.5,
          cornerSize: 14,
          touchCornerSize: 32,
          transparentCorners: false,
          cornerStyle: "circle",
          padding: 6,
        });

        fabricCanvas.on("selection:created", () => setHasSelection(true));
        fabricCanvas.on("selection:updated", () => setHasSelection(true));
        fabricCanvas.on("selection:cleared", () => setHasSelection(false));
        fabricCanvas.on("object:added", () => {
          setOverlayCount(fabricCanvas?.getObjects().length ?? 0);
          reportActive();
        });
        fabricCanvas.on("object:removed", () => {
          const c = fabricCanvas?.getObjects().length ?? 0;
          setOverlayCount(c);
          reportActive();
          // If the erased target was removed, exit erase mode.
          if (eraseTargetRef.current && !fabricCanvas?.contains(eraseTargetRef.current)) {
            exitEraseMode();
          }
        });

        // Pointer pipeline (placement + eraser). Always registered;
        // handlers no-op when neither mode is active.
        fabricCanvas.on("mouse:down", (opt) => {
          // Two-tap headwear calibration.
          if (placementStepRef.current) {
            const pt = opt.scenePoint ?? opt.pointer;
            if (pt) handlePlacementClick({ x: pt.x, y: pt.y });
            return;
          }
          if (!eraseModeRef.current) return;
          const target = eraseTargetRef.current;
          if (!target) return;
          startStroke(target);
          const sp = canvasPointToSource(target, opt.scenePoint ?? opt.pointer);
          if (!sp) return;
          isStrokingRef.current = true;
          lastSourcePtRef.current = sp;
          const r = sourceBrushRadius(target, fabricCanvas!);
          paintEraseStroke(target, sp, sp, r);
        });
        fabricCanvas.on("mouse:move", (opt) => {
          if (!eraseModeRef.current || !isStrokingRef.current) return;
          const target = eraseTargetRef.current;
          if (!target) return;
          const last = lastSourcePtRef.current;
          if (!last) return;
          const sp = canvasPointToSource(target, opt.scenePoint ?? opt.pointer);
          if (!sp) return;
          const r = sourceBrushRadius(target, fabricCanvas!);
          paintEraseStroke(target, last, sp, r);
          lastSourcePtRef.current = sp;
        });
        fabricCanvas.on("mouse:up", () => {
          isStrokingRef.current = false;
          lastSourcePtRef.current = null;
        });

        fabricRef.current = fabricCanvas;
        fabricNsRef.current = fabric;
        setIsReady(true);
      })();

      return () => {
        cancelled = true;
        fabricRef.current = null;
        fabricCanvas?.dispose();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Photo background.
    useEffect(() => {
      if (!isReady || !photoDataUrl) return;
      let cancelled = false;

      (async () => {
        const fabric = fabricNsRef.current;
        const fc = fabricRef.current;
        if (!fabric || !fc) return;

        const img = await fabric.FabricImage.fromURL(photoDataUrl);
        if (cancelled || !fabricRef.current) return;

        fc.remove(...fc.getObjects());
        if (eraseModeRef.current) exitEraseMode();

        photoSizeRef.current = { w: img.width ?? 1, h: img.height ?? 1 };

        img.set({
          originX: "left",
          originY: "top",
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
        });
        fc.backgroundImage = img;

        fitCanvasToWrapper();
        reportActive();
      })();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady, photoDataUrl, fitCanvasToWrapper, reportActive]);

    // Resize observer.
    useEffect(() => {
      if (!isReady) return;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const observer = new ResizeObserver(() => fitCanvasToWrapper());
      observer.observe(wrapper);
      return () => observer.disconnect();
    }, [isReady, fitCanvasToWrapper]);

    /** Load a merch image into a backing canvas and wrap it in a
     *  FabricImage with all our metadata + custom controls attached.
     *  Returns the image *unpositioned* — the caller decides placement. */
    async function buildOverlayImage(
      item: MerchItem,
    ): Promise<FabricImageWithMeta | null> {
      const fabric = fabricNsRef.current;
      if (!fabric) return null;

      const imgEl = new Image();
      imgEl.crossOrigin = "anonymous";
      try {
        await new Promise<void>((resolve, reject) => {
          imgEl.onload = () => resolve();
          imgEl.onerror = () => reject(new Error("Failed to load merch image"));
          imgEl.src = item.cloudinaryUrl;
        });
      } catch (err) {
        console.error(err);
        return null;
      }

      const off = document.createElement("canvas");
      off.width = imgEl.naturalWidth;
      off.height = imgEl.naturalHeight;
      const offCtx = off.getContext("2d", { willReadFrequently: true });
      if (!offCtx) return null;
      offCtx.drawImage(imgEl, 0, 0);

      const img = new fabric.FabricImage(off) as FabricImageWithMeta;
      img.merchId = item.id;
      img.merchType = item.type;
      img._sourceCanvas = off;
      img._sourceCtx = offCtx;
      img._undoStack = [];
      img.set({ objectCaching: false });

      attachDeleteControl(fabric, img);
      return img;
    }

    const addOverlay = useCallback(async (item: MerchItem) => {
      const fc = fabricRef.current;
      if (!fc) return;
      if (eraseModeRef.current) exitEraseMode();
      if (placementStepRef.current) cancelPlacement();

      // Toggle/replace within type — same UX as before.
      const sameType: FabricImageWithMeta[] = fc
        .getObjects()
        .filter((o) => (o as FabricImageWithMeta).merchType === item.type) as FabricImageWithMeta[];
      const alreadyOn = sameType.find((o) => o.merchId === item.id);
      if (alreadyOn) {
        fc.remove(alreadyOn);
        fc.requestRenderAll();
        return;
      }
      sameType.forEach((o) => fc.remove(o));

      // Headwear → start two-tap calibration. The actual placement
      // happens after the user taps the top of their head and chin.
      if (item.type === "headwear") {
        pendingHeadwearItemRef.current = item;
        setPendingHeadwearName(item.shortName);
        setPlacementStep("head-top");
        fc.discardActiveObject();
        fc.selection = false;
        fc.getObjects().forEach((o) => {
          o.selectable = false;
          o.evented = false;
        });
        fc.defaultCursor = "crosshair";
        fc.hoverCursor = "crosshair";
        fc.requestRenderAll();
        return;
      }

      // Clothing → place at chest height with sensible defaults.
      const img = await buildOverlayImage(item);
      if (!img || !fabricRef.current) return;
      placeClothingDefault(fc, img);
    }, []);

    function placeClothingDefault(
      fc: import("fabric").Canvas,
      img: FabricImageWithMeta,
    ) {
      const canvasW = fc.getWidth();
      const canvasH = fc.getHeight();
      const naturalW = img.width ?? 1;
      const scale = (canvasW * 0.72) / naturalW;
      img.set({
        left: canvasW / 2,
        top: canvasH * 0.34,
        originX: "center",
        originY: "top",
        scaleX: scale,
        scaleY: scale,
      });
      fc.add(img);
      fc.setActiveObject(img);
      fc.requestRenderAll();
    }

    function handlePlacementClick(point: { x: number; y: number }) {
      if (placementStepRef.current === "head-top") {
        headTopPointRef.current = point;
        setPlacementStep("head-chin");
        return;
      }
      if (placementStepRef.current === "head-chin") {
        const top = headTopPointRef.current;
        const item = pendingHeadwearItemRef.current;
        if (!top || !item) {
          cancelPlacement();
          return;
        }
        void placeHeadwearWithCalibration(item, top, point);
        cancelPlacement();
      }
    }

    /** Use the two calibration points to size, position and rotate the
     *  cap/headband so it actually matches the user's head in the photo. */
    async function placeHeadwearWithCalibration(
      item: MerchItem,
      top: { x: number; y: number },
      chin: { x: number; y: number },
    ) {
      const fc = fabricRef.current;
      if (!fc) return;
      const img = await buildOverlayImage(item);
      if (!img || !fabricRef.current) return;

      // Vector from chin → top of head: length = head height,
      // angle = how the head is tilted in the photo.
      const vx = top.x - chin.x;
      const vy = top.y - chin.y;
      const headHeightPx = Math.max(1, Math.hypot(vx, vy));
      // Front-view human head: width ≈ 0.72 × height.
      const headWidthPx = headHeightPx * 0.72;
      // Tilt in degrees relative to upright (vector pointing up = 0°).
      const angleDeg = (Math.atan2(vx, -vy) * 180) / Math.PI;
      // Unit vector from chin → top of head.
      const upX = vx / headHeightPx;
      const upY = vy / headHeightPx;

      const naturalW = img.width ?? 1;
      const naturalH = img.height ?? 1;

      let displayWidth: number;
      let centerX: number;
      let centerY: number;

      if (item.id === "headband-black") {
        // Headband sits on the forehead — about 22% of the way from
        // the top of the head down toward the chin.
        displayWidth = headWidthPx * 1.02;
        centerX = top.x + (chin.x - top.x) * 0.22;
        centerY = top.y + (chin.y - top.y) * 0.22;
      } else {
        // Cap (snapback): brim at the eyebrow line, crown above the
        // top of the head.
        displayWidth = headWidthPx * 1.18;
        const scaleForWidth = displayWidth / naturalW;
        const capHeightPx = naturalH * scaleForWidth;
        // Push the cap's center upward by ~half its height (so its
        // bottom edge meets the top of the head), then back down by
        // 30% of head height so the brim covers the forehead.
        const offsetUp = capHeightPx * 0.5 - headHeightPx * 0.3;
        centerX = top.x + upX * offsetUp;
        centerY = top.y + upY * offsetUp;
      }

      const scale = displayWidth / naturalW;

      img.set({
        left: centerX,
        top: centerY,
        originX: "center",
        originY: "center",
        scaleX: scale,
        scaleY: scale,
        angle: angleDeg,
      });

      fc.add(img);
      fc.setActiveObject(img);
      fc.requestRenderAll();
    }

    function cancelPlacement() {
      const fc = fabricRef.current;
      pendingHeadwearItemRef.current = null;
      headTopPointRef.current = null;
      setPlacementStep(null);
      setPendingHeadwearName("");
      if (!fc) return;
      fc.selection = true;
      fc.getObjects().forEach((o) => {
        o.selectable = true;
        o.evented = true;
      });
      fc.defaultCursor = "default";
      fc.hoverCursor = "move";
      fc.requestRenderAll();
    }

    useImperativeHandle(ref, () => ({ addOverlay }), [addOverlay]);

    // ---------------- Erase mode ----------------

    function enterEraseMode() {
      const fc = fabricRef.current;
      if (!fc) return;
      if (placementStepRef.current) cancelPlacement();

      let target = fc.getActiveObject() as FabricImageWithMeta | null;
      if (!target || !target.merchId) {
        const objs = fc.getObjects();
        target = (objs[objs.length - 1] as FabricImageWithMeta | undefined) ?? null;
      }
      if (!target) return;

      eraseTargetRef.current = target;
      const merch = MERCH_CATALOG.find((m) => m.id === target!.merchId);
      setEraseTargetName(merch?.shortName ?? "the merch");
      setEraseMode(true);

      fc.discardActiveObject();
      fc.selection = false;
      fc.getObjects().forEach((o) => {
        o.selectable = false;
        o.evented = false;
      });
      fc.defaultCursor = "crosshair";
      fc.hoverCursor = "crosshair";
      fc.requestRenderAll();
    }

    function exitEraseMode() {
      const fc = fabricRef.current;
      if (!fc) return;
      if (placementStepRef.current) cancelPlacement();

      setEraseMode(false);
      setEraseTargetName(null);
      eraseTargetRef.current = null;
      isStrokingRef.current = false;
      lastSourcePtRef.current = null;

      fc.selection = true;
      fc.getObjects().forEach((o) => {
        o.selectable = true;
        o.evented = true;
      });
      fc.defaultCursor = "default";
      fc.hoverCursor = "move";
      fc.requestRenderAll();
    }

    function startStroke(target: FabricImageWithMeta) {
      const ctx = target._sourceCtx;
      const sc = target._sourceCanvas;
      if (!ctx || !sc) return;
      const snap = ctx.getImageData(0, 0, sc.width, sc.height);
      target._undoStack = target._undoStack ?? [];
      target._undoStack.push(snap);
      if (target._undoStack.length > MAX_UNDO_STEPS) target._undoStack.shift();
    }

    function handleUndoErase() {
      const target = eraseTargetRef.current;
      if (!target?._undoStack || target._undoStack.length === 0) return;
      const snap = target._undoStack.pop();
      if (!snap || !target._sourceCtx) return;
      target._sourceCtx.putImageData(snap, 0, 0);
      target.set({ dirty: true });
      fabricRef.current?.requestRenderAll();
    }

    function handleResetErase() {
      const target = eraseTargetRef.current;
      const merch = target?.merchId
        ? MERCH_CATALOG.find((m) => m.id === target.merchId)
        : null;
      if (!target || !merch || !target._sourceCtx || !target._sourceCanvas) return;

      const imgEl = new Image();
      imgEl.crossOrigin = "anonymous";
      imgEl.onload = () => {
        const ctx = target._sourceCtx!;
        const sc = target._sourceCanvas!;
        ctx.clearRect(0, 0, sc.width, sc.height);
        ctx.drawImage(imgEl, 0, 0);
        target._undoStack = [];
        target.set({ dirty: true });
        fabricRef.current?.requestRenderAll();
      };
      imgEl.src = merch.cloudinaryUrl;
    }

    // ---------------- Other actions ----------------

    function handleClearAll() {
      const fc = fabricRef.current;
      if (!fc) return;
      if (eraseModeRef.current) exitEraseMode();
      fc.remove(...fc.getObjects());
      fc.discardActiveObject();
      fc.requestRenderAll();
    }

    function handleDownload() {
      const fc = fabricRef.current;
      if (!fc) return;
      if (eraseModeRef.current) exitEraseMode();
      fc.discardActiveObject();
      fc.requestRenderAll();

      const dataUrl = fc.toDataURL({ format: "png", multiplier: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `virtry-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    return (
      <div className="flex h-full flex-col gap-3">
        <Toolbar
          eraseMode={eraseMode}
          eraseTargetName={eraseTargetName}
          hasOverlays={overlayCount > 0}
          hasPhoto={!!photoDataUrl}
          onMove={exitEraseMode}
          onErase={enterEraseMode}
          onClearAll={handleClearAll}
          onUndo={handleUndoErase}
          onReset={handleResetErase}
          onDownload={handleDownload}
        />

        <div
          ref={wrapperRef}
          className={[
            "canvas-wrapper canvas-checker relative flex min-h-[360px] flex-1 items-center justify-center overflow-hidden rounded-2xl border shadow-card",
            eraseMode
              ? "border-brand-red ring-2 ring-brand-red/30"
              : placementStep
                ? "border-brand-red ring-2 ring-brand-red/20"
                : "border-brand-line",
          ].join(" ")}
        >
          <canvas ref={canvasElRef} className="touch-none" />
          {!photoDataUrl && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
              <div className="rounded-2xl bg-white/85 px-5 py-4 text-sm text-brand-smoke shadow-card">
                <Sparkles className="mx-auto mb-1 h-5 w-5 text-brand-red" />
                Your canvas appears here once you upload a photo
              </div>
            </div>
          )}
          {placementStep && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3">
              <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-brand-red px-4 py-2 text-white shadow-glow">
                <Crosshair className="h-4 w-4" />
                <span className="text-xs font-semibold">
                  {placementStep === "head-top"
                    ? `Step 1 of 2 · Tap the top of your head`
                    : `Step 2 of 2 · Tap your chin to fit ${pendingHeadwearName}`}
                </span>
                <button
                  type="button"
                  onClick={cancelPlacement}
                  className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium hover:bg-white/30"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-brand-smoke">
          {placementStep
            ? "Tap on the photo to mark the head — Virtry uses your two taps to fit the merch"
            : eraseMode
              ? "Drag across the merch to wipe pixels (e.g. the hood opening). Tap Move to go back to drag mode."
              : photoDataUrl
                ? hasSelection
                  ? "Drag to move · pinch or drag a corner to resize · drag the top handle to rotate · tap ✕ to remove"
                  : "Tap a piece of merch from the right to try it on"
                : "Pick a photo above to begin"}
        </p>
      </div>
    );
  },
);

// =====================================================================
// Toolbar (unified)
// =====================================================================

interface ToolbarProps {
  eraseMode: boolean;
  eraseTargetName: string | null;
  hasOverlays: boolean;
  hasPhoto: boolean;
  onMove: () => void;
  onErase: () => void;
  onClearAll: () => void;
  onUndo: () => void;
  onReset: () => void;
  onDownload: () => void;
}

function Toolbar({
  eraseMode,
  eraseTargetName,
  hasOverlays,
  hasPhoto,
  onMove,
  onErase,
  onClearAll,
  onUndo,
  onReset,
  onDownload,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ToolPicker
          eraseMode={eraseMode}
          hasOverlays={hasOverlays}
          onMove={onMove}
          onErase={onErase}
        />

        {eraseMode ? (
          <>
            {eraseTargetName && (
              <span className="hidden text-xs text-brand-smoke sm:inline">
                Erasing{" "}
                <span className="font-semibold text-brand-ink">
                  {eraseTargetName}
                </span>
              </span>
            )}
            <ToolButton onClick={onUndo}>
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </ToolButton>
            <ToolButton onClick={onReset} variant="quiet">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </ToolButton>
          </>
        ) : (
          <ToolButton onClick={onClearAll} disabled={!hasOverlays} variant="quiet">
            <RotateCcw className="h-3.5 w-3.5" />
            Clear all
          </ToolButton>
        )}
      </div>

      <button
        type="button"
        onClick={onDownload}
        disabled={!hasPhoto}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-redDeep disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download className="h-4 w-4" />
        Download
      </button>
    </div>
  );
}

interface ToolPickerProps {
  eraseMode: boolean;
  hasOverlays: boolean;
  onMove: () => void;
  onErase: () => void;
}

/** Persistent Move ↔ Erase segmented control. The user can always tap
 *  Move to leave erase mode, instead of hunting for a Done button. */
function ToolPicker({ eraseMode, hasOverlays, onMove, onErase }: ToolPickerProps) {
  const baseBtn =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition";
  return (
    <div
      role="tablist"
      aria-label="Tool"
      className="inline-flex items-center rounded-full border border-brand-line bg-white p-1 shadow-card"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!eraseMode}
        onClick={onMove}
        className={`${baseBtn} ${
          !eraseMode
            ? "bg-brand-ink text-white"
            : "text-brand-smoke hover:text-brand-ink"
        }`}
      >
        <MousePointer2 className="h-3.5 w-3.5" />
        Move
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={eraseMode}
        disabled={!hasOverlays && !eraseMode}
        onClick={onErase}
        className={`${baseBtn} ${
          eraseMode
            ? "bg-brand-red text-white"
            : "text-brand-smoke hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-40"
        }`}
      >
        <Eraser className="h-3.5 w-3.5" />
        Erase
      </button>
    </div>
  );
}

function ToolButton({
  onClick,
  disabled,
  variant = "default",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "quiet" | "accent";
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
  const styles =
    variant === "quiet"
      ? "border-brand-line bg-white text-brand-smoke hover:border-brand-red/40 hover:text-brand-red"
      : variant === "accent"
        ? "border-brand-red/30 bg-brand-redTint text-brand-redDeep hover:bg-brand-redSoft"
        : "border-brand-line bg-white text-brand-ink hover:border-brand-red/50 hover:text-brand-red";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

// =====================================================================
// Helpers
// =====================================================================

/** Map a canvas-space pointer to source-canvas (image) pixel coordinates,
 *  taking into account the image's left/top/scale/rotation. */
function canvasPointToSource(
  target: FabricImageWithMeta,
  pt: { x: number; y: number } | undefined,
): { x: number; y: number } | null {
  if (!pt) return null;
  // calcTransformMatrix is local→canvas; invert for canvas→local.
  const matrix = target.calcTransformMatrix();
  const inv = invert2DMatrix(matrix);
  const local = applyMatrix(inv, pt);
  // Local origin is at the image's geometric center; offset to top-left.
  return {
    x: local.x + (target.width ?? 0) / 2,
    y: local.y + (target.height ?? 0) / 2,
  };
}

/** Inverse of a 6-element 2D affine matrix `[a,b,c,d,e,f]`. */
function invert2DMatrix(m: number[]): number[] {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (det === 0) return [1, 0, 0, 1, 0, 0];
  const id = 1 / det;
  return [
    d * id,
    -b * id,
    -c * id,
    a * id,
    (c * f - d * e) * id,
    (b * e - a * f) * id,
  ];
}

function applyMatrix(m: number[], p: { x: number; y: number }) {
  const [a, b, c, d, e, f] = m;
  return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f };
}

/** Brush radius in source-image pixels — sized so the visible brush
 *  on screen is roughly DISPLAY_BRUSH_RADIUS_CSS no matter how the
 *  user has scaled/zoomed. */
function sourceBrushRadius(target: FabricImageWithMeta, fc: import("fabric").Canvas) {
  const objectScale = target.scaleX ?? 1;
  const canvasZoom = fc.getZoom?.() ?? 1;
  return Math.max(2, DISPLAY_BRUSH_RADIUS_CSS / (objectScale * canvasZoom));
}

function paintEraseStroke(
  target: FabricImageWithMeta,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
) {
  const ctx = target._sourceCtx;
  if (!ctx) return;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = radius * 2;
  ctx.strokeStyle = "rgba(0,0,0,1)";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();

  target.set({ dirty: true });
  target.canvas?.requestRenderAll();
}

/** Canva-style red ✕ delete handle just above the top-right corner. */
function attachDeleteControl(
  fabric: typeof import("fabric"),
  img: import("fabric").FabricImage,
) {
  const baseControls = img.controls ?? fabric.FabricImage.prototype.controls;

  const deleteControl = new fabric.Control({
    x: 0.5,
    y: -0.5,
    offsetX: 22,
    offsetY: -22,
    cursorStyle: "pointer",
    actionName: "delete",
    sizeX: 32,
    sizeY: 32,
    touchSizeX: 44,
    touchSizeY: 44,
    mouseUpHandler: (_event, transform) => {
      const target = transform.target;
      const canvas = target.canvas;
      if (!canvas) return false;
      canvas.remove(target);
      canvas.requestRenderAll();
      return true;
    },
    render: (ctx, left, top, _styleOverride, fabricObject) => {
      const radius = 13;
      ctx.save();
      ctx.translate(left, top);
      ctx.rotate(((fabricObject.angle ?? 0) * Math.PI) / 180);

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#DC2626";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      const arm = radius * 0.45;
      ctx.beginPath();
      ctx.moveTo(-arm, -arm);
      ctx.lineTo(arm, arm);
      ctx.moveTo(arm, -arm);
      ctx.lineTo(-arm, arm);
      ctx.stroke();

      ctx.restore();
    },
  });

  img.controls = { ...baseControls, deleteControl };
}
