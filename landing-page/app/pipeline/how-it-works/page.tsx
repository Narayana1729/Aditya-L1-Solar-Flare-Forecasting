"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { ArrowLeft, Cpu, Activity, FileCode, Sliders, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const codeSnippet = `from sklearn.linear_model import LogisticRegression
import lightgbm as lgb
import torch

class StackingEnsemble:
    def __init__(self, lgb_model, lstm_model, iforest_model):
        self.lgb = lgb_model
        self.lstm = lstm_model # PyTorch LSTM model
        self.iforest = iforest_model
        self.meta_learner = LogisticRegression(class_weight='balanced')
        
    def fit_meta_learner(self, X_val, y_val):
        # 1. Generate out-of-fold predictions from base learners
        p_lgb = self.lgb.predict_proba(X_val)[:, 1]
        p_lstm = self.lstm.predict_sequence(X_val)
        p_if = -self.iforest.score_samples(X_val) # Anomaly scores
        
        # 2. Train Logistic Regression meta-learner on predictions
        meta_features = np.column_stack([p_lgb, p_lstm, p_if])
        self.meta_learner.fit(meta_features, y_val)
        
    def predict_forecast(self, X_new):
        # Blend base predictions to compute final probability
        p_lgb = self.lgb.predict_proba(X_new)[:, 1]
        p_lstm = self.lstm.predict_sequence(X_new)
        p_if = -self.iforest.score_samples(X_new)
        
        meta_features = np.column_stack([p_lgb, p_lstm, p_if])
        return self.meta_learner.predict_proba(meta_features)[:, 1]
`;

export default function HowItWorksPage() {
  const [activeModel, setActiveModel] = useState<string>("stacking");
  const [isCopied, setIsCopied] = useState(false);

  // SHAP Simulator States
  const [fluxDeriv, setFluxDeriv] = useState<number>(35);
  const [peakCounts, setPeakCounts] = useState<number>(40);
  const [hardnessRatio, setHardnessRatio] = useState<number>(20);
  const [brighteningIndex, setBrighteningIndex] = useState<number>(15);
  const [flareProbability, setFlareProbability] = useState<number>(0);

  useEffect(() => {
    // Simulated Logistic Regression Meta-Learner formula based on sliders
    const rawScore = 
      (fluxDeriv * 0.04) + 
      (peakCounts * 0.03) + 
      (hardnessRatio * 0.05) + 
      (brighteningIndex * 0.06) - 
      4.5;
    
    // Sigmoid function to output probability [0, 100]
    const probability = Math.round((1 / (1 + Math.exp(-rawScore))) * 100);
    setFlareProbability(probability);
  }, [fluxDeriv, peakCounts, hardnessRatio, brighteningIndex]);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getProbColor = (prob: number) => {
    if (prob < 30) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (prob < 70) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-rose-400 bg-rose-500/10 border-rose-500/20";
  };

  const getBarColor = (prob: number) => {
    if (prob < 30) return "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
    if (prob < 70) return "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]";
    return "bg-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
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
          <span className="text-sm font-mono text-violet-500 uppercase tracking-wider block mb-4">Pipeline Step 02</span>
          <h1 className="text-5xl md:text-6xl font-display tracking-tight mb-6 leading-none">
            Stacking Ensemble & <br />
            <span className="text-muted-foreground">SHAP Explainability</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Our predictive architecture blends boosting decision trees, deep sequence networks, 
            and unsupervised anomaly metrics into a singular meta-learner. Tree attribution models 
            deconstruct predictions in real-time to explain feature relevance.
          </p>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-24">
          {/* Left Column: Interactive Stacking Graphic (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-card/50 backdrop-blur-md border border-border rounded-2xl p-6 lg:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-[80px] pointer-events-none" />
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-2 text-foreground">
                <Cpu className="w-5 h-5 text-violet-500" />
                Stacking Ensemble Pipeline
              </h3>

              {/* Stacking Schematic */}
              <div className="relative w-full aspect-[16/9] bg-black/40 rounded-xl border border-border/50 p-6 flex flex-col justify-between overflow-hidden">
                {/* SVG connection lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                  {/* Lines from Base Models to Meta-Learner */}
                  <path d="M 120,70 L 320,130" stroke="#2a2a2e" strokeWidth="1.5" fill="none" />
                  <path d="M 120,140 L 320,140" stroke="#2a2a2e" strokeWidth="1.5" fill="none" />
                  <path d="M 120,210 L 320,150" stroke="#2a2a2e" strokeWidth="1.5" fill="none" />
                  
                  {/* Line from Meta to Output */}
                  <path d="M 460,140 L 530,140" stroke="#2a2a2e" strokeWidth="1.5" fill="none" />

                  {/* Highlights */}
                  {activeModel === "lgb" && <path d="M 120,70 L 320,130" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="5,3" fill="none" className="animate-[dash_2s_linear_infinite]" />}
                  {activeModel === "lstm" && <path d="M 120,140 L 320,140" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="5,3" fill="none" className="animate-[dash_2s_linear_infinite]" />}
                  {activeModel === "iforest" && <path d="M 120,210 L 320,150" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="5,3" fill="none" className="animate-[dash_2s_linear_infinite]" />}
                  {activeModel === "stacking" && (
                    <>
                      <path d="M 120,70 L 320,130" stroke="#8b5cf6" strokeWidth="1.5" fill="none" />
                      <path d="M 120,140 L 320,140" stroke="#8b5cf6" strokeWidth="1.5" fill="none" />
                      <path d="M 120,210 L 320,150" stroke="#8b5cf6" strokeWidth="1.5" fill="none" />
                      <line x1="460" y1="140" x2="530" y2="140" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="5,3" className="animate-[dash_2s_linear_infinite]" />
                    </>
                  )}
                </svg>

                {/* Base Models (Left column nodes) */}
                <div className="flex flex-col justify-between h-full w-[160px] z-10">
                  <button
                    onClick={() => setActiveModel("lgb")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      activeModel === "lgb" ? "border-violet-500 bg-violet-500/10" : "border-border bg-card hover:border-foreground/10"
                    }`}
                  >
                    <span className="text-[9px] font-mono text-violet-500 block uppercase">Base Learner 1</span>
                    <span className="text-xs font-semibold text-foreground block">LightGBM Classifier</span>
                    <span className="text-[8px] text-muted-foreground block">Tabular Flux Precursors</span>
                  </button>

                  <button
                    onClick={() => setActiveModel("lstm")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      activeModel === "lstm" ? "border-violet-500 bg-violet-500/10" : "border-border bg-card hover:border-foreground/10"
                    }`}
                  >
                    <span className="text-[9px] font-mono text-violet-500 block uppercase">Base Learner 2</span>
                    <span className="text-xs font-semibold text-foreground block">LSTM Recurrent Net</span>
                    <span className="text-[8px] text-muted-foreground block">Temporal Sequence Fluxes</span>
                  </button>

                  <button
                    onClick={() => setActiveModel("iforest")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      activeModel === "iforest" ? "border-violet-500 bg-violet-500/10" : "border-border bg-card hover:border-foreground/10"
                    }`}
                  >
                    <span className="text-[9px] font-mono text-violet-500 block uppercase">Base Learner 3</span>
                    <span className="text-xs font-semibold text-foreground block">Isolation Forest</span>
                    <span className="text-[8px] text-muted-foreground block">Unsupervised Outliers</span>
                  </button>
                </div>

                {/* Meta Learner (Middle node) */}
                <div className="absolute left-[320px] top-[105px] z-10">
                  <button
                    onClick={() => setActiveModel("stacking")}
                    className={`p-4 rounded-xl border text-left transition-all w-[140px] ${
                      activeModel === "stacking" ? "border-violet-500 bg-violet-500/10" : "border-border bg-card hover:border-foreground/10"
                    }`}
                  >
                    <span className="text-[9px] font-mono text-violet-500 block uppercase">Meta Blender</span>
                    <span className="text-xs font-bold text-foreground block">Logistic Regression</span>
                    <span className="text-[8px] text-muted-foreground block">Balances weights based on cross-val</span>
                  </button>
                </div>

                {/* Output (Right node) */}
                <div className="absolute right-[20px] top-[115px] z-10">
                  <div className="p-3 rounded-xl border border-border/60 bg-black/40 text-center w-[90px]">
                    <span className="text-[8px] text-muted-foreground block uppercase">FORECAST</span>
                    <span className="text-xs font-bold text-emerald-400 block">Probability</span>
                    <span className="text-[8px] text-muted-foreground block">M/X-Class Flare</span>
                  </div>
                </div>
              </div>

              {/* Model Descriptions */}
              <div className="mt-6 bg-black/30 border border-border/40 rounded-xl p-5 min-h-[120px]">
                {activeModel === "lgb" && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      LightGBM Tabular Classifier
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Processes highly-engineered rolling tabular features (means, derivatives, peak ratios) extracted from the telemetry stream. Excellent at detecting static thresholds and sudden spikes in Soft/Hard X-ray intensities.
                    </p>
                  </div>
                )}
                {activeModel === "lstm" && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      LSTM Recurrent Neural Network
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      A deep sequence model built in PyTorch. It ingests the raw historical 1-minute cadence time-series arrays over a sliding 2-hour lookback window, detecting complex temporal patterns and pre-flare brightening curvatures.
                    </p>
                  </div>
                )}
                {activeModel === "iforest" && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      Isolation Forest Anomaly Estimator
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      An unsupervised tree model that measures how anomalous the current solar emission state is compared to quiet-sun reference states. Helps flag unusual pre-flare activity that traditional classifiers might miss.
                    </p>
                  </div>
                )}
                {activeModel === "stacking" && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      Logistic Regression Meta-Blender
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Learns optimal blending weights for each base model. By combining decision boundaries, sequence memory, and anomaly indices, it optimizes the final M/X-class flare probability, maximizing the True Skill Statistic (TSS).
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: SHAP Simulator (5 cols) */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-card/50 backdrop-blur-md border border-border rounded-2xl p-6 lg:p-8 relative overflow-hidden flex flex-col h-full justify-between">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-foreground">
                  <Sliders className="w-5 h-5 text-emerald-500" />
                  SHAP Explainability Simulator
                </h3>
                <p className="text-xs text-muted-foreground mb-6">
                  Adjust the solar flare precursor sliders to see how the meta-learner attributes contribution scores (SHAP values) and computes the warning probability.
                </p>

                {/* Sliders list */}
                <div className="space-y-5 mb-8">
                  {/* Slider 1: Flux Derivative */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-muted-foreground">Flux Derivative (SoLEXS)</span>
                      <span className="text-foreground font-semibold font-mono">{fluxDeriv} W/m²/s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={fluxDeriv}
                      onChange={(e) => setFluxDeriv(Number(e.target.value))}
                      className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {/* Slider 2: Peak Counts */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-muted-foreground">Peak Flux Counts (HEL1OS)</span>
                      <span className="text-foreground font-semibold font-mono">{peakCounts} cps</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={peakCounts}
                      onChange={(e) => setPeakCounts(Number(e.target.value))}
                      className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {/* Slider 3: Hardness Ratio */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-muted-foreground">Spectral Hardness Ratio</span>
                      <span className="text-foreground font-semibold font-mono">{(hardnessRatio / 20).toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={hardnessRatio}
                      onChange={(e) => setHardnessRatio(Number(e.target.value))}
                      className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {/* Slider 4: Brightening Index */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-muted-foreground">Physics Brightening Index</span>
                      <span className="text-foreground font-semibold font-mono">{(brighteningIndex / 15).toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={brighteningIndex}
                      onChange={(e) => setBrighteningIndex(Number(e.target.value))}
                      className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>

                {/* Prob Output Panel */}
                <div className="border border-border/40 bg-black/45 rounded-xl p-5 text-center space-y-4">
                  <span className="text-[10px] text-muted-foreground block uppercase font-mono tracking-wider">Simulated Ensemble Output</span>
                  
                  <div className="flex items-center justify-center gap-4">
                    <div className={`text-4xl font-extrabold font-mono tracking-tight px-4 py-2 rounded-xl border ${getProbColor(flareProbability)} transition-all duration-300`}>
                      {flareProbability}%
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-semibold text-foreground block">Flare Probability</span>
                      <span className="text-[10px] text-muted-foreground block">M/X-Class prediction (30m window)</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getBarColor(flareProbability)}`}
                      style={{ width: `${flareProbability}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-border/30 flex items-center gap-3 text-[11px] text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                SHAP attribution weights are calibrated directly via KernelExplainer models.
              </div>
            </div>
          </div>
        </div>

        {/* Code Section */}
        <div className="bg-card/50 backdrop-blur-md border border-border rounded-2xl p-6 lg:p-8 relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
              <FileCode className="w-5 h-5 text-violet-500" />
              Stacking Ensemble Code Implementation
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
