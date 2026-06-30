"use client";

import { useEffect, useState, useRef } from "react";
import { ShieldCheck, BarChart3, Layers, ScanSearch } from "lucide-react";

const reliabilityFeatures = [
  {
    icon: ShieldCheck,
    title: "GOES Cross-Validation",
    description: "All models validated against independent NOAA GOES-16/18 flare catalog ground truth.",
    image: "/images/validation_bg_removed.png",
  },
  {
    icon: BarChart3,
    title: "Conformal Prediction",
    description: "MAPIE wrappers provide mathematically guaranteed 90% confidence intervals on every forecast.",
    image: "/images/conformal_bg_removed.png",
  },
  {
    icon: Layers,
    title: "SHAP Explainability",
    description: "TreeExplainer SHAP values expose exactly which SoLEXS features drive each flare alert.",
    image: "/images/shap_bg_removed.png",
  },
  {
    icon: ScanSearch,
    title: "Threshold Audit",
    description: "TSS-optimised decision boundaries verified on 11,199 held-out test flare events.",
    image: "/images/threshold_bg_removed.jpg",
  },
];

const certifications = ["TSS · Peirce", "HSS · Heidke", "GOES-16/18", "NOAA SWPC"];

export function ReliabilitySection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
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

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % reliabilityFeatures.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const dynamicMetrics = [
    { value: "0.22", label: "TSS · Stacking Ensemble 30m horizon", badgeIndex: 2 },
    { value: "90%", label: "Conformal Prediction Coverage (MAPIE Guarantee)", badgeIndex: 3 },
    { value: "18", label: "Physics features ranked by SHAP value per event", badgeIndex: 0 },
    { value: "0.38", label: "HSS · Heidke Skill Score on held-out test events", badgeIndex: 1 },
  ];

  return (
    <section id="reliability" ref={sectionRef} className="relative py-32 lg:py-40 overflow-hidden">
      {/* Background accent removed */}
      
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-20">
          <span className={`inline-flex items-center gap-4 text-sm font-mono text-muted-foreground mb-8 transition-all duration-700 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}>
            <span className="w-12 h-px bg-foreground/20" />
            Reliability & Validation
          </span>
          
          {/* Title — full width */}
          <h2 className={`text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9] mb-12 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}>
            Explainable,
            <br />
            <span className="text-muted-foreground">not a black box.</span>
          </h2>
          
          {/* Description — below title */}
          <div className={`transition-all duration-1000 delay-100 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Every prediction is traceable. SHAP values, conformal intervals, and GOES cross-validation ensure the pipeline is transparent, auditable, and trustworthy.
            </p>
          </div>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Large visual card */}
          <div className={`lg:col-span-7 relative p-8 lg:p-12 border border-border min-h-[400px] overflow-hidden transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}>
            {/* Dynamic feature image with cross-fade — desktop only */}
            <div className="absolute inset-0 pointer-events-none items-center justify-end hidden lg:flex">
              {reliabilityFeatures.map((feature, index) => (
                <img
                  key={feature.image}
                  src={feature.image}
                  alt={feature.title}
                  className="absolute h-3/4 w-3/4 object-contain object-right transition-opacity duration-500"
                  style={{ opacity: activeFeature === index ? 0.85 : 0 }}
                />
              ))}
            </div>
            
            <div className="relative z-10">
              <span className="font-mono text-sm text-muted-foreground">Test set evaluation</span>
              <div className="mt-8 transition-all duration-300">
                <span className="text-7xl lg:text-8xl font-display block transition-all duration-200">
                  {dynamicMetrics[activeFeature].value}
                </span>
                <span className="block text-muted-foreground mt-2 text-sm font-mono tracking-tight">
                  {dynamicMetrics[activeFeature].label}
                </span>
              </div>
            </div>
            
            {/* Certification badges */}
            <div className="absolute bottom-8 left-8 right-8 flex flex-wrap gap-2">
              {certifications.map((cert, index) => {
                const isActive = dynamicMetrics[activeFeature].badgeIndex === index;
                return (
                  <button
                    key={cert}
                    type="button"
                    onClick={() => {
                      const matchingIdx = dynamicMetrics.findIndex(m => m.badgeIndex === index);
                      if (matchingIdx !== -1) setActiveFeature(matchingIdx);
                    }}
                    className={`px-3 py-1 border text-xs font-mono transition-all duration-300 ${
                      isActive
                        ? "border-[#FF6B00] text-[#FF6B00] bg-[#FF6B00]/5 font-semibold"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    } ${
                      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
                    style={{ transitionDelay: `${index * 100 + 300}ms` }}
                  >
                    {cert}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feature cards stack */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {reliabilityFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className={`p-6 border transition-all duration-500 cursor-default ${
                  activeFeature === index 
                    ? "border-foreground/30 bg-foreground/[0.04]" 
                    : "border-border"
                } ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
                style={{ transitionDelay: `${index * 80}ms` }}
                onClick={() => setActiveFeature(index)}
                onMouseEnter={() => setActiveFeature(index)}
              >
                <div className="flex items-start gap-4">
                  <div className={`shrink-0 w-10 h-10 flex items-center justify-center border transition-colors ${
                    activeFeature === index 
                      ? "border-foreground bg-foreground text-background" 
                      : "border-border"
                  }`}>
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
