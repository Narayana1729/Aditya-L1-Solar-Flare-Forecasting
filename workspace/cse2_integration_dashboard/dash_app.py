import os
import sys
import pandas as pd
import numpy as np
from datetime import datetime
import dash
from dash import dcc, html, Input, Output, State
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
from pathlib import Path

# Resolve workspace directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))

# ALERT LOGIC CONFIGURATION (EASY TO TUNE)
LSTM_WATCH_THRESHOLD = 0.30
LSTM_ALERT_THRESHOLD = 0.50

# Rule-based fallback thresholds (if ML model fails/errors)
FALLBACK_WATCH_FLUX = 200.0
FALLBACK_ALERT_FLUX = 500.0

# Path to preprocessed datasets
DATA_PATH = BASE_DIR / "goes_data/processed/goes_labeled.csv"

# Load the inference module
try:
    from models import inference
    model_available = True
    print("[SUCCESS] Found models/inference.py. Real model active.")
except Exception as e:
    model_available = False
    print(f"[WARNING] Could not load models/inference.py: {e}. Falling back to rule-based nowcaster.")

# Load replay database
if DATA_PATH.exists():
    df_database = pd.read_csv(DATA_PATH)
    df_database['timestamp'] = pd.to_datetime(df_database['timestamp'])
    df_database = df_database.sort_values('timestamp').reset_index(drop=True)
    print(f"[SUCCESS] Loaded {len(df_database)} records from {DATA_PATH} for simulation.")
else:
    # Fallback to generating synthetic data if E1 CSV is missing
    print(f"[WARNING] {DATA_PATH} not found. Generating synthetic flux dataset.")
    date_range = pd.date_range(start="2026-06-18 12:00:00", periods=180, freq="1min")
    # Simulate background noise with a sudden M-class flare injection
    short_flux = np.random.normal(50, 5, 180)
    long_flux = np.random.normal(30, 3, 180)
    # Inject flare peaking around index 100
    for i in range(70, 140):
        intensity = 600 * np.exp(-((i - 100) ** 2) / 100)
        short_flux[i] += intensity
        long_flux[i] += intensity * 0.7
        
    df_database = pd.DataFrame({
        "timestamp": date_range,
        "short_flux": short_flux,
        "long_flux": long_flux,
        "flare_class": ["quiet" if (i < 80 or i > 120) else "M2.3" for i in range(180)],
        "physics_precursor_score": [0.1 if (i < 70 or i > 130) else 0.4 if i < 90 else 0.8 for i in range(180)]
    })
    # Add dummy feature columns to prevent inference wrapper crashes
    feature_cols_path = BASE_DIR / "data/processed/feature_cols.txt"
    if feature_cols_path.exists():
        with open(feature_cols_path, "r") as f:
            feature_cols = [line.strip() for line in f if line.strip()]
        for col in feature_cols:
            df_database[col] = np.random.normal(0.0, 1.0, len(df_database))

# Initialize Dash application with DARKLY bootstrap theme
app = dash.Dash(
    __name__,
    external_stylesheets=[dbc.themes.DARKLY],
    title="Aditya-L1 Solar Flare Forecast Control Deck"
)

# App Layout Structure
app.layout = dbc.Container([
    # 1. Header Navigation Bar
    dbc.Row([
        dbc.Col([
            html.Div([
                html.H1("🛰️ ADITYA-L1", style={"fontSize": "28px", "fontWeight": "800", "margin": "0", "color": "#38bdf8"}),
                html.P("Solar Flare Forecasting Operations & Safe-Mode Dashboard (C2)", style={"color": "#64748b", "margin": "0", "fontSize": "13px"})
            ])
        ], md=6, className="d-flex align-items-center"),
        
        # Live Indicator Panel
        dbc.Col([
            dbc.Card([
                dbc.CardBody([
                    html.Div([
                        html.Span("SYSTEM LEVEL:", style={"fontSize": "10px", "color": "#64748b", "fontWeight": "700", "letterSpacing": "1px"}),
                        html.H4("QUIET MODE", id="alert-text", style={"margin": "0", "fontSize": "16px", "fontWeight": "700", "color": "#10b981"}),
                    ], className="flex-grow-1"),
                    dbc.Badge("none", id="flare-class-badge", color="success", className="ms-3 px-3 py-2", style={"fontSize": "14px", "fontWeight": "800"})
                ], className="d-flex align-items-center justify-content-between p-2")
            ], id="alert-indicator-card", style={
                "backgroundColor": "rgba(16, 185, 129, 0.12)",
                "border": "1px solid rgba(16, 185, 129, 0.3)",
                "borderRadius": "12px",
                "width": "260px"
            })
        ], md=6, className="d-flex justify-content-end align-items-center")
    ], className="my-4 pb-3 border-bottom border-secondary"),

    # 2. Main Visualization Columns
    dbc.Row([
        # Left Panel (Charts + Replay Controls)
        dbc.Col([
            dbc.Card([
                dbc.CardHeader("Telemetry Real-time Replay", style={"fontWeight": "600", "fontSize": "14px"}),
                dbc.CardBody([
                    dcc.Graph(id="flux-chart", config={"displayModeBar": False}),
                    
                    # Timeline Progress
                    html.Div([
                        dbc.Progress(id="timeline-progress", value=0, max=len(df_database)-1, striped=True, animated=True, style={"height": "6px"}),
                        html.Div([
                            html.Span("Simulation Date: 2026-06-18", id="simulation-date-label", style={"color": "#64748b", "fontSize": "11px"}),
                            html.Span("0 / 180 min", id="timeline-progress-label", style={"color": "#64748b", "fontSize": "11px"})
                        ], className="d-flex justify-content-between mt-2")
                    ], className="my-3"),
                    
                    # Control Deck
                    dbc.Row([
                        dbc.Col([
                            dbc.ButtonGroup([
                                dbc.Button("▶ Play", id="btn-play-pause", color="info", size="sm", className="px-3"),
                                dbc.Button("🔄 Reset", id="btn-reset", color="secondary", size="sm")
                            ])
                        ], width=6, className="d-flex align-items-center"),
                        
                        dbc.Col([
                            html.Div([
                                html.Span("Replay Speed:", className="me-2", style={"fontSize": "12px", "color": "#94a3b8"}),
                                dcc.Dropdown(
                                    id="speed-selector",
                                    options=[
                                        {"label": "1x Speed", "value": 1},
                                        {"label": "10x Speed (Accelerated)", "value": 10},
                                        {"label": "50x Speed (Rapid)", "value": 50}
                                    ],
                                    value=10,
                                    clearable=False,
                                    searchable=False,
                                    style={"width": "180px", "color": "#000"}
                                )
                            ], className="d-flex align-items-center justify-content-end")
                        ], width=6)
                    ])
                ])
            ], className="mb-4", style={"backgroundColor": "#151932", "border": "1px solid rgba(255,255,255,0.05)", "borderRadius": "16px"})
        ], md=8),
        
        # Right Panel (Checklists + Logs)
        dbc.Col([
            # Spacecraft Advisory Checklist Card
            dbc.Card([
                dbc.CardHeader("Spacecraft Action Advisory", style={"fontWeight": "600", "fontSize": "14px"}),
                dbc.CardBody([
                    html.H5("OPERATIONAL STATUS: NOMINAL", id="advisory-status", style={"fontSize": "13px", "fontWeight": "700"}),
                    html.P("All instruments acquiring baseline baseline levels.", id="advisory-text", style={"fontSize": "12px", "color": "#94a3b8", "lineHeight": "1.4"}),
                    html.Div(id="advisory-checklist-container", children=[
                        html.Ul([
                            html.Li("Proceed with active solar baseline scans", style={"fontSize": "12px", "color": "#10b981"}),
                            html.Li("Transmit standard telemetry packets", style={"fontSize": "12px", "color": "#10b981"}),
                            html.Li("Radiator systems and payload pointing normal", style={"fontSize": "12px", "color": "#10b981"})
                        ], style={"margin": "0", "paddingLeft": "15px"})
                    ])
                ])
            ], className="mb-4", style={"backgroundColor": "#151932", "border": "1px solid rgba(255,255,255,0.05)", "borderRadius": "16px"}),
            
            # Scrolling Event Log Card
            dbc.Card([
                dbc.CardHeader("Simulation Operations Log", style={"fontWeight": "600", "fontSize": "14px"}),
                dbc.CardBody([
                    html.Div(id="event-logs-list", style={
                        "height": "220px", 
                        "overflowY": "auto", 
                        "fontSize": "11px", 
                        "fontFamily": "monospace",
                        "display": "flex",
                        "flexDirection": "column-reverse",
                        "gap": "6px"
                    })
                ])
            ], className="mb-4", style={"backgroundColor": "#151932", "border": "1px solid rgba(255,255,255,0.05)", "borderRadius": "16px"})
        ], md=4)
    ]),
    
    # Stores for maintaining simulation state and transition logs
    dcc.Store(id="stream-index-store", data=0),
    dcc.Store(id="logs-store", data=[]),
    
    # Interval timer component for simulation streaming ticks
    dcc.Interval(id="simulation-interval", interval=100, disabled=True)
], fluid=True, style={"maxWidth": "1500px", "backgroundColor": "#060814", "minHeight": "100vh", "padding": "0 24px"})

# Callback 1: Controls Play/Pause toggle and Reset action
@app.callback(
    [Output("stream-index-store", "data"),
     Output("simulation-interval", "disabled"),
     Output("btn-play-pause", "children"),
     Output("btn-play-pause", "color")],
    [Input("btn-play-pause", "n_clicks"),
     Input("btn-reset", "n_clicks"),
     Input("simulation-interval", "n_intervals")],
    [State("btn-play-pause", "children"),
     State("stream-index-store", "data")]
)
def handle_controls(play_clicks, reset_clicks, n_intervals, play_text, current_index):
    ctx = dash.callback_context
    if not ctx.triggered:
        return current_index, True, "▶ Play", "info"
        
    trigger_id = ctx.triggered[0]["prop_id"].split(".")[0]
    
    if trigger_id == "btn-reset":
        return 0, True, "▶ Play", "info"
        
    elif trigger_id == "btn-play-pause":
        if "Play" in play_text:
            return current_index, False, "⏸ Pause", "danger"
        else:
            return current_index, True, "▶ Play", "info"
            
    elif trigger_id == "simulation-interval":
        next_idx = current_index + 1
        if next_idx >= len(df_database):
            # Loop simulation
            return 0, True, "▶ Play", "info"
        return next_idx, False, "⏸ Pause", "danger"
        
    return current_index, True, "▶ Play", "info"

# Callback 2: Adjusts replay interval pacing based on speed dropdown
@app.callback(
    Output("simulation-interval", "interval"),
    Input("speed-selector", "value")
)
def update_interval_speed(multiplier):
    # Base rate is 1000ms. Accelerated 10x is 100ms, 50x is 20ms.
    return int(1000 / multiplier)

# Callback 3: Computes ML prediction and updates all charts and panels
@app.callback(
    [Output("flux-chart", "figure"),
     Output("alert-indicator-card", "style"),
     Output("alert-text", "children"),
     Output("alert-text", "style"),
     Output("flare-class-badge", "children"),
     Output("flare-class-badge", "color"),
     Output("advisory-status", "children"),
     Output("advisory-text", "children"),
     Output("advisory-checklist-container", "children"),
     Output("timeline-progress", "value"),
     Output("timeline-progress-label", "children"),
     Output("simulation-date-label", "children"),
     Output("event-logs-list", "children"),
     Output("logs-store", "data")],
    [Input("stream-index-store", "data")],
    [State("logs-store", "data")]
)
def update_telemetry_deck(current_idx, transition_logs):
    # Slice the history stream up to current_idx
    df_history = df_database.iloc[:current_idx+1]
    current_row = df_database.iloc[current_idx]
    
    # 1. Pipeline Integration & LSTM Inference Call
    lstm_prob = 0.0
    inference_status = "OK"
    
    if model_available:
        try:
            # Check if we have at least 30 lookback rows of history
            if len(df_history) >= 30:
                window_df = df_history.iloc[-30:]
                lstm_prob = inference.predict(window_df)
            else:
                # Pad sequences if we are at the very beginning of replay
                padding_df = pd.concat([df_database.iloc[[0]]] * (30 - len(df_history)) + [df_history], ignore_index=True)
                lstm_prob = inference.predict(padding_df)
        except Exception as e:
            inference_status = f"ERROR: {str(e)[:40]}..."
            # Graceful Fallback: Rule-based thresholding
            s_flux = current_row["short_flux"]
            l_flux = current_row["long_flux"]
            if s_flux >= FALLBACK_ALERT_FLUX or l_flux >= FALLBACK_ALERT_FLUX:
                lstm_prob = 0.65
            elif s_flux >= FALLBACK_WATCH_FLUX or l_flux >= FALLBACK_WATCH_FLUX:
                lstm_prob = 0.38
            else:
                lstm_prob = 0.12
    else:
        inference_status = "FALLBACK (Rule-based nowcaster active)"
        # Rule-based thresholding fallback
        s_flux = current_row["short_flux"]
        l_flux = current_row["long_flux"]
        if s_flux >= FALLBACK_ALERT_FLUX or l_flux >= FALLBACK_ALERT_FLUX:
            lstm_prob = 0.70
        elif s_flux >= FALLBACK_WATCH_FLUX or l_flux >= FALLBACK_WATCH_FLUX:
            lstm_prob = 0.40
        else:
            lstm_prob = 0.10

    # 2. Evaluate Alerts using Constants at Top
    status_level = "GREEN"
    status_text = "QUIET MODE"
    status_color = "#10b981"
    status_bg = "rgba(16, 185, 129, 0.12)"
    status_border = "1px solid rgba(16, 185, 129, 0.3)"
    
    advisory_lbl = "OPERATIONAL STATUS: NOMINAL"
    advisory_desc = "All instruments acquiring standard baseline counts. Normal solar background activity."
    advisory_list = html.Ul([
        html.Li("Proceed with active solar baseline scans", style={"color": "#10b981"}),
        html.Li("Transmit standard telemetry packets", style={"color": "#10b981"}),
        html.Li("Attitude and orbit control tracking Sun center", style={"color": "#10b981"})
    ], style={"margin": "0", "paddingLeft": "15px"})
    
    if lstm_prob >= LSTM_ALERT_THRESHOLD:
        status_level = "RED"
        status_text = "FLARE WARNING"
        status_color = "#ef4444"
        status_bg = "rgba(239, 68, 68, 0.15)"
        status_border = "1px solid rgba(239, 68, 68, 0.4)"
        
        advisory_lbl = "CRITICAL ALERT: INITIATE SAFE-MODE"
        advisory_desc = "ACTION RECOMMENDED: Solar flare peak imminent (<30m). Suspend science telemetry, close shutter assemblies, and orient solar panels to protect payload."
        advisory_list = html.Ul([
            html.Li("Close mechanical shutter valves for SoLEXS/HEL1OS", style={"color": "#ef4444", "fontWeight": "bold"}),
            html.Li("De-energize high-voltage CdTe grids", style={"color": "#ef4444"}),
            html.Li("Rotate solar arrays perpendicular to flare source", style={"color": "#ef4444"}),
            html.Li("Prepare spacecraft backup local buffer systems", style={"color": "#ef4444"})
        ], style={"margin": "0", "paddingLeft": "15px"})
        
    elif lstm_prob >= LSTM_WATCH_THRESHOLD:
        status_level = "YELLOW"
        status_text = "ALERT WATCH"
        status_color = "#f59e0b"
        status_bg = "rgba(245, 158, 11, 0.15)"
        status_border = "1px solid rgba(245, 158, 11, 0.4)"
        
        advisory_lbl = "STANDBY ALERT: MONITOR DETECTORS"
        advisory_desc = "ACTION RECOMMENDED: Elevated precursor heating detected. Power up high-cadence thermal registers and check radiator pathways."
        advisory_list = html.Ul([
            html.Li("Initiate high-cadence monitoring (10s telemetry grid)", style={"color": "#f59e0b"}),
            html.Li("Verify payload radiator plates are clear of debris", style={"color": "#f59e0b"}),
            html.Li("Pre-cool CdTe semiconductor matrix arrays", style={"color": "#f59e0b"}),
            html.Li("Do NOT execute safe-mode maneuvers yet", style={"color": "#f59e0b"})
        ], style={"margin": "0", "paddingLeft": "15px"})

    # 3. Flare Class Badge Display
    flare_class = current_row["flare_class"] if pd.notna(current_row["flare_class"]) else "none"
    if flare_class == "quiet" or flare_class == "none" or flare_class == "none-class":
        badge_text = "none"
        badge_color = "success"
    else:
        badge_text = str(flare_class).upper()
        badge_color = "danger" if ("M" in badge_text or "X" in badge_text) else "warning"

    # 4. Chronological Operational Logs Logic
    ts_str = current_row["timestamp"].strftime("%H:%M:%S")
    latest_log_entry = f"[{ts_str}] status: {status_level} | class: {badge_text} | score: {lstm_prob:.3f} | pipeline: {inference_status}"
    
    # Check if state changed, or if it is the first tick, or every 5th tick to record log
    last_stored_status = transition_logs[-1].split("status: ")[1].split(" |")[0] if transition_logs else None
    
    if last_stored_status != status_level or current_idx == 0 or current_idx % 10 == 0:
        transition_logs.append(latest_log_entry)
        
    # Render scrolling logs list
    log_elements = []
    for entry in transition_logs:
        color = "#10b981" if "status: GREEN" in entry else "#f59e0b" if "status: YELLOW" in entry else "#ef4444"
        log_elements.append(html.Div(entry, style={"color": color, "marginBottom": "4px"}))

    # 5. Build Time-series Plotly Chart
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=df_history["timestamp"],
        y=df_history["short_flux"],
        name="SoLEXS Soft X-Ray (short)",
        line=dict(color="#38bdf8", width=2)
    ))
    fig.add_trace(go.Scatter(
        x=df_history["timestamp"],
        y=df_history["long_flux"],
        name="HEL1OS Hard X-Ray CZT (long)",
        line=dict(color="#ec4899", width=1.5)
    ))
    # Add predicted probabilities as a dotted line
    # Since prob range is 0-1, scale it temporarily on a secondary y-axis, or plot directly
    # To keep it simple, we plot on secondary axes or scale by max counts to show overlay
    max_counts = max(df_history["short_flux"].max(), 100.0)
    fig.add_trace(go.Scatter(
        x=df_history["timestamp"],
        # Pre-calculated ensemble prob in history or the dynamic calculated prob
        y=df_history["lstm_prob"].fillna(0) * max_counts,
        name="LSTM Threat Prob (scaled)",
        line=dict(color="#a855f7", width=1.5, dash="dash")
    ))
    
    fig.update_layout(
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#94a3b8", size=10),
        xaxis=dict(gridcolor="rgba(255,255,255,0.05)", zeroline=False),
        yaxis=dict(gridcolor="rgba(255,255,255,0.05)", zeroline=False),
        margin=dict(l=40, r=20, t=10, b=30),
        height=320,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
    )

    card_style = {
        "backgroundColor": status_bg,
        "border": status_border,
        "borderRadius": "12px",
        "width": "260px",
        "boxShadow": f"0 0 15px {status_bg}",
        "transition": "all 0.3s ease"
    }
    
    indicator_text_style = {"margin": "0", "fontSize": "16px", "fontWeight": "700", "color": status_color}
    progress_label_text = f"{current_idx} / {len(df_database)-1} min"
    sim_date_str = f"Simulation Timeline: {current_row['timestamp'].strftime('%Y-%m-%d')}"

    return (
        fig, 
        card_style, 
        status_text, 
        indicator_text_style,
        badge_text, 
        badge_color,
        advisory_lbl,
        advisory_desc,
        advisory_list,
        current_idx, 
        progress_label_text, 
        sim_date_str,
        log_elements, 
        transition_logs
    )

if __name__ == "__main__":
    print("Initializing C2 Plotly Dash Dashboard on http://localhost:8050...")
    app.run(host="0.0.0.0", port=8050, debug=True)
