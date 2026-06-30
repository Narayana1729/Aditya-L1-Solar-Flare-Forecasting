"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: "01",
    title: "LSTM Forecasting",
    subtitle: "Deep Sequence Model",
    description: "Deep LSTM networks process the past 60 minutes of soft and hard X-ray flux to generate future flare probabilities across 15m, 30m, and 60m horizons.",
  },
  {
    number: "02",
    title: "LightGBM Stacking",
    subtitle: "Ensemble Meta-Learner",
    description: "A gradient-boosted meta-classifier aggregates primary predictions, rolling derivatives, and baseline statistics to optimize decision thresholds.",
  },
  {
    number: "03",
    title: "Isolation Forest",
    subtitle: "Outlier & Anomaly Filter",
    description: "An unsupervised Isolation Forest flags instrumentation outliers and telemetry glitches, pruning false positives before alarms trigger.",
  },
  {
    number: "04",
    title: "SHAP Explanations",
    subtitle: "Operator Explainability",
    description: "TreeExplainer calculates SHAP attribution values in real-time, showing operators exactly which features caused the model to alert.",
  },
];

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
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

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [activeStep, steps.length]);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-[#121824] text-[#EDEFF2] overflow-hidden"
    >
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[#FF5C28]/[0.01] blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header — titre + image cerisier */}
        <div className="relative mb-0 lg:mb-0 grid lg:grid-cols-2 gap-4 lg:gap-12 items-end">
          {/* Titre colonne gauche */}
          <div className="overflow-hidden pb-0 lg:pb-32">
            <div className={`transition-all duration-1000 ${isVisible ? "translate-x-0 opacity-100" : "-translate-x-12 opacity-0"}`}>
              <span className="inline-flex items-center gap-3 text-sm font-mono text-[#5EE6D0] mb-8">
                <span className="w-12 h-px bg-border" />
                Meet the Pipeline
              </span>
            </div>
            
            <h2 className={`text-6xl md:text-7xl lg:text-[100px] font-display tracking-tight leading-[0.85] transition-all duration-1000 delay-100 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
            }`}>
              <span className="block">Four-stage</span>
              <span className="block text-[#FF5C28]">Architecture.</span>
            </h2>
          </div>

          {/* Image cerisier — se colle en bas sur les blocs */}
          <div className={`relative h-[320px] lg:h-[640px] overflow-hidden transition-all duration-1000 delay-200 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}>
            <img
              src="/images/tree_bg_removed.png"
              alt="Aditya-L1 Pipeline"
              aria-hidden="true"
              className="absolute bottom-0 left-0 w-full h-full object-contain object-bottom"
            />
            {/* Fade sur le bord gauche */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#121824] via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Horizontal Steps Layout */}
        <div className="grid lg:grid-cols-4 gap-4 mt-6 lg:mt-8">
          {steps.map((step, index) => (
            <button
              key={step.number}
              type="button"
              onClick={() => setActiveStep(index)}
              className={`relative text-left p-8 lg:p-12 border transition-all duration-500 rounded-lg ${
                activeStep === index 
                  ? "bg-[#0A0E17] border-[#FF5C28]" 
                  : "bg-[#0A0E17]/40 border-white/5 hover:border-[#FF5C28]/40"
              }`}
            >
              {/* Step number with animated line */}
              <div className="flex items-center gap-4 mb-8 font-mono">
                <span className={`text-4xl font-display transition-colors duration-300 ${
                  activeStep === index ? "text-[#FF5C28]" : "text-[#EDEFF2]/20"
                }`}>
                  {step.number}
                </span>
                <div className="flex-1 h-px bg-white/10 overflow-hidden">
                  {activeStep === index && (
                    <div className="h-full bg-[#FF5C28]/50 animate-progress" />
                  )}
                </div>
              </div>

              {/* Title */}
              <h3 className="text-3xl lg:text-3xl font-display mb-2 text-[#EDEFF2] tracking-tight">
                {step.title}
              </h3>
              <span className="text-sm font-mono text-[#FFB627] block mb-6 uppercase tracking-wider">
                {step.subtitle}
              </span>

              {/* Description */}
              <p className={`text-sm leading-relaxed transition-opacity duration-300 text-[#EDEFF2]/70 ${
                activeStep === index ? "opacity-100" : "opacity-60"
              }`}>
                {step.description}
              </p>

              {/* Active indicator */}
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-[#FF5C28] transition-transform duration-500 origin-left ${
                activeStep === index ? "scale-x-100" : "scale-x-0"
              }`} />
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-progress {
          animation: progress 6s linear forwards;
        }
      `}</style>
    </section>
  );
}
