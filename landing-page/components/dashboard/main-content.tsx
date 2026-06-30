"use client";
 
import type { Section } from "@/app/dashboard/page";
import { TelemetryContent } from "./content/telemetry-content";
import { CatalogueContent } from "./content/catalogue-content";
import { MetricsContent } from "./content/metrics-content";
import { IngestionContent } from "./content/ingestion-content";
import { SettingsContent } from "./content/settings-content";
import { OverviewContent } from "./content/overview-content";
import { IncidentsContent } from "./content/incidents-content";
import { DeploymentsContent } from "./content/deployments-content";
import { PerformanceContent } from "./content/performance-content";
import { ErrorsContent } from "./content/errors-content";
import { SlaContent } from "./content/sla-content";
import { OncallContent } from "./content/oncall-content";
import { ServicesContent } from "./content/services-content";
import { PostmortemsContent } from "./content/postmortems-content";
 
import { Bell, Calendar, RefreshCw, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
 
interface MainContentProps {
  activeSection: Section;
}
 
const sectionConfig: Record<Section, { title: string; subtitle: string }> = {
  telemetry: {
    title: "Live Solar Telemetry",
    subtitle: "Real-time Aditya-L1 SoLEXS & HEL1OS Light Curves",
  },
  catalogue: {
    title: "Master Flare Catalogue",
    subtitle: "Automated database of nowcasted solar flares",
  },
  metrics: {
    title: "Model Verification Metrics",
    subtitle: "Evaluation charts, TSS/HSS scores & confusion matrix",
  },
  ingestion: {
    title: "Data Ingestion Portal",
    subtitle: "ISSDC PRADAN sync logs & active gaps tracking",
  },
  settings: {
    title: "System Config Settings",
    subtitle: "LSTM forecasting weights & alert threshold parameters",
  },
  overview: {
    title: "System Overview",
    subtitle: "Real-time Engineering Metrics",
  },
  incidents: {
    title: "Incidents",
    subtitle: "Active & Recent Incidents",
  },
  deployments: {
    title: "Deployments",
    subtitle: "Release Pipeline & History",
  },
  performance: {
    title: "Performance",
    subtitle: "System Latency & Throughput",
  },
  errors: {
    title: "Error Tracking",
    subtitle: "Exceptions & Error Rates",
  },
  sla: {
    title: "SLA & Uptime",
    subtitle: "Service Level Monitoring",
  },
  oncall: {
    title: "On-Call",
    subtitle: "Schedule & Response Metrics",
  },
  services: {
    title: "Services",
    subtitle: "Service Catalog & Health",
  },
  postmortems: {
    title: "Postmortems",
    subtitle: "Incident Reports & Learnings",
  },
};
 
export function MainContent({ activeSection }: MainContentProps) {
  const config = sectionConfig[activeSection];
 
  const renderContent = () => {
    switch (activeSection) {
      case "telemetry":
        return <TelemetryContent />;
      case "catalogue":
        return <CatalogueContent />;
      case "metrics":
        return <MetricsContent />;
      case "ingestion":
        return <IngestionContent />;
      case "settings":
        return <SettingsContent />;
      case "overview":
        return <OverviewContent />;
      case "incidents":
        return <IncidentsContent />;
      case "deployments":
        return <DeploymentsContent />;
      case "performance":
        return <PerformanceContent />;
      case "errors":
        return <ErrorsContent />;
      case "sla":
        return <SlaContent />;
      case "oncall":
        return <OncallContent />;
      case "services":
        return <ServicesContent />;
      case "postmortems":
        return <PostmortemsContent />;
      default:
        return <TelemetryContent />;
    }
  };
 
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <header className="h-16 px-8 flex items-center justify-between border-b border-border bg-card shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            {config.title}
          </h1>
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
 
        <div className="flex items-center gap-3">
          {/* Time Range */}
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Calendar className="w-4 h-4" />
            <span>Telemetry stream</span>
          </Button>
 
          {/* Refresh */}
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <RefreshCw className="w-4 h-4" />
            <span>Sync API</span>
          </Button>
 
          {/* Alerts */}
          <button
            type="button"
            className="relative p-2 rounded-xl hover:bg-muted transition-colors"
            aria-label="Alerts"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          </button>
 
          {/* Ingestion status badge */}
          <span className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-500 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Pipeline Nominal
          </span>
        </div>
      </header>
 
      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div key={activeSection} className="animate-fade-in">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
