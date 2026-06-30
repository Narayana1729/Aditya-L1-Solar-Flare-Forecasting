"use client";

import { useEffect, useState, useRef } from "react";
import { Terminal, Copy, Check } from "lucide-react";

const datasets = [
  {
    id: "ISRO/ADITYAL1/SOLEXS_L1_FLUX_1M",
    name: "SoLEXS Soft X-ray Telemetry",
    instrument: "Solar Low Energy X-ray Spectrometer",
    description: "Continuous 1-minute cadence observations in the 1-22 keV range. Critical for low-energy flare pre-cursors and baseline flux tracking.",
    availability: "July 2024 - July 2026",
    provider: "ISRO ISSDC / PRADAN portal",
    cadence: "1 minute (continuous)",
    bands: [
      { name: "flux_long_raw", type: "float", desc: "Raw X-ray count rate from SoLEXS detector" },
      { name: "flux_long_baseline", type: "float", desc: "Filtered solar background/baseline flux" },
      { name: "flux_long_zscore", type: "float", desc: "Z-score normalized deviation from running mean" },
      { name: "solexs_flux_accel", type: "float", desc: "First-derivative rate of change of flux" }
    ],
    code: `import adityal1 as al1

# Load SoLEXS Soft X-ray telemetry collection
solexs_flux = al1.ImageCollection("ISRO/ADITYAL1/SOLEXS_L1_FLUX_1M") \\
                 .filterDate("2025-01-01", "2025-01-07") \\
                 .select(["flux_long_raw", "flux_long_baseline"])

# Compute rolling derivatives & z-scores
engineered_features = solexs_flux.map(al1.features.compute_derivatives)

print(engineered_features.first().getInfo())`
  },
  {
    id: "ISRO/ADITYAL1/HEL1OS_L1_SPECTRA_1M",
    name: "HEL1OS Hard X-ray Energy Bands",
    instrument: "High Energy L1 Orbiting X-ray Spectrometer",
    description: "Observations in high-energy hard X-ray bands (10-150 keV). Captures particle acceleration and impulsive phase flare evolution.",
    availability: "July 2024 - July 2026",
    provider: "ISRO ISSDC / PRADAN portal",
    cadence: "1 minute (impulsive trigger)",
    bands: [
      { name: "hard_xray_low", type: "float", desc: "Low-energy hard X-ray flux (10-40 keV)" },
      { name: "hard_xray_high", type: "float", desc: "High-energy hard X-ray flux (40-150 keV)" },
      { name: "minutes_since_last_flare", type: "integer", desc: "Temporal delta since last detected trigger" },
      { name: "flux_prominence_10m", type: "float", desc: "Integrated prominence peak ratio over 10m window" }
    ],
    code: `import adityal1 as al1

# Load HEL1OS Hard X-ray spectrogram collection
hel1os_spectra = al1.ImageCollection("ISRO/ADITYAL1/HEL1OS_L1_SPECTRA_1M") \\
                    .filterDate("2025-01-01", "2025-01-07") \\
                    .select(["hard_xray_low", "hard_xray_high"])

# Merge with telemetry delta flags
merged_dataset = hel1os_spectra.addBands(al1.goes.get_catalog_deltas())

print(merged_dataset.aggregate_array("flux_prominence_10m").getInfo())`
  }
];

export function InfrastructureSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
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

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeDataset = datasets[activeTab];

  return (
    <section id="infra" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden bg-[#0A0E17] border-t border-white/5">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        
        {/* Header */}
        <div className="mb-16">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-[#5EE6D0] mb-4">
            <span className="w-8 h-px bg-white/20" />
            Data Catalogs
          </span>
          <h2 className="text-4xl md:text-5xl font-display text-[#EDEFF2] tracking-tight leading-none mb-6">
            Ready-to-Use <span className="text-[#FF5C28]">Datasets</span>
          </h2>
          <p className="text-base lg:text-lg text-white/60 leading-relaxed max-w-2xl">
            Cleaned and synchronized telemetry collections from Aditya-L1 payloads, pre-processed for immediate ML model inference and model validation.
          </p>
        </div>

        {/* Dataset Tabs */}
        <div className="flex gap-2 border-b border-white/10 pb-px mb-8 overflow-x-auto whitespace-nowrap">
          {datasets.map((dataset, idx) => (
            <button
              key={dataset.id}
              onClick={() => { setActiveTab(idx); setCopied(false); }}
              className={`pb-4 px-4 font-mono text-sm tracking-tight transition-all relative ${
                activeTab === idx 
                  ? "text-[#FF5C28] font-semibold" 
                  : "text-white/40 hover:text-white/80"
              }`}
            >
              {dataset.name}
              {activeTab === idx && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF5C28]" />
              )}
            </button>
          ))}
        </div>

        {/* Dataset Detail Grid */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Metadata Block (Left Column) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-[#121824] border border-white/5 rounded-xl p-6 space-y-4">
              <div>
                <span className="text-[10px] uppercase font-mono text-white/40 block">Dataset ID</span>
                <span className="text-sm font-mono text-[#EDEFF2] font-semibold break-all">{activeDataset.id}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-mono text-white/40 block">Temporal Cadence</span>
                  <span className="text-xs text-[#EDEFF2] font-mono">{activeDataset.cadence}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-white/40 block">Availability</span>
                  <span className="text-xs text-[#EDEFF2] font-mono">{activeDataset.availability}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-white/40 block">Provider / Catalog</span>
                <span className="text-xs text-[#EDEFF2] font-mono">{activeDataset.provider}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-white/40 block">Payload Instrument</span>
                <span className="text-xs text-[#FFB627] font-mono font-semibold">{activeDataset.instrument}</span>
              </div>
              <p className="text-sm text-white/70 leading-relaxed pt-2">
                {activeDataset.description}
              </p>
            </div>

            {/* Bands/Variables table */}
            <div className="bg-[#121824] border border-white/5 rounded-xl p-6">
              <h3 className="text-xs font-mono font-bold text-[#EDEFF2] uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                Bands & Feature Columns
              </h3>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                {activeDataset.bands.map((band) => (
                  <div key={band.name} className="flex flex-col md:flex-row md:items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[#5EE6D0] font-semibold">{band.name}</span>
                      <span className="font-mono text-white/30 text-[10px]">{band.type}</span>
                    </div>
                    <span className="text-white/60 font-mono text-[11px] md:text-right">{band.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Code Ingest block (Right Column) */}
          <div className="lg:col-span-6 bg-[#070B12] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
            {/* Window header */}
            <div className="flex items-center justify-between bg-[#121824] px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#FFB627]" />
                <span className="text-[11px] font-mono text-[#EDEFF2]/70 font-semibold">aditya_l1_sandbox.py</span>
              </div>
              <button
                onClick={() => handleCopy(activeDataset.code)}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#5EE6D0]" />
                    <span className="text-[#5EE6D0] font-mono text-[11px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="font-mono text-[11px]">Copy Snippet</span>
                  </>
                )}
              </button>
            </div>
            {/* Code lines */}
            <pre className="p-6 overflow-x-auto text-[11px] text-[#EDEFF2]/90 leading-relaxed font-mono whitespace-pre bg-[#070b12] max-h-[360px]">
              <code>{activeDataset.code}</code>
            </pre>
          </div>

        </div>

      </div>
    </section>
  );
}
