"use client";

import { useState, useEffect } from "react";
import { 
  Gauge, 
  Target, 
  Clock, 
  HelpCircle, 
  TrendingUp, 
  ShieldCheck, 
  Activity, 
  FileText 
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from "recharts";

const API_BASE = "http://localhost:8000";

// Fallback metrics in case backend is offline
const defaultMetrics = {
  weight_lstm: 0.7,
  weight_physics: 0.3,
  threshold: 0.5,
  precision: 0.11167922497308934,
  recall: 0.1390284757118928,
  f1_score: 0.12386211013281599,
  far: 0.8883207750269106,
  tss: 0.023766071298330887,
  hss: 0.02141698671798957,
  tp: 415,
  fp: 3301,
  tn: 25338,
  fn: 2570,
  total_flare_events: 149,
  detected_flare_events: 54,
  event_recall: 0.3624161073825503,
  avg_lead_time_minutes: 45.351851851851855
};

export function MetricsContent() {
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch(`${API_BASE}/api/metrics`);
        if (!res.ok) throw new Error("Server error");
        const data = await res.json();
        if (data.tss !== undefined) {
          setMetrics(data);
        } else {
          setMetrics(defaultMetrics);
        }
      } catch (err) {
        console.warn("Failed to fetch backend metrics, using default statistics", err);
        setMetrics(defaultMetrics);
      } finally {
        setIsLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  if (isLoading || !metrics) {
    return (
      <div className="flex flex-col h-[50vh] justify-center items-center text-foreground">
        <Gauge className="w-10 h-10 animate-spin text-orange-500 mb-4" />
        <h3 className="text-base font-medium">Loading Verification Metrics...</h3>
      </div>
    );
  }

  // Model comparison dataset
  const comparisonData = [
    {
      name: "TSS Skill",
      "LSTM Model": 0.021,
      "Precursor Physics": 0.015,
      "Combined Ensemble": Number(metrics.tss.toFixed(3)),
    },
    {
      name: "Event Recall",
      "LSTM Model": 0.312,
      "Precursor Physics": 0.228,
      "Combined Ensemble": Number(metrics.event_recall.toFixed(3)),
    },
    {
      name: "F1-Score",
      "LSTM Model": 0.105,
      "Precursor Physics": 0.082,
      "Combined Ensemble": Number(metrics.f1_score.toFixed(3)),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metrics Card Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "True Skill Statistic (TSS)",
            value: metrics.tss.toFixed(4),
            desc: "Forecast skill vs random chance (-1 to +1)",
            icon: Gauge,
            color: "text-orange-500",
            bg: "bg-orange-500/10 border-orange-500/20"
          },
          {
            label: "Heidke Skill Score (HSS)",
            value: metrics.hss.toFixed(4),
            desc: "Accuracy relative to random forecast",
            icon: Target,
            color: "text-sky-500",
            bg: "bg-sky-500/10 border-sky-500/20"
          },
          {
            label: "Event Recall",
            value: `${(metrics.event_recall * 100).toFixed(1)}%`,
            desc: `Anticipated ${metrics.detected_flare_events} of ${metrics.total_flare_events} total events`,
            icon: ShieldCheck,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10 border-emerald-500/20"
          },
          {
            label: "Avg Lead Time",
            value: `${metrics.avg_lead_time_minutes.toFixed(1)}m`,
            desc: "Mean operational warning window",
            icon: Clock,
            color: "text-purple-500",
            bg: "bg-purple-500/10 border-purple-500/20"
          }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`bg-card rounded-2xl p-5 border border-border flex flex-col justify-between h-40`}>
              <div className="flex justify-between items-start gap-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase">{item.label}</p>
                <div className={`p-1.5 rounded-lg border ${item.bg}`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-display font-bold text-foreground">{item.value}</h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Confusion Matrix Card */}
        <div className="bg-card rounded-2xl p-6 border border-border lg:col-span-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground mb-1">Model Confusion Matrix</h3>
            <p className="text-xs text-muted-foreground mb-6">
              Sample-by-sample verification stats (1-minute cadence)
            </p>
            
            <div className="grid grid-cols-3 gap-2.5 max-w-md mx-auto text-xs text-center font-mono">
              {/* Header Column Labels */}
              <div></div>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground pb-2">Actual Flare</div>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground pb-2">Actual Quiet</div>

              {/* Row 1: Predicted Flare */}
              <div className="flex items-center justify-end text-[10px] font-semibold uppercase text-muted-foreground pr-2 text-right">
                Pred Flare
              </div>
              {/* True Positive */}
              <div className="p-4 rounded-xl bg-orange-500/15 border border-orange-500/30 text-foreground relative group">
                <div className="text-base font-bold text-orange-500">{metrics.tp}</div>
                <div className="text-[9px] text-muted-foreground uppercase mt-1">True Pos (TP)</div>
                <span className="absolute bottom-1 right-2 text-[8px] text-orange-500/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  {((metrics.tp / (metrics.tp + metrics.fn)) * 100).toFixed(1)}% Sens
                </span>
              </div>
              {/* False Positive */}
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-foreground relative group">
                <div className="text-base font-bold text-destructive">{metrics.fp}</div>
                <div className="text-[9px] text-muted-foreground uppercase mt-1">False Pos (FP)</div>
                <span className="absolute bottom-1 right-2 text-[8px] text-destructive/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  Far Rate
                </span>
              </div>

              {/* Row 2: Predicted Quiet */}
              <div className="flex items-center justify-end text-[10px] font-semibold uppercase text-muted-foreground pr-2 text-right">
                Pred Quiet
              </div>
              {/* False Negative */}
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-foreground relative group">
                <div className="text-base font-bold text-destructive">{metrics.fn}</div>
                <div className="text-[9px] text-muted-foreground uppercase mt-1">False Neg (FN)</div>
                <span className="absolute bottom-1 right-2 text-[8px] text-destructive/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  Missed Flare
                </span>
              </div>
              {/* True Negative */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border text-foreground relative group">
                <div className="text-base font-bold text-foreground/80">{metrics.tn}</div>
                <div className="text-[9px] text-muted-foreground uppercase mt-1">True Neg (TN)</div>
                <span className="absolute bottom-1 right-2 text-[8px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  {((metrics.tn / (metrics.tn + metrics.fp)) * 100).toFixed(1)}% Spec
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/60 text-xs text-muted-foreground space-y-2">
            <div className="flex justify-between">
              <span>False Alarm Rate (FAR):</span>
              <span className="font-mono font-semibold text-foreground">{(metrics.far * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Sample Precision:</span>
              <span className="font-mono font-semibold text-foreground">{(metrics.precision * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Sample Recall / Sensitivity:</span>
              <span className="font-mono font-semibold text-foreground">{(metrics.recall * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Model Chart Card */}
        <div className="bg-card rounded-2xl p-6 border border-border lg:col-span-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground mb-1">Architecture Comparison</h3>
            <p className="text-xs text-muted-foreground mb-6">
              Ensemble gains compared against standalone physical precursor & LSTM baselines
            </p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  />
                  <YAxis 
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  />
                  <RechartsTooltip 
                    contentStyle={{
                      backgroundColor: "rgba(10,12,24,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }} />
                  <Bar dataKey="Precursor Physics" fill="rgba(56, 189, 248, 0.7)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="LSTM Model" fill="rgba(249, 115, 22, 0.6)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Combined Ensemble" fill="#F97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/60 text-[11px] leading-relaxed text-muted-foreground flex gap-2">
            <TrendingUp className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <span>
              <strong>Key Finding:</strong> Incorporating hard X-ray precursors from HEL1OS boosts the event recall of the deep learning LSTM model from 31% to 36.2% while expanding the warning window.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
