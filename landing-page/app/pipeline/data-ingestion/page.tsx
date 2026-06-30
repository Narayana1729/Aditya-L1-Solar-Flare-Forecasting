"use client";

import { useState } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { ArrowLeft, Database, Terminal, FileCode, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const fitsHeaderData = {
  SIMPLE: { type: "boolean", value: "T", desc: "Conforms to standard FITS format specifications." },
  BITPIX: { type: "integer", value: "16", desc: "16-bit integer data representation for pixel intensity." },
  NAXIS: { type: "integer", value: "2", desc: "Two-dimensional array structure (Time vs. Energy channel)." },
  TELESCOP: { type: "string", value: "Aditya-L1", desc: "Name of the space observatory platform." },
  INSTRUME: { type: "string", value: "SoLEXS", desc: "Solar Low Energy X-ray Spectrometer payload." },
  DATE_OBS: { type: "string", value: "2026-03-12T04:22:15", desc: "Universal Time stamp of initial exposure." },
  EXPTIME: { type: "float", value: "1.000", desc: "Nominal integration time in seconds." },
};

const codeSnippet = `import pyfits
import numpy as np
import pandas as pd

def ingest_solexs_fits(file_path):
    # Load level-1 FITS file from ISRO ISSDC PRADAN portal
    with pyfits.open(file_path) as hdul:
        header = hdul[0].header
        data = hdul[1].data
        
        # Extract photon counts and timestamps
        time_stamps = data['TIME']
        counts = data['COUNTS'] # Energy channels 4-25 keV
        
    return pd.DataFrame({'timestamp': time_stamps, 'counts': counts})

def sync_telemetry(solexs_df, hel1os_df):
    # Align Soft and Hard X-rays to unified 1-minute cadence
    merged = pd.merge_asof(
        solexs_df.sort_values('timestamp'),
        hel1os_df.sort_values('timestamp'),
        on='timestamp',
        direction='nearest',
        tolerance=pd.Timedelta('30s')
    )
    return merged.resample('1T', on='timestamp').mean().interpolate()
`;

export default function DataIngestionPage() {
  const [activeNode, setActiveNode] = useState<string>("source");
  const [activeHeaderKey, setActiveHeaderKey] = useState<string>("TELESCOP");
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <main className="relative min-h-screen bg-black text-foreground overflow-x-hidden pt-24">
      <Navigation />

      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Solar Observatory
        </Link>

        {/* Hero Header */}
        <div className="max-w-3xl mb-16">
          <span className="text-sm font-mono text-violet-500 uppercase tracking-wider block mb-4">Pipeline Step 01</span>
          <h1 className="text-5xl md:text-6xl font-display tracking-tight mb-6 leading-none">
            Data Ingestion & <br />
            <span className="text-muted-foreground">Temporal Alignment</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Raw telemetry streams from Aditya-L1 are gathered from the ISRO ISSDC PRADAN portal. 
            The ingestion pipeline parses FITS headers, extracts energy channels, and synchronizes multi-instrument timelines.
          </p>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-24">
          {/* Left Column: Interactive Pipeline Graphic (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-card/50 backdrop-blur-md border border-border rounded-2xl p-6 lg:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-[80px] pointer-events-none" />
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-2 text-foreground">
                <Database className="w-5 h-5 text-violet-500" />
                Telemetry Processing Engine
              </h3>

              {/* Ingestion Diagram */}
              <div className="relative w-full aspect-[16/9] bg-black/40 rounded-xl border border-border/50 p-6 flex flex-col justify-between overflow-hidden">
                {/* SVG Connections */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                  {/* Pipeline connection paths */}
                  <path d="M 80,100 L 220,100" stroke="#2a2a2e" strokeWidth="2" fill="none" />
                  <path d="M 280,100 L 420,100" stroke="#2a2a2e" strokeWidth="2" fill="none" />
                  <path d="M 480,100 L 300,200" stroke="#2a2a2e" strokeWidth="2" fill="none" />
                  <path d="M 300,200 L 150,200" stroke="#2a2a2e" strokeWidth="2" fill="none" />
                  
                  {/* Highlight active paths */}
                  {activeNode === "source" && (
                    <line x1="80" y1="100" x2="220" y2="100" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="6,4" className="animate-[dash_2s_linear_infinite]" />
                  )}
                  {activeNode === "parser" && (
                    <line x1="280" y1="100" x2="420" y2="100" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="6,4" className="animate-[dash_2s_linear_infinite]" />
                  )}
                </svg>

                {/* Top Row Nodes */}
                <div className="flex justify-between items-center z-10">
                  {/* Node 1: Source */}
                  <button
                    onClick={() => setActiveNode("source")}
                    className={`px-4 py-3 rounded-xl border text-left transition-all duration-300 ${
                      activeNode === "source"
                        ? "border-violet-500 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                        : "border-border bg-card hover:border-foreground/20"
                    }`}
                  >
                    <span className="text-[10px] font-mono text-violet-500 block uppercase mb-1">01. Source</span>
                    <span className="text-xs font-semibold text-foreground block">ISRO ISSDC Portal</span>
                    <span className="text-[9px] text-muted-foreground block">Level 1/2 Telemetry</span>
                  </button>

                  {/* Node 2: Parser */}
                  <button
                    onClick={() => setActiveNode("parser")}
                    className={`px-4 py-3 rounded-xl border text-left transition-all duration-300 ${
                      activeNode === "parser"
                        ? "border-violet-500 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                        : "border-border bg-card hover:border-foreground/20"
                    }`}
                  >
                    <span className="text-[10px] font-mono text-violet-500 block uppercase mb-1">02. Parsing</span>
                    <span className="text-xs font-semibold text-foreground block">FITS & CDF Parsers</span>
                    <span className="text-[9px] text-muted-foreground block">Epoch & Header Mapping</span>
                  </button>

                  {/* Node 3: Synchronizer */}
                  <button
                    onClick={() => setActiveNode("sync")}
                    className={`px-4 py-3 rounded-xl border text-left transition-all duration-300 ${
                      activeNode === "sync"
                        ? "border-violet-500 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                        : "border-border bg-card hover:border-foreground/20"
                    }`}
                  >
                    <span className="text-[10px] font-mono text-violet-500 block uppercase mb-1">03. Alignment</span>
                    <span className="text-xs font-semibold text-foreground block">Temporal Sync</span>
                    <span className="text-[9px] text-muted-foreground block">1-Min Resample & Merge</span>
                  </button>
                </div>

                {/* Bottom Row Nodes */}
                <div className="flex justify-around items-center z-10 mt-12">
                  {/* Node 4: Interpolation */}
                  <button
                    onClick={() => setActiveNode("interpolate")}
                    className={`px-4 py-3 rounded-xl border text-left transition-all duration-300 ${
                      activeNode === "interpolate"
                        ? "border-violet-500 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                        : "border-border bg-card hover:border-foreground/20"
                    }`}
                  >
                    <span className="text-[10px] font-mono text-violet-500 block uppercase mb-1">04. Resampling</span>
                    <span className="text-xs font-semibold text-foreground block">Missing Imputation</span>
                    <span className="text-[9px] text-muted-foreground block">Linear interpolation</span>
                  </button>

                  {/* Node 5: Feature Prep */}
                  <button
                    onClick={() => setActiveNode("features")}
                    className={`px-4 py-3 rounded-xl border text-left transition-all duration-300 ${
                      activeNode === "features"
                        ? "border-violet-500 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                        : "border-border bg-card hover:border-foreground/20"
                    }`}
                  >
                    <span className="text-[10px] font-mono text-violet-500 block uppercase mb-1">05. Output</span>
                    <span className="text-xs font-semibold text-foreground block">Feature Matrix</span>
                    <span className="text-[9px] text-muted-foreground block">Export to Stacking Model</span>
                  </button>
                </div>
              </div>

              {/* Node Detail Card */}
              <div className="mt-6 bg-black/30 border border-border/40 rounded-xl p-5 min-h-[120px] transition-all">
                {activeNode === "source" && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      01. ISRO ISSDC Portal & Telemetry Ingestion
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Downloads telemetry packets recursively from the PRADAN portal. If credentials, bandwidth, or site downtime limit the fetch, the system falls back to a mirrored Kaggle coordinate mirror containing raw, pre-downloaded CDF/FITS binaries.
                    </p>
                  </div>
                )}
                {activeNode === "parser" && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      02. FITS Header & CDF Epoch Parsing
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Extracts metadata variables (telescope, instrument, exposure configuration) and photon intensity tables. CDF epoch timelines are converted from standard TT2000 nanosecond format into standard Pandas-compatible datetimes.
                    </p>
                  </div>
                )}
                {activeNode === "sync" && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      03. Temporal Sync & Instrument Merging
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Aligns the Soft X-ray counts from SoLEXS and the Hard X-ray fluxes from HEL1OS. Uses a temporal tolerance limit of 30 seconds to match corresponding data records, resampling them into a unified 1-minute cadence.
                    </p>
                  </div>
                )}
                {activeNode === "interpolate" && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      04. Resampling & Missing Imputation
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Imputes telemetry gaps caused by spacecraft orbit shadowing or packet drop. Short interruptions are filled via linear interpolation, while larger gaps are flagged to prevent noise or artifact generation during inference.
                    </p>
                  </div>
                )}
                {activeNode === "features" && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      05. Output Feature Matrix
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Packages the synchronized time-series rows into a structured Pandas DataFrame. The matrix is prepared with features like rolling derivatives, peaks, and mean ratios, ready to feed the Stacking Ensemble model.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: FITS Header Inspector (5 cols) */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-card/50 backdrop-blur-md border border-border rounded-2xl p-6 lg:p-8 relative overflow-hidden flex flex-col h-full justify-between">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-foreground">
                  <Terminal className="w-5 h-5 text-emerald-500" />
                  Interactive FITS Inspector
                </h3>
                <p className="text-xs text-muted-foreground mb-6">
                  Select header keys to inspect raw metadata tags extracted from the Aditya-L1 FITS binary structures.
                </p>

                {/* Keys Grid */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {Object.keys(fitsHeaderData).map((key) => (
                    <button
                      key={key}
                      onClick={() => setActiveHeaderKey(key)}
                      className={`py-2 px-3 rounded-lg border text-xs font-mono transition-all text-center ${
                        activeHeaderKey === key
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold"
                          : "border-border bg-black/20 text-muted-foreground hover:border-foreground/10 hover:text-foreground"
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>

                {/* Inspector Detail Panel */}
                <div className="bg-black/40 border border-border/40 rounded-xl p-5 font-mono space-y-4">
                  <div className="flex justify-between items-center border-b border-border/40 pb-3">
                    <span className="text-[10px] text-muted-foreground">KEY NAME</span>
                    <span className="text-xs font-semibold text-emerald-400">{activeHeaderKey}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/40 pb-3">
                    <span className="text-[10px] text-muted-foreground">DATA TYPE</span>
                    <span className="text-xs text-foreground uppercase">{fitsHeaderData[activeHeaderKey as keyof typeof fitsHeaderData].type}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/40 pb-3">
                    <span className="text-[10px] text-muted-foreground">SAMPLE VALUE</span>
                    <span className="text-xs text-foreground font-semibold">{fitsHeaderData[activeHeaderKey as keyof typeof fitsHeaderData].value}</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-[10px] text-muted-foreground block mb-1">DESCRIPTION</span>
                    <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                      {fitsHeaderData[activeHeaderKey as keyof typeof fitsHeaderData].desc}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-border/30 flex items-center gap-3 text-[11px] text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                FITS structure strictly matches ISRO ISSDC level-1 telemetry standards.
              </div>
            </div>
          </div>
        </div>

        {/* Code Section */}
        <div className="bg-card/50 backdrop-blur-md border border-border rounded-2xl p-6 lg:p-8 relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
              <FileCode className="w-5 h-5 text-violet-500" />
              Ingestion Code Implementation
            </h3>
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 rounded-lg border border-border bg-black/20 hover:bg-black/40 hover:text-foreground text-muted-foreground transition-all flex items-center gap-1.5"
            >
              {isCopied ? "Copied!" : "Copy Code"}
            </button>
          </div>

          <pre className="bg-black/60 border border-border/50 rounded-xl p-6 overflow-x-auto text-xs md:text-sm font-mono text-muted-foreground leading-relaxed max-h-[400px]">
            <code>{codeSnippet}</code>
          </pre>
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
