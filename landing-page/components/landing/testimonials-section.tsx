"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

const testimonials = [
  {
    quote: "Processing 1M+ rows of Aditya-L1 telemetry and merging SoLEXS with HEL1OS on a memory budget required rethinking ingestion from scratch.",
    author: "Uppena Upagna",
    role: "Signal Processing Lead",
    company: "Data Ingestion",
    metric: { value: "1M+", label: "Telemetry rows ingested" },
  },
  {
    quote: "GOES cross-validation exposed how class imbalance was silently killing recall. SMOTE + TSS threshold tuning changed everything for flare detection.",
    author: "Polishetty Bhanu Venkata Sai Ram Koushik",
    role: "Physics & Domain Lead",
    company: "Validation",
    metric: { value: "6,556", label: "NOAA flare events labelled" },
  },
  {
    quote: "Stacking LightGBM, LSTM, and Isolation Forest with a meta-learner pushed 30m TSS to 0.22 — a meaningful jump over any single model alone.",
    author: "Ismail Zabiullah",
    role: "ML Modelling Lead",
    company: "Ensemble",
    metric: { value: "0.22", label: "Stacking Ensemble TSS (30m)" },
  },
  {
    quote: "Wiring real-time SHAP explanations into the Plotly Dash dashboard lets operators understand exactly why an alert fired, not just that it fired.",
    author: "Subramhanya Srimannarayana",
    role: "Dashboard & Integration Lead",
    company: "Dashboard",
    metric: { value: "+12 min", label: "Mean flare warning lead time" },
  },
];

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [mounted, setMounted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      setDirection("right");
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const goTo = (index: number) => {
    setDirection(index > activeIndex ? "right" : "left");
    setActiveIndex(index);
  };

  const goPrev = () => {
    setDirection("left");
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goNext = () => {
    setDirection("right");
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const activeTestimonial = testimonials[activeIndex];

  return (
    <section id="team" ref={sectionRef} className="relative py-32 lg:py-40 bg-[#0A0E17] text-[#EDEFF2] overflow-hidden border-t border-white/5">
      {/* ASCII background pattern */}
      <div className="absolute inset-0 font-mono text-[10px] text-white/[0.02] leading-tight overflow-hidden whitespace-pre select-none">
        {mounted && Array.from({ length: 60 }, (_, i) => 
          Array.from({ length: 100 }, () => 
            Math.random() > 0.7 ? '"' : ' '
          ).join("")
        ).join("\n")}
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-20">
          <div>
            <span className="inline-flex items-center gap-3 text-sm font-mono text-[#5EE6D0] mb-4">
              <span className="w-12 h-px bg-white/10" />
              Team Insight
            </span>
            <h2 className={`text-4xl lg:text-5xl font-display transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}>
              IRIS X Core <span className="text-white/40">Roles.</span>
            </h2>
          </div>
          
          {/* Navigation arrows */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={goPrev}
              className="p-4 border border-white/10 hover:bg-white/5 transition-colors rounded"
            >
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </button>
            <button
              onClick={goNext}
              className="p-4 border border-white/10 hover:bg-white/5 transition-colors rounded"
            >
              <ArrowRight className="w-5 h-5 text-white/70" />
            </button>
          </div>
        </div>

        {/* Main content - Split layout */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-20">
          {/* Quote side */}
          <div className="lg:col-span-7 relative">
            {/* Large quote mark */}
            <span className="absolute -left-4 -top-8 text-[200px] font-display text-white/[0.03] leading-none select-none">
              &ldquo;
            </span>
            
            <div className="relative">
              <blockquote 
                key={activeIndex}
                className="text-3xl lg:text-4xl xl:text-5xl font-display leading-[1.2] tracking-tight animate-fadeSlideIn text-[#EDEFF2]"
              >
                {activeTestimonial.quote}
              </blockquote>

              {/* Author */}
              <div className="mt-12 flex items-center gap-6">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <span className="font-display text-xl text-[#FFB627]">
                    {activeTestimonial.author.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-medium text-[#EDEFF2]">{activeTestimonial.author}</p>
                  <p className="text-white/50 text-sm font-mono mt-1">
                    {activeTestimonial.role} &middot; <span className="text-[#5EE6D0]">{activeTestimonial.company}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Metric cards side */}
          <div className="lg:col-span-5 flex flex-col justify-center gap-6">
            {/* Active metric - Large */}
            <div 
              key={`metric-${activeIndex}`}
              className="p-10 border border-white/10 bg-[#121824]/60 rounded-xl shadow-xl animate-fadeSlideIn"
            >
              <span className="text-7xl lg:text-8xl font-display block mb-4 text-[#FFB627] tracking-tight">
                {activeTestimonial.metric.value}
              </span>
              <span className="text-sm font-mono text-white/60 uppercase tracking-wider block">
                {activeTestimonial.metric.label}
              </span>
            </div>

            {/* Progress indicators */}
            <div className="flex gap-2">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  className="flex-1 h-1 bg-white/10 overflow-hidden rounded-full"
                >
                  <div 
                    className={`h-full bg-[#FF5C28] transition-all duration-300 ${
                      idx === activeIndex ? "w-full" : idx < activeIndex ? "w-full opacity-50" : "w-0"
                    }`}
                    style={idx === activeIndex ? { animation: "progress 8s linear forwards" } : {}}
                  />
                </button>
              ))}
            </div>

            {/* Company list */}
            <div className="mt-4 pt-6 border-t border-white/5">
              <span className="text-xs font-mono text-white/30 uppercase tracking-widest block mb-4">
                Pipeline Components
              </span>
              <div className="flex flex-wrap gap-2">
                {testimonials.map((t, idx) => (
                  <button
                    key={t.company}
                    onClick={() => goTo(idx)}
                    className={`px-4 py-2 text-xs font-mono border rounded transition-all ${
                      idx === activeIndex 
                        ? "border-[#FF5C28] text-[#FF5C28] bg-[#FF5C28]/10" 
                        : "border-white/5 text-white/40 hover:border-white/20 hover:text-white/80"
                    }`}
                  >
                    {t.company}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fadeSlideIn {
          animation: fadeSlideIn 0.5s ease-out forwards;
        }
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
}
