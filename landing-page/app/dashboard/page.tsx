"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { MainContent } from "@/components/dashboard/main-content";
import { RightPanel } from "@/components/dashboard/right-panel";

if (typeof window !== "undefined") {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    let url = "";
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input && typeof input === "object" && "url" in input) {
      url = (input as any).url;
    }

    if (url.includes("devtunnels.ms") || url.includes("/api/")) {
      if (typeof input === "string" || input instanceof URL) {
        init = init || {};
        init.headers = init.headers || {};
        if (init.headers instanceof Headers) {
          init.headers.set("X-Tunnel-Skip-AntiPhishing-Threshold", "true");
        } else if (Array.isArray(init.headers)) {
          init.headers.push(["X-Tunnel-Skip-AntiPhishing-Threshold", "true"]);
        } else {
          // @ts-ignore
          init.headers["X-Tunnel-Skip-AntiPhishing-Threshold"] = "true";
        }
      } else {
        try {
          const req = input as Request;
          const newHeaders = new Headers(req.headers);
          newHeaders.set("X-Tunnel-Skip-AntiPhishing-Threshold", "true");
          input = new Request(req, { headers: newHeaders });
        } catch (e) {
          console.warn("Failed to set devtunnel header on Request object", e);
        }
      }
    }
    return originalFetch(input, init);
  };
}

export type Section =
  | "telemetry"
  | "catalogue"
  | "metrics"
  | "ingestion"
  | "settings"
  | "overview"
  | "incidents"
  | "deployments"
  | "performance"
  | "errors"
  | "sla"
  | "oncall"
  | "services"
  | "postmortems";

export default function DashboardPage() {
  const [activeSection, setActiveSection] = useState<Section>("telemetry");

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Sidebar */}
      <AppSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      {/* Main Content */}
      <MainContent activeSection={activeSection} />

      {/* Right Panel */}
      <RightPanel />
    </div>
  );
}
