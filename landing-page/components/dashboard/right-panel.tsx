"use client";

import { Activity, Clock, Users, AlertTriangle, CheckCircle, XCircle, Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const recentActivity = [
  {
    id: 1,
    type: "incident",
    title: "X1.5 solar flare nowcast",
    time: "2 min ago",
    status: "active",
  },
  {
    id: 2,
    type: "deploy",
    title: "Level-1 CDF ingestion successful",
    time: "15 min ago",
    status: "success",
  },
  {
    id: 3,
    type: "incident",
    title: "M4.2 solar flare forecast",
    time: "1 hour ago",
    status: "resolved",
  },
  {
    id: 4,
    type: "deploy",
    title: "Ensemble model retrained",
    time: "2 hours ago",
    status: "success",
  },
  {
    id: 5,
    type: "incident",
    title: "CZT sensor background scan complete",
    time: "3 hours ago",
    status: "resolved",
  },
];

const oncallTeam = [
  {
    id: 1,
    name: "Uppena",
    role: "Signal Processing Lead",
    initials: "UP",
    status: "active",
  },
  {
    id: 2,
    name: "Kosik",
    role: "Physics & Domain Lead",
    initials: "KO",
    status: "standby",
  },
  {
    id: 3,
    name: "Zabi",
    role: "ML Modelling Lead",
    initials: "ZA",
    status: "available",
  },
  {
    id: 4,
    name: "Sri",
    role: "Dashboard & Integration Lead",
    initials: "SR",
    status: "available",
  },
];

export function RightPanel() {
  return (
    <aside className="w-[280px] h-screen bg-card border-l border-border flex flex-col shrink-0 overflow-hidden">
      {/* System Status */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Payload & Spacecraft Health</h3>
          <span className="flex items-center gap-1.5 text-xs font-medium text-success">
            <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
            Nominal
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-muted/50">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Downlink Uptime</p>
            <p className="text-lg font-semibold text-foreground">99.98%</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/50">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Downlink Latency</p>
            <p className="text-lg font-semibold text-foreground">142ms</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="p-5 border-b border-border">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          Observation Logs
        </h3>
        <div className="space-y-3">
          {recentActivity.map((item) => (
            <div
              key={item.id}
              className="w-full flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors text-left group"
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                item.status === "active" 
                  ? "bg-destructive/10" 
                  : item.status === "success" 
                    ? "bg-success/10" 
                    : "bg-muted"
              )}>
                {item.type === "incident" ? (
                  item.status === "active" ? (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-success" />
                  )
                ) : item.status === "success" ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* On-Call Team */}
      <div className="p-5 flex-1 overflow-y-auto">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Operations Team
        </h3>
        <div className="space-y-2">
          {oncallTeam.map((member) => (
            <div
              key={member.id}
              className="w-full flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
            >
              <div className="relative">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium",
                    member.status === "active" 
                      ? "bg-orange-500/20 text-orange-500" 
                      : member.status === "standby"
                        ? "bg-warning/20 text-warning"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {member.initials}
                </div>
                {member.status === "active" && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-card" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {member.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {member.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
