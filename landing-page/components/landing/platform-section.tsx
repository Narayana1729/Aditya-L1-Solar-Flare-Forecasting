"use client";

import { useState, useEffect, useRef } from "react";
import { LineChart, LayoutDashboard, Terminal, BellRing, ChevronRight, Check } from "lucide-react";

const products = [
  {
    id: "dashboard",
    icon: <LayoutDashboard className="w-5 h-5 text-[#FF5C28]" />,
    title: "Interactive Operator Dashboard",
    tagline: "Plotly Dash + Next.js User Interfaces",
    description: "A centralized command center designed for satellite operators. Streams real-time Aditya-L1 solar flux telemetry, overlays conformal prediction confidence intervals, and runs live SHAP feature attributions for active warnings.",
    features: [
      "Real-time flux & derivative timeline charts",
      "Dynamic lead-time countdowns for incoming flares",
      "Interactive SHAP bar charts showing trigger causes",
      "Model metric evaluation toggles (LGBM, LSTM, Stacking)"
    ],
    visualType: "dashboard"
  },
  {
    id: "api",
    icon: <Terminal className="w-5 h-5 text-[#5EE6D0]" />,
    title: "FastAPI Inference Engine",
    tagline: "Low-Latency Programmatic Access",
    description: "A high-performance Python API that connects our models to upstream spacecraft systems. Serves predictions, baseline analysis, and local feature importance via high-throughput JSON endpoints.",
    features: [
      "10-second end-to-end ingestion-to-prediction latency",
      "Full API compatibility with ISRO PRADAN FITS archives",
      "Confidence boundaries calibrated via MAPIE Conformal predictors",
      "Detailed Swagger / OpenAPI documentation endpoints"
    ],
    visualType: "code"
  },
  {
    id: "alerts",
    icon: <BellRing className="w-5 h-5 text-[#FFB627]" />,
    title: "Downstream Integrations",
    tagline: "Autonomous Space Weather Alerting",
    description: "Keeps operational teams and automated defense grids updated in real-time. Dispatches low-latency alarms through direct integrations when critical flare events (M-class or X-class) are forecast.",
    features: [
      "Automated Slack notification webhooks",
      "PagerDuty escalations for high-probability X-class alerts",
      "Telemetry archives exported to AWS S3 buckets",
      "Experiment logs captured in Weights & Biases dashboards"
    ],
    visualType: "integrations"
  }
];

export function PlatformSection() {
  const [activeTab, setActiveTab] = useState(0);
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

  const activeProduct = products[activeTab];

  return (
    <section id="platform" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden bg-[#121824] border-t border-white/5">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        
        {/* Header */}
        <div className="mb-16">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-[#5EE6D0] mb-4">
            <span className="w-8 h-px bg-white/20" />
            Platform & Integrations
          </span>
          <h2 className="text-4xl md:text-5xl font-display text-[#EDEFF2] tracking-tight leading-none mb-6">
            What We <span className="text-[#FF5C28]">Built</span>
          </h2>
          <p className="text-base lg:text-lg text-white/60 leading-relaxed max-w-2xl">
            A comprehensive, operational space-weather framework combining visual user interfaces, programmatic APIs, and automatic downstream telemetry integrations.
          </p>
        </div>

        {/* Outer Split layout - Earth Engine Style */}
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Tab Selector Left (lg:col-span-4) */}
          <div className="lg:col-span-4 flex flex-col gap-3 justify-start">
            {products.map((product, idx) => {
              const isActive = activeTab === idx;
              return (
                <button
                  key={product.id}
                  onClick={() => setActiveTab(idx)}
                  className={`text-left p-6 border rounded-xl transition-all duration-300 ${
                    isActive 
                      ? "border-[#FF5C28] bg-[#0A0E17] shadow-[0_4px_20px_rgba(255,92,40,0.05)]" 
                      : "border-white/5 bg-[#0A0E17]/30 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {product.icon}
                    <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
                      {product.tagline}
                    </span>
                  </div>
                  <h3 className="text-lg font-display text-[#EDEFF2] tracking-tight mb-2">
                    {product.title}
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
                    {product.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Detailed Content Display Right (lg:col-span-8) */}
          <div className="lg:col-span-8 bg-[#0A0E17] border border-white/5 rounded-xl p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF5C28]/[0.02] blur-3xl pointer-events-none rounded-full" />
            
            <div className="grid md:grid-cols-12 gap-8 items-center h-full">
              
              {/* Info Detail */}
              <div className="md:col-span-6 space-y-6">
                <div>
                  <span className="text-[10px] font-mono text-[#5EE6D0] uppercase tracking-wider block mb-1">
                    System Component
                  </span>
                  <h3 className="text-2xl lg:text-3xl font-display text-[#EDEFF2] tracking-tight leading-none">
                    {activeProduct.title}
                  </h3>
                </div>

                <p className="text-sm text-white/70 leading-relaxed font-sans">
                  {activeProduct.description}
                </p>

                <ul className="space-y-2.5">
                  {activeProduct.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-white/80 font-mono">
                      <Check className="w-3.5 h-3.5 text-[#5EE6D0] shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual Preview Frame */}
              <div className="md:col-span-6 h-full flex items-center justify-center">
                {activeProduct.visualType === "dashboard" && (
                  <div className="w-full bg-[#121824] border border-white/5 rounded-lg p-4 font-mono text-[10px] space-y-3 shadow-inner">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#FF5C28] animate-pulse" />
                        <span className="text-[#EDEFF2] font-semibold">SOLEXS REALTIME FLUX</span>
                      </div>
                      <span className="text-white/40">15m LEAD</span>
                    </div>
                    {/* Simulated Graph */}
                    <div className="h-28 bg-[#070b12] rounded border border-white/5 flex items-end p-2 gap-1 relative overflow-hidden">
                      {/* Grid background */}
                      <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-5 pointer-events-none">
                        {[...Array(24)].map((_, i) => (
                          <div key={i} className="border-t border-l border-white" />
                        ))}
                      </div>
                      
                      {/* Bars/Curve */}
                      {[15, 12, 14, 18, 16, 15, 14, 13, 14, 25, 48, 76, 54, 38, 29, 22].map((height, i) => (
                        <div 
                          key={i} 
                          className="flex-1 rounded-t-sm transition-all duration-500" 
                          style={{ 
                            height: `${height}%`,
                            backgroundColor: i >= 9 ? "#FF5C28" : "#5EE6D0",
                            boxShadow: i >= 9 ? "0 0 8px rgba(255,92,40,0.5)" : "none"
                          }} 
                        />
                      ))}
                      {/* Alert banner overlay */}
                      <div className="absolute top-2 right-2 bg-[#FF5C28]/20 border border-[#FF5C28] text-[#FF5C28] px-1.5 py-0.5 rounded text-[8px] font-bold">
                        ALERT: M4.8
                      </div>
                    </div>
                    {/* Metrics readouts */}
                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                      <div className="bg-[#070b12] p-1.5 border border-white/5 rounded">
                        <span className="text-white/40">PROBABILITY</span>
                        <span className="block text-[#FFB627] font-semibold">96.4% CRITICAL</span>
                      </div>
                      <div className="bg-[#070b12] p-1.5 border border-white/5 rounded">
                        <span className="text-white/40">SHAP HIGHLIGHT</span>
                        <span className="block text-[#5EE6D0] font-semibold">flux_long_zscore</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeProduct.visualType === "code" && (
                  <div className="w-full bg-[#070b12] border border-white/5 rounded-lg overflow-hidden shadow-inner font-mono text-[9px] text-[#EDEFF2]/80 leading-normal">
                    <div className="bg-[#121824] px-3 py-1.5 border-b border-white/5 text-[8px] text-white/40 flex justify-between">
                      <span>GET /api/predict</span>
                      <span className="text-[#5EE6D0]">200 OK</span>
                    </div>
                    <pre className="p-4 overflow-x-auto select-all max-h-[180px] leading-relaxed">
                      <code>{`{
  "status": "success",
  "prediction": {
    "15m": { "probability": 0.964, "alert": "critical" },
    "30m": { "probability": 0.812, "alert": "warning" },
    "60m": { "probability": 0.450, "alert": "normal" }
  },
  "metrics": {
    "optimal_thresholds": { "15m": 0.38, "30m": 0.42 },
    "conformal_intervals": { "low": 0.885, "high": 0.992 }
  },
  "system": { "payload": "SoLEXS+HEL1OS", "latency_ms": 12.8 }
}`}</code>
                    </pre>
                  </div>
                )}

                {activeProduct.visualType === "integrations" && (
                  <div className="w-full grid grid-cols-2 gap-3">
                    {[
                      { name: "ISRO ISSDC", desc: "PRADAN portal data telemetry sync", icon: "🛰️" },
                      { name: "NOAA SWPC", desc: "Solar catalog event labeling", icon: "☀️" },
                      { name: "AWS S3", desc: "Long-term data lake archives", icon: "📦" },
                      { name: "Slack / Alerts", desc: "Low-latency operator webhooks", icon: "🔔" }
                    ].map((integ) => (
                      <div key={integ.name} className="bg-[#121824] border border-white/5 p-3.5 rounded-lg flex flex-col justify-between h-24">
                        <div className="flex justify-between items-center">
                          <span className="text-base">{integ.icon}</span>
                          <span className="text-[7px] font-mono text-white/30 uppercase">CONNECTED</span>
                        </div>
                        <div>
                          <span className="font-semibold text-white text-[10px] block font-mono">{integ.name}</span>
                          <span className="text-[8px] text-white/50 leading-none block mt-1">{integ.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
