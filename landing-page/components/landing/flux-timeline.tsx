"use client";

import { useEffect, useState, useRef } from "react";

export function FluxTimeline() {
  const [sweepProgress, setSweepProgress] = useState(0);
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [fluxValue, setFluxValue] = useState("1.24e-6");
  const [flareClass, setFlareClass] = useState("A9.1");
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const DURATION = 8000; // 8 seconds per sweep cycle

  // Synthetic data for the solar flare (100 points)
  // Quick rise, slow exponential decay
  const dataPoints = useRef<number[]>([]);
  if (dataPoints.current.length === 0) {
    for (let i = 0; i < 100; i++) {
      let val = 15; // baseline noise
      // Add slight baseline noise
      val += Math.sin(i * 0.5) * 1.5 + Math.cos(i * 1.2) * 0.8;
      
      // Spike starts at index 40, peaks at index 45, decays until 85
      if (i >= 40 && i <= 45) {
        // Fast linear rise
        val += ((i - 40) / 5) * 75;
      } else if (i > 45 && i <= 85) {
        // Exponential decay
        const decayFactor = (i - 45) / 40;
        val += 75 * Math.exp(-decayFactor * 3.5);
      }
      dataPoints.current.push(val);
    }
  }

  useEffect(() => {
    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const progress = (elapsed % DURATION) / DURATION;
      
      setSweepProgress(progress);

      const index = Math.floor(progress * 100);
      const currentVal = dataPoints.current[index] || 15;
      
      // Anomaly is active from index 43 to 80 (during the spike and initial decay)
      const anomalyActive = index >= 43 && index <= 80;
      setIsAnomaly(anomalyActive);

      // Update readouts
      const sciVal = (currentVal * 1e-7).toExponential(2);
      setFluxValue(sciVal);

      if (currentVal > 75) {
        setFlareClass("X1.2");
      } else if (currentVal > 45) {
        setFlareClass("M4.8");
      } else if (currentVal > 25) {
        setFlareClass("C3.1");
      } else if (currentVal > 18) {
        setFlareClass("B6.4");
      } else {
        setFlareClass("A9.1");
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Generate SVG path for the line up to the current sweep progress
  const generatePath = () => {
    const width = 500;
    const height = 220;
    const pointsCount = Math.floor(sweepProgress * 100);
    
    if (pointsCount < 2) return "";
    
    let path = `M 0 ${height - (dataPoints.current[0] / 100) * height}`;
    for (let i = 1; i <= pointsCount; i++) {
      const x = (i / 99) * width;
      // invert Y coordinate for SVG space
      const y = height - (dataPoints.current[i] / 100) * height - 10;
      path += ` L ${x} ${y}`;
    }
    return path;
  };

  const currentX = sweepProgress * 500;
  const currentVal = dataPoints.current[Math.floor(sweepProgress * 100)] || 15;
  const currentY = 220 - (currentVal / 100) * 220 - 10;

  return (
    <div className="relative w-full border border-white/10 bg-[#0A0E17]/90 rounded-xl p-6 font-mono text-xs overflow-hidden shadow-2xl backdrop-blur-sm">
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/30" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/30" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/30" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/30" />

      {/* Header Info */}
      <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FF5C28] animate-pulse" />
          <span className="text-[#EDEFF2] uppercase tracking-wider font-bold">SoLEXS FLUX MONITOR</span>
        </div>
        <div className="text-right text-[#EDEFF2]/60">
          STATUS: <span className="text-[#5EE6D0] font-bold">ACTIVE</span>
        </div>
      </div>

      {/* Readouts Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-[11px]">
        <div className="bg-[#121824] p-2 border border-white/5 rounded">
          <div className="text-white/40 text-[9px] uppercase">Telemetry Flux</div>
          <div className="text-[#EDEFF2] text-sm font-semibold font-mono tracking-tight">{fluxValue} W/m²</div>
        </div>
        <div className="bg-[#121824] p-2 border border-white/5 rounded">
          <div className="text-white/40 text-[9px] uppercase">Classification</div>
          <div className={`text-sm font-bold font-mono ${isAnomaly ? "text-[#FF5C28]" : "text-[#EDEFF2]"}`}>
            {flareClass}
          </div>
        </div>
        <div className="bg-[#121824] p-2 border border-white/5 rounded">
          <div className="text-white/40 text-[9px] uppercase">Anomaly Risk</div>
          <div className={`text-sm font-semibold font-mono ${isAnomaly ? "text-[#FFB627]" : "text-[#5EE6D0]"}`}>
            {isAnomaly ? "98.4% CRITICAL" : "0.02% NORMAL"}
          </div>
        </div>
      </div>

      {/* SVG Oscilloscope Container */}
      <div className="relative bg-[#070b12] border border-white/5 rounded p-2 overflow-hidden h-[240px]">
        {/* Oscilloscope Grid Lines */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
          <div className="w-full h-full" style={{
            backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "25px 22px"
          }} />
          {/* Center line */}
          <div className="absolute top-[110px] left-0 right-0 h-px bg-white/10" />
        </div>

        {/* Anomaly Detection Marker */}
        {isAnomaly && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-[#FF5C28]/10 border border-[#FF5C28] px-3 py-1.5 rounded animate-bounce">
            <span className="w-2 h-2 rounded-full bg-[#FF5C28] animate-ping" />
            <span className="text-[#FF5C28] font-bold text-[10px] tracking-wider uppercase font-mono">
              ANOMALY DETECTED
            </span>
          </div>
        )}

        {/* Oscilloscope Plot */}
        <svg viewBox="0 0 500 240" className="w-full h-full relative z-10 overflow-visible">
          {/* Main flux line */}
          <path
            d={generatePath()}
            fill="none"
            stroke="#FF5C28"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_0_8px_rgba(255,92,40,0.8)]"
          />

          {/* Sweep scanning bar */}
          <line
            x1={currentX}
            y1="0"
            x2={currentX}
            y2="240"
            stroke="#FFB627"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="opacity-60"
          />

          {/* Active node dot */}
          {sweepProgress > 0 && (
            <g>
              <circle
                cx={currentX}
                cy={currentY}
                r="6"
                fill="#FFB627"
                className="animate-ping"
              />
              <circle
                cx={currentX}
                cy={currentY}
                r="4"
                fill="#EDEFF2"
                stroke="#FF5C28"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Static reference labels */}
          <text x="10" y="25" fill="#EDEFF2" className="text-[9px] fill-[#EDEFF2]/30">Soft X-ray Channel</text>
          <text x="10" y="225" fill="#5EE6D0" className="text-[9px] fill-[#5EE6D0]/60">Lead Time: ~15-60m</text>
        </svg>
      </div>

      {/* Footer System Details */}
      <div className="flex justify-between items-center mt-3 text-[10px] text-white/40">
        <div>ORBIT: L1 HALO POINT</div>
        <div className="flex gap-4">
          <div>MODEL: ENSEMBLE V2.0</div>
          <div>FPS: 60.0</div>
        </div>
      </div>
    </div>
  );
}
