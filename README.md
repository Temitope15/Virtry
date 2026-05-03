# Virtry

A virtual try-on web app. Upload a photo, tap a piece of merch, and see it on you — all in the browser. No AI service calls; just HTML5 Canvas, geometry, and Fabric.js.

> Originally built for **Christ Dominion · Keys of the Kingdom Youth Week** to let members preview the official merch from a single photo before pre-orders open. The catalog is a constant in `lib/merchData.ts` — swap it out and Virtry becomes a try-on for whatever you sell.

---

## Features

- **One-tap try-on.** Tap any merch item to overlay it on your photo. Tap the same item again to remove it. Tap a different item of the same category and Virtry swaps them automatically.
- **Two-tap head calibration** for caps and headbands. Virtry asks you to tap the top of your head and then your chin, and uses the two points to compute the head's size, position, and tilt — then auto-fits and auto-rotates the merch. No ML, just geometry.
- **Pixel eraser.** Each overlay is backed by an offscreen `<canvas>`, so the eraser actually deletes pixels (e.g. wipe out the inside of a hood so your face shows through). Six-level undo and full reset.
- **Move / Erase tool picker.** A Canva-style segmented control that's always visible — tapping **Move** instantly returns you to drag/select.
- **Per-overlay delete handle.** Each merch item gets a red ✕ floating above it so non-technical users can see how to remove it.
- **Smart defaults.** Clothing lands at chest height with top-anchored placement at 72% of canvas width. The canvas auto-fits the photo's aspect ratio and rescales overlays proportionally on window resize.
- **PNG export at 2× resolution** for crisp social-media shares.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Canvas | Fabric.js 6 |
| Styling | Tailwind CSS 3 |
| Asset hosting | Cloudinary (with AI Background Removal at upload time) |
| Icons | Lucide React |

---

## Getting started

### Prerequisites

- Node.js 18+
- A [Cloudinary](https://cloudinary.com/) account. The free tier is fine. The **AI Background Removal** add-on must be enabled if you want transparent merch PNGs (otherwise pre-process backgrounds yourself and upload with `--no-bg-removal`).

### Local setup

```bash
git clone https://github.com/Temitope15/Virtry.git
cd Virtry
npm install

cp .env.local.example .env.local
# fill in your Cloudinary credentials
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Uploading your own merch

1. Drop product photos into `assets/merch/` using the filenames listed in [`scripts/upload-merch.mjs`](scripts/upload-merch.mjs) — or rename the entries there to match your files.
2. Confirm what will be uploaded:
   ```bash
   npm run upload-merch -- --dry-run
   ```
3. Upload for real:
   ```bash
   npm run upload-merch
   ```
4. The script prints a JSON block. Paste it over the `MERCH_CATALOG` array in [`lib/merchData.ts`](lib/merchData.ts).

Background-removal note: Cloudinary processes the removal **asynchronously**. The first time you load an uploaded URL it may still show the original background — wait ~30 seconds and hard-reload. Runs subsequent to the first are instant.

---

## How the calibration works (no AI)

Caps and headbands need to match the user's actual head, not just sit at a fixed position. Virtry asks for two taps:

1. **Top of head** → first point `T`
2. **Chin** → second point `C`

From those:

| Quantity | Formula |
|---|---|
| Head height (px) | `‖T − C‖` |
| Head width (px) | `0.72 × headHeight` (front-view human proportion) |
| Tilt (deg) | `atan2(T.x − C.x, C.y − T.y) × 180 / π` |
| Up-vector | `(T − C) / ‖T − C‖` |

Each item then gets:

- **Headband** → centered ~22% of the way from `T` toward `C` (forehead), display width = `headWidth × 1.02`.
- **Snapback cap** → pushed up along the up-vector by `(capHeight/2) − (headHeight × 0.3)` so the brim sits at the eyebrow line; display width = `headWidth × 1.18`.

Both are rotated by the head's tilt, so the merch looks right even on tilted photos. The user can still drag/pinch/rotate after.

---

## How the eraser works

Each merch overlay is rendered from an offscreen `HTMLCanvasElement` rather than directly from the loaded `<img>`. When the user paints with the eraser:

1. The pointer position is mapped into source-canvas pixel coordinates via the inverse of the FabricImage's transform matrix.
2. The brush radius is recomputed each stroke as `DISPLAY_BRUSH_RADIUS_CSS / (objectScale × canvasZoom)` so it feels the same size on screen no matter how the user has scaled the merch.
3. A line is stroked onto the source context with `globalCompositeOperation = "destination-out"`, which deletes pixels.
4. The FabricImage is marked dirty (`objectCaching: false` is set when it's built) and Fabric re-renders from the now-modified source canvas.

Undo is implemented as a stack of `ImageData` snapshots taken on each `pointerdown`, capped at six entries. Reset re-loads the original PNG.

---

## Project layout

```
app/
  layout.tsx          Root layout, metadata, theme
  page.tsx            Landing + Studio routing
  globals.css         Tailwind + custom utilities
  icon.svg            Favicon
components/
  Logo.tsx            AR-bracket "V" mark
  Header.tsx
  Uploader.tsx        Drag-and-drop photo input
  MerchCatalog.tsx    Right-rail catalog with active-state badges
  CanvasWorkspace.tsx Fabric.js canvas, eraser, calibration, toolbar
lib/
  merchData.ts        Merch catalog (id, name, type, price, cloudinaryUrl)
  types.ts            Shared types
scripts/
  upload-merch.mjs    Bulk-upload assets to Cloudinary
assets/merch/         Local product images (uploaded by the script)
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run upload-merch` | Upload `assets/merch/*` to Cloudinary with AI background removal |
| `npm run upload-merch -- --dry-run` | Preview the upload without sending anything |
| `npm run upload-merch -- --no-bg-removal` | Skip background removal (use if you've pre-removed backgrounds) |

---

## Limitations (read me)

- **PNG-overlay try-on has a hard ceiling.** The merch sits *on top of* the photo and can never tuck behind hair or follow a real shoulder slope. The eraser closes some of this gap (you can wipe out the inside of a hood); for a true "see how it fits" experience you'd need a body-segmentation API like [Replicate IDM-VTON](https://replicate.com/cuuupid/idm-vton).
- **Cloudinary AI Background Removal is an add-on.** If your account doesn't have it, run `upload-merch -- --no-bg-removal` and pre-process backgrounds with [remove.bg](https://remove.bg) or Photoshop instead.
- **The calibration constants** (`headWidth ≈ 0.72 × headHeight`, cap brim offset = 30% of head height) are tuned to average front-view human proportions. Photos with extreme angles or unusual framing may need a manual nudge after calibration.

---

## License

© 2026 Virtry. All rights reserved.
