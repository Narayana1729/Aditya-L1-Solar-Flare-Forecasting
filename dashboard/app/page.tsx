"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { MainContent } from "@/components/dashboard/main-content";
import { RightPanel } from "@/components/dashboard/right-panel";

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
