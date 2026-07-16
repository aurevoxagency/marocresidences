import { useEffect, useState, type ReactNode } from "react";

import logo from "@/assets/header-maroc-residences-removebg-preview.png";
import loaderVideo from "@/assets/15296840_1920_1080_30fps.mp4";

const STAGES = [
  { progress: 0, label: "Préparation de votre séjour" },
  { progress: 25, label: "Chargement des destinations" },
  { progress: 50, label: "Ouverture des maisons d'hôtes" },
  { progress: 100, label: "Bienvenue chez Maroc Résidences" },
] as const;

const STAGE_DELAYS = [0, 750, 1600, 2550] as const;
const EXIT_DELAY_MS = 1000;

export function AppSplashLoader({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState<string>(STAGES[0].label);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const timers = STAGES.map((stage, index) =>
      window.setTimeout(() => {
        setProgress(stage.progress);
        setLabel(stage.label);
      }, STAGE_DELAYS[index]),
    );

    const lastDelay = STAGE_DELAYS[STAGE_DELAYS.length - 1];
    const exitTimer = window.setTimeout(() => setExiting(true), lastDelay + 500);
    const hideTimer = window.setTimeout(() => setVisible(false), lastDelay + 500 + EXIT_DELAY_MS);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [visible]);

  const ringSize = 128;
  const stroke = 3;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ringOffset = circumference - (progress / 100) * circumference;

  return (
    <>
      {children}
      {visible && (
        <div
          className="fixed inset-0 z-[9999] overflow-hidden"
          style={{
            opacity: exiting ? 0 : 1,
            transform: exiting ? "scale(1.04)" : "scale(1)",
            filter: exiting ? "blur(6px)" : "blur(0)",
            transition: `opacity ${EXIT_DELAY_MS}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${EXIT_DELAY_MS}ms cubic-bezier(0.4, 0, 0.2, 1), filter ${EXIT_DELAY_MS}ms ease`,
            pointerEvents: exiting ? "none" : "auto",
          }}
          aria-busy="true"
          aria-live="polite"
          role="status"
        >
          <video
            className="absolute inset-0 h-full w-full scale-110 object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
            style={{ animation: "mr-splash-kenburns 18s ease-in-out infinite alternate" }}
          >
            <source src={loaderVideo} type="video/mp4" />
          </video>

          <div className="absolute inset-0 bg-black/40" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 45% at 50% 35%, rgba(180, 70, 50, 0.12), transparent 65%), radial-gradient(ellipse 50% 35% at 85% 85%, rgba(212, 140, 50, 0.1), transparent 55%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />

          <div
            className="relative z-10 flex h-full flex-col items-center justify-center px-5"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 700ms ease, transform 700ms ease",
            }}
          >
            <div
              className="w-full max-w-[420px] rounded-[28px] border border-white/15 px-7 py-9 text-center shadow-[0_40px_100px_-40px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:px-10 sm:py-11"
              style={{
                background:
                  "linear-gradient(160deg, rgba(12,10,8,0.72) 0%, rgba(20,14,12,0.55) 100%)",
              }}
            >
              <div className="relative mx-auto mb-8 w-fit">
                <div
                  className="absolute -inset-8 rounded-full opacity-60 blur-3xl"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(200, 90, 55, 0.45), transparent 70%)",
                    animation: "mr-splash-pulse 2.6s ease-in-out infinite",
                  }}
                />
                <img
                  src={logo}
                  alt="Maroc Résidences"
                  className="relative mx-auto h-[68px] w-auto max-w-[min(78vw,320px)] object-contain sm:h-20"
                  style={{ animation: "mr-splash-float 3.4s ease-in-out infinite" }}
                />
              </div>

              <div className="relative mx-auto mb-7 grid place-items-center">
                <svg
                  width={ringSize}
                  height={ringSize}
                  className="-rotate-90"
                  aria-hidden
                >
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={stroke}
                  />
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    fill="none"
                    stroke="url(#mrSplashRing)"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={ringOffset}
                    style={{ transition: "stroke-dashoffset 750ms cubic-bezier(0.22, 1, 0.36, 1)" }}
                  />
                  <defs>
                    <linearGradient id="mrSplashRing" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#c45c38" />
                      <stop offset="55%" stopColor="#e0a060" />
                      <stop offset="100%" stopColor="#f5e6c8" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <div
                    key={progress}
                    className="text-center"
                    style={{ animation: "mr-splash-fade-up 360ms ease both" }}
                  >
                    <p className="font-serif text-4xl leading-none tabular-nums text-[#f7efe3] sm:text-5xl">
                      {progress}
                      <span className="ml-0.5 text-lg text-white/45">%</span>
                    </p>
                  </div>
                </div>
              </div>

              <p
                key={label}
                className="mx-auto mb-8 min-h-[2.5rem] max-w-[280px] text-sm leading-relaxed tracking-wide text-white/70 sm:text-[15px]"
                style={{ animation: "mr-splash-fade-up 420ms ease both" }}
              >
                {label}
              </p>

              <div className="relative mx-auto h-1 max-w-[280px] overflow-hidden rounded-full bg-white/12">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #b84a2e 0%, #d4924a 50%, #f0d9b0 100%)",
                    boxShadow: "0 0 16px rgba(212, 146, 74, 0.45)",
                    transition: "width 750ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 w-20 opacity-70"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                    animation: progress < 100 ? "mr-splash-shimmer 1.35s ease-in-out infinite" : "none",
                  }}
                />
              </div>

              <div className="mx-auto mt-5 flex max-w-[280px] justify-between">
                {STAGES.map((stage) => {
                  const active = progress >= stage.progress;
                  return (
                    <div key={stage.progress} className="flex flex-col items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full transition-all duration-500"
                        style={{
                          background: active ? "#e0a060" : "rgba(255,255,255,0.22)",
                          boxShadow: active ? "0 0 10px rgba(224, 160, 96, 0.7)" : "none",
                          transform: active ? "scale(1.4)" : "scale(1)",
                        }}
                      />
                      <span
                        className="text-[10px] tabular-nums tracking-wider transition-colors duration-500"
                        style={{ color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.32)" }}
                      >
                        {stage.progress}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p
              className="mt-7 text-[11px] font-medium uppercase tracking-[0.28em] text-white/40"
              style={{ animation: "mr-splash-fade-up 900ms ease both" }}
            >
              Vos vacances au Maroc
            </p>
          </div>

          <style>{`
            @keyframes mr-splash-pulse {
              0%, 100% { opacity: 0.35; transform: scale(0.9); }
              50% { opacity: 0.7; transform: scale(1.1); }
            }
            @keyframes mr-splash-float {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-7px); }
            }
            @keyframes mr-splash-fade-up {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes mr-splash-shimmer {
              0% { transform: translateX(-140%); }
              100% { transform: translateX(480%); }
            }
            @keyframes mr-splash-kenburns {
              from { transform: scale(1.08) translate(0, 0); }
              to { transform: scale(1.16) translate(-1.5%, -1%); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
