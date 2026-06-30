"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { Section } from "@/app/dashboard/page";
import {
  LayoutDashboard,
  AlertTriangle,
  Rocket,
  Gauge,
  Bug,
  Shield,
  Phone,
  Server,
  FileText,
  Settings,
  Search,
  Moon,
  Sun,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AppSidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

interface NavItem {
  id: Section;
  label: string;
  icon: LucideIcon;
  badge?: number;
  badgeColor?: "red" | "yellow" | "green";
}

const favorites: NavItem[] = [
  { id: "telemetry", label: "Live Telemetry", icon: LayoutDashboard },
  { id: "catalogue", label: "Active Warning", icon: AlertTriangle, badgeColor: "red" },
];
 
const mainMenu: NavItem[] = [
  { id: "telemetry", label: "Live Telemetry", icon: LayoutDashboard },
  { id: "catalogue", label: "Flare Catalogue", icon: AlertTriangle, badge: 149, badgeColor: "red" },
  { id: "metrics", label: "Model Verification", icon: Gauge },
  { id: "ingestion", label: "Data Ingestion", icon: Server },
];
 
export function AppSidebar({ activeSection, onSectionChange }: AppSidebarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside className="w-[260px] h-screen bg-card border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-foreground text-[15px] tracking-tight">
          IRIS X
        </span>
        <span className="ml-auto px-2 py-0.5 text-[10px] font-medium bg-orange-500/10 text-orange-500 rounded-full">
          Aditya-L1
        </span>
      </div>
 
      {/* Search */}
      <div className="px-4 py-4">
        <button
          type="button"
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors"
        >
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground flex-1 text-left">Search catalogue...</span>
          <kbd className="text-[11px] text-muted-foreground bg-background px-1.5 py-0.5 rounded-md border border-border font-mono">
            /
          </kbd>
        </button>
      </div>
 
      {/* Favorites */}
      <div className="px-4 mb-2">
        <p className="px-2 mb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Quick Access
        </p>
        <nav className="space-y-0.5">
          {favorites.map((item) => (
            <NavButton
              key={`fav-${item.id}`}
              item={item}
              isActive={activeSection === item.id}
              onClick={() => onSectionChange(item.id)}
            />
          ))}
        </nav>
      </div>
 
      {/* Main Menu */}
      <div className="px-4 flex-1">
        <p className="px-2 mb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Operations
        </p>
        <nav className="space-y-0.5">
          {mainMenu.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeSection === item.id}
              onClick={() => onSectionChange(item.id)}
            />
          ))}
        </nav>
      </div>
 
      {/* Settings & User */}
      <div className="px-4 py-4 border-t border-border space-y-2">
        <NavButton
          item={{ id: "settings", label: "Settings", icon: Settings }}
          isActive={activeSection === "settings"}
          onClick={() => onSectionChange("settings")}
        />
        
        {/* User Profile */}
        <div className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer">
          <div className="w-9 h-9 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center text-sm font-semibold">
            AL1
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Aditya-L1 Console</p>
            <p className="text-xs text-muted-foreground truncate">Mission Control</p>
          </div>
          <button 
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="Toggle theme"
          >
            {mounted && theme === "dark" ? (
              <Sun className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Moon className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

interface NavButtonProps {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}

function NavButton({ item, isActive, onClick }: NavButtonProps) {
  const Icon = item.icon;
  
  const badgeColorClass = {
    red: "bg-destructive/15 text-destructive",
    yellow: "bg-warning/20 text-warning",
    green: "bg-success/15 text-success",
  };
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive
          ? "bg-primary text-primary-foreground font-medium shadow-sm"
          : "text-foreground/80 hover:bg-muted/80 hover:text-foreground"
      )}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            isActive
              ? "bg-primary-foreground/20 text-primary-foreground"
              : item.badgeColor 
                ? badgeColorClass[item.badgeColor]
                : "bg-muted text-muted-foreground"
          )}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}
