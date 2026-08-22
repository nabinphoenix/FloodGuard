import { useMemo } from "react";
import "./WaterfallRain.css";

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Animated waterfall + rain decorative background layer.
 * Pure CSS animation (transform/opacity only) — safe to drop behind any
 * hero or section. Absolutely positioned, pointer-events: none.
 *
 * Props:
 *  - waterfallBackCount / waterfallMiddleCount / waterfallFrontCount:
 *      number of streaks per depth layer (default 10 / 14 / 10)
 *  - rainCount: number of rain drops (default 70)
 *  - cascadeSpread: percent width the waterfall streaks occupy, centered
 *      (default 100 = full width; use e.g. 40 for a narrower column)
 *  - showRain / showWaterfall / showSplash / showMist: toggle layers
 */
export default function WaterfallRain({
  waterfallBackCount = 10,
  waterfallMiddleCount = 14,
  waterfallFrontCount = 10,
  rainCount = 70,
  cascadeSpread = 100,
  showRain = true,
  showWaterfall = true,
  showSplash = true,
  showMist = true,
  className = "",
}) {
  // Waterfall streaks: 3 depth layers, tall self-relative % height so a
  // single translateY sweep crosses the whole container.
  const makeLayer = (count, opts) =>
    Array.from({ length: count }, (_, i) => {
      const leftPct = 50 - cascadeSpread / 2 + rand(0, cascadeSpread);
      return {
        id: `${opts.key}-${i}`,
        left: leftPct,
        width: rand(opts.width[0], opts.width[1]),
        height: rand(opts.height[0], opts.height[1]),
        duration: rand(opts.duration[0], opts.duration[1]),
        delay: rand(-opts.duration[1], 0),
        opacity: rand(opts.opacity[0], opts.opacity[1]),
        blur: opts.blur,
      };
    });

  const backStreaks = useMemo(
    () =>
      makeLayer(waterfallBackCount, {
        key: "back",
        width: [6, 10],
        height: [70, 95],
        duration: [1.0, 1.2],
        opacity: [0.22, 0.32],
        blur: 1.0,
      }),
    [waterfallBackCount, cascadeSpread]
  );

  const middleStreaks = useMemo(
    () =>
      makeLayer(waterfallMiddleCount, {
        key: "mid",
        width: [3, 6],
        height: [75, 100],
        duration: [0.8, 1.0],
        opacity: [0.32, 0.48],
        blur: 0.7,
      }),
    [waterfallMiddleCount, cascadeSpread]
  );

  const frontStreaks = useMemo(
    () =>
      makeLayer(waterfallFrontCount, {
        key: "front",
        width: [2, 4],
        height: [80, 100],
        duration: [0.6, 0.8],
        opacity: [0.48, 0.65],
        blur: 0.5,
      }),
    [waterfallFrontCount, cascadeSpread]
  );

  // Rain: thin, fast, full-width, slight wind tilt, viewport-height sweep
  // so short drops still fully traverse the container.
  const raindrops = useMemo(
    () =>
      Array.from({ length: rainCount }, (_, i) => ({
        id: `rain-${i}`,
        left: rand(0, 100),
        width: rand(1.5, 2.5),
        height: rand(40, 90),
        duration: rand(0.4, 0.9),
        delay: rand(-0.9, 0),
        opacity: rand(0.25, 0.55),
        tilt: rand(6, 14),
        drift: rand(15, 40),
      })),
    [rainCount]
  );

  const ripples = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: `ripple-${i}`,
        left: 50 - cascadeSpread / 2 + rand(0, cascadeSpread),
        size: rand(60, 140),
        duration: rand(2.2, 3.2),
        delay: rand(0, 3),
      })),
    [cascadeSpread]
  );

  return (
    <div className={`wr-container ${className}`} aria-hidden="true">
      {showMist && (
        <div className="wr-mist" style={{ left: `${50}%` }} />
      )}

      {showRain && (
        <div className="wr-layer wr-rain">
          {raindrops.map((d) => (
            <span
              key={d.id}
              className="wr-raindrop"
              style={{
                "--left": `${d.left}%`,
                "--w": `${d.width}px`,
                "--h": `${d.height}px`,
                "--duration": `${d.duration}s`,
                "--delay": `${d.delay}s`,
                "--opacity": d.opacity,
                "--tilt": `${d.tilt}deg`,
                "--drift": `${d.drift}px`,
              }}
            />
          ))}
        </div>
      )}

      {showWaterfall && (
        <>
          <div className="wr-layer wr-streaks wr-back">
            {backStreaks.map((s) => (
              <span
                key={s.id}
                className="wr-streak"
                style={{
                  "--left": `${s.left}%`,
                  "--w": `${s.width}px`,
                  "--h": `${s.height}%`,
                  "--duration": `${s.duration}s`,
                  "--delay": `${s.delay}s`,
                  "--opacity": s.opacity,
                  "--blur": `${s.blur}px`,
                }}
              />
            ))}
          </div>
          <div className="wr-layer wr-streaks wr-middle">
            {middleStreaks.map((s) => (
              <span
                key={s.id}
                className="wr-streak"
                style={{
                  "--left": `${s.left}%`,
                  "--w": `${s.width}px`,
                  "--h": `${s.height}%`,
                  "--duration": `${s.duration}s`,
                  "--delay": `${s.delay}s`,
                  "--opacity": s.opacity,
                  "--blur": `${s.blur}px`,
                }}
              />
            ))}
          </div>
          <div className="wr-layer wr-streaks wr-front">
            {frontStreaks.map((s) => (
              <span
                key={s.id}
                className="wr-streak"
                style={{
                  "--left": `${s.left}%`,
                  "--w": `${s.width}px`,
                  "--h": `${s.height}%`,
                  "--duration": `${s.duration}s`,
                  "--delay": `${s.delay}s`,
                  "--opacity": s.opacity,
                  "--blur": `${s.blur}px`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {showSplash && (
        <div className="wr-splash-zone">
          {ripples.map((r) => (
            <span
              key={r.id}
              className="wr-ripple"
              style={{
                "--left": `${r.left}%`,
                "--size": `${r.size}px`,
                "--duration": `${r.duration}s`,
                "--delay": `${r.delay}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}