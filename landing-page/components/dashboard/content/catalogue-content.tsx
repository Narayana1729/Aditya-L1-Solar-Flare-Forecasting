"use client";
 
import { useState } from "react";
import { Search, Filter, ShieldAlert, Download, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
 
interface FlareEvent {
  id: string;
  peakTime: string;
  source: string;
  classification: string;
  peakFlux: string;
  leadTime: string;
  type: "nowcasted" | "forecasted";
}
 
const initialFlares: FlareEvent[] = [
  { id: "FLR-2024-001", peakTime: "2024-05-10 03:45 UTC", source: "SoLEXS + HEL1OS", classification: "X1.5", peakFlux: "42,100 cps", leadTime: "52m", type: "forecasted" },
  { id: "FLR-2024-002", peakTime: "2024-05-10 18:22 UTC", source: "SoLEXS", classification: "M4.2", peakFlux: "12,400 cps", leadTime: "38m", type: "forecasted" },
  { id: "FLR-2024-003", peakTime: "2024-05-11 11:15 UTC", source: "SoLEXS + HEL1OS", classification: "X2.1", peakFlux: "58,900 cps", leadTime: "64m", type: "forecasted" },
  { id: "FLR-2024-004", peakTime: "2024-05-12 08:30 UTC", source: "HEL1OS", classification: "C8.4", peakFlux: "8,900 cps", leadTime: "22m", type: "nowcasted" },
  { id: "FLR-2024-005", peakTime: "2024-06-01 14:10 UTC", source: "SoLEXS", classification: "M1.8", peakFlux: "15,200 cps", leadTime: "45m", type: "forecasted" },
  { id: "FLR-2024-006", peakTime: "2024-06-02 22:55 UTC", source: "SoLEXS + HEL1OS", classification: "X1.0", peakFlux: "38,500 cps", leadTime: "50m", type: "forecasted" },
  { id: "FLR-2024-007", peakTime: "2024-06-03 05:12 UTC", source: "HEL1OS", classification: "M2.9", peakFlux: "11,800 cps", leadTime: "30m", type: "nowcasted" },
  { id: "FLR-2024-008", peakTime: "2024-06-04 19:40 UTC", source: "SoLEXS + HEL1OS", classification: "M5.6", peakFlux: "28,100 cps", leadTime: "48m", type: "forecasted" },
  { id: "FLR-2024-009", peakTime: "2024-06-15 12:05 UTC", source: "SoLEXS", classification: "C5.2", peakFlux: "6,200 cps", leadTime: "15m", type: "nowcasted" },
  { id: "FLR-2024-010", peakTime: "2024-06-16 09:50 UTC", source: "SoLEXS + HEL1OS", classification: "X1.2", peakFlux: "39,100 cps", leadTime: "42m", type: "forecasted" },
];
 
export function CatalogueContent() {
  const [flares] = useState<FlareEvent[]>(initialFlares);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
 
  // Filtering logic
  const filteredFlares = flares.filter((flare) => {
    const matchesSearch = 
      flare.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flare.peakTime.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesClass = 
      classFilter === "ALL" || 
      (classFilter === "X" && flare.classification.startsWith("X")) ||
      (classFilter === "M" && flare.classification.startsWith("M")) ||
      (classFilter === "C" && flare.classification.startsWith("C"));
 
    const matchesType =
      typeFilter === "ALL" ||
      flare.type === typeFilter.toLowerCase();
 
    return matchesSearch && matchesClass && matchesType;
  });
 
  const getClassBadgeStyle = (classification: string) => {
    if (classification.startsWith("X")) {
      return "bg-destructive/10 text-destructive border-destructive/20";
    }
    if (classification.startsWith("M")) {
      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    }
    return "bg-sky-500/10 text-sky-500 border-sky-500/20";
  };
 
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Solar Flares Ingested", value: "149", desc: "Master Aditya-L1 Catalog count" },
          { label: "Nowcasted Flare Events", value: "54", desc: "Real-time algorithmic detections" },
          { label: "Mean Forecast Lead Time", value: "45.4m", desc: "Before peak solar flux trigger" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-2xl p-5 border border-border">
            <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">{stat.label}</p>
            <h3 className="text-3xl font-display font-bold text-foreground">{stat.value}</h3>
            <p className="text-[10px] text-muted-foreground mt-2">{stat.desc}</p>
          </div>
        ))}
      </div>
 
      {/* Filtering Header */}
      <div className="bg-card rounded-2xl p-5 border border-border flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search event ID or peak time..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>
 
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 text-sm w-full md:w-auto justify-end">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Class:</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-muted px-2.5 py-1.5 rounded-lg border border-border text-xs focus:outline-none"
            >
              <option value="ALL">All Classes</option>
              <option value="X">X-Class Only</option>
              <option value="M">M-Class Only</option>
              <option value="C">C-Class Only</option>
            </select>
          </div>
 
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Trigger:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-muted px-2.5 py-1.5 rounded-lg border border-border text-xs focus:outline-none"
            >
              <option value="ALL">All Triggers</option>
              <option value="FORECASTED">Forecasted</option>
              <option value="NOWCASTED">Nowcasted</option>
            </select>
          </div>
 
          <Button variant="outline" size="sm" className="rounded-xl border-border bg-transparent gap-2 h-9">
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>
 
      {/* Table Container */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-4 font-semibold text-muted-foreground">Event ID</th>
                <th className="p-4 font-semibold text-muted-foreground">Peak Time (UTC)</th>
                <th className="p-4 font-semibold text-muted-foreground">Instruments</th>
                <th className="p-4 font-semibold text-muted-foreground">Classification</th>
                <th className="p-4 font-semibold text-muted-foreground">Peak Flux Count</th>
                <th className="p-4 font-semibold text-muted-foreground">Alert Lead Time</th>
                <th className="p-4 font-semibold text-muted-foreground">Trigger Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredFlares.map((flare) => (
                <tr key={flare.id} className="hover:bg-muted/15 transition-colors group">
                  <td className="p-4 font-mono font-medium text-foreground group-hover:text-orange-500 transition-colors">
                    {flare.id}
                  </td>
                  <td className="p-4 text-muted-foreground">{flare.peakTime}</td>
                  <td className="p-4 text-muted-foreground">{flare.source}</td>
                  <td className="p-4">
                    <span className={`inline-block px-2.5 py-0.5 border text-xs font-semibold rounded-full ${getClassBadgeStyle(flare.classification)}`}>
                      {flare.classification}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-muted-foreground">{flare.peakFlux}</td>
                  <td className="p-4">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5 text-orange-500" />
                      {flare.leadTime}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-semibold rounded-full ${
                      flare.type === "forecasted"
                        ? "bg-orange-500/10 text-orange-500"
                        : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {flare.type}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredFlares.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No matching flare events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
