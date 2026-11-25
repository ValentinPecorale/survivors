"use client";

/**
 * RevealText — instant random-block text reveal with an ASCII phase.
 *
 *   hidden  →  random symbol  →  real character
 *
 * Self-contained: only depends on React 19 (uses <style precedence> for
 * de-duplicated CSS; on React 18 swap it for a plain <style>).
 * Layout never moves: every real character keeps its box the whole time.
 *
 * Usage:
 *   <RevealText text="Your copy here" className="text-5xl" />
 *   <RevealText text="..." trigger="inView" unit="char" steps={30} />
 */

import { Fragment, useEffect, useRef, type CSSProperties, type ElementType } from "react";

export type Unit = "word" | "block" | "char";

export const CHARSETS = {
  symbols: "!<>-_\\/[]{}=+*^?#%&@$~|:;",
  binary: "01",
  blocks: "█▓▒░▌▐▄▀■",
  lines: "|/\\-_=+",
} as const;

export type Settings = {
  unit: Unit;
  /** ms from first step to last step */
  duration: number;
  /** discrete frames the reveal snaps to. 1 = all at once */
  steps: number;
  /** >1 most units land early · <1 most land late */
  skew: number;
  /** consecutive words per block (unit = "block") */
  blockMin: number;
  blockMax: number;
  /** same seed = same reveal order */
  seed: number;
  /** ms spent as a random symbol. 0 = skip the ASCII phase */
  scramble: number;
  /** ms between symbol swaps. 0 = one frozen symbol */
  cycle: number;
  charset: keyof typeof CHARSETS;
  /** opacity of not-yet-revealed text (0–1) */
  ghost: number;
};

/*DEFAULTS*/
const DEFAULTS: Settings = {
  unit: "word",
  duration: 900,
  steps: 24,
  skew: 1,
  blockMin: 2,
  blockMax: 5,
  seed: 7,
  scramble: 0,
  cycle: 45,
  charset: "symbols",
  ghost: 0,
};
/*END DEFAULTS*/

/** each char's scramble end is jittered by up to this fraction so units don't settle in lockstep */
const SCRAMBLE_JITTER = 0.35;

export type RevealTextProps = Partial<Settings> & {
  text: string;
  className?: string;
  style?: CSSProperties;
  /** element to render. default "p" */
  as?: ElementType;
  /** "load" starts on mount · "inView" starts when 30% visible (inside a page card: once the card has fully slid in) */
  trigger?: "load" | "inView";
  /** change this value to replay */
  replayKey?: string | number;
  onDone?: () => void;
};

const CSS = `
.rt [data-c]>.rt-r{opacity:var(--rt-ghost,0)}
.rt [data-c][data-s]>.rt-r{opacity:0}
.rt [data-c][data-on]>.rt-r{opacity:1}
.rt [data-c][data-s]{position:relative}
.rt [data-c][data-s]::after{content:attr(data-g);position:absolute;inset:0;text-align:center;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;opacity:.75}
.rt .rt-w{white-space:nowrap}
`;

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

function hashText(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function buildSteps(root: HTMLElement, s: Settings) {
  const rand = mulberry32(s.seed);
  const words = Array.from(root.querySelectorAll<HTMLElement>("[data-w]")).map((w) =>
    Array.from(w.querySelectorAll<HTMLElement>("[data-c]")),
  );

  let units: HTMLElement[][];
  if (s.unit === "char") units = words.flat().map((c) => [c]);
  else if (s.unit === "word") units = words;
  else {
    units = [];
    const lo = Math.max(1, Math.min(s.blockMin, s.blockMax));
    const hi = Math.max(lo, s.blockMax);
    for (let i = 0; i < words.length; ) {
      const size = lo + Math.floor(rand() * (hi - lo + 1));
      units.push(words.slice(i, i + size).flat());
      i += size;
    }
  }

  for (let i = units.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [units[i], units[j]] = [units[j], units[i]];
  }

  const n = units.length;
  const K = Math.max(1, Math.round(s.steps));
  const buckets: HTMLElement[][] = Array.from({ length: K }, () => []);
  units.forEach((u, rank) => {
    const k = Math.min(K - 1, Math.floor(Math.pow(rank / n, s.skew) * K));
    buckets[k].push(...u);
  });

  return buckets
    .map((chars, k) => ({ at: K === 1 ? 0 : (k / (K - 1)) * s.duration, chars }))
    .filter((b) => b.chars.length > 0);
}

function run(root: HTMLElement, s: Settings, onDone?: () => void) {
  const chars = Array.from(root.querySelectorAll<HTMLElement>("[data-c]"));
  chars.forEach((c) => {
    c.removeAttribute("data-on");
    c.removeAttribute("data-s");
    c.removeAttribute("data-g");
  });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    chars.forEach((c) => c.setAttribute("data-on", ""));
    onDone?.();
    return () => {};
  }

  const steps = buildSteps(root, s);
  const pool = CHARSETS[s.charset] ?? CHARSETS.symbols;
  const glyph = () => pool[Math.floor(Math.random() * pool.length)];
  const live: { el: HTMLElement; end: number; swap: number }[] = [];
  const start = performance.now();
  let next = 0;
  let raf = 0;

  const tick = (now: number) => {
    const t = now - start;

    while (next < steps.length && steps[next].at <= t) {
      for (const c of steps[next].chars) {
        if (s.scramble <= 0) {
          c.setAttribute("data-on", "");
        } else {
          c.setAttribute("data-s", "");
          c.setAttribute("data-g", glyph());
          live.push({
            el: c,
            end: t + s.scramble * (1 - SCRAMBLE_JITTER * Math.random()),
            swap: t + s.cycle,
          });
        }
      }
      next++;
    }

    for (let i = live.length - 1; i >= 0; i--) {
      const l = live[i];
      if (t >= l.end) {
        l.el.removeAttribute("data-s");
        l.el.removeAttribute("data-g");
        l.el.setAttribute("data-on", "");
        live.splice(i, 1);
      } else if (s.cycle > 0 && t >= l.swap) {
        l.el.setAttribute("data-g", glyph());
        l.swap = t + s.cycle;
      }
    }

    if (next < steps.length || live.length > 0) raf = requestAnimationFrame(tick);
    else onDone?.();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export default function RevealText({
  text,
  className,
  style,
  as,
  trigger = "load",
  replayKey,
  onDone,
  ...overrides
}: RevealTextProps) {
  const Tag: ElementType = as ?? "p";
  const ref = useRef<HTMLElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Each text gets its own reveal order (seeded from its content) unless a seed is passed, so neighbours do not move in lockstep.
  const cfg: Settings = { ...DEFAULTS, seed: hashText(text), ...overrides };
  const cfgKey = JSON.stringify(cfg);
  // A newline in the text is a hard line break; everything else wraps naturally.
  const lines = text.split("\n").map((line) => line.split(/\s+/).filter(Boolean));

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const settings = JSON.parse(cfgKey) as Settings;
    let stop = () => {};
    const go = () => {
      stop = run(root, settings, () => onDoneRef.current?.());
    };

    if (trigger === "inView") {
      // Inside a stacked page card ("layer"): wait until the card has finished sliding in and fills the viewport,
      // then start once the text itself is on screen. A card still sliding up from below does not count.
      const card = root.closest<HTMLElement>(".site-card");
      let cardIo: IntersectionObserver | undefined;
      let io: IntersectionObserver | undefined;
      const watchText = () => {
        io = new IntersectionObserver(
          ([e]) => {
            if (e.isIntersecting) {
              io?.disconnect();
              go();
            }
          },
          { threshold: 0.3 },
        );
        io.observe(root);
      };
      if (card) {
        cardIo = new IntersectionObserver(
          ([e]) => {
            if (e.intersectionRatio >= 0.98) {
              cardIo?.disconnect();
              watchText();
            }
          },
          { threshold: [0, 0.5, 0.98, 1] },
        );
        cardIo.observe(card);
      } else watchText();
      return () => {
        cardIo?.disconnect();
        io?.disconnect();
        stop();
      };
    }
    go();
    return () => stop();
  }, [text, cfgKey, trigger, replayKey]);

  return (
    <>
      <style href="reveal-text" precedence="default">
        {CSS}
      </style>
      <Tag
        ref={ref}
        aria-label={text.replace(/\s*\n\s*/g, " ")}
        className={`rt${className ? " " + className : ""}`}
        style={{ ...style, ["--rt-ghost" as string]: cfg.ghost }}
      >
        {lines.map((words, l) => (
          <Fragment key={l}>
            {l > 0 ? <br /> : null}
            {words.map((w, i) => (
              <Fragment key={i}>
                {/* The space lives outside the nowrap word, otherwise the line can never break between words. */}
                {i > 0 ? " " : null}
                <span data-w aria-hidden className="rt-w">
                  {Array.from(w).map((ch, j) => (
                    <span key={j} data-c>
                      <span className="rt-r">{ch}</span>
                    </span>
                  ))}
                </span>
              </Fragment>
            ))}
          </Fragment>
        ))}
      </Tag>
    </>
  );
}
