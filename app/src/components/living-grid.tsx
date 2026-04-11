"use client";

import { useEffect, useRef } from "react";
import type p5Type from "p5";
import { seedFromDOB } from "@/lib/noise-seed";

export interface LivingGridProps {
  presentWeekIndex: number;
  totalWeeks: number;
  lifeProgress: number;
  birthdate: string;
  regionId: string;
}

// Colors
const COLOR_PAST = [120, 113, 108]; // stone #78716c
const COLOR_PAST_WARM = [139, 115, 85]; // warm stone #8b7355
const COLOR_PRESENT = [245, 158, 11]; // amber #f59e0b
const COLOR_FUTURE = [68, 64, 60]; // dark stone #44403c
const COLS = 52;

function breathingPeriod(): number {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  // Cosine curve: fastest at 9am (2.5s), slowest at 9pm (4s)
  const t = ((hour - 9) / 24) * Math.PI * 2;
  return 3.25 + 0.75 * Math.cos(t);
}

function transitionAmplitude(distance: number): number {
  if (distance === 0) return 1.0;
  if (distance === 1) return 0.5;
  if (distance === 2) return 0.25;
  return 0;
}

export default function LivingGrid({
  presentWeekIndex,
  totalWeeks,
  lifeProgress,
  birthdate,
  regionId,
}: LivingGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ presentWeekIndex, totalWeeks, lifeProgress, birthdate, regionId });
  propsRef.current = { presentWeekIndex, totalWeeks, lifeProgress, birthdate, regionId };

  // Hold-to-fast-forward state
  const holdRef = useRef({
    active: false,
    timeOffset: 0, // in weeks
    easeStart: 0,
    easeFrom: 0,
    easing: false,
  });

  // Reduced motion preference
  const reducedMotionRef = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let p5Instance: p5Type | null = null;

    // Dynamic import to avoid SSR issues
    import("p5").then((mod) => {
      const p5 = mod.default;
      if (!containerRef.current) return;

      const noiseCache = new Float32Array(propsRef.current.totalWeeks);
      const noiseCachePrev = new Float32Array(propsRef.current.totalWeeks);
      let frameSinceNoiseUpdate = 0;
      const NOISE_UPDATE_INTERVAL = 3;

      p5Instance = new p5((p: p5Type) => {
        let dotSize = 0;
        let gap = 0;

        function calcLayout() {
          const containerWidth = containerRef.current?.clientWidth ?? 600;
          const totalGapWidth = (COLS - 1) * 1; // min 1px gap
          dotSize = Math.max(2, Math.floor((containerWidth - totalGapWidth) / COLS));
          gap = Math.max(1, Math.floor(dotSize * 0.15));
          const rows = Math.ceil(propsRef.current.totalWeeks / COLS);
          const w = COLS * dotSize + (COLS - 1) * gap;
          const h = rows * dotSize + (rows - 1) * gap;
          return { w, h, rows };
        }

        p.setup = () => {
          const { w, h } = calcLayout();
          const canvas = p.createCanvas(w, h);
          canvas.style("display", "block");
          p.noStroke();
          p.noiseSeed(seedFromDOB(propsRef.current.birthdate, propsRef.current.regionId));
          p.frameRate(30);
        };

        p.draw = () => {
          const props = propsRef.current;
          const hold = holdRef.current;
          const reduced = reducedMotionRef.current;

          // Update hold-to-fast-forward offset
          if (hold.active) {
            // ~1 year per second = 52 weeks/sec, at 30fps = ~1.73 weeks/frame
            hold.timeOffset = Math.min(
              hold.timeOffset + 52 / 30,
              props.totalWeeks - props.presentWeekIndex
            );
          } else if (hold.easing) {
            const elapsed = Date.now() - hold.easeStart;
            const t = Math.min(1, elapsed / 800);
            // ease-out: 1 - (1-t)^3
            const eased = 1 - Math.pow(1 - t, 3);
            hold.timeOffset = hold.easeFrom * (1 - eased);
            if (t >= 1) {
              hold.timeOffset = 0;
              hold.easing = false;
            }
          }

          const virtualPresent = Math.floor(props.presentWeekIndex + hold.timeOffset);
          const period = breathingPeriod();
          const time = p.millis() / 1000;

          // Update noise cache every NOISE_UPDATE_INTERVAL frames (skip during hold on mobile)
          const skipNoise = hold.active && reduced;
          if (!skipNoise && !reduced) {
            frameSinceNoiseUpdate++;
            if (frameSinceNoiseUpdate >= NOISE_UPDATE_INTERVAL) {
              // Swap prev and current
              noiseCachePrev.set(noiseCache);
              for (let i = 0; i < props.totalWeeks; i++) {
                const col = i % COLS;
                const row = Math.floor(i / COLS);
                noiseCache[i] = p.noise(col * 0.1, row * 0.1, time * 0.3);
              }
              frameSinceNoiseUpdate = 0;
            }
          }

          // Lerp factor between cached frames
          const lerpT = reduced ? 0 : frameSinceNoiseUpdate / NOISE_UPDATE_INTERVAL;

          // Life progress color temperature
          const progress = props.lifeProgress;

          p.background(28, 25, 23); // #1c1917

          for (let i = 0; i < props.totalWeeks; i++) {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const x = col * (dotSize + gap);
            const y = row * (dotSize + gap);

            const dist = Math.abs(i - virtualPresent);
            const amp = transitionAmplitude(dist);

            if (i < virtualPresent) {
              // PAST: fossilized
              const r = COLOR_PAST[0] + (COLOR_PAST_WARM[0] - COLOR_PAST[0]) * progress;
              const g = COLOR_PAST[1] + (COLOR_PAST_WARM[1] - COLOR_PAST[1]) * progress;
              const b = COLOR_PAST[2] + (COLOR_PAST_WARM[2] - COLOR_PAST[2]) * progress;

              if (amp > 0 && !reduced) {
                const nVal = noiseCache[i] * lerpT + noiseCachePrev[i] * (1 - lerpT);
                const scale = 1 + (nVal - 0.5) * 0.3 * amp;
                const s = dotSize * scale;
                const offset = (dotSize - s) / 2;
                p.fill(r, g, b, 180 + 75 * amp);
                p.ellipse(x + offset + s / 2, y + offset + s / 2, s, s);
              } else {
                p.fill(r, g, b, 153); // 0.6 opacity
                p.ellipse(x + dotSize / 2, y + dotSize / 2, dotSize, dotSize);
              }
            } else if (i === virtualPresent || amp > 0) {
              // PRESENT: breathing
              if (reduced) {
                p.fill(COLOR_PRESENT[0], COLOR_PRESENT[1], COLOR_PRESENT[2], 255);
                p.ellipse(x + dotSize / 2, y + dotSize / 2, dotSize, dotSize);
              } else {
                const nVal = noiseCache[i] * lerpT + noiseCachePrev[i] * (1 - lerpT);
                const breathPhase = Math.sin((time / period) * Math.PI * 2 + nVal * Math.PI);
                const scale = 0.7 + 0.4 * breathPhase * amp;
                const opacity = (0.5 + 0.5 * breathPhase * amp) * 255;
                const s = dotSize * scale;
                const offset = (dotSize - s) / 2;
                p.fill(COLOR_PRESENT[0], COLOR_PRESENT[1], COLOR_PRESENT[2], opacity);
                p.ellipse(x + offset + s / 2, y + offset + s / 2, s, s);
              }
            } else {
              // FUTURE: latent
              if (reduced) {
                p.fill(COLOR_FUTURE[0], COLOR_FUTURE[1], COLOR_FUTURE[2], 38); // 15%
                p.ellipse(x + dotSize / 2, y + dotSize / 2, dotSize, dotSize);
              } else {
                // Skip noise for dots beyond year 60 on all devices (optimization)
                const yearIndex = row;
                const nVal =
                  yearIndex < 60
                    ? noiseCache[i] * lerpT + noiseCachePrev[i] * (1 - lerpT)
                    : 0.5;
                const opacity = (0.1 + 0.15 * (nVal - 0.3)) * 255;
                p.fill(COLOR_FUTURE[0], COLOR_FUTURE[1], COLOR_FUTURE[2], opacity);
                p.ellipse(x + dotSize / 2, y + dotSize / 2, dotSize, dotSize);
              }
            }
          }
        };

        // Hold-to-fast-forward: mouse/touch handlers
        p.mousePressed = () => {
          if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
            holdRef.current.active = true;
            holdRef.current.easing = false;
          }
        };
        p.mouseReleased = () => {
          if (holdRef.current.active) {
            holdRef.current.active = false;
            if (holdRef.current.timeOffset > 0) {
              holdRef.current.easing = true;
              holdRef.current.easeStart = Date.now();
              holdRef.current.easeFrom = holdRef.current.timeOffset;
            }
          }
        };
        // Touch handlers via canvas element directly (p5 types don't expose these)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const canvasEl = (p as any).canvas as HTMLCanvasElement;
        canvasEl.addEventListener("touchstart", (e) => {
          holdRef.current.active = true;
          holdRef.current.easing = false;
          e.preventDefault();
        }, { passive: false });
        canvasEl.addEventListener("touchend", () => {
          if (holdRef.current.active) {
            holdRef.current.active = false;
            if (holdRef.current.timeOffset > 0) {
              holdRef.current.easing = true;
              holdRef.current.easeStart = Date.now();
              holdRef.current.easeFrom = holdRef.current.timeOffset;
            }
          }
        });

        // Resize handler (debounced)
        let resizeTimer: ReturnType<typeof setTimeout> | null = null;
        p.windowResized = () => {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            const { w, h } = calcLayout();
            p.resizeCanvas(w, h);
          }, 150);
        };
      }, containerRef.current);
    });

    return () => {
      if (p5Instance) {
        p5Instance.remove();
        p5Instance = null;
      }
    };
  }, [birthdate, regionId]); // Only recreate sketch when seed-affecting props change

  return (
    <div className="mt-12">
      <div ref={containerRef} className="w-full" />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-4 text-[10px] text-stone-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-stone-500 opacity-60" />
            Past
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Now
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-stone-700 opacity-30" />
            Future
          </span>
        </div>
        <span className="text-[10px] text-stone-500">hold to fast-forward</span>
      </div>
    </div>
  );
}
