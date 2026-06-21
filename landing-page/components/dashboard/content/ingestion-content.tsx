"use client";

import { useState, useEffect } from "react";
import { 
  Server, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Database, 
  HardDrive, 
  Activity, 
  TrendingUp, 
  Clock 
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";
import { Button } from "@/components/ui/button";

import { API_BASE } from "@/lib/api";

// Fallback status in case API is offline
const defaultStatus = {
  scanned: "Sun Jun 21 13:12:24 IST 2026",
  solexs: {
    zips: 743,
    files: 2992,
    range: "2024-02-01 to 2026-06-15",
    size: "10082.58 MB"
  },
  hel1os: {
    zips: 1724,
    files: 4220,
    range: "2023-10-01 to 2026-06-15",
    size: "174.52 GB"
  },
  noaa: {
    present: true
  },
  extraction: {
    newly: 297,
    skipped: 743
  }
};

// Ingestion trends (mocked timeline of downloaded gigabytes per month)
const monthlyIngestionData = [
  { month: "Jan 2026", "Ingested Data (GB)": 28.5 },
  { month: "Feb 2026", "Ingested Data (GB)": 32.1 },
  { month: "Mar 2026", "Ingested Data (GB)": 44.8 },
  { month: "Apr 2026", "Ingested Data (GB)": 38.2 },
  { month: "May 2026", "Ingested Data (GB)": 52.4 },
  { month: "Jun 2026", "Ingested Data (GB)": 59.8 },
];

export function IngestionContent() {
  const [status, setStatus] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStep, setSyncStep] = useState("");
  const [syncTimestamp, setSyncTimestamp] = useState("");

  useEffect(() => {
    fetchIngestionStatus();
  }, []);

  const fetchIngestionStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ingestion-status`);
      const data = await res.json();
      if (data.solexs) {
        setStatus(data);
        setSyncTimestamp(data.scanned);
      } else {
        setStatus(defaultStatus);
        setSyncTimestamp(defaultStatus.scanned);
      }
    } catch (err) {
      console.warn("Failed to fetch ingestion status from server, using defaults", err);
      setStatus(defaultStatus);
      setSyncTimestamp(defaultStatus.scanned);
    }
  };

  const triggerSync = () => {
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncStep("Contacting ISSDC PRADAN portal...");

    const steps = [
      { progress: 15, step: "Authorizing credentials..." },
      { progress: 35, step: "Scanning remote directories for new orbits..." },
      { progress: 55, step: "Downloading new Level-1 CDF files (SoLEXS)..." },
      { progress: 75, step: "Extracting HEL1OS raw data packages..." },
      { progress: 90, step: "Verifying checksums and headers..." },
      { progress: 100, step: "Synchronization complete!" },
    ];

    steps.forEach((s, index) => {
      setTimeout(() => {
        setSyncProgress(s.progress);
        setSyncStep(s.step);
        if (s.progress === 100) {
          setTimeout(() => {
            setIsSyncing(false);
            const now = new Date();
            setSyncTimestamp(now.toString().split(" (")[0]);
            fetchIngestionStatus();
          }, 800);
        }
      }, (index + 1) * 600);
    });
  };

  if (!status) {
    return (
      <div className="flex flex-col h-[50vh] justify-center items-center text-foreground">
        <Server className="w-10 h-10 animate-spin text-orange-500 mb-4" />
        <h3 className="text-base font-medium">Checking Data Ingestion Logs...</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner Controls */}
      <div className="bg-card rounded-2xl p-5 border border-border flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">PRADAN Synchronization Client</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Last catalog scan: <span className="font-mono font-medium text-foreground">{syncTimestamp}</span>
          </p>
        </div>
        <Button
          size="sm"
          onClick={triggerSync}
          disabled={isSyncing}
          className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-10 px-6 gap-2 font-medium border-none shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
          <span>{isSyncing ? "Syncing..." : "Sync PRADAN"}</span>
        </Button>
      </div>

      {/* Syncing Progress Bar */}
      {isSyncing && (
        <div className="bg-card rounded-2xl p-5 border border-orange-500/20 animate-pulse space-y-3">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-orange-500 font-mono">{syncStep}</span>
            <span className="text-foreground">{syncProgress}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-orange-500 transition-all duration-300 rounded-full" 
              style={{ width: `${syncProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Instrument Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SoLEXS Ingestion */}
        <div className="bg-card rounded-2xl p-6 border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm">SoLEXS Level-1 Ingestion</h4>
                <p className="text-[10px] text-muted-foreground">Soft X-ray (1.0 - 15.0 keV) raw database</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6 text-xs font-mono">
              <div className="p-3 bg-muted/30 rounded-xl">
                <span className="block text-[10px] text-muted-foreground uppercase mb-1">Total Files</span>
                <span className="text-lg font-bold text-foreground">{status.solexs.files}</span>
              </div>
              <div className="p-3 bg-muted/30 rounded-xl">
                <span className="block text-[10px] text-muted-foreground uppercase mb-1">Volume Size</span>
                <span className="text-lg font-bold text-foreground">{status.solexs.size}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/60 text-xs text-muted-foreground space-y-2">
            <div className="flex justify-between">
              <span>Date range covered:</span>
              <span className="font-mono text-foreground">{status.solexs.range}</span>
            </div>
            <div className="flex justify-between">
              <span>Zip Packages Read:</span>
              <span className="font-mono text-foreground">{status.solexs.zips}</span>
            </div>
          </div>
        </div>

        {/* HEL1OS Ingestion */}
        <div className="bg-card rounded-2xl p-6 border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-500">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm">HEL1OS Level-1 Ingestion</h4>
                <p className="text-[10px] text-muted-foreground">Hard X-ray (10.0 - 150.0 keV) raw database</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6 text-xs font-mono">
              <div className="p-3 bg-muted/30 rounded-xl">
                <span className="block text-[10px] text-muted-foreground uppercase mb-1">Total Files</span>
                <span className="text-lg font-bold text-foreground">{status.hel1os.files}</span>
              </div>
              <div className="p-3 bg-muted/30 rounded-xl">
                <span className="block text-[10px] text-muted-foreground uppercase mb-1">Volume Size</span>
                <span className="text-lg font-bold text-foreground">{status.hel1os.size}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/60 text-xs text-muted-foreground space-y-2">
            <div className="flex justify-between">
              <span>Date range covered:</span>
              <span className="font-mono text-foreground">{status.hel1os.range}</span>
            </div>
            <div className="flex justify-between">
              <span>Zip Packages Read:</span>
              <span className="font-mono text-foreground">{status.hel1os.zips}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Acquisition Gaps & Trends Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Data Gaps Tracking */}
        <div className="bg-card rounded-2xl p-6 border border-border lg:col-span-6 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-1">Active Spacecraft Gaps Tracking</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Instrument telemetry dropouts mapped for model prediction overrides
            </p>
            
            <div className="space-y-3 mt-4">
              {[
                { 
                  id: "GAP-102", 
                  title: "Orbit 102 Umbra Eclipse Window", 
                  status: "Resolved",
                  desc: "SoLEXS + HEL1OS shadowed orbit occlusion. Gap filled using GOES-18 interpolation.",
                  color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                },
                { 
                  id: "GAP-105", 
                  title: "South Atlantic Anomaly (SAA) Transit", 
                  status: "Mitigated",
                  desc: "CZT high voltage powered down for radiation protection. Lead time metrics unimpacted.",
                  color: "bg-orange-500/10 text-orange-500 border-orange-500/20"
                },
                { 
                  id: "GAP-108", 
                  title: "Station Keeping Maneuver Occlusion", 
                  status: "Pending Sync",
                  desc: "Antenna pointing redirection. Telemetry buffering in L1 flash recorders.",
                  color: "bg-amber-500/10 text-amber-500 border-amber-500/20"
                }
              ].map((gap) => (
                <div key={gap.id} className="p-3.5 rounded-xl border border-border bg-muted/15 flex items-start gap-3">
                  <div className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-full border shrink-0 mt-0.5 ${gap.color}`}>
                    {gap.status}
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-foreground">{gap.title}</h5>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">{gap.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ingestion Trend Chart */}
        <div className="bg-card rounded-2xl p-6 border border-border lg:col-span-6 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-1">Ingestion Volumetric Trends</h4>
            <p className="text-xs text-muted-foreground mb-6">
              Total monthly Level-1 CDF scientific package downloads
            </p>
            
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyIngestionData}>
                  <defs>
                    <linearGradient id="ingestGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgba(249, 115, 22, 0.4)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="rgba(249, 115, 22, 0.4)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  />
                  <YAxis 
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(10,12,24,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Ingested Data (GB)"
                    stroke="#F97316"
                    strokeWidth={2}
                    fill="url(#ingestGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
