"use client";

import { useState, useEffect } from "react";
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
  XCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { API_BASE } from "@/lib/api";

const settingsSections = [
  {
    id: "profile",
    label: "Profile",
    description: "Manage your personal information",
    icon: User,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Configure how you receive updates",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security",
    description: "Password and authentication settings",
    icon: Lock,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Customize the look and feel",
    icon: Palette,
  },
  {
    id: "team",
    label: "Team",
    description: "Manage team members and roles",
    icon: Users,
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Connect with other tools",
    icon: Zap,
  },
];

const integrations = [
  { name: "PagerDuty", connected: true, icon: "PD" },
  { name: "Slack", connected: true, icon: "S" },
  { name: "Datadog", connected: true, icon: "DD" },
  { name: "GitHub", connected: true, icon: "GH" },
  { name: "Jira", connected: false, icon: "J" },
];

export function SettingsContent() {
  const [lstmWeight, setLstmWeight] = useState<number>(0.7);
  const [threshold, setThreshold] = useState<number>(0.5);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Load initial settings from backend
  useEffect(() => {
    async function loadSettings() {
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
        console.warn("Failed to load initial settings, using defaults.", err);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("idle");
    setErrorMsg("");

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
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setErrorMsg(data.error || "Failed to update settings.");
      }
    } catch (err) {
      setSaveStatus("error");
      setErrorMsg("Failed to connect to forecasting server.");
    } finally {
      setIsSaving(false);
    }
  };

  const physicsWeight = Number((1.0 - lstmWeight).toFixed(2));

  return (
    <div className="max-w-4xl space-y-6">
      {/* Aditya-L1 Space Weather Model Configurator */}
      <div className="bg-card rounded-2xl border border-border p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Aditya-L1 Model Ensemble Configurator</h3>
            <p className="text-[10px] text-muted-foreground">Adjust forecasting weights and alarm triggers dynamically</p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          {/* Sliders Grid */}
          <div className="space-y-5">
            {/* Slider 1: LSTM Weight */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1">
                  {"LSTM Neural Forecast Weight ($w_{lstm}$)"}
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
                  if (saveStatus !== "idle") setSaveStatus("idle");
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
                  if (saveStatus !== "idle") setSaveStatus("idle");
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

          {/* Alert Status Feedback */}
          {saveStatus === "success" && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Weights updated. Simulated stream will adjust dynamic predictions on next refresh.</span>
            </div>
          )}
          {saveStatus === "error" && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 font-medium">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-10 px-6 gap-2 font-medium border-none shadow-sm"
            >
              <span>{isSaving ? "Saving Config..." : "Save Ensemble Config"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Settings - Kept intact as requested */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <h3 className="font-semibold text-foreground p-6 pb-4">Quick Settings</h3>
        <div className="divide-y divide-border">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                className="w-full flex items-center gap-4 p-6 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">{section.label}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Integrations - Kept intact as requested */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Integrations</h3>
        <div className="space-y-3">
          {integrations.map((integration) => (
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
                className={cn(integration.connected && "bg-transparent")}
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
