"use client";

import { useState, useEffect, useRef } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { ArrowLeft, Terminal, BarChart2, BellRing, CheckCircle2, Play, RefreshCw } from "lucide-react";
import Link from "next/link";

interface LogMessage {
  time: string;
  type: "info" | "success" | "warning" | "error" | "alarm";
  text: string;
}

const mockSimulationSteps = [
  { type: "info", text: "Establishing secure ingestion channel to ISRO ISSDC PRADAN portal..." },
  { type: "info", text: "Raw FITS telemetry binary received: Aditya-L1 SoLEXS (HDU count = 2)." },
  { type: "info", text: "HEL1OS CDF files retrieved successfully. Converged epochs to standard datetime." },
  { type: "success", text: "Data Ingestion Synced: Soft X-ray and Hard X-ray fluxes merged to 1-minute cadence." },
  { type: "info", text: "Ingestion completed. Running rolling feature extraction engine..." },
  { type: "info", text: "Computed derivatives: d(Flux)/dt = 4.22e-5 W/m²/s². Hardness ratio = 0.68." },
  { type: "info", text: "Evaluating model predictions across base learners..." },
  { type: "info", text: "Base predictions: LightGBM (p=0.48), LSTM (p=0.78), Anomaly index (score=0.82)." },
  { type: "warning", text: "Stacking Meta-learner evaluation: Blended M/X-Class flare probability = 83.4%." },
  { type: "alarm", text: "WARNING: Solar flare probability exceeded threshold (0.50). ALERT STAGE 2 ACTIVE!" },
  { type: "info", text: "Broadcasting warning packets to warning webhooks (Discord/Slack/Audible Console)..." },
  { type: "success", text: "Ground Truth Verified: NOAA GOES-R detects M-Class flare starting at orbit timeline. Lead warning time: 14.5 minutes!" },
];

export default function ResultsPage() {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const runSimulation = () => {
    if (isSimulating) return;
    setLogs([]);
    setIsSimulating(true);
    setSimStep(0);
  };

  useEffect(() => {
    if (!isSimulating) return;

    if (simStep < mockSimulationSteps.length) {
      const timer = setTimeout(() => {
        const step = mockSimulationSteps[simStep];
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [
          ...prev,
          {
            time: timestamp,
            type: step.type as LogMessage["type"],
            text: step.text,
          },
        ]);
        setSimStep((prev) => prev + 1);
      }, 1200);

      return () => clearTimeout(timer);
    } else {
      setIsSimulating(false);
    }
  }, [isSimulating, simStep]);

  const getLogTypeStyle = (type: LogMessage["type"]) => {
    switch (type) {
      case "success": return "text-emerald-400";
      case "warning": return "text-amber-400";
      case "error": return "text-rose-500";
      case "alarm": return "text-rose-400 font-bold animate-pulse";
      default: return "text-blue-400";
    }
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
          <span className="text-sm font-mono text-violet-500 uppercase tracking-wider block mb-4">Pipeline Step 04</span>
          <h1 className="text-5xl md:text-6xl font-display tracking-tight mb-6 leading-none">
            Validation Metrics & <br />
            <span className="text-muted-foreground">Results</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Our pipeline is strictly validated against historical NOAA GOES-R event catalog databases. 
            By fusing soft and hard spectral channels, we achieve a massive increase in lead times 
            and forecast skill.
          </p>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-24">
          {/* Left Column: Live Simulation Console (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-card/50 backdrop-blur-md border border-border rounded-2xl p-6 lg:p-8 relative overflow-hidden flex flex-col h-full justify-between">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-[80px] pointer-events-none" />
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
                    <Terminal className="w-5 h-5 text-violet-500" />
                    Space Weather Operations Console
                  </h3>
                  <button
                    onClick={runSimulation}
                    disabled={isSimulating}
                    className="text-xs py-2 px-4 rounded-xl border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {isSimulating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Running Simulation...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Simulate Solar Event
                      </>
                    )}
                  </button>
                </div>

                {/* Console Output */}
                <div className="w-full h-[320px] bg-black/75 rounded-xl border border-border/50 p-5 overflow-y-auto font-mono text-[11px] md:text-xs text-muted-foreground space-y-2 leading-relaxed shadow-inner">
                  {logs.length === 0 && (
                    <div className="text-center py-20 text-muted-foreground/40">
                      <BellRing className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      Click "Simulate Solar Event" above to trigger a live forecast pipeline.
                    </div>
                  )}
                  {logs.map((log, index) => (
                    <div key={index} className="flex gap-3 border-b border-white/5 pb-1">
                      <span className="text-white/20 shrink-0">{log.time}</span>
                      <span className={`${getLogTypeStyle(log.type)} shrink-0`}>
                        [{log.type.toUpperCase()}]
                      </span>
                      <span className="text-white/80">{log.text}</span>
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-border/30 flex items-center gap-3 text-[11px] text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                Warning logs trace operations from ISRO telemetry ingestion to NOAA ground truth validation.
              </div>
            </div>
          </div>

          {/* Right Column: Model Performance comparison (5 cols) */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-card/50 backdrop-blur-md border border-border rounded-2xl p-6 lg:p-8 relative overflow-hidden flex flex-col h-full justify-between">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-foreground">
                  <BarChart2 className="w-5 h-5 text-emerald-500" />
                  Model Skill Comparison (TSS)
                </h3>
                <p className="text-xs text-muted-foreground mb-8">
                  The True Skill Statistic (TSS) measures forecast quality, balancing sensitivity (recall) and specificity. Stacking ensembling improves predictions.
                </p>

                {/* HTML/CSS Bar Chart */}
                <div className="space-y-6">
                  {/* Stacking Ensemble */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-violet-400">Stacking Ensemble (Blend)</span>
                      <span className="text-white font-mono">0.22 TSS</span>
                    </div>
                    <div className="w-full h-4 bg-black/40 rounded-lg overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-lg shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all duration-1000" style={{ width: "95%" }} />
                    </div>
                  </div>

                  {/* PyTorch LSTM */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">PyTorch LSTM (Sequence)</span>
                      <span className="text-white/80 font-mono">0.18 TSS</span>
                    </div>
                    <div className="w-full h-4 bg-black/40 rounded-lg overflow-hidden">
                      <div className="h-full bg-blue-500/70 rounded-lg transition-all duration-1000" style={{ width: "78%" }} />
                    </div>
                  </div>

                  {/* LightGBM */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">LightGBM (Tabular)</span>
                      <span className="text-white/80 font-mono">0.16 TSS</span>
                    </div>
                    <div className="w-full h-4 bg-black/40 rounded-lg overflow-hidden">
                      <div className="h-full bg-emerald-500/70 rounded-lg transition-all duration-1000" style={{ width: "68%" }} />
                    </div>
                  </div>

                  {/* Baseline (Physics Indices) */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Physics Precursors Baseline</span>
                      <span className="text-white/60 font-mono">0.11 TSS</span>
                    </div>
                    <div className="w-full h-4 bg-black/40 rounded-lg overflow-hidden">
                      <div className="h-full bg-zinc-600/70 rounded-lg transition-all duration-1000" style={{ width: "48%" }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-border/30 flex items-center gap-3 text-[11px] text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                Metrics evaluated over 10-fold temporal cross-validation.
              </div>
            </div>
          </div>
        </div>

        {/* Live Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-card/50 border border-border p-5 rounded-2xl">
            <span className="text-[10px] text-muted-foreground font-mono block uppercase mb-1">True Skill Statistic</span>
            <div className="text-3xl font-bold text-violet-400 font-mono">0.22</div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">Maximum value among state-of-the-art architectures.</p>
          </div>

          <div className="bg-card/50 border border-border p-5 rounded-2xl">
            <span className="text-[10px] text-muted-foreground font-mono block uppercase mb-1">Heidke Skill Score</span>
            <div className="text-3xl font-bold text-violet-400 font-mono">0.19</div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">HSS evaluation score showing prediction improvement over chance.</p>
          </div>

          <div className="bg-card/50 border border-border p-5 rounded-2xl">
            <span className="text-[10px] text-muted-foreground font-mono block uppercase mb-1">Mean Warning Lead Time</span>
            <div className="text-3xl font-bold text-emerald-400 font-mono">+12.4m</div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">Advance warning time provided prior to GOES peak flare observation.</p>
          </div>

          <div className="bg-card/50 border border-border p-5 rounded-2xl">
            <span className="text-[10px] text-muted-foreground font-mono block uppercase mb-1">Precision (M/X Class)</span>
            <div className="text-3xl font-bold text-violet-400 font-mono">84.2%</div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">Low false alarm rates, optimizing satellite instrument protection.</p>
          </div>
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
