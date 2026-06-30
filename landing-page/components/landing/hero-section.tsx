"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { FluxTimeline } from "./flux-timeline";

const actionWords = ["Nowcasting", "Forecasting"];
const instruments = ["Aditya-L1", "SoLEXS", "HEL1OS"];

function BlurWord({ word, trigger }: { word: string; trigger: number }) {
  const letters = word.split("");
  const STAGGER = 45;      // ms between each letter
  const DURATION = 500;    // blur+opacity fade duration per letter
  const GRADIENT_HOLD = STAGGER * letters.length + DURATION + 200;

  const [letterStates, setLetterStates] = useState<{ opacity: number; blur: number }[]>(
    letters.map(() => ({ opacity: 0, blur: 20 }))
  );
  const [showGradient, setShowGradient] = useState(true);
  const framesRef = useRef<number[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // reset
    framesRef.current.forEach(cancelAnimationFrame);
    timersRef.current.forEach(clearTimeout);
    framesRef.current = [];
    timersRef.current = [];

    setLetterStates(letters.map(() => ({ opacity: 0, blur: 20 })));
    setShowGradient(true);

    // stagger each letter
    letters.forEach((_, i) => {
      const t = setTimeout(() => {
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / DURATION, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setLetterStates(prev => {
            const next = [...prev];
            next[i] = { opacity: eased, blur: 20 * (1 - eased) };
            return next;
          });
          if (progress < 1) {
            const id = requestAnimationFrame(tick);
            framesRef.current.push(id);
          }
        };
        const id = requestAnimationFrame(tick);
        framesRef.current.push(id);
      }, i * STAGGER);
      timersRef.current.push(t);
    });

    // remove gradient once all letters are settled
    const gt = setTimeout(() => setShowGradient(false), GRADIENT_HOLD);
    timersRef.current.push(gt);

    return () => {
      framesRef.current.forEach(cancelAnimationFrame);
      timersRef.current.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  // gradient colours cycling across letter positions
  const gradientColors = ["#FF5C28", "#FFB627", "#5EE6D0", "#FF5C28"];

  return (
    <>
      {letters.map((char, i) => {
        const colorIndex = (i / Math.max(letters.length - 1, 1)) * (gradientColors.length - 1);
        const lower = Math.floor(colorIndex);
        const upper = Math.min(lower + 1, gradientColors.length - 1);
        const t = colorIndex - lower;

        // lerp hex colours
        const hex2rgb = (hex: string) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return [r, g, b];
        };
        const [r1, g1, b1] = hex2rgb(gradientColors[lower]);
        const [r2, g2, b2] = hex2rgb(gradientColors[upper]);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: letterStates[i]?.opacity ?? 0,
              filter: `blur(${letterStates[i]?.blur ?? 20}px)`,
              color: showGradient ? `rgb(${r},${g},${b})` : "white",
              transition: "color 0.4s ease",
            }}
          >
            {char}
          </span>
        );
      })}
    </>
  );
}

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [videoOpacity, setVideoOpacity] = useState(0); // Start at 0 to avoid flashing the video start
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % 6);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let rafId: number;
    let isSeeking = false;
    let initialSeekDone = false;

    // Set initial start time when metadata is loaded
    const handleLoadedMetadata = () => {
      if (!initialSeekDone) {
        video.currentTime = 23.5;
      }
    };

    if (video.readyState >= 1) {
      video.currentTime = 23.5;
    } else {
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
    }

    const checkTime = () => {
      if (!video) return;
      const time = video.currentTime;

      // Start fading out 0.5 seconds before loop point (at 31.0s)
      if (time >= 31.0 && time < 31.5) {
        setVideoOpacity(0);
      }
      
      // Loop back if we reach or exceed the limit
      if (time >= 31.5 && !isSeeking) {
        isSeeking = true;
        setVideoOpacity(0);
        video.currentTime = 23.5;
        // Call play in case seeking paused it
        video.play().catch(() => {});
      }

      rafId = requestAnimationFrame(checkTime);
    };

    const handleSeeked = () => {
      isSeeking = false;
      initialSeekDone = true;
      // Seek complete, fade back in
      setVideoOpacity(0.8);
    };

    video.addEventListener("seeked", handleSeeked);
    
    // Start RAF loop
    rafId = requestAnimationFrame(checkTime);

    // Make sure it starts playing
    video.play().catch(() => {});

    return () => {
      cancelAnimationFrame(rafId);
      if (video) {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("seeked", handleSeeked);
      }
    };
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center items-start overflow-hidden bg-black">
      {/* Background video */}
      <div className="absolute inset-0 z-0">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          className="w-full h-full object-cover object-center transition-opacity duration-500 ease-in-out"
          style={{ opacity: videoOpacity }}
        >
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>
        {/* Subtle overlay to ensure text readability on the left */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
      </div>

      {/* Subtle grid lines */}
      <div className="absolute inset-0 z-[2] overflow-hidden pointer-events-none opacity-20">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-white/10"
            style={{
              top: `${12.5 * (i + 1)}%`,
              left: 0,
              right: 0,
            }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-white/10"
            style={{
              left: `${8.33 * (i + 1)}%`,
              top: 0,
              bottom: 0,
            }}
          />
        ))}
      </div>
      
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            {/* Small Label Text */}
            <div 
              className={`mb-4 transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <span className="inline-flex items-center gap-3 text-sm font-mono text-white/60">
                <span className="w-8 h-px bg-white/30" />
                BAH 2026 · Problem Statement 15 · Team IRIS X
              </span>
            </div>

            {/* Tagline */}
            <div 
              className={`mb-8 transition-all duration-700 delay-75 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#FF5C28] pl-11">
                Solar Flare Intelligence from Aditya-L1
              </span>
            </div>
            
            {/* Main headline */}
            <div className="mb-8">
              <h1 
                className={`text-left text-[clamp(2rem,4vw,5rem)] font-display leading-[0.95] tracking-tight text-white transition-all duration-1000 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              >
                <span className="block">
                  <span className="relative inline-block text-[#FF5C28]">
                    <BlurWord word={actionWords[Math.floor(wordIndex / 3)]} trigger={Math.floor(wordIndex / 3)} />
                  </span>{" "}
                  Solar Flares
                </span>
                <span className="block">
                  with{" "}
                  <span className="relative inline-block text-[#FF5C28]">
                    <BlurWord word={instruments[wordIndex % 3]} trigger={wordIndex} />
                  </span>
                </span>
              </h1>
            </div>

            {/* Subheading */}
            <div 
              className={`mb-12 transition-all duration-700 delay-200 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <p className="text-xl text-white/70 leading-relaxed max-w-xl pl-1">
                A real-time ML pipeline using SoLEXS and HEL1OS instrument data from Aditya-L1 to detect, classify, and forecast solar flare events.
              </p>
            </div>

            {/* CTA Button */}
            <div 
              className={`transition-all duration-700 delay-300 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <Button
                asChild
                size="lg"
                className="bg-[#FF5C28] hover:bg-[#FF5C28]/90 text-white px-8 h-14 text-base rounded-full font-medium transition-all flex items-center gap-2 group border-none"
              >
                <a href="#how-it-works">
                  Explore Pipeline
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
            </div>
          </div>
          <div 
            className={`lg:col-span-5 w-full transition-all duration-1000 delay-300 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <FluxTimeline />
          </div>
        </div>
      </div>
      
      {/* Stats — 3 metrics static, no auto-scroll */}
      <div 
        className={`absolute bottom-12 left-0 right-0 px-6 lg:px-12 transition-all duration-700 delay-500 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="max-w-[1400px] mx-auto flex items-start gap-10 lg:gap-20">
          {[
            { value: "Aditya-L1", label: "satellite data" },
            { value: "SoLEXS · HEL1OS", label: "instruments" },
            { value: "1M+", label: "rows (July 2024–2026)" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-2">
              <span className="text-3xl lg:text-4xl font-display text-white">{stat.value}</span>
              <span className="text-xs text-white/50 leading-tight">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}

    </section>
  );
}
