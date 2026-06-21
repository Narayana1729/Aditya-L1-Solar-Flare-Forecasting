"use client";

import { useEffect, useState, useRef } from "react";

const instruments = [
  {
    code: "VELC",
    name: "Visible Emission Line Coronagraph",
    purpose: "Solar corona imaging",
    description: "Solar corona imaging and spectroscopy. Studies coronal heating dynamics, magnetic field measurements, and coronal mass ejections.",
    highlight: false,
  },
  {
    code: "SUIT",
    name: "Solar Ultraviolet Imaging Telescope",
    purpose: "UV photosphere and chromosphere imaging",
    description: "UV photosphere and chromosphere imaging. Measures solar irradiance variations and studies solar atmospheric layers.",
    highlight: false,
  },
  {
    code: "SoLEXS",
    name: "Solar Low Energy X-ray Spectrometer",
    purpose: "Soft X-ray solar flare spectrometer",
    description: "Soft X-ray spectrometer. Monitors solar X-ray flux to study flare dynamics, coronal heating, and spectral characteristics.",
    highlight: true,
  },
  {
    code: "HEL1OS",
    name: "High Energy L1 Orbiting X-ray Spectrometer",
    purpose: "Hard X-ray flare monitor",
    description: "Hard X-ray spectrometer. Monitors high-energy solar flare processes, particle acceleration, and evolution.",
    highlight: true,
  },
  {
    code: "ASPEX",
    name: "Aditya Solar wind Particle Experiment",
    purpose: "Solar wind particle experiment",
    description: "Solar wind particle analyser. Measures solar wind protons, alpha particles, and heavier ions with energy diagnostics.",
    highlight: false,
  },
  {
    code: "PAPA",
    name: "Plasma Analyser Package for Aditya",
    purpose: "Solar wind electrons and ions plasma analyser",
    description: "Plasma analyser. Studies solar wind electrons, ions, composition, and their energy distributions.",
    highlight: false,
  },
  {
    code: "MAG",
    name: "Magnetometer",
    purpose: "Interplanetary magnetic field magnetometer",
    description: "Tri-axial magnetometer. Measures the magnitude and dynamics of the interplanetary magnetic field in L1 orbit.",
    highlight: false,
  },
];

export function InfrastructureSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

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

  return (
    <section id="infra" ref={sectionRef} className="relative py-32 lg:py-40 overflow-hidden bg-background">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header Hero Panel */}
        <div 
          className={`relative border border-foreground/10 rounded-2xl overflow-hidden min-h-[440px] lg:min-h-[520px] flex flex-col justify-end p-8 lg:p-16 mb-20 group bg-black transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
        >
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img
              src="/images/aditya-l1.png"
              alt="Aditya-L1 spacecraft orbiting L1 point"
              className="w-full h-full object-cover object-center opacity-85 transition-transform duration-1000 group-hover:scale-[1.01]"
            />
            {/* Subtle left-to-right gradient to make text readable without blocking the Sun */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </div>

          {/* Foreground Text Content (Transparent with Text Shadow) */}
          <div className="relative z-10 max-w-2xl [text-shadow:_0_2px_10px_rgba(0,0,0,0.85)]">
            <span className="inline-flex items-center gap-4 text-sm font-mono text-[#FFB347] mb-6">
              <span className="w-8 h-px bg-[#FFB347]/50" />
              Spacecraft Payload
            </span>
            
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display tracking-tight leading-[0.95] text-white">
              Aditya-L1
              <br />
              <span className="text-[#FF6B00]">Instruments.</span>
            </h2>

            <p className="mt-6 text-base lg:text-lg text-white/90 leading-relaxed max-w-xl">
              Seven scientific payloads orbiting at the Sun-Earth L1 point, 1.5 million km from Earth, monitoring the solar atmosphere, flare events, and space weather dynamics.
            </p>
          </div>
        </div>

        {/* Instruments Card Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instruments.map((instrument, index) => (
            <div
              key={instrument.code}
              className={`p-8 border bg-card hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-h-[260px] relative overflow-hidden ${
                instrument.highlight 
                  ? "border-[#FF6B00] shadow-[0_0_25px_rgba(255,107,0,0.08)]" 
                  : "border-border"
              } ${
                index === 6 
                  ? "md:col-span-2 lg:col-span-3" 
                  : ""
              } ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${index * 75}ms` }}
            >
              {/* Highlight background glow */}
              {instrument.highlight && (
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#FF6B00]/5 blur-xl rounded-full pointer-events-none" />
              )}

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`font-mono text-sm uppercase tracking-wider font-semibold ${
                    instrument.highlight ? "text-[#FF6B00]" : "text-muted-foreground/60"
                  }`}>
                    {instrument.code}
                  </span>
                  
                  {instrument.highlight && (
                    <span className="text-[10px] font-mono text-[#FF6B00] bg-[#FF6B00]/10 px-2 py-0.5 rounded-sm">
                      IRIS X Core Input
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-display text-foreground mb-2">
                  {instrument.name}
                </h3>
                
                <span className="text-xs text-muted-foreground font-mono block mb-4">
                  {instrument.purpose}
                </span>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mt-auto">
                {instrument.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
