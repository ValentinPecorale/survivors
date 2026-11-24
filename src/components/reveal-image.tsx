"use client";

/**
 * RevealImage — instant image reveal.
 *
 *   mode="glyphs" (default):  hidden → GLYPHS → PIXELS
 *       1. a symbol grid fills the whole box (you pick the columns)
 *       2. the real image lands pixel by pixel on top of the glyphs
 *   mode="pixels":            hidden → PIXELS only. No glyph phase, no hold.
 *
 * Pixel (image-cell) sizes — `cellMode`:
 *   "uniform" every pixel is `cell` px · "random" random sizes from `cell` to `cellMax`
 *   (`split` = mix) · "detail" small where the image has detail, big where it is flat.
 *   Sizes step ×2 (cell, 2×cell, 4×cell…) and always tile the box with no gaps.
 *
 * The glyph grid and the pixel grid are independent: e.g. 40 glyph columns
 * under 32px pixels.
 *
 * EFFECT ONLY. Renders a wrapper <div> that fills its parent (width/height 100%)
 * holding two stacked <canvas>es. No border-radius, shadow, aspect-ratio, margin
 * or size is set — put it in your own sized container (or give it className/style);
 * the image is "cover"-fitted into that box. Set `color` on it for the glyph
 * colour when tint is off or the image can't be sampled.
 *
 * Self-contained: depends on React only. Canvas 2D, one rAF loop, only changed
 * glyphs/cells are redrawn. Cross-origin images need CORS headers for the glyph
 * tint (the reveal itself works without; glyphs fall back to the text colour).
 * Use opaque images: transparent pixels would let glyphs show through.
 *
 * Usage:
 *   <div className="aspect-video w-full">
 *     <RevealImage src="/photo.jpg" alt="…" trigger="inView" />
 *   </div>
 */

import { useEffect, useRef, type CSSProperties } from "react";

export const CHARSETS = {
  symbols: "!<>-_\\/[]{}=+*^?#%&@$~|:;",
  binary: "01",
  blocks: "█▓▒░▌▐▄▀■",
  lines: "|/\\-_=+",
} as const;

export type Settings = {
  /** glyph columns across the box. rows follow (square glyph cells). 0 = no glyph phase */
  glyphCols: number;
  /** ms for the whole glyph field to appear */
  glyphDuration: number;
  /** ms the complete glyph field sits before the image cells start */
  hold: number;
  /**
   * "glyphs" = hidden → glyphs → pixels (the glyph phase, then the hold, then the pixels)
   * "pixels" = hidden → pixels only. No glyph phase, no hold: the real image pixels land straight away.
   */
  mode: "glyphs" | "pixels";
  /**
   * How pixel (image-cell) sizes are chosen:
   *   "uniform" = every pixel is `cell` px
   *   "random"  = random sizes between `cell` and `cellMax` (see `split`)
   *   "detail"  = small pixels where the image has detail, big where it is flat (see `detail`)
   */
  cellMode: "uniform" | "random" | "detail";
  /** pixel size in CSS px. uniform: the size of every pixel · random/detail: the SMALLEST size */
  cell: number;
  /** random/detail: the LARGEST pixel size in CSS px. sizes step by ×2: cell, 2×cell, 4×cell… up to this */
  cellMax: number;
  /** random: chance (0–1) that a block splits into four smaller ones. low = mostly big, high = mostly small */
  split: number;
  /** detail: local contrast (0–1) above which a block splits. low = splits easily (more small pixels) */
  detail: number;
  /** ms for all image cells to land (after the hold) */
  duration: number;
  /** "random" = shuffled · "linear" = reading order, top-left first (both phases) */
  order: "random" | "linear";
  /** discrete frames each phase snaps to. 1 = all at once */
  steps: number;
  /** >1 most land early · <1 most land late (both phases) */
  skew: number;
  /** same seed = same reveal order */
  seed: number;
  /** ms between glyph swaps while visible. 0 = frozen glyphs */
  cycle: number;
  charset: keyof typeof CHARSETS;
  /** opacity (0–1) of the not-yet-revealed image */
  ghost: number;
  /** colour glyphs from the image underneath */
  tint: boolean;
  /**
   * "draw"     = this component draws the glyph grid itself (no dependencies)
   * "underlay" = YOUR layer (children) sits underneath; this component hides it
   *              behind an opaque cover and uncovers it cell by cell (glyph columns
   *              / time / order apply to the uncovering). Use for e.g. Shader Lab.
   */
  glyphLayer: "draw" | "underlay";
  /** underlay mode: colour of the cover hiding the underlay. match your background */
  cover: string;
};

/*DEFAULTS*/
const DEFAULTS: Settings = {
  glyphCols: 36,
  glyphDuration: 700,
  hold: 300,
  mode: "pixels",
  cellMode: "random",
  cell: 26,
  cellMax: 190,
  split: 0.74,
  detail: 0.2,
  duration: 600,
  order: "random",
  steps: 6,
  skew: 1,
  seed: 7,
  cycle: 60,
  charset: "symbols",
  ghost: 0,
  tint: true,
  glyphLayer: "draw",
  cover: "#000000",
};
/*END DEFAULTS*/

/** fraction of visible glyphs that change on each swap tick (keeps big grids cheap) */
const SWAP_FRACTION = 0.35;

export type RevealImageProps = Partial<Settings> & {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** "load" starts when the image is ready · "inView" when 30% visible */
  trigger?: "load" | "inView";
  /** change this value to replay */
  replayKey?: string | number;
  onDone?: () => void;
  /** glyphLayer="underlay": the layer that gets uncovered (e.g. <ShaderLabComposition/>) */
  children?: React.ReactNode;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Grid = { cols: number; rows: number; xs: number[]; ys: number[] };

type Layout = {
  W: number;
  H: number;
  scale: number;
  ox: number;
  oy: number;
  cells: Grid; // image cells
  glyphs: Grid; // glyph cells
};

// integer device-pixel edges → neighbouring cells butt together with no seams
function makeGrid(cols: number, rows: number, W: number, H: number): Grid {
  return {
    cols,
    rows,
    xs: Array.from({ length: cols + 1 }, (_, c) => Math.round((c * W) / cols)),
    ys: Array.from({ length: rows + 1 }, (_, r) => Math.round((r * H) / rows)),
  };
}

function makeLayout(
  wrap: HTMLElement,
  canvases: HTMLCanvasElement[],
  img: HTMLImageElement,
  s: Settings,
): Layout | null {
  const rect = wrap.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap: 3x phones don't need 9x pixels
  const W = Math.round(rect.width * dpr);
  const H = Math.round(rect.height * dpr);
  for (const c of canvases) {
    c.width = W;
    c.height = H;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(W / iw, H / ih); // cover

  const cols = Math.max(1, Math.round(rect.width / Math.max(4, s.cell)));
  const rows = Math.max(1, Math.round(rect.height / Math.max(4, s.cell)));
  const gcols = Math.max(1, Math.round(s.glyphCols));
  const grows = Math.max(1, Math.round(H / (W / gcols))); // square glyph cells

  return {
    W,
    H,
    scale,
    ox: (W - iw * scale) / 2,
    oy: (H - ih * scale) / 2,
    cells: makeGrid(cols, rows, W, H),
    glyphs: makeGrid(gcols, grows, W, H),
  };
}

/** average colour per grid cell: let the browser downscale the visible image to cols×rows */
function sampleColors(img: HTMLImageElement, L: Layout, g: Grid): Uint8ClampedArray | null {
  try {
    const off = document.createElement("canvas");
    off.width = g.cols;
    off.height = g.rows;
    const o = off.getContext("2d", { willReadFrequently: true })!;
    o.drawImage(img, -L.ox / L.scale, -L.oy / L.scale, L.W / L.scale, L.H / L.scale, 0, 0, g.cols, g.rows);
    return o.getImageData(0, 0, g.cols, g.rows).data;
  } catch {
    return null; // tainted canvas (cross-origin without CORS)
  }
}

function paintGhost(ctx: CanvasRenderingContext2D, img: HTMLImageElement, L: Layout, alpha: number) {
  ctx.clearRect(0, 0, L.W, L.H);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, L.ox, L.oy, img.naturalWidth * L.scale, img.naturalHeight * L.scale);
  ctx.globalAlpha = 1;
}

type Tile = { c: number; r: number; w: number; h: number }; // in grid units

/**
 * The pixels. Every tile is a rectangle of whole grid units, so tiles share integer
 * device-pixel edges and abut with no seams, whatever their sizes.
 *
 * uniform → one tile per grid unit.
 * random / detail → a quadtree: start from big blocks (`cellMax`) and recursively split a
 * block into four, stopping at the smallest size (`cell`). `random` flips a coin per block,
 * `detail` splits where the image has local contrast. Sizes therefore step ×2.
 */
function buildTiles(img: HTMLImageElement, L: Layout, s: Settings): Tile[] {
  const { cols, rows } = L.cells;
  const tiles: Tile[] = [];

  if (s.cellMode === "uniform") {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles.push({ c, r, w: 1, h: 1 });
    return tiles;
  }

  const levels = Math.max(0, Math.min(5, Math.floor(Math.log2(Math.max(s.cellMax, s.cell) / s.cell))));
  const top = 2 ** levels;
  const rand = mulberry32(s.seed + 101); // own stream: pixel sizes don't change when the order is re-rolled

  // detail: luminance at one sample per grid unit
  let lum: Float32Array | null = null;
  if (s.cellMode === "detail") {
    const px = sampleColors(img, L, L.cells);
    if (px) {
      lum = new Float32Array(cols * rows);
      for (let i = 0; i < lum.length; i++) {
        lum[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
      }
    }
  }
  const contrast = (c: number, r: number, w: number, h: number) => {
    let lo = 1, hi = 0;
    for (let y = r; y < r + h; y++) {
      for (let x = c; x < c + w; x++) {
        const v = lum![y * cols + x];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    return hi - lo;
  };

  const visit = (c: number, r: number, size: number) => {
    const w = Math.min(size, cols - c);
    const h = Math.min(size, rows - r);
    // a tile can't be split below one grid unit
    const wantSplit =
      size > 1 && (lum ? contrast(c, r, w, h) > s.detail : rand() < s.split);
    if (!wantSplit) {
      tiles.push({ c, r, w, h });
      return;
    }
    const half = size / 2;
    for (const [dc, dr] of [[0, 0], [half, 0], [0, half], [half, half]]) {
      if (c + dc < cols && r + dr < rows) visit(c + dc, r + dr, half);
    }
  };
  for (let r = 0; r < rows; r += top) for (let c = 0; c < cols; c += top) visit(c, r, top);

  // reading order, so order="linear" runs top-left → bottom-right whatever the sizes
  tiles.sort((a, b) => a.r - b.r || a.c - b.c);
  return tiles;
}

/** seeded order + skew-warped, step-quantised buckets over [0, duration] */
function schedule(n: number, s: Settings, rand: () => number, duration: number) {
  const order = Array.from({ length: n }, (_, i) => i);
  if (s.order !== "linear") {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  const K = Math.max(1, Math.round(s.steps));
  const buckets: number[][] = Array.from({ length: K }, () => []);
  order.forEach((idx, rank) => {
    buckets[Math.min(K - 1, Math.floor(Math.pow(rank / n, s.skew) * K))].push(idx);
  });
  return buckets
    .map((items, k) => ({ at: K === 1 ? 0 : (k / (K - 1)) * duration, items }))
    .filter((b) => b.items.length > 0);
}

function start(
  wrap: HTMLElement,
  glyphCanvas: HTMLCanvasElement,
  imgCanvas: HTMLCanvasElement,
  img: HTMLImageElement,
  L: Layout,
  s: Settings,
  onDone: () => void,
) {
  const gctx = glyphCanvas.getContext("2d")!;
  const ictx = imgCanvas.getContext("2d")!;
  const { cells, glyphs, scale, ox, oy } = L;
  const useGlyphs = s.mode !== "pixels" && s.glyphCols > 0; // "pixels" = skip the glyph phase entirely
  const fallback = getComputedStyle(wrap).color || "#fff";
  const pool = CHARSETS[s.charset] ?? CHARSETS.symbols;
  const pick = () => pool[Math.floor(Math.random() * pool.length)];
  const underlay = s.glyphLayer === "underlay";
  const colors = useGlyphs && !underlay && s.tint ? sampleColors(img, L, glyphs) : null;

  if (underlay) {
    gctx.fillStyle = s.cover; // opaque: hides the underlay until its cells are uncovered
    gctx.fillRect(0, 0, L.W, L.H);
  } else gctx.clearRect(0, 0, L.W, L.H);
  paintGhost(ictx, img, L, s.ghost);

  // ── glyph layer ──────────────────────────────────────────────────────────
  const gn = glyphs.cols * glyphs.rows;
  const gch: string[] = new Array(gn);
  const visible: number[] = [];
  const fontPx = Math.max(6, Math.floor((glyphs.ys[1] - glyphs.ys[0]) * 0.62));

  const drawGlyph = (i: number) => {
    const c = i % glyphs.cols;
    const r = (i / glyphs.cols) | 0;
    const x = glyphs.xs[c], y = glyphs.ys[r];
    const w = glyphs.xs[c + 1] - x, h = glyphs.ys[r + 1] - y;
    gctx.clearRect(x, y, w, h); // symbol only — no tile behind it
    let fg = fallback;
    if (colors) {
      const k = i * 4;
      // lift toward white so dark areas still read as symbols
      fg = `rgb(${Math.min(255, colors[k] + 70)},${Math.min(255, colors[k + 1] + 70)},${Math.min(255, colors[k + 2] + 70)})`;
    }
    gctx.fillStyle = fg;
    gctx.font = `${fontPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    gctx.textAlign = "center";
    gctx.textBaseline = "middle";
    gctx.fillText(gch[i], x + w / 2, y + h / 2 + h * 0.04, w);
  };

  // ── image layer ──────────────────────────────────────────────────────────
  const tiles = buildTiles(img, L, s);
  const drawCell = (i: number) => {
    const t = tiles[i];
    const x = cells.xs[t.c], y = cells.ys[t.r];
    const w = cells.xs[t.c + t.w] - x, h = cells.ys[t.r + t.h] - y;
    ictx.clearRect(x, y, w, h);
    ictx.drawImage(img, (x - ox) / scale, (y - oy) / scale, w / scale, h / scale, x, y, w, h);
  };

  // ── timeline: [glyph field fills] → hold → [cells land] ──────────────────
  const rand = mulberry32(s.seed);
  const glyphSteps = useGlyphs ? schedule(gn, s, rand, s.glyphDuration) : [];
  const cellStart = useGlyphs ? s.glyphDuration + s.hold : 0;
  const cellSteps = schedule(tiles.length, s, rand, s.duration).map((b) => ({
    ...b,
    at: b.at + cellStart,
  }));

  const t0 = performance.now();
  let gNext = 0;
  let cNext = 0;
  let swapAt = s.cycle;
  let raf = 0;

  const tick = (now: number) => {
    const t = now - t0;

    while (gNext < glyphSteps.length && glyphSteps[gNext].at <= t) {
      for (const i of glyphSteps[gNext].items) {
        if (underlay) {
          // uncover this cell: the underlay shows through
          const c = i % glyphs.cols;
          const r = (i / glyphs.cols) | 0;
          gctx.clearRect(glyphs.xs[c], glyphs.ys[r], glyphs.xs[c + 1] - glyphs.xs[c], glyphs.ys[r + 1] - glyphs.ys[r]);
          continue;
        }
        gch[i] = pick();
        visible.push(i);
        drawGlyph(i);
      }
      gNext++;
    }

    if (!underlay && s.cycle > 0 && t >= swapAt && visible.length) {
      for (const i of visible) {
        if (Math.random() < SWAP_FRACTION) {
          gch[i] = pick();
          drawGlyph(i);
        }
      }
      swapAt = t + s.cycle;
    }

    while (cNext < cellSteps.length && cellSteps[cNext].at <= t) {
      for (const i of cellSteps[cNext].items) drawCell(i);
      cNext++;
    }

    if (cNext < cellSteps.length || gNext < glyphSteps.length) {
      raf = requestAnimationFrame(tick);
    } else {
      gctx.clearRect(0, 0, L.W, L.H); // fully covered now — free the layer
      onDone();
    }
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

const layer: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "block",
  width: "100%",
  height: "100%",
};

export default function RevealImage({
  src,
  alt = "",
  className,
  style,
  trigger = "load",
  replayKey,
  onDone,
  children,
  ...overrides
}: RevealImageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const underlayRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  const cfgKey = JSON.stringify({ ...DEFAULTS, ...overrides });

  useEffect(() => {
    const wrap = wrapRef.current;
    const gc = glyphRef.current;
    const ic = imgRef.current;
    if (!wrap || !gc || !ic) return;
    const s = JSON.parse(cfgKey) as Settings;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cancelled = false;
    let stop = () => {};
    let io: IntersectionObserver | undefined;
    let ro: ResizeObserver | undefined;
    let phase: "waiting" | "running" | "done" = "waiting";
    const img = new Image();
    img.crossOrigin = "anonymous";

    const layout = () => makeLayout(wrap, [gc, ic], img, s);

    const begin = () => {
      stop();
      const L = layout();
      if (!L) return;
      if (reduce) {
        paintGhost(ic.getContext("2d")!, img, L, 1);
        phase = "done";
        onDoneRef.current?.();
        return;
      }
      phase = "running";
      stop = start(wrap, gc, ic, img, L, s, () => {
        phase = "done";
        onDoneRef.current?.();
      });
      // the cover is painted synchronously inside start(), so it's now safe to show the underlay
      if (underlayRef.current) underlayRef.current.style.visibility = "visible";
    };

    const ready = () => {
      if (cancelled) return;
      if (trigger === "inView") {
        const L = layout();
        if (L) paintGhost(ic.getContext("2d")!, img, L, s.ghost);
        io = new IntersectionObserver(
          ([e]) => {
            if (e.isIntersecting) {
              io?.disconnect();
              begin();
            }
          },
          { threshold: 0.3 },
        );
        io.observe(wrap);
      } else begin();

      // resizing changes both grids: restart if still animating, otherwise repaint the finished image
      const r0 = wrap.getBoundingClientRect();
      let lastW = r0.width;
      let lastH = r0.height;
      ro = new ResizeObserver(() => {
        const r = wrap.getBoundingClientRect();
        if (Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 1) return;
        lastW = r.width;
        lastH = r.height;
        if (phase === "running") begin();
        else {
          stop();
          const L = layout();
          if (L) paintGhost(ic.getContext("2d")!, img, L, phase === "done" ? 1 : s.ghost);
        }
      });
      ro.observe(wrap);
    };

    img.onload = ready;
    img.src = src;

    return () => {
      cancelled = true;
      io?.disconnect();
      ro?.disconnect();
      stop();
    };
  }, [src, cfgKey, trigger, replayKey]);

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={alt}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
    >
      {children !== undefined && (
        // hidden until the cover has been painted, so it never flashes before the reveal starts
        <div ref={underlayRef} aria-hidden style={{ ...layer, visibility: "hidden" }}>
          {children}
        </div>
      )}
      <canvas ref={glyphRef} aria-hidden style={layer} />
      <canvas ref={imgRef} aria-hidden style={layer} />
    </div>
  );
}
