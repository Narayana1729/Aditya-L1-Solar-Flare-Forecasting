import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Calendar, ShieldAlert, 
  TrendingUp, Activity, BarChart3, AlertTriangle, 
  Settings, Award, Clock, Flame, CheckSquare, 
  Users, Plus, Trash2, LayoutDashboard, Check, Square,
  GitBranch, Cpu, Database, Tv, FileText, Layers, Network, ChevronRight, ArrowRight
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, ReferenceLine, Legend, LineChart, Line, CartesianGrid, ComposedChart
} from 'recharts';

const API_BASE = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry', 'roadmap', or 'flow'
  const [newTaskTexts, setNewTaskTexts] = useState({ e1: '', e2: '', c1: '', c2: '' });
  const [selectedNode, setSelectedNode] = useState('telemetry_source');
  const [diagramType, setDiagramType] = useState('flow'); // 'flow', 'arch', or 'usecase'
  const [tasks, setTasks] = useState({
    e1: [
      { id: 1, text: "PRADAN portal level-1 CDF data extraction", status: "completed" },
      { id: 2, text: "FITS / CDF binary table parsing with astropy", status: "completed" },
      { id: 3, text: "Background subtraction & resample cadence", status: "completed" },
      { id: 4, text: "HEL1OS light curves extraction and inspect", status: "completed" },
      { id: 5, text: "NOAA flare catalog annotations", status: "completed" },
      { id: 6, text: "Signal feature engineering (log-lags & rolling)", status: "completed" }
    ],
    e2: [
      { id: 1, text: "GOES XRS data download (2010-2025)", status: "completed" },
      { id: 2, text: "GOES baseline preprocessing pipeline", status: "completed" },
      { id: 3, text: "Class imbalance weights formulation", status: "completed" },
      { id: 4, text: "Space weather metrics (TSS, HSS, recall)", status: "completed" },
      { id: 5, text: "Domain paper physics insights", status: "completed" },
      { id: 6, text: "Physical precursor scores (brightening, hardening)", status: "completed" }
    ],
    c1: [
      { id: 1, text: "LSTM PyTorch neural network", status: "completed" },
      { id: 2, text: "Chronological train/validation splits", status: "completed" },
      { id: 3, text: "Early stopping on validation loss", status: "completed" },
      { id: 4, text: "Dynamic pos_weight imbalance loss", status: "completed" },
      { id: 5, text: "Dual-channel soft & hard X-ray fusion", status: "completed" },
      { id: 6, text: "Model checkpoints exporting (.pt & scaler)", status: "completed" }
    ],
    c2: [
      { id: 1, text: "FastAPI stream API backend", status: "completed" },
      { id: 2, text: "Telemetry dashboard UI (Recharts)", status: "completed" },
      { id: 3, text: "Simulation 10x replay mode streaming", status: "completed" },
      { id: 4, text: "Real-time alert warning state UI", status: "completed" },
      { id: 5, text: "Presentation deck & architecture flowchart", status: "active" },
      { id: 6, text: "Pipeline integration & GitHub repo organize", status: "completed" }
    ]
  });

  const handleToggleTask = (role, taskId) => {
    setTasks(prev => {
      const updatedList = prev[role].map(t => {
        if (t.id === taskId) {
          const nextStatus = t.status === 'completed' ? 'active' : t.status === 'active' ? 'pending' : 'completed';
          return { ...t, status: nextStatus };
        }
        return t;
      });
      return { ...prev, [role]: updatedList };
    });
  };

  const handleAddTask = (role) => {
    const text = newTaskTexts[role].trim();
    if (!text) return;
    setTasks(prev => {
      const nextId = prev[role].length > 0 ? Math.max(...prev[role].map(t => t.id)) + 1 : 1;
      return {
        ...prev,
        [role]: [...prev[role], { id: nextId, text, status: 'pending' }]
      };
    });
    setNewTaskTexts(prev => ({ ...prev, [role]: '' }));
  };

  const handleDeleteTask = (role, taskId) => {
    setTasks(prev => ({
      ...prev,
      [role]: prev[role].filter(t => t.id !== taskId)
    }));
  };

  const [isRunning, setIsRunning] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1000); // ms per tick
  const [availableDates, setAvailableDates] = useState([]);
  const [groupedDates, setGroupedDates] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [metrics, setMetrics] = useState({});
  const [realtime, setRealtime] = useState(null);
  const [error, setError] = useState(null);
  
  const timerRef = useRef(null);

  // Fetch initial setup data
  useEffect(() => {
    fetchMetrics();
    fetchDates();
    resetSimulation();
  }, []);

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/metrics`);
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      console.error("Failed to fetch metrics", err);
    }
  };

  // Fetch dates (grouped by year)
  const fetchDates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/flare-dates-grouped`);
      const data = await res.json();
      setGroupedDates(data);
      // Flatten for backward-compat checks
      const allDates = Object.values(data).flat();
      setAvailableDates(allDates);
      if (allDates.length > 0 && (!selectedDate || !allDates.includes(selectedDate))) {
        setSelectedDate(allDates[0]);
      }
    } catch (err) {
      console.error("Failed to fetch flare dates", err);
    }
  };

  // Set simulation date
  const handleDateChange = async (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setIsRunning(false);
    try {
      const res = await fetch(`${API_BASE}/api/set-simulation-date?date=${newDate}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setError(null);
        // Fetch the initial state
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

  const toggleSimulation = () => {
    setIsRunning(!isRunning);
  };

  // Helper to format iso timestamps to clock times
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toTimeString().split(' ')[0].substring(0, 5);
  };

  if (!realtime) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#060814', color: '#fff' }}>
        <Activity size={48} className="animate-spin" style={{ color: '#38bdf8', marginBottom: '16px' }} />
        <h3>Connecting to Aditya-L1 Forecasting Server...</h3>
        {error && <p style={{ color: '#ef4444', marginTop: '8px' }}>{error}</p>}
      </div>
    );
  }

  const current = realtime.current || {};
  const history = realtime.history || [];
  const status = realtime.warning_status || 'GREEN';
  const desc = realtime.warning_desc || '';

  // Energy count rates
  const solexsCount = current.solexs_sdd2_counts !== null ? current.solexs_sdd2_counts.toFixed(1) : 'N/A';
  const cztLow = current.hel1os_czt1_20_to_40_ctr !== null ? current.hel1os_czt1_20_to_40_ctr.toFixed(1) : 'N/A';
  const cztHigh = current.hel1os_czt1_80_to_150_ctr !== null ? current.hel1os_czt1_80_to_150_ctr.toFixed(1) : 'N/A';
  const cdteCount = current.hel1os_cdte1_5_to_20_ctr !== null ? current.hel1os_cdte1_5_to_20_ctr.toFixed(1) : 'N/A';

  // Warnings styling
  const statusStyles = {
    GREEN: {
      color: '#10b981',
      bgGlow: 'pulse-ring-green',
      border: 'rgba(16, 185, 129, 0.3)',
      text: 'QUIET MODE'
    },
    YELLOW: {
      color: '#f59e0b',
      bgGlow: 'pulse-ring-yellow',
      border: 'rgba(245, 158, 11, 0.3)',
      text: 'ALERT WATCH'
    },
    RED: {
      color: '#ef4444',
      bgGlow: 'pulse-ring',
      border: 'rgba(239, 68, 68, 0.3)',
      text: 'FLARE WARNING'
    }
  }[status];

  // Map history to charts data
  const chartData = history.map(item => ({
    time: formatTime(item.timestamp),
    solexs: item.solexs_sdd2_counts,
    czt_low: item.hel1os_czt1_20_to_40_ctr,
    czt_high: item.hel1os_czt1_80_to_150_ctr,
    cdte: item.hel1os_cdte1_5_to_20_ctr,
    lstm: item.lstm_prob,
    physics: item.physics_precursor_score,
    ensemble: item.ensemble_prob,
    is_flare: item.is_flare ? 1.0 : 0.0
  }));

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* HEADER BAR */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(56, 189, 248, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Flame size={32} style={{ color: '#f59e0b' }} />
              <h1 style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' }}>ADITYA-L1</h1>
            </div>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '2px' }}>Solar Flare Nowcasting & Forecasting System (SoLEXS + HEL1OS)</p>
          </div>

          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', marginLeft: '16px' }}>
            <button 
              onClick={() => setActiveTab('telemetry')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: activeTab === 'telemetry' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeTab === 'telemetry' ? '#38bdf8' : '#94a3b8',
                border: activeTab === 'telemetry' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
            >
              <LayoutDashboard size={14} />
              Telemetry
            </button>
            <button 
              onClick={() => setActiveTab('roadmap')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: activeTab === 'roadmap' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeTab === 'roadmap' ? '#38bdf8' : '#94a3b8',
                border: activeTab === 'roadmap' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
            >
              <Users size={14} />
              Task Roadmap
            </button>
            <button 
              onClick={() => setActiveTab('flow')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: activeTab === 'flow' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeTab === 'flow' ? '#38bdf8' : '#94a3b8',
                border: activeTab === 'flow' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
            >
              <GitBranch size={14} />
              System Architecture
            </button>
          </div>
        </div>

        {/* Live Warning Status Widget */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px',
          padding: '12px 24px', 
          backgroundColor: 'rgba(13, 17, 39, 0.8)', 
          border: `1px solid ${statusStyles.border}`,
          borderRadius: '12px',
          boxShadow: `0 0 20px ${statusStyles.border}`
        }}>
          <div style={{ position: 'relative', width: '20px', height: '20px' }}>
            <div className={statusStyles.bgGlow} style={{ 
              width: '100%', 
              height: '100%', 
              borderRadius: '50%', 
              backgroundColor: statusStyles.color,
              animation: `${statusStyles.bgGlow} 2s infinite`
            }} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', letterSpacing: '1px' }}>SYSTEM STATE</span>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: statusStyles.color }}>{statusStyles.text}</h3>
          </div>
          <div style={{ marginLeft: '16px', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '16px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', letterSpacing: '1px' }}>ALERT FORECAST</span>
            <p style={{ fontSize: '14px', fontWeight: '500', color: '#f8fafc' }}>{desc}</p>
          </div>
        </div>
      </header>

      {/* ERROR BOX */}
      {error && (
        <div style={{ 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid #ef4444', 
          color: '#ef4444', 
          padding: '12px 16px', 
          borderRadius: '8px', 
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* DASHBOARD BODY */}
      {activeTab === 'telemetry' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        
        {/* LEFT COLUMN: CHARTS AND MAIN VISUALIZATIONS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* CONTROL BAR */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px', 
            backgroundColor: 'rgba(13, 17, 39, 0.5)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                onClick={toggleSimulation} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  backgroundColor: isRunning ? '#ef4444' : '#38bdf8', 
                  color: '#060814', 
                  border: 'none', 
                  padding: '8px 16px', 
                  borderRadius: '6px', 
                  fontWeight: '600', 
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {isRunning ? <Pause size={16} /> : <Play size={16} />}
                {isRunning ? 'Pause Sim' : 'Play Sim'}
              </button>
              
              <button 
                onClick={resetSimulation} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  backgroundColor: 'transparent', 
                  color: '#94a3b8', 
                  border: '1px solid rgba(148, 163, 184, 0.3)', 
                  padding: '8px 16px', 
                  borderRadius: '6px', 
                  fontWeight: '600', 
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} style={{ color: '#64748b' }} />
                <span style={{ fontSize: '14px', color: '#94a3b8' }}>Event Date:</span>
                <select 
                  value={selectedDate} 
                  onChange={handleDateChange} 
                  style={{ 
                    backgroundColor: '#0d1127', 
                    color: '#f8fafc', 
                    border: '1px solid rgba(56, 189, 248, 0.2)', 
                    padding: '6px 12px', 
                    borderRadius: '6px', 
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {Object.keys(groupedDates).sort().map(year => (
                    <optgroup key={year} label={`──── ${year} (${groupedDates[year].length} days) ────`}>
                      {groupedDates[year].map(date => (
                        <option key={date} value={date}>{date}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: '#94a3b8' }}>Speed:</span>
                <input 
                  type="range" 
                  min="200" 
                  max="2000" 
                  step="200" 
                  value={simulationSpeed} 
                  onChange={(e) => setSimulationSpeed(Number(e.target.value))} 
                  style={{ cursor: 'pointer', width: '100px' }} 
                />
                <span style={{ fontSize: '12px', color: '#64748b', width: '45px' }}>{simulationSpeed}ms</span>
              </div>
            </div>
          </div>

          {/* INSTRUMENT TIMESERIES CHART */}
          <div style={{ 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '20px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} style={{ color: '#38bdf8' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Aditya-L1 Raw Instrument Light Curves</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Cadence: 1 minute</span>
            </div>
            
            <div style={{ height: '320px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSolexs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCzt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0d1127', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  
                  <Area 
                    name="SoLEXS Soft X-Ray (0.8-2 keV)" 
                    type="monotone" 
                    dataKey="solexs" 
                    stroke="#38bdf8" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorSolexs)" 
                  />
                  <Area 
                    name="HEL1OS Hard X-Ray CZT (20-40 keV)" 
                    type="monotone" 
                    dataKey="czt_low" 
                    stroke="#ec4899" 
                    strokeWidth={1.5}
                    fillOpacity={1} 
                    fill="url(#colorCzt)" 
                  />
                  <Area 
                    name="HEL1OS CdTe low-energy (5-20 keV)" 
                    type="monotone" 
                    dataKey="cdte" 
                    stroke="#10b981" 
                    strokeWidth={1.5}
                    fillOpacity={0.05}
                    fill="#10b981" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FORECAST ALERT PROBABILITIES CHART */}
          <div style={{ 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '20px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={20} style={{ color: '#f59e0b' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Ensemble Threat Level Forecasting</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Forecast Horizon: 30 minutes</span>
            </div>

            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} domain={[0, 1]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0d1127', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  
                  {/* Alert threshold reference line */}
                  <ReferenceLine y={0.3} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Alert Threshold (0.3)', fill: '#ef4444', fontSize: 10, position: 'top' }} />
                  
                  <Line 
                    name="LSTM Probability" 
                    type="monotone" 
                    dataKey="lstm" 
                    stroke="#a855f7" 
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line 
                    name="Physics Precursor Score" 
                    type="monotone" 
                    dataKey="physics" 
                    stroke="#10b981" 
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line 
                    name="Ensemble Threat Level" 
                    type="monotone" 
                    dataKey="ensemble" 
                    stroke="#f59e0b" 
                    strokeWidth={3}
                    dot={false}
                  />
                  <Area 
                    name="Actual GOES Flare Peak Active" 
                    type="step" 
                    dataKey="is_flare" 
                    stroke="none"
                    fill="rgba(239, 68, 68, 0.15)"
                    legendType="none"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: PRECURSOR METRICS AND ALGORITHMIC DETAILS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* SIMULATOR TIME DISPLAY */}
          <div style={{ 
            backgroundColor: 'rgba(13, 17, 39, 0.8)', 
            border: '1px solid var(--border-glow)', 
            borderRadius: '16px', 
            padding: '20px',
            boxShadow: '0 0 15px rgba(56, 189, 248, 0.05)'
          }}>
            <h4 style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', letterSpacing: '1px', marginBottom: '10px' }}>SIMULATION TIMELINE</h4>
            <div style={{ fontSize: '24px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
              {formatTime(current.timestamp) || '00:00'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Class: <strong style={{ color: current.flare_class !== 'quiet' ? '#ef4444' : '#94a3b8' }}>{current.flare_class}</strong></span>
              <span style={{ color: '#64748b' }}>{realtime.currentIndex} / {realtime.totalIndex} min</span>
            </div>
            <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${(realtime.currentIndex / realtime.totalIndex) * 100}%`, height: '100%', backgroundColor: '#38bdf8' }} />
            </div>
          </div>

          {/* PHYSICS INDICATORS GAUGES */}
          <div style={{ 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '20px' 
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} style={{ color: '#38bdf8' }} />
              Physics-Guided Precursors
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Brightening */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Pre-Flare Brightening (SXR)</span>
                  <span style={{ fontWeight: '600', color: '#38bdf8' }}>{((current.solexs_brightening || 0) * 100).toFixed(0)}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(current.solexs_brightening || 0) * 100}%`, height: '100%', backgroundColor: '#38bdf8', transition: 'width 0.3s' }} />
                </div>
              </div>

              {/* Hardening */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Spectral Hardening (HXR)</span>
                  <span style={{ fontWeight: '600', color: '#ec4899' }}>{((current.spectral_hardening || 0) * 100).toFixed(0)}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(current.spectral_hardening || 0) * 100}%`, height: '100%', backgroundColor: '#ec4899', transition: 'width 0.3s' }} />
                </div>
              </div>

              {/* Microflare count */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>HXR Microflares (CdTe)</span>
                  <span style={{ fontWeight: '600', color: '#10b981' }}>{((current.microflare_score || 0) * 100).toFixed(0)}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(current.microflare_score || 0) * 100}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.3s' }} />
                </div>
              </div>
            </div>
          </div>

          {/* METRICS PANEL */}
          <div style={{ 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '20px' 
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} style={{ color: '#f59e0b' }} />
              Validation Performance
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              
              <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600' }}>EVENT RECALL</span>
                <span style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
                  {typeof metrics.event_recall === 'number' ? `${(metrics.event_recall * 100).toFixed(1)}%` : '—'}
                </span>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600' }}>LEAD TIME</span>
                <span style={{ fontSize: '18px', fontWeight: '700', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={16} />
                  {typeof metrics.avg_lead_time_minutes === 'number' ? `${metrics.avg_lead_time_minutes.toFixed(1)}m` : '—'}
                </span>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600' }}>FALSE ALARM RATE</span>
                <span style={{ fontSize: '18px', fontWeight: '700', color: '#ef4444' }}>
                  {typeof metrics.far === 'number' ? `${(metrics.far * 100).toFixed(1)}%` : '—'}
                </span>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600' }}>F1-SCORE</span>
                <span style={{ fontSize: '18px', fontWeight: '700', color: '#a855f7' }}>
                  {typeof metrics.f1_score === 'number' ? metrics.f1_score.toFixed(3) : '—'}
                </span>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600' }}>TSS (PEIRCE)</span>
                <span style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b' }}>
                  {typeof metrics.tss === 'number' ? metrics.tss.toFixed(3) : '—'}
                </span>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600' }}>HSS (HEIDKE)</span>
                <span style={{ fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>
                  {typeof metrics.hss === 'number' ? metrics.hss.toFixed(3) : '—'}
                </span>
              </div>

            </div>
            
            <div style={{ marginTop: '12px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
              Ensemble Model Weight Configuration:<br />
              <strong>LSTM (70%) + Physics Precursors (30%)</strong>
            </div>
          </div>

        </div>
      </div>
      )}

      {activeTab === 'roadmap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* STAT CARDS / PROGRESS SUMMARY */}
          {(() => {
            const allTasks = [...tasks.e1, ...tasks.e2, ...tasks.c1, ...tasks.c2];
            const completedCount = allTasks.filter(t => t.status === 'completed').length;
            const activeCount = allTasks.filter(t => t.status === 'active').length;
            const pendingCount = allTasks.filter(t => t.status === 'pending').length;
            const progressPct = Math.round((completedCount / allTasks.length) * 100) || 0;
            
            return (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                gap: '16px',
                padding: '20px',
                backgroundColor: 'rgba(13, 17, 39, 0.5)',
                border: '1px solid rgba(56, 189, 248, 0.1)',
                borderRadius: '16px',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', letterSpacing: '1px' }}>HACKATHON PROGRESS</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px' }}>
                    <span style={{ fontSize: '36px', fontWeight: '800', color: '#38bdf8' }}>{progressPct}%</span>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>({completedCount} / {allTasks.length} tasks)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressPct}%`, height: '100%', backgroundColor: '#38bdf8', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                <div style={{ paddingLeft: '16px', borderLeft: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', letterSpacing: '1px' }}>COMPLETED</span>
                  <h3 style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', marginTop: '6px' }}>{completedCount}</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Ingestion & Pipeline logic finished</p>
                </div>

                <div style={{ paddingLeft: '16px', borderLeft: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', letterSpacing: '1px' }}>ACTIVE SPRINT</span>
                  <h3 style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b', marginTop: '6px' }}>{activeCount}</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Tasks currently in focus</p>
                </div>

                <div style={{ paddingLeft: '16px', borderLeft: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', letterSpacing: '1px' }}>BACKLOG (PENDING)</span>
                  <h3 style={{ fontSize: '28px', fontWeight: '700', color: '#94a3b8', marginTop: '6px' }}>{pendingCount}</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Remaining deliverables</p>
                </div>
              </div>
            );
          })()}

          {/* ROADMAP GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            
            {/* ECE 1: SIGNAL LEAD */}
            <div style={{ 
              backgroundColor: 'rgba(13, 17, 39, 0.3)', 
              border: '1px solid rgba(56, 189, 248, 0.1)', 
              borderRadius: '16px', 
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '6px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>E1</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>ECE 1 — Signal Lead</h3>
                  </div>
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600', letterSpacing: '0.5px' }}>
                    {Math.round((tasks.e1.filter(t => t.status === 'completed').length / tasks.e1.length) * 100)}% DONE
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tasks.e1.map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => handleToggleTask('e1', task.id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '10px', 
                        padding: '10px', 
                        backgroundColor: task.status === 'completed' ? 'rgba(16, 185, 129, 0.03)' : task.status === 'active' ? 'rgba(245, 158, 11, 0.03)' : 'rgba(255,255,255,0.01)',
                        border: `1px solid ${task.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : task.status === 'active' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        {task.status === 'completed' ? <CheckSquare size={16} style={{ color: '#10b981', flexShrink: 0 }} /> : task.status === 'active' ? <Clock size={16} style={{ color: '#f59e0b', flexShrink: 0 }} /> : <Square size={16} style={{ color: '#475569', flexShrink: 0 }} />}
                        <span style={{ 
                          fontSize: '13px', 
                          color: task.status === 'completed' ? '#94a3b8' : task.status === 'active' ? '#f8fafc' : '#64748b',
                          textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                          fontWeight: task.status === 'active' ? '600' : 'normal',
                          marginRight: '30px',
                          wordBreak: 'break-word'
                        }}>{task.text}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask('e1', task.id); }}
                        style={{ position: 'absolute', right: '8px', top: '8px', background: 'none', border: 'none', color: '#ef4444', opacity: 0.3, cursor: 'pointer', padding: '4px' }}
                        onMouseEnter={(e) => e.target.style.opacity = 1}
                        onMouseLeave={(e) => e.target.style.opacity = 0.3}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Custom Task Form */}
              <div style={{ marginTop: '20px', display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <input 
                  type="text" 
                  placeholder="Add custom E1 task..."
                  value={newTaskTexts.e1}
                  onChange={(e) => setNewTaskTexts(prev => ({ ...prev, e1: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask('e1')}
                  style={{ 
                    flex: 1, 
                    backgroundColor: '#0d1127', 
                    color: '#f8fafc', 
                    border: '1px solid rgba(255, 255, 255, 0.05)', 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    fontSize: '12px' 
                  }}
                />
                <button 
                  onClick={() => handleAddTask('e1')}
                  style={{ backgroundColor: '#38bdf8', color: '#060814', border: 'none', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* ECE 2: DOMAIN LEAD */}
            <div style={{ 
              backgroundColor: 'rgba(13, 17, 39, 0.3)', 
              border: '1px solid rgba(56, 189, 248, 0.1)', 
              borderRadius: '16px', 
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '6px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>E2</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>ECE 2 — Domain & Validation</h3>
                  </div>
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600', letterSpacing: '0.5px' }}>
                    {Math.round((tasks.e2.filter(t => t.status === 'completed').length / tasks.e2.length) * 100)}% DONE
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tasks.e2.map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => handleToggleTask('e2', task.id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '10px', 
                        padding: '10px', 
                        backgroundColor: task.status === 'completed' ? 'rgba(16, 185, 129, 0.03)' : task.status === 'active' ? 'rgba(245, 158, 11, 0.03)' : 'rgba(255,255,255,0.01)',
                        border: `1px solid ${task.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : task.status === 'active' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        {task.status === 'completed' ? <CheckSquare size={16} style={{ color: '#10b981', flexShrink: 0 }} /> : task.status === 'active' ? <Clock size={16} style={{ color: '#f59e0b', flexShrink: 0 }} /> : <Square size={16} style={{ color: '#475569', flexShrink: 0 }} />}
                        <span style={{ 
                          fontSize: '13px', 
                          color: task.status === 'completed' ? '#94a3b8' : task.status === 'active' ? '#f8fafc' : '#64748b',
                          textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                          fontWeight: task.status === 'active' ? '600' : 'normal',
                          marginRight: '30px',
                          wordBreak: 'break-word'
                        }}>{task.text}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask('e2', task.id); }}
                        style={{ position: 'absolute', right: '8px', top: '8px', background: 'none', border: 'none', color: '#ef4444', opacity: 0.3, cursor: 'pointer', padding: '4px' }}
                        onMouseEnter={(e) => e.target.style.opacity = 1}
                        onMouseLeave={(e) => e.target.style.opacity = 0.3}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <input 
                  type="text" 
                  placeholder="Add custom E2 task..."
                  value={newTaskTexts.e2}
                  onChange={(e) => setNewTaskTexts(prev => ({ ...prev, e2: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask('e2')}
                  style={{ 
                    flex: 1, 
                    backgroundColor: '#0d1127', 
                    color: '#f8fafc', 
                    border: '1px solid rgba(255, 255, 255, 0.05)', 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    fontSize: '12px' 
                  }}
                />
                <button 
                  onClick={() => handleAddTask('e2')}
                  style={{ backgroundColor: '#10b981', color: '#060814', border: 'none', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* CSE 1: ML LEAD */}
            <div style={{ 
              backgroundColor: 'rgba(13, 17, 39, 0.3)', 
              border: '1px solid rgba(56, 189, 248, 0.1)', 
              borderRadius: '16px', 
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '6px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>C1</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>CSE 1 — ML Lead</h3>
                  </div>
                  <span style={{ fontSize: '11px', color: '#a855f7', fontWeight: '600', letterSpacing: '0.5px' }}>
                    {Math.round((tasks.c1.filter(t => t.status === 'completed').length / tasks.c1.length) * 100)}% DONE
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tasks.c1.map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => handleToggleTask('c1', task.id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '10px', 
                        padding: '10px', 
                        backgroundColor: task.status === 'completed' ? 'rgba(16, 185, 129, 0.03)' : task.status === 'active' ? 'rgba(245, 158, 11, 0.03)' : 'rgba(255,255,255,0.01)',
                        border: `1px solid ${task.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : task.status === 'active' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        {task.status === 'completed' ? <CheckSquare size={16} style={{ color: '#10b981', flexShrink: 0 }} /> : task.status === 'active' ? <Clock size={16} style={{ color: '#f59e0b', flexShrink: 0 }} /> : <Square size={16} style={{ color: '#475569', flexShrink: 0 }} />}
                        <span style={{ 
                          fontSize: '13px', 
                          color: task.status === 'completed' ? '#94a3b8' : task.status === 'active' ? '#f8fafc' : '#64748b',
                          textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                          fontWeight: task.status === 'active' ? '600' : 'normal',
                          marginRight: '30px',
                          wordBreak: 'break-word'
                        }}>{task.text}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask('c1', task.id); }}
                        style={{ position: 'absolute', right: '8px', top: '8px', background: 'none', border: 'none', color: '#ef4444', opacity: 0.3, cursor: 'pointer', padding: '4px' }}
                        onMouseEnter={(e) => e.target.style.opacity = 1}
                        onMouseLeave={(e) => e.target.style.opacity = 0.3}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <input 
                  type="text" 
                  placeholder="Add custom C1 task..."
                  value={newTaskTexts.c1}
                  onChange={(e) => setNewTaskTexts(prev => ({ ...prev, c1: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask('c1')}
                  style={{ 
                    flex: 1, 
                    backgroundColor: '#0d1127', 
                    color: '#f8fafc', 
                    border: '1px solid rgba(255, 255, 255, 0.05)', 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    fontSize: '12px' 
                  }}
                />
                <button 
                  onClick={() => handleAddTask('c1')}
                  style={{ backgroundColor: '#a855f7', color: '#060814', border: 'none', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* CSE 2: DASHBOARD LEAD */}
            <div style={{ 
              backgroundColor: 'rgba(13, 17, 39, 0.3)', 
              border: '1px solid rgba(56, 189, 248, 0.1)', 
              borderRadius: '16px', 
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '6px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>C2</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>CSE 2 — Dashboard & Integration</h3>
                  </div>
                  <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600', letterSpacing: '0.5px' }}>
                    {Math.round((tasks.c2.filter(t => t.status === 'completed').length / tasks.c2.length) * 100)}% DONE
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tasks.c2.map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => handleToggleTask('c2', task.id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '10px', 
                        padding: '10px', 
                        backgroundColor: task.status === 'completed' ? 'rgba(16, 185, 129, 0.03)' : task.status === 'active' ? 'rgba(245, 158, 11, 0.03)' : 'rgba(255,255,255,0.01)',
                        border: `1px solid ${task.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : task.status === 'active' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        {task.status === 'completed' ? <CheckSquare size={16} style={{ color: '#10b981', flexShrink: 0 }} /> : task.status === 'active' ? <Clock size={16} style={{ color: '#f59e0b', flexShrink: 0 }} /> : <Square size={16} style={{ color: '#475569', flexShrink: 0 }} />}
                        <span style={{ 
                          fontSize: '13px', 
                          color: task.status === 'completed' ? '#94a3b8' : task.status === 'active' ? '#f8fafc' : '#64748b',
                          textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                          fontWeight: task.status === 'active' ? '600' : 'normal',
                          marginRight: '30px',
                          wordBreak: 'break-word'
                        }}>{task.text}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask('c2', task.id); }}
                        style={{ position: 'absolute', right: '8px', top: '8px', background: 'none', border: 'none', color: '#ef4444', opacity: 0.3, cursor: 'pointer', padding: '4px' }}
                        onMouseEnter={(e) => e.target.style.opacity = 1}
                        onMouseLeave={(e) => e.target.style.opacity = 0.3}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <input 
                  type="text" 
                  placeholder="Add custom C2 task..."
                  value={newTaskTexts.c2}
                  onChange={(e) => setNewTaskTexts(prev => ({ ...prev, c2: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask('c2')}
                  style={{ 
                    flex: 1, 
                    backgroundColor: '#0d1127', 
                    color: '#f8fafc', 
                    border: '1px solid rgba(255, 255, 255, 0.05)', 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    fontSize: '12px' 
                  }}
                />
                <button 
                  onClick={() => handleAddTask('c2')}
                  style={{ backgroundColor: '#f59e0b', color: '#060814', border: 'none', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

          </div>

          {/* ROADMAP HOW-TO NOTE */}
          <div style={{ 
            backgroundColor: 'rgba(56, 189, 248, 0.02)', 
            border: '1px solid rgba(56, 189, 248, 0.1)', 
            borderRadius: '12px', 
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Settings size={20} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              <strong>Tip for the Hackathon Pitch:</strong> Click on any task box above to cycle its status: 
              <strong style={{ color: '#10b981' }}> Completed</strong> (Green check) → 
              <strong style={{ color: '#f59e0b' }}> Active Sprint</strong> (Orange timer) → 
              <strong style={{ color: '#64748b' }}> Backlog</strong> (Gray box). You can also add custom deliverables at the bottom.
            </span>
          </div>

        </div>
      )}

      {activeTab === 'flow' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Style Injector for SVG Flow Animation */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes flowDash {
              to {
                stroke-dashoffset: -20;
              }
            }
            .flow-line-animated {
              stroke-dasharray: 6;
              animation: flowDash 0.8s linear infinite;
            }
            .node-pulse-blue {
              box-shadow: 0 0 15px rgba(56, 189, 248, 0.15);
            }
            .node-pulse-blue:hover {
              box-shadow: 0 0 25px rgba(56, 189, 248, 0.4);
              border-color: rgba(56, 189, 248, 0.5) !important;
            }
            .node-pulse-green {
              box-shadow: 0 0 15px rgba(16, 185, 129, 0.15);
            }
            .node-pulse-green:hover {
              box-shadow: 0 0 25px rgba(16, 185, 129, 0.4);
              border-color: rgba(16, 185, 129, 0.5) !important;
            }
            .node-pulse-purple {
              box-shadow: 0 0 15px rgba(168, 85, 247, 0.15);
            }
            .node-pulse-purple:hover {
              box-shadow: 0 0 25px rgba(168, 85, 247, 0.4);
              border-color: rgba(168, 85, 247, 0.5) !important;
            }
            .node-pulse-indigo {
              box-shadow: 0 0 15px rgba(99, 102, 241, 0.15);
            }
            .node-pulse-indigo:hover {
              box-shadow: 0 0 25px rgba(99, 102, 241, 0.4);
              border-color: rgba(99, 102, 241, 0.5) !important;
            }
            .node-pulse-orange {
              box-shadow: 0 0 15px rgba(245, 158, 11, 0.15);
            }
            .node-pulse-orange:hover {
              box-shadow: 0 0 25px rgba(245, 158, 11, 0.4);
              border-color: rgba(245, 158, 11, 0.5) !important;
            }
          `}} />

          {/* DIAGRAM TYPE CONTROLS */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            backgroundColor: 'rgba(13, 17, 39, 0.5)',
            border: '1px solid rgba(56, 189, 248, 0.15)',
            borderRadius: '16px',
            padding: '16px 24px',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)'
          }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>System Diagram Explorer</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Explore the data flow, module architecture, and system sequence of the Aditya-L1 forecasting engine</p>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {[
                { id: 'flow', label: 'Process Flow', icon: <Network size={14} /> },
                { id: 'arch', label: 'System Architecture', icon: <GitBranch size={14} /> },
                { id: 'usecase', label: 'Use Case Sequence', icon: <Layers size={14} /> }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setDiagramType(opt.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: diagramType === opt.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: diagramType === opt.id ? '#38bdf8' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '12px',
                    transition: 'all 0.2s'
                  }}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* MAIN DIAGRAM DISPLAY PANEL */}
          <div style={{ 
            backgroundColor: 'rgba(13, 17, 39, 0.3)', 
            border: '1px solid rgba(56, 189, 248, 0.1)', 
            borderRadius: '16px', 
            padding: '40px 20px',
            position: 'relative',
            minHeight: '400px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            overflowX: 'auto'
          }}>
            
            {/* 1. PROCESS FLOW VIEW */}
            {diagramType === 'flow' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', maxWidth: '1200px', justifyContent: 'space-between', position: 'relative', padding: '0 20px' }}>
                
                {/* SVG Connections Canvas */}
                <svg style={{ position: 'absolute', top: '50px', left: 0, width: '100%', height: '40px', zIndex: 0, pointerEvents: 'none' }}>
                  <line x1="15%" y1="20" x2="30%" y2="20" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="2" className="flow-line-animated" />
                  <line x1="35%" y1="20" x2="50%" y2="20" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="2" className="flow-line-animated" />
                  <line x1="55%" y1="20" x2="70%" y2="20" stroke="rgba(168, 85, 247, 0.2)" strokeWidth="2" className="flow-line-animated" />
                  <line x1="75%" y1="20" x2="90%" y2="20" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="2" className="flow-line-animated" />
                </svg>

                {/* Nodes list */}
                {[
                  { id: 'telemetry_source', label: '1. Raw Telemetry', desc: 'SoLEXS & HEL1OS', icon: <Database size={24} />, color: '#38bdf8', ringClass: 'node-pulse-blue' },
                  { id: 'ingestion_fusion', label: '2. Ingestion & Sync', desc: 'Resample & Label', icon: <Layers size={24} />, color: '#10b981', ringClass: 'node-pulse-green' },
                  { id: 'algorithmic_core', label: '3. Ensemble ML Core', desc: 'LSTM + Physics', icon: <Cpu size={24} />, color: '#a855f7', ringClass: 'node-pulse-purple' },
                  { id: 'fastapi_stream', label: '4. FastAPI Engine', desc: '10x Sim Player', icon: <Network size={24} />, color: '#6366f1', ringClass: 'node-pulse-indigo' },
                  { id: 'react_dashboard', label: '5. Visual Telemetry', desc: 'Realtime Alerts', icon: <Tv size={24} />, color: '#f59e0b', ringClass: 'node-pulse-orange' }
                ].map(node => {
                  const isSelected = selectedNode === node.id;
                  return (
                    <div 
                      key={node.id}
                      onClick={() => setSelectedNode(node.id)}
                      className={node.ringClass}
                      style={{
                        zIndex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '180px',
                        padding: '16px',
                        backgroundColor: isSelected ? 'rgba(13, 17, 39, 0.95)' : 'rgba(6, 8, 20, 0.8)',
                        border: `2px solid ${isSelected ? node.color : 'rgba(255, 255, 255, 0.05)'}`,
                        borderRadius: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        transform: isSelected ? 'scale(1.08)' : 'scale(1)'
                      }}
                    >
                      <div style={{ 
                        backgroundColor: isSelected ? `${node.color}20` : 'rgba(255,255,255,0.02)', 
                        color: node.color, 
                        width: '50px', 
                        height: '50px', 
                        borderRadius: '12px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        marginBottom: '12px',
                        border: `1px solid ${isSelected ? node.color : 'rgba(255,255,255,0.05)'}`
                      }}>
                        {node.icon}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: isSelected ? '#f8fafc' : '#94a3b8', textAlign: 'center' }}>
                        {node.label}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', textAlign: 'center' }}>
                        {node.desc}
                      </span>
                    </div>
                  );
                })}

              </div>
            )}

            {/* 2. SYSTEM ARCHITECTURE VIEW */}
            {diagramType === 'arch' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: '30px', width: '100%', maxWidth: '1000px', position: 'relative' }}>
                
                {/* LEFT SIDE: ECE DOMAIN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ borderLeft: '3px solid #38bdf8', paddingLeft: '16px', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#38bdf8', letterSpacing: '0.5px' }}>ECE PIPELINE (PHYSICS & SIGNAL)</h4>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>Data loading, processing, and solar physics equations</p>
                  </div>
                  
                  {/* ECE 1 Node */}
                  <div 
                    onClick={() => setSelectedNode('telemetry_source')}
                    className="node-pulse-blue"
                    style={{
                      padding: '16px',
                      backgroundColor: selectedNode === 'telemetry_source' ? 'rgba(13, 17, 39, 0.95)' : 'rgba(6, 8, 20, 0.8)',
                      border: `2px solid ${selectedNode === 'telemetry_source' ? '#38bdf8' : 'rgba(56, 189, 248, 0.15)'}`,
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '10px', borderRadius: '10px' }}>
                        <Database size={20} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>ECE 1 — Ingestion Layer</h4>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>FITS/CDF loader, dynamic columns resolver</span>
                      </div>
                    </div>
                  </div>

                  {/* ECE 2 Node */}
                  <div 
                    onClick={() => setSelectedNode('ingestion_fusion')}
                    className="node-pulse-green"
                    style={{
                      padding: '16px',
                      backgroundColor: selectedNode === 'ingestion_fusion' ? 'rgba(13, 17, 39, 0.95)' : 'rgba(6, 8, 20, 0.8)',
                      border: `2px solid ${selectedNode === 'ingestion_fusion' ? '#10b981' : 'rgba(16, 185, 129, 0.15)'}`,
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '10px', borderRadius: '10px' }}>
                        <Layers size={20} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>ECE 2 — Physics Precursors</h4>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Spectral hardening, SXR brightening derivatives</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CENTER CONNECTORS */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '40px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.1)' }}>
                    <ArrowRight size={20} className="flow-line-animated" style={{ color: '#38bdf8' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.1)' }}>
                    <ArrowRight size={20} className="flow-line-animated" style={{ color: '#a855f7' }} />
                  </div>
                </div>

                {/* RIGHT SIDE: CSE SOFTWARE/ML */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ borderLeft: '3px solid #a855f7', paddingLeft: '16px', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#a855f7', letterSpacing: '0.5px' }}>CSE PIPELINE (ML & DASHBOARD)</h4>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>Sequential modelling, API player caching, and streaming</p>
                  </div>

                  {/* CSE 1 Node */}
                  <div 
                    onClick={() => setSelectedNode('algorithmic_core')}
                    className="node-pulse-purple"
                    style={{
                      padding: '16px',
                      backgroundColor: selectedNode === 'algorithmic_core' ? 'rgba(13, 17, 39, 0.95)' : 'rgba(6, 8, 20, 0.8)',
                      border: `2px solid ${selectedNode === 'algorithmic_core' ? '#a855f7' : 'rgba(168, 85, 247, 0.15)'}`,
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '10px', borderRadius: '10px' }}>
                        <Cpu size={20} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>CSE 1 — ML Deep Learning</h4>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>LSTM model sequence predictions, weighted BCE</span>
                      </div>
                    </div>
                  </div>

                  {/* CSE 2 Node */}
                  <div 
                    onClick={() => setSelectedNode('fastapi_stream')}
                    className="node-pulse-orange"
                    style={{
                      padding: '16px',
                      backgroundColor: selectedNode === 'fastapi_stream' ? 'rgba(13, 17, 39, 0.95)' : 'rgba(6, 8, 20, 0.8)',
                      border: `2px solid ${selectedNode === 'fastapi_stream' ? '#f59e0b' : 'rgba(245, 158, 11, 0.15)'}`,
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '10px', borderRadius: '10px' }}>
                        <Tv size={20} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>CSE 2 — API & Integration</h4>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>FastAPI player state caching, live feed visualizer</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* 3. USE CASE SEQUENCE VIEW */}
            {diagramType === 'usecase' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '800px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '8px', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                  <span>SYSTEM ENTITY</span>
                  <span>TRIGGER PATHWAY</span>
                  <span>OUTCOME ALERT</span>
                </div>

                {[
                  { step: '01', source: 'Aditya-L1 Satellite', icon: <Database size={16} />, desc: 'Detects sudden Soft X-ray brightening in SoLEXS FITS files', action: 'Data transmission', status: 'telemetry_source', color: '#38bdf8' },
                  { step: '02', source: 'Ingestion Pipeline', icon: <Layers size={16} />, desc: 'Resamples raw fluxes to a 1-min grid, checks NOAA catalog matches', action: 'Synchronized alignment', status: 'ingestion_fusion', color: '#10b981' },
                  { step: '03', source: 'Hybrid Ensemble Core', icon: <Cpu size={16} />, desc: 'LSTM calculates temporal trends; E2 formulas extract spectral hardening', action: 'Prediction evaluation', status: 'algorithmic_core', color: '#a855f7' },
                  { step: '04', source: 'FastAPI Stream Server', icon: <Network size={16} />, desc: 'Evaluates probability thresholds (RED alert issued at 0.50 threshold)', action: 'Thread-safe broadcast', status: 'fastapi_stream', color: '#6366f1' },
                  { step: '05', source: 'React Telemetry Panel', icon: <Tv size={16} />, desc: 'Triggers visual banners, plots curves, issues satellite safe-mode warning', action: 'Operator response', status: 'react_dashboard', color: '#f59e0b' }
                ].map((item, idx) => (
                  <div 
                    key={item.step}
                    onClick={() => setSelectedNode(item.status)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '12px 16px',
                      backgroundColor: selectedNode === item.status ? 'rgba(13, 17, 39, 0.8)' : 'rgba(255,255,255,0.01)',
                      border: `1px solid ${selectedNode === item.status ? item.color : 'rgba(255,255,255,0.03)'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      transform: selectedNode === item.status ? 'translateX(10px)' : 'translateX(0)'
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '700', color: item.color, fontFamily: 'var(--font-mono)' }}>{item.step}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '200px', flexShrink: 0 }}>
                      <div style={{ color: item.color }}>{item.icon}</div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc' }}>{item.source}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#94a3b8', flex: 1, padding: '0 10px' }}>
                      {item.desc}
                    </span>
                    <div style={{ backgroundColor: `${item.color}15`, color: item.color, fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${item.color}30` }}>
                      {item.action}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* DYNAMIC DETAIL CARD DISPLAY */}
          {(() => {
            const nodeDetails = {
              telemetry_source: {
                title: "Raw Spacecraft Telemetry Ingestion (SoLEXS & HEL1OS)",
                role: "ECE 1 — Signal Lead & ECE 2 — Domain Lead",
                roleBadgeColor: '#38bdf8',
                description: "This stage is responsible for fetching, reading, and verifying the binary tables transmitted from the Aditya-L1 spacecraft. It parses compression formats and maps variable columns generated across detector calibration cycles.",
                files: [
                  { name: "DATA_INSTRUCTION.md", path: "/Users/srimannarayanadeevi/Aditya-L1 Solar Flare Forecasting/DATA_INSTRUCTION.md" },
                  { name: "verify_ingestion.py", path: "/Users/srimannarayanadeevi/Aditya-L1 Solar Flare Forecasting/src/data/verify_ingestion.py" }
                ],
                logic: [
                  "SoLEXS FITS parser searches recursively for compressed light curves (*.lc.gz)",
                  "Dynamically inspects extension tables to resolve variable data column aliases (COUNTS vs. RATE vs. COUNT_RATE)",
                  "Accesses FITS memory mappings using Astropy, casting data directly to memory matrices to avoid lazy-loading handle errors"
                ],
                code: `# Ingestion verification scan snippet
for filepath in glob.glob("data/raw/solexs/**/*.lc.gz", recursive=True):
    try:
        with fits.open(filepath) as hdul:
            data = hdul[1].data
            # Cache tables in memory to keep handles open
            counts = data['COUNTS'].astype(float)
            timestamps = data['TIME'].astype(float)
    except Exception as e:
        print(f"File error on {filepath}: {e}")`
              },
              ingestion_fusion: {
                title: "Data Alignment & NOAA Solar Catalog Labeling",
                role: "ECE 1 — Signal Lead & ECE 2 — Domain Lead",
                roleBadgeColor: '#10b981',
                description: "Aligns the high-cadence soft X-ray (SoLEXS) and hard X-ray (HEL1OS) signals onto a common temporal grid. Annotates timestamps using chronological NOAA ground-truth flare records.",
                files: [
                  { name: "merge_data.py", path: "/Users/srimannarayanadeevi/Aditya-L1 Solar Flare Forecasting/src/data/merge_data.py" },
                  { name: "cdf_parser.py", path: "/Users/srimannarayanadeevi/Aditya-L1 Solar Flare Forecasting/src/utils/cdf_parser.py" }
                ],
                logic: [
                  "Downsamples high-cadence count records to a standard 1-minute cadence using pandas mean resampling",
                  "Aligns SoLEXS and HEL1OS data arrays via a temporal outer join to prevent coordinate misalignment",
                  "Cross-references timelines against NOAA catalog logs, labeling timestamps as quiet vs. class C/M/X flare events"
                ],
                code: `# Standardizing cadences and syncing timestamps
solexs_resampled = solexs_df.set_index('timestamp').resample('1min').mean()
hel1os_resampled = hel1os_df.set_index('timestamp').resample('1min').mean()

# Outer join aligns timestamps and keeps all telemetry channels
merged_dataset = solexs_resampled.join(hel1os_resampled, how='outer')
merged_dataset = merged_dataset.reset_index()`
              },
              algorithmic_core: {
                title: "Hybrid Ensemble Predictor (PyTorch LSTM + Physics Precursors)",
                role: "CSE 1 — ML Lead & ECE 2 — Domain Lead",
                roleBadgeColor: '#a855f7',
                description: "Evaluates the probability of solar flare escalation. Combines a sequence-based PyTorch LSTM classifier (processed with class-weighted cross-entropy) with physics-guided precursor scoring.",
                files: [
                  { name: "train_lstm.py", path: "/Users/srimannarayanadeevi/Aditya-L1 Solar Flare Forecasting/src/models/train_lstm.py" },
                  { name: "physics_precursors.py", path: "/Users/srimannarayanadeevi/Aditya-L1 Solar Flare Forecasting/src/models/physics_precursors.py" },
                  { name: "ensemble_forecast.py", path: "/Users/srimannarayanadeevi/Aditya-L1 Solar Flare Forecasting/src/models/ensemble_forecast.py" }
                ],
                logic: [
                  "Pre-flare Brightening: checks for Soft X-ray counts increase rate over a rolling 5-minute window",
                  "Spectral Hardening: calculates the ratio of high-energy CZT (80-150 keV) vs low-energy CZT (20-40 keV) count rates",
                  "LSTM sequence classifier: processes a rolling 60-minute window of lag-features to forecast flares 15 minutes ahead",
                  "Loss Optimization: applies weighted BCE (pos_weight = 9.212) to address class imbalance, maximizing TSS and HSS scores"
                ],
                code: `# Calculating Soft X-Ray Pre-flare Brightening score
solexs_diff = df['log_solexs_sdd2_counts'].diff()
# Fraction of the last 5 minutes with increasing flux
df['solexs_brightening'] = (solexs_diff > 0.001).rolling(window=5, min_periods=1).sum() / 5.0

# Spectral Hardening formula
df['spectral_hardening'] = df['hel1os_czt1_80_to_150_ctr'] / (df['hel1os_czt1_20_to_40_ctr'] + 1e-5)`
              },
              fastapi_stream: {
                title: "FastAPI Simulated Live Telemetry Server",
                role: "CSE 2 — Dashboard Lead",
                roleBadgeColor: '#6366f1',
                description: "Simulates real-time spacecraft streaming. Provides high-performance, thread-safe endpoints using asynchronous locking to drive visual alerts on the operator dashboard.",
                files: [
                  { name: "main.py", path: "/Users/srimannarayanadeevi/Aditya-L1 Solar Flare Forecasting/backend/main.py" }
                ],
                logic: [
                  "Caches processed validation arrays in memory during server startup using FastAPI lifecycle hooks",
                  "Maintains simulation player indices inside a thread lock (threading.Lock()) to support concurrent front-end queries",
                  "Calculates real-time threat levels: RED status is triggered when the hybrid ensemble model exceeds a 0.50 threshold"
                ],
                code: `# Asynchronous streaming endpoint
@app.get("/api/stream")
def get_stream():
    global stream_index, stream_date
    with stream_lock:
        df_day = dashboard_df[dashboard_df['timestamp'].dt.date == pd.to_datetime(stream_date).date()]
        row = df_day.iloc[stream_index].to_dict()
        stream_index += 1
    return {"current": row, "currentIndex": stream_index, "totalIndex": len(df_day)}`
              },
              react_dashboard: {
                title: "Visual Telemetry Control Center Dashboard",
                role: "CSE 2 — Dashboard Lead",
                roleBadgeColor: '#f59e0b',
                description: "The visual operations deck. Integrates live streams with responsive Recharts panels, warning status indicators, and satellite safe-mode action recommendations.",
                files: [
                  { name: "App.jsx", path: "/Users/srimannarayanadeevi/Aditya-L1 Solar Flare Forecasting/dashboard/src/App.jsx" }
                ],
                logic: [
                  "Tab Switcher maintains view states: Live Telemetry feed, Task Roadmap checklist, and System Architecture",
                  "Simulation speed is adjustable dynamically via polling intervals (100ms - 2000ms per ticks)",
                  "Operator Banners provide early warning recommendations: yellow warning alerts pre-heating; red alert advises safe-mode"
                ],
                code: `// React effect hook driving telemetry updates
useEffect(() => {
  if (!isRunning) return;
  
  const tick = async () => {
    try {
      const res = await fetch(\`\${API_BASE}/api/stream\`);
      const data = await res.json();
      setRealtime(data);
    } catch (err) {
      console.error("Failed to fetch stream tick", err);
    }
  };
  
  timerRef.current = setInterval(tick, simulationSpeed);
  return () => clearInterval(timerRef.current);
}, [isRunning, simulationSpeed]);`
              }
            };

            const details = nodeDetails[selectedNode] || nodeDetails.telemetry_source;
            return (
              <div style={{ 
                backgroundColor: 'rgba(13, 17, 39, 0.5)',
                border: '1px solid rgba(56, 189, 248, 0.15)',
                borderRadius: '16px',
                padding: '24px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)'
              }}>
                {/* Left Column: Text & Files */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <span style={{ 
                      backgroundColor: `${details.roleBadgeColor}15`, 
                      color: details.roleBadgeColor, 
                      fontSize: '11px', 
                      fontWeight: '700', 
                      padding: '4px 10px', 
                      borderRadius: '6px', 
                      border: `1px solid ${details.roleBadgeColor}30`,
                      display: 'inline-block',
                      letterSpacing: '0.5px'
                    }}>
                      {details.role}
                    </span>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#f8fafc', marginTop: '10px' }}>
                      {details.title}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px', lineHeight: '1.5' }}>
                      {details.description}
                    </p>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Associated Code Files</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {details.files.map(f => (
                        <a 
                          key={f.name}
                          href={`file://${f.path}`}
                          style={{ 
                            fontSize: '13px', 
                            color: '#38bdf8', 
                            textDecoration: 'none', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            fontWeight: '500'
                          }}
                          onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                          onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                        >
                          <FileText size={14} />
                          {f.name}
                        </a>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Key Logic & Formulas</h4>
                    <ul style={{ paddingLeft: '20px', fontSize: '13px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {details.logic.map((l, i) => (
                        <li key={i} style={{ lineHeight: '1.4' }}>{l}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Column: Code block */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', letterSpacing: '0.5px' }}>LOGIC IMPLEMENTATION SNIPPET</span>
                    <span style={{ fontSize: '11px', color: details.roleBadgeColor, fontFamily: 'var(--font-mono)' }}>python</span>
                  </div>
                  <div style={{ 
                    flex: 1, 
                    backgroundColor: '#060814', 
                    borderRadius: '12px', 
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '16px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: '#e2e8f0',
                    lineHeight: '1.5',
                    overflowX: 'auto',
                    whiteSpace: 'pre'
                  }}>
                    {details.code}
                  </div>
                </div>

              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
}

export default App;
