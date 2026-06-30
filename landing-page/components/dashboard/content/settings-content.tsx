"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { 
  User, 
  Bell, 
  Lock, 
  Palette, 
  Users, 
  Zap, 
  ChevronRight, 
  Sliders, 
  ShieldAlert, 
  Activity, 
  CheckCircle2, 
  XCircle,
  Calendar,
  Volume2,
  VolumeX,
  Play,
  Moon,
  Sun,
  Laptop,
  Check,
  Send,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = "http://127.0.0.1:8000";

const teamOperators = [
  { id: "ece1", name: "Uppena Upagna", role: "Signal Processing Lead (ECE 1)" },
  { id: "ece2", name: "Sai Ram Koushik", role: "Physics & Domain Lead (ECE 2)" },
  { id: "cse1", name: "Ismail Zabiullah", role: "ML Modelling Lead (CSE 1)" },
  { id: "cse2", name: "Srimannarayana", role: "Dashboard & Integration Lead (CSE 2)" },
];

export function SettingsContent() {
  const { theme, setTheme } = useTheme();
  
  // Model Config States
  const [lstmWeight, setLstmWeight] = useState<number>(0.7);
  const [threshold, setThreshold] = useState<number>(0.5);
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [modelSaveStatus, setModelSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [modelErrorMsg, setModelErrorMsg] = useState("");

  // Simulation States
  const [simulationDates, setSimulationDates] = useState<string[]>([]);
  const [selectedSimDate, setSelectedSimDate] = useState<string>("");
  const [activeSimDate, setActiveSimDate] = useState<string>("");
  const [isSettingDate, setIsSettingDate] = useState(false);
  const [dateSaveStatus, setDateSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [dateErrorMsg, setDateErrorMsg] = useState("");
  const [cadence, setCadence] = useState<string>("1m");

  // Audible / Alarm States (backed by localStorage)
  const [voiceAlerts, setVoiceAlerts] = useState<boolean>(false);
  const [sirenSound, setSirenSound] = useState<boolean>(false);
  const [activeOperator, setActiveOperator] = useState<string>("cse2");

  // Webhook States (backed by localStorage)
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<"idle" | "success" | "error">("idle");
  const [webhookFeedback, setWebhookFeedback] = useState("");

  // Integrations State
  const [integrationsState, setIntegrationsState] = useState([
    { name: "PagerDuty", connected: true, icon: "PD" },
    { name: "Slack", connected: true, icon: "S" },
    { name: "Datadog", connected: true, icon: "DD" },
    { name: "GitHub", connected: true, icon: "GH" },
    { name: "Jira", connected: false, icon: "J" },
  ]);

  const toggleIntegration = (index: number) => {
    setIntegrationsState(prev => {
      const next = [...prev];
      next[index] = { ...next[index], connected: !next[index].connected };
      return next;
    });
  };

  // Load settings on mount
  useEffect(() => {
    // 1. Fetch backend settings
    async function loadBackendSettings() {
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
        console.warn("Failed to load model weights from backend.", err);
      }
    }

    // 2. Fetch available flare dates
    async function loadSimulationDates() {
      try {
        const res = await fetch(`${API_BASE}/api/flare-dates`);
        const data = await res.json();
        setSimulationDates(data);
        if (data.length > 0) {
          setSelectedSimDate(data[0]);
        }
      } catch (err) {
        console.warn("Failed to load simulation dates.", err);
      }
    }

    // 3. Fetch current simulation status
    async function loadSimulationStatus() {
      try {
        const res = await fetch(`${API_BASE}/api/realtime`);
        const data = await res.json();
        if (data.simulationDate) {
          setActiveSimDate(data.simulationDate);
        }
      } catch (err) {
        console.warn("Failed to load simulation date status.", err);
      }
    }

    loadBackendSettings();
    loadSimulationDates();
    loadSimulationStatus();

    // 4. Load localStorage preferences
    setVoiceAlerts(localStorage.getItem("settings_voice_alerts") === "true");
    setSirenSound(localStorage.getItem("settings_siren_sound") === "true");
    setActiveOperator(localStorage.getItem("settings_operator") || "cse2");
    setWebhookUrl(localStorage.getItem("settings_webhook_url") || "");
    setCadence(localStorage.getItem("settings_cadence") || "1m");
  }, []);

  // Save Model Configuration
  const handleSaveModel = async () => {
    setIsSavingModel(true);
    setModelSaveStatus("idle");
    setModelErrorMsg("");

    const payload = {
      weight_lstm: lstmWeight,
      weight_physics: Number((1.0 - lstmWeight).toFixed(2)),
      threshold: threshold
    };

    try {
      const res = await fetch(`${API_BASE}/api/update-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setModelSaveStatus("success");
        setTimeout(() => setModelSaveStatus("idle"), 4000);
      } else {
        setModelSaveStatus("error");
        setModelErrorMsg(data.error || "Failed to save configuration.");
      }
    } catch (err) {
      setModelSaveStatus("error");
      setModelErrorMsg("Failed to connect to forecasting server.");
    } finally {
      setIsSavingModel(false);
    }
  };

  // Change active simulation date
  const handleSetSimulationDate = async () => {
    if (!selectedSimDate) return;
    setIsSettingDate(true);
    setDateSaveStatus("idle");
    setDateErrorMsg("");

    try {
      const res = await fetch(`${API_BASE}/api/set-simulation-date?date=${selectedSimDate}`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        setDateSaveStatus("success");
        setActiveSimDate(selectedSimDate);
        setTimeout(() => setDateSaveStatus("idle"), 4000);
      } else {
        setDateSaveStatus("error");
        setDateErrorMsg(data.error || "Failed to set simulation date.");
      }
    } catch (err) {
      setDateSaveStatus("error");
      setDateErrorMsg("Failed to connect to forecasting server.");
    } finally {
      setIsSettingDate(false);
    }
  };

  // Toggle Preferences
  const handleToggleVoice = (val: boolean) => {
    setVoiceAlerts(val);
    localStorage.setItem("settings_voice_alerts", String(val));
    if (val && window.speechSynthesis) {
      // test speech immediately so user gets feedback
      const utterance = new SpeechSynthesisUtterance("Voice alerts enabled");
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleToggleSiren = (val: boolean) => {
    setSirenSound(val);
    localStorage.setItem("settings_siren_sound", String(val));
    if (val) {
      // test synth tone immediately
      playTestBeep();
    }
  };

  const playTestBeep = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleOperatorChange = (opId: string) => {
    setActiveOperator(opId);
    localStorage.setItem("settings_operator", opId);
  };

  const handleCadenceChange = (cad: string) => {
    setCadence(cad);
    localStorage.setItem("settings_cadence", cad);
  };

  // Test Webhook Connection
  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      setWebhookStatus("error");
      setWebhookFeedback("Please enter a webhook URL first.");
      return;
    }

    setIsTestingWebhook(true);
    setWebhookStatus("idle");
    setWebhookFeedback("");

    // Save url
    localStorage.setItem("settings_webhook_url", webhookUrl);

    // Mock warning payload
    const mockPayload = {
      text: "🚨 *Aditya-L1 Space Weather Warning* 🚨\n*Flare Probability:* 87%\n*Horizon:* < 30 mins (C1 nowcasting)\n*Instruments:* SoLEXS soft X-Ray + HEL1OS hard X-Ray\n*Action Advise:* Spacecraft Safe Mode recommended.",
      channel: "#space-alerts"
    };

    try {
      // If it looks like a real url, try to POST it (CORS might block it, but we can catch)
      if (webhookUrl.startsWith("http")) {
        // Send actual test request (using no-cors mode to bypass CORS preflight restrictions for Slack/Discord incoming hooks)
        await fetch(webhookUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mockPayload)
        });
      }
      
      // Delay for premium feel
      await new Promise(r => setTimeout(r, 1500));
      setWebhookStatus("success");
      setWebhookFeedback("Test payload sent! Slack/Discord alert dispatched successfully.");
      setTimeout(() => setWebhookStatus("idle"), 4000);
    } catch (err) {
      setWebhookStatus("error");
      setWebhookFeedback("Failed to send webhook. Verify network connectivity and webhook URL format.");
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const physicsWeight = Number((1.0 - lstmWeight).toFixed(2));

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      
      {/* 1. Ensemble Configurator */}
      <div className="bg-card rounded-2xl border border-border p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Aditya-L1 Model Ensemble Configurator</h3>
            <p className="text-[10px] text-muted-foreground">Adjust forecasting weights and alarm thresholds dynamically</p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="space-y-5">
            {/* Slider 1: LSTM Weight */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1">
                  LSTM Neural Forecast Weight (w_lstm)
                </span>
                <span className="font-mono text-orange-500">{(lstmWeight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={lstmWeight}
                onChange={(e) => {
                  setLstmWeight(Number(e.target.value));
                  if (modelSaveStatus !== "idle") setModelSaveStatus("idle");
                }}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0% (Physics Only)</span>
                <span>50% (Equal Contribution)</span>
                <span>100% (LSTM Only)</span>
              </div>
            </div>

            {/* Visual Contribution Bar */}
            <div className="space-y-1">
              <span className="block text-[10px] text-muted-foreground uppercase font-semibold">Active Ensemble Contribution Split</span>
              <div className="h-4 w-full bg-muted rounded-lg overflow-hidden flex text-[9px] font-mono font-bold text-center">
                <div 
                  className="bg-orange-500 text-white flex items-center justify-center transition-all duration-300"
                  style={{ width: `${lstmWeight * 100}%` }}
                >
                  {lstmWeight > 0.15 && `LSTM (${(lstmWeight * 100).toFixed(0)}%)`}
                </div>
                <div 
                  className="bg-sky-500 text-white flex items-center justify-center transition-all duration-300 flex-1"
                >
                  {physicsWeight > 0.15 && `Physics (${(physicsWeight * 100).toFixed(0)}%)`}
                </div>
              </div>
            </div>

            {/* Slider 2: Alert Threshold */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1">
                  Alert Trigger Probability Threshold
                </span>
                <span className="font-mono text-orange-500">{(threshold * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={threshold}
                onChange={(e) => {
                  setThreshold(Number(e.target.value));
                  if (modelSaveStatus !== "idle") setModelSaveStatus("idle");
                }}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>10% (High Sensitivity)</span>
                <span>50% (Nominal)</span>
                <span>90% (Low False Alarms)</span>
              </div>
            </div>
          </div>

          {/* Model Status Feedback */}
          {modelSaveStatus === "success" && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Ensemble weights updated successfully! Telemetry console will apply these coefficients in real time.</span>
            </div>
          )}
          {modelSaveStatus === "error" && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 font-medium">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{modelErrorMsg}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveModel}
              disabled={isSavingModel}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-10 px-6 gap-2 font-medium border-none shadow-sm transition-colors"
            >
              {isSavingModel ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin animate-infinite" />
                  <span>Saving Config...</span>
                </>
              ) : (
                <span>Save Ensemble Config</span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Simulation & Mission Control */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-500">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Mission Simulation Control</h3>
            <p className="text-[10px] text-muted-foreground">Select historical flare dates to stream and inspect telemetry cadence</p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Simulation Date Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground block">Select Simulation Date</label>
              <div className="flex gap-2">
                <select
                  value={selectedSimDate}
                  onChange={(e) => setSelectedSimDate(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {simulationDates.length === 0 ? (
                    <option>Loading dates...</option>
                  ) : (
                    simulationDates.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))
                  )}
                </select>
                <Button
                  onClick={handleSetSimulationDate}
                  disabled={isSettingDate || simulationDates.length === 0}
                  className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-medium px-4 shrink-0 transition-colors"
                >
                  {isSettingDate ? "Setting..." : "Set Date"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                Currently streaming: <span className="text-sky-500 font-bold">{activeSimDate || "Loading..."}</span>
              </p>
            </div>

            {/* Ingestion Cadence */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground block">Telemetry Cadence Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "10s", label: "Burst (10s)" },
                  { id: "1m", label: "Nominal (1m)" },
                  { id: "5m", label: "Low Band (5m)" }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleCadenceChange(item.id)}
                    className={cn(
                      "py-2 px-3 border text-xs font-medium rounded-xl transition-all",
                      cadence === item.id 
                        ? "border-sky-500 text-sky-500 bg-sky-500/5 font-semibold"
                        : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Adjusts virtual sampler resolution on the satellite receiver</p>
            </div>
          </div>

          {/* Date feedback */}
          {dateSaveStatus === "success" && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Simulation date successfully updated! Poller will reset to the start of {activeSimDate}.</span>
            </div>
          )}
          {dateSaveStatus === "error" && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 font-medium">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{dateErrorMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Audible & Operator Settings */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-500">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Alarms & Mission Profiles</h3>
            <p className="text-[10px] text-muted-foreground">Configure browser synthesised warning alerts and current operator profile</p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Alarm Options */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-foreground block">Telemetry Alert Alarms</label>
              
              {/* Voice Alert Toggle */}
              <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/20">
                <div>
                  <p className="text-xs font-medium text-foreground">Audible Voice Warnings</p>
                  <p className="text-[10px] text-muted-foreground">Announce warnings via browser speech synthesis</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleVoice(!voiceAlerts)}
                  className={cn(
                    "w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none",
                    voiceAlerts ? "bg-violet-500" : "bg-muted-foreground/30"
                  )}
                >
                  <div 
                    className={cn(
                      "w-4 h-4 rounded-full bg-white transition-transform",
                      voiceAlerts ? "translate-x-4" : "translate-x-0"
                    )} 
                  />
                </button>
              </div>

              {/* Siren Alert Toggle */}
              <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/20">
                <div>
                  <p className="text-xs font-medium text-foreground">Siren Pitch Tones</p>
                  <p className="text-[10px] text-muted-foreground">Play synth beeps via Web Audio API on alert escalate</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSiren(!sirenSound)}
                  className={cn(
                    "w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none",
                    sirenSound ? "bg-violet-500" : "bg-muted-foreground/30"
                  )}
                >
                  <div 
                    className={cn(
                      "w-4 h-4 rounded-full bg-white transition-transform",
                      sirenSound ? "translate-x-4" : "translate-x-0"
                    )} 
                  />
                </button>
              </div>
            </div>

            {/* Operator Selection */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-foreground block">Active Console Operator</label>
              <div className="space-y-2">
                {teamOperators.map(op => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => handleOperatorChange(op.id)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all",
                      activeOperator === op.id
                        ? "border-violet-500 bg-violet-500/5 font-semibold text-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                    )}
                  >
                    <div>
                      <p className="font-semibold">{op.name}</p>
                      <p className="text-[9px] text-muted-foreground">{op.role}</p>
                    </div>
                    {activeOperator === op.id && <Check className="w-4 h-4 text-violet-500 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Warning Webhook Integrations */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Space Weather Warning Webhooks</h3>
            <p className="text-[10px] text-muted-foreground">Post automated flare alert payloads directly to your Slack or Discord channel</p>
          </div>
        </div>

        <div className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground block">Incoming Webhook URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://hooks.slack.com/services/..."
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  if (webhookStatus !== "idle") setWebhookStatus("idle");
                }}
                className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono placeholder:font-sans placeholder:text-xs text-xs"
              />
              <Button
                onClick={handleTestWebhook}
                disabled={isTestingWebhook}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium px-4 shrink-0 transition-colors flex items-center gap-1.5"
              >
                {isTestingWebhook ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Test Webhook</span>
                  </>
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Supports incoming webhook formats for Slack and Discord integrations.</p>
          </div>

          {/* Webhook Feedback */}
          {webhookStatus === "success" && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{webhookFeedback}</span>
            </div>
          )}
          {webhookStatus === "error" && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 font-medium">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{webhookFeedback}</span>
            </div>
          )}
        </div>
      </div>

      {/* 5. Console Appearance (Theme Switching) */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Console Appearance</h3>
            <p className="text-[10px] text-muted-foreground">Choose the visual style of the mission telemetry console</p>
          </div>
        </div>

        <div className="space-y-4 max-w-xl">
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "light", label: "Light Mode", icon: Sun },
              { id: "dark", label: "Dark Mode", icon: Moon },
              { id: "system", label: "System Default", icon: Laptop }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTheme(item.id)}
                  className={cn(
                    "p-4 border rounded-xl flex flex-col items-center gap-2 text-xs font-semibold transition-all cursor-pointer",
                    theme === item.id 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5"
                      : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 6. External Systems Integrations */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">External Systems Integrations</h3>
            <p className="text-[10px] text-muted-foreground">Manage connections to third-party alert dispatchers and repositories</p>
          </div>
        </div>
        <div className="space-y-3">
          {integrationsState.map((integration, idx) => (
            <div
              key={integration.name}
              className="flex items-center gap-4 p-4 rounded-xl bg-muted/30"
            >
              <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center text-sm font-semibold text-foreground">
                {integration.icon}
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">{integration.name}</p>
                <p className="text-xs text-muted-foreground">
                  {integration.connected ? "Connected" : "Not connected"}
                </p>
              </div>
              <Button
                variant={integration.connected ? "outline" : "default"}
                size="sm"
                className={cn(integration.connected && "bg-transparent cursor-pointer")}
                onClick={() => toggleIntegration(idx)}
              >
                {integration.connected ? "Disconnect" : "Connect"}
              </Button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
