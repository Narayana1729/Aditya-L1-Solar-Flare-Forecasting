"use client";
 
import { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Calendar as CalendarIcon, 
  ShieldAlert, 
  Sliders, 
  Activity, 
  Flame, 
  Clock 
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
 
const API_BASE = "http://127.0.0.1:8000";

// Helper functions to prevent timezone shifts when parsing/formatting dates
const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return undefined;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return undefined;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-based
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
};

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const playAlarmSound = (frequency: number, duration: number) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.error("Failed to play audio alert", err);
  }
};

export function TelemetryContent() {
  const [isRunning, setIsRunning] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1000); // ms per tick
  const [groupedDates, setGroupedDates] = useState<Record<string, string[]>>({});
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [realtime, setRealtime] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lstmWeight, setLstmWeight] = useState<number>(0.7);
  const [threshold, setThreshold] = useState<number>(0.5);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prevStatusRef = useRef<string>("GREEN");
 
  const flareDatesSet = new Set(Object.values(groupedDates).flat());
 
  // Fetch initial setup data
  useEffect(() => {
    fetchDates();
    resetSimulation();
    fetchWeights();
  }, []);

  // Trigger Web Audio and Speech Alerts when warningStatus escalates
  useEffect(() => {
    if (!realtime) return;
    
    // Determine the active alert level
    const current = realtime.current || {};
    const currentLstm = current.lstm_prob !== null ? current.lstm_prob : 0.0;
    const currentPhysics = current.physics_precursor_score !== null ? current.physics_precursor_score : 0.0;
    const liveEnsembleProb = currentLstm * lstmWeight + currentPhysics * (1.0 - lstmWeight);
    
    let status = "GREEN";
    const yellowThreshold = Math.max(0.1, threshold - 0.2);
    if (liveEnsembleProb >= threshold) {
      status = "RED";
    } else if (liveEnsembleProb >= yellowThreshold) {
      status = "YELLOW";
    }
    
    if (status !== prevStatusRef.current) {
      if (status === "RED") {
        if (localStorage.getItem("settings_voice_alerts") === "true") {
          const utterance = new SpeechSynthesisUtterance("Critical Alert. Solar flare peak imminent. Deploying spacecraft safe mode.");
          window.speechSynthesis?.speak(utterance);
        }
        if (localStorage.getItem("settings_siren_sound") === "true") {
          playAlarmSound(880, 0.5);
        }
      } else if (status === "YELLOW") {
        if (localStorage.getItem("settings_voice_alerts") === "true") {
          const utterance = new SpeechSynthesisUtterance("Warning. Precursor solar heating detected.");
          window.speechSynthesis?.speak(utterance);
        }
        if (localStorage.getItem("settings_siren_sound") === "true") {
          playAlarmSound(440, 0.3);
        }
      }
      prevStatusRef.current = status;
    }
  }, [realtime, lstmWeight, threshold]);
 
  // Simulation loop trigger
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/realtime`);
          const data = await res.json();
          if (data.error) {
            setError(data.error);
            setIsRunning(false);
          } else {
            setRealtime(data);
          }
        } catch (err) {
          console.error("Error polling realtime data", err);
        }
      }, simulationSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
 
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, simulationSpeed]);
 
  // Fetch dates (grouped by year)
  const fetchDates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/flare-dates-grouped`);
      const data = await res.json();
      setGroupedDates(data);
      
      const allDates = Object.values(data).flat() as string[];
      if (allDates.length > 0 && !selectedDate) {
        setSelectedDate(allDates[0]);
      }
    } catch (err) {
      console.error("Failed to fetch flare dates", err);
    }
  };
 
  // Fetch backend configuration weights
  const fetchWeights = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/metrics`);
      const data = await res.json();
      if (data.weight_lstm !== undefined) {
        setLstmWeight(data.weight_lstm);
      }
      if (data.threshold !== undefined) {
        setThreshold(data.threshold);
      }
    } catch (err) {
      console.error("Failed to fetch model weights", err);
    }
  };
 
  // Set simulation date
  const handleDateChange = async (dateVal: string) => {
    setSelectedDate(dateVal);
    setIsRunning(false);
    try {
      const res = await fetch(`${API_BASE}/api/set-simulation-date?date=${dateVal}`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setError(null);
        const tickRes = await fetch(`${API_BASE}/api/realtime?reset=true`);
        const tickData = await tickRes.json();
        setRealtime(tickData);
      }
    } catch (err) {
      setError("Failed to set simulation date.");
    }
  };
 
  // Reset simulation
  const resetSimulation = async () => {
    setIsRunning(false);
    try {
      const res = await fetch(`${API_BASE}/api/realtime?reset=true`);
      const data = await res.json();
      setRealtime(data);
      setError(null);
    } catch (err) {
      setError("Failed to connect to forecasting server.");
    }
  };
 
  // Helper to format ISO timestamps to clock times
  const formatTime = (isoString: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toTimeString().split(" ")[0].substring(0, 5);
  };
 
  if (!realtime) {
    return (
      <div className="flex flex-col h-[50vh] justify-center items-center text-foreground">
        <Activity className="w-10 h-10 animate-spin text-orange-500 mb-4" />
        <h3 className="text-base font-medium">Connecting to Aditya-L1 API Server...</h3>
        <p className="text-sm text-muted-foreground mt-1">Make sure the Python backend is running on port 8000</p>
        {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
      </div>
    );
  }
 
  const current = realtime.current || {};
  const history = realtime.history || [];
 
  // Compute live ensemble probability based on current weights
  const currentLstm = current.lstm_prob !== null ? current.lstm_prob : 0.0;
  const currentPhysics = current.physics_precursor_score !== null ? current.physics_precursor_score : 0.0;
  const liveEnsembleProb = currentLstm * lstmWeight + currentPhysics * (1.0 - lstmWeight);
  
  const brightening = current.solexs_brightening !== null && current.solexs_brightening !== undefined ? current.solexs_brightening : 0.0;
  const hardening = current.spectral_hardening !== null && current.spectral_hardening !== undefined ? current.spectral_hardening : 0.0;
  const microflare = current.microflare_score !== null && current.microflare_score !== undefined ? current.microflare_score : 0.0;
 
  let warningStatus = "GREEN";
  let warningDesc = "QUIET: Normal solar background activity";
  let warningAction = "All instruments in nominal acquisition state. Spacecraft is oriented for active science telemetry.";
  let statusColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  let pulseColor = "bg-emerald-500";
 
  const yellowThreshold = Math.max(0.1, threshold - 0.2);
  if (liveEnsembleProb >= threshold) {
    warningStatus = "RED";
    warningDesc = "CRITICAL: Solar Flare Peak Imminent (< 30m)";
    warningAction = "ACTION ADVISE: Spacecraft safe-mode. Close shutter valves, power down high-voltage subsystems, align spacecraft orientation to minimize X-ray flux damage.";
    statusColor = "bg-destructive/10 text-destructive border-destructive/20";
    pulseColor = "bg-destructive";
  } else if (liveEnsembleProb >= yellowThreshold) {
    warningStatus = "YELLOW";
    warningDesc = "WARNING: Precursor heating/hardening detected";
    warningAction = "ACTION ADVISE: Payload watch state. Deploy high-cadence monitoring. Prepare CDTe detectors for high flux absorption.";
    statusColor = "bg-orange-500/10 text-orange-500 border-orange-500/20";
    pulseColor = "bg-orange-500";
  }
 
  // Energy count rates
  const solexsCount = current.solexs_sdd2_counts !== null ? current.solexs_sdd2_counts.toFixed(1) : "N/A";
  const cztLow = current.hel1os_czt1_20_to_40_ctr !== null ? current.hel1os_czt1_20_to_40_ctr.toFixed(1) : "N/A";
  const cztHigh = current.hel1os_czt1_80_to_150_ctr !== null ? current.hel1os_czt1_80_to_150_ctr.toFixed(1) : "N/A";
  const cdteCount = current.hel1os_cdte1_5_to_20_ctr !== null ? current.hel1os_cdte1_5_to_20_ctr.toFixed(1) : "N/A";
 
  // Prepare chart dataset
  const chartData = history.map((h: any) => ({
    time: formatTime(h.timestamp),
    "Soft X-ray (SoLEXS)": h.solexs_sdd2_counts || 0,
    "Hard X-ray (HEL1OS)": (h.hel1os_cdte1_5_to_20_ctr || 0) + (h.hel1os_czt1_20_to_40_ctr || 0),
    "Forecast Probability": (h.lstm_prob * lstmWeight + (h.physics_precursor_score || 0) * (1 - lstmWeight)) * 100,
  }));
 
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Simulation Controls Panel */}
      <div className="bg-card rounded-2xl p-5 border border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsRunning(!isRunning)}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-10 w-28 gap-2 flex items-center justify-center font-medium shadow-sm transition-all border-none"
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Play</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetSimulation}
            className="rounded-xl border-border bg-transparent h-10 gap-2 font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </Button>
        </div>
 
        <div className="flex flex-wrap items-center gap-6 text-sm">
          {/* Speed Selector */}
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Playback Interval:</span>
            <select
              value={simulationSpeed}
              onChange={(e) => setSimulationSpeed(Number(e.target.value))}
              className="bg-muted px-2.5 py-1.5 rounded-lg border border-border text-xs focus:outline-none"
            >
              <option value={2000}>Slow (2s)</option>
              <option value={1000}>Normal (1s)</option>
              <option value={500}>Fast (0.5s)</option>
            </select>
          </div>
 
          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Select Simulation Date:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border border-border bg-muted px-2.5 py-1.5 h-8 font-normal text-xs justify-start gap-2 hover:bg-muted/80 text-foreground"
                >
                  {selectedDate || "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate ? parseLocalDate(selectedDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      const formatted = getLocalDateString(date);
                      handleDateChange(formatted);
                    }
                  }}
                  disabled={(date) => {
                    const minD = new Date("2024-02-01T00:00:00");
                    const maxD = new Date("2026-06-15T00:00:00");
                    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                    const compareMin = new Date(minD.getFullYear(), minD.getMonth(), minD.getDate());
                    const compareMax = new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate());
                    return compareDate < compareMin || compareDate > compareMax;
                  }}
                  modifiers={{
                    hasFlare: (date) => {
                      const formatted = getLocalDateString(date);
                      return flareDatesSet.has(formatted);
                    }
                  }}
                  modifiersClassNames={{
                    hasFlare: "relative font-semibold text-orange-500 after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-orange-500"
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
 
      {/* Visual Alerts Warning Panel */}
      <div className={`rounded-2xl border p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all duration-500 ${statusColor}`}>
        <div className="flex items-start gap-4">
          <div className="relative mt-1">
            <ShieldAlert className="w-8 h-8 shrink-0" />
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping ${pulseColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{warningStatus} ALERT ACTIVE</h2>
            </div>
            <p className="text-sm font-semibold mt-1 opacity-90">{warningDesc}</p>
            <p className="text-xs mt-2 leading-relaxed opacity-75 max-w-2xl">{warningAction}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Forecast Probability</p>
          <p className="text-4xl font-display font-bold text-foreground">{(liveEnsembleProb * 100).toFixed(1)}%</p>
        </div>
      </div>
 
      {/* Physics Precursor Breakdown */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-500" />
          <span>Physics Precursor Breakdown</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Pre-flare Brightening */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-muted-foreground">Pre-flare Brightening (SoLEXS)</span>
              <span className="text-xs font-mono font-bold text-foreground">{(brightening * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, brightening * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Soft X-ray rate-of-change accumulation</p>
          </div>

          {/* Card 2: Spectral Hardening */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-muted-foreground">Spectral Hardening (HEL1OS)</span>
              <span className="text-xs font-mono font-bold text-foreground">{(hardening * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, hardening * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Hard-to-Soft X-ray ratio slope</p>
          </div>

          {/* Card 3: Microflare Activity */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-muted-foreground">Microflare Activity (HEL1OS)</span>
              <span className="text-xs font-mono font-bold text-foreground">{(microflare * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, microflare * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Spike density in low-energy CdTe detector</p>
          </div>
        </div>
      </div>
 
      {/* Real-time Telemetry Observations Chart */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">Instrument Light Curves (Observations)</h3>
            <p className="text-sm text-muted-foreground">Real-time counts/sec from SoLEXS (Soft X-ray) & HEL1OS (Hard X-ray)</p>
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            Current Date: {realtime.simulationDate || selectedDate} | Step: {realtime.currentIndex || 0}/{realtime.totalIndex || 0}
          </div>
        </div>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="solexsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgba(249, 115, 22, 0.4)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="rgba(249, 115, 22, 0.4)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="time" 
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <YAxis 
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                label={{ value: 'Count Rate (counts/sec)', angle: -90, position: 'insideLeft', offset: 0, fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "rgba(10,12,24,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#fff",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }} />
              <Area
                type="monotone"
                dataKey="Soft X-ray (SoLEXS)"
                stroke="#F97316"
                strokeWidth={2}
                fill="url(#solexsGradient)"
              />
              <Line
                type="monotone"
                dataKey="Hard X-ray (HEL1OS)"
                stroke="#38bdf8"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Forecast Probability Chart */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">Flare Forecast Probability</h3>
            <p className="text-sm text-muted-foreground">Hybrid Ensemble (LSTM + Physics Precursors) probability of flare within 30 minutes</p>
          </div>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgba(255, 107, 0, 0.3)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="rgba(255, 107, 0, 0)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="time" 
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <YAxis 
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                label={{ value: 'Forecast Probability', angle: -90, position: 'insideLeft', offset: 0, fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "rgba(10,12,24,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#fff",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }} />
              <Area
                type="monotone"
                dataKey="Forecast Probability"
                stroke="#FF6B00"
                strokeWidth={2.5}
                fill="url(#probGradient)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
 
      {/* Live Energy Count Rates Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "SoLEXS SDD2 (Soft)", value: solexsCount, unit: "cps", desc: "1.0 - 15.0 keV payload channel" },
          { label: "HEL1OS CdTe (Hard)", value: cdteCount, unit: "cps", desc: "5.0 - 20.0 keV spectrometer" },
          { label: "HEL1OS CZT 20-40 (Hard)", value: cztLow, unit: "cps", desc: "Intermediate flux channel" },
          { label: "HEL1OS CZT 80-150 (Hard)", value: cztHigh, unit: "cps", desc: "High-energy flux channel" },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-2xl p-5 border border-border">
            <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">{item.label}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-display font-bold text-foreground">{item.value}</span>
              <span className="text-xs text-muted-foreground font-mono">{item.unit}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
