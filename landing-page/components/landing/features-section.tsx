"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const features = [
  {
    number: "E1",
    title: "Signal Lead — ECE 1",
    description: "Manages raw FITS data ingestion from the PRADAN portal, soft/hard X-ray time-alignment, preprocessing (cadence resampling, background subtraction), and time-series feature extraction.",
    stats: { value: "Astropy", label: "telemetry pipeline" },
    image: "/images/role-e1.jpg",
    imageAlt: "Solar magnetic activity visualisation for Signal Lead",
    imageLeft: true,
  },
  {
    number: "E2",
    title: "Domain & Validation — ECE 2",
    description: "Processes historical GOES X-ray flux for validation, solves severe class imbalances using SMOTE, and implements space weather validation metrics like True Skill Statistic (TSS).",
    stats: { value: "TSS / HSS", label: "solar physics metrics" },
    image: "/images/role-e2.jpg",
    imageAlt: "Solar flare eruption illustrating domain validation context",
  },
  {
    number: "C1",
    title: "ML Lead — CSE 1",
    description: "Architects the core PyTorch LSTM model for short-term forecasting, designs the rule-based Nowcaster module, and implements dual-channel soft/hard X-ray fusion.",
    stats: { value: "PyTorch", label: "model training" },
    image: "/images/role-c1.jpg",
    imageAlt: "Solar sunspot active regions for ML Lead",
    imageLeft: true,
  },
  {
    number: "C2",
    title: "Dashboard & Integration — CSE 2",
    description: "Develops the Plotly Dash frontend showcasing real-time rolling flux plots, alarm triggers, satellite safety warnings, and integrates the complete end-to-end pipeline.",
    stats: { value: "Plotly Dash", label: "visual frontend" },
    image: "/images/role-c2.jpg",
    imageAlt: "Full sun ultraviolet image for Dashboard and Integration",
  },
];

// Floating dot particles visualization — smooth mouse repulsion
function ParticleVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: -9999, y: -9999 }); // off-screen default

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", () => {
      mouseRef.current = { x: -9999, y: -9999 };
    });

    const COUNT = 70;
    const REPEL_RADIUS = 90;  // px — how close before repulsion kicks in
    const REPEL_STRENGTH = 0.18; // gentle push force
    const DAMPING = 0.88;        // velocity decay per frame — higher = glider, lower = sticky

    const particles = Array.from({ length: COUNT }, (_, i) => {
      const seed = i * 1.618;
      const rect = canvas.getBoundingClientRect();
      const bx = ((seed * 127.1) % 1) * rect.width;
      const by = ((seed * 311.7) % 1) * rect.height;
      return {
        bx,          // base x (orbit centre)
        by,          // base y (orbit centre)
        x: bx,       // current x
        y: by,       // current y
        vx: 0,       // velocity x
        vy: 0,       // velocity y
        phase: seed * Math.PI * 2,
        speed: 0.4 + (seed % 0.4),
        radius: 1.2 + (seed % 2.2),
      };
    });

    let time = 0;
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      particles.forEach((p) => {
        // Natural floating orbit around base position
        const orbitX = p.bx + Math.sin(time * p.speed * 0.4 + p.phase) * 38;
        const orbitY = p.by + Math.cos(time * p.speed * 0.3 + p.phase * 0.7) * 24;

        // Repulsion force from mouse
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < REPEL_RADIUS && dist > 0) {
          const strength = REPEL_STRENGTH * (1 - dist / REPEL_RADIUS);
          p.vx += (dx / dist) * strength * 6;
          p.vy += (dy / dist) * strength * 6;
        }

        // Spring back toward orbit centre — gently
        p.vx += (orbitX - p.x) * 0.04;
        p.vy += (orbitY - p.y) * 0.04;

        // Dampen velocity — makes motion feel fluid, not twitchy
        p.vx *= DAMPING;
        p.vy *= DAMPING;

        p.x += p.vx;
        p.y += p.vy;

        const pulse = Math.sin(time * p.speed + p.phase) * 0.5 + 0.5;
        const proximity = dist < REPEL_RADIUS ? (1 - dist / REPEL_RADIUS) * 0.25 : 0;
        const alpha = 0.08 + pulse * 0.18 + proximity;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + pulse * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      });

      time += 0.016;
      frameRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-auto"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);   // which tab is selected (for highlight)
  const [displayFeature, setDisplayFeature] = useState(0); // which content is rendered (stable during fade)
  const [fading, setFading] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleTabSwitch = useCallback((idx: number) => {
    if (idx === activeFeature) return;
    setActiveFeature(idx);   // update tab highlight immediately
    setFading(true);
    setTimeout(() => {
      setDisplayFeature(idx); // swap content + layout direction after fade-out
      setFading(false);
    }, 260);
  }, [activeFeature]);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="dark relative py-24 lg:py-32 overflow-hidden bg-background text-foreground border-t border-border"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header - Full width with diagonal layout */}
        <div className="relative mb-24 lg:mb-32">
          <div className="grid lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
                <span className="w-12 h-px bg-foreground/30" />
                Capabilities
              </span>
              <h2
                className={`text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9] transition-all duration-1000 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              >
                What We
                <br />
                <span className="text-muted-foreground">Built.</span>
              </h2>
            </div>
            <div className="lg:col-span-5 lg:pb-4">
              <p className={`text-xl text-muted-foreground leading-relaxed transition-all duration-1000 delay-200 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}>
                A suite of custom solar forecasting models and ensembles designed specifically for the Aditya-L1 instruments.
              </p>
            </div>
          </div>
        </div>

        {/* Bento Grid Layout (Single Large Card) */}
        <div className="grid lg:grid-cols-12 gap-4 lg:gap-6">
          <div 
            className={`lg:col-span-12 relative bg-card border border-border min-h-[500px] overflow-hidden group transition-all duration-700 flex flex-col lg:flex-row ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            }`}
          >
            {/* Left: per-role image with crossfade */}
            <div className="hidden lg:flex relative w-[42%] shrink-0 overflow-hidden order-first">
              {features.map((feature, idx) => (
                <img
                  key={feature.number}
                  src={feature.image}
                  alt={feature.imageAlt}
                  aria-hidden={displayFeature !== idx}
                  className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700"
                  style={{ opacity: displayFeature === idx ? 1 : 0 }}
                />
              ))}
              {/* Gradient fades right edge into the content panel */}
              <div className="absolute inset-0 bg-gradient-to-l from-card via-card/30 to-transparent" />
            </div>

            {/* Right: text content + particle canvas */}
            <div className="relative flex-1 p-8 lg:p-12 bg-card flex flex-col justify-between min-h-[450px] lg:min-h-auto">
              <ParticleVisualization />
              
              <div className="relative z-10">
                {/* Switcher Tabs */}
                <div className="flex flex-wrap gap-2.5 mb-8 relative z-20">
                  {features.map((feature, idx) => (
                    <button
                      key={feature.number}
                      onClick={() => handleTabSwitch(idx)}
                      className={`px-5 py-2 font-mono text-xs uppercase tracking-wider border rounded transition-all duration-300 flex items-center gap-2 ${
                        activeFeature === idx
                          ? "border-[#FF6B00] text-[#FF6B00] bg-[#FF6B00]/5 font-semibold shadow-[0_0_15px_rgba(255,107,0,0.1)]"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-transparent"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${activeFeature === idx ? "bg-[#FF6B00]" : "bg-foreground/20"}`} />
                      {feature.number}
                    </button>
                  ))}
                </div>

                {/* Animated text content — fades + slides on tab switch */}
                <div
                  style={{
                    opacity: fading ? 0 : 1,
                    transform: fading ? "translateY(10px)" : "translateY(0px)",
                    transition: "opacity 0.25s ease, transform 0.25s ease",
                  }}
                >
                  <span className="font-mono text-sm text-[#FF6B00] font-semibold tracking-wider">
                    {features[displayFeature].number} · {features[displayFeature].stats.label}
                  </span>
                  <h3 className="text-3xl lg:text-4xl font-display mt-4 mb-6">
                    {features[displayFeature].title}
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8 min-h-[80px]">
                    {features[displayFeature].description}
                  </p>
                </div>
              </div>
              
              <div
                className="relative z-10 mt-auto pt-6 border-t border-border flex items-baseline gap-4"
                style={{
                  opacity: fading ? 0 : 1,
                  transform: fading ? "translateY(8px)" : "translateY(0px)",
                  transition: "opacity 0.25s ease 0.05s, transform 0.25s ease 0.05s",
                }}
              >
                <div>
                  <span className="text-5xl lg:text-6xl font-display text-foreground">
                    {features[displayFeature].stats.value}
                  </span>
                  <span className="block text-xs text-muted-foreground font-mono mt-2 uppercase tracking-wider">
                    Core Technology / Metric
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
