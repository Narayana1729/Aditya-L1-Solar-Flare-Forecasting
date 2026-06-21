import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="CSE 2 Telemetry Server Scratch")

# Enable CORS for React frontend local port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simulated live player index state
stream_lock = threading.Lock()
stream_index = 0
stream_data = [
    {"timestamp": "2024-07-01 12:00:00", "solexs_counts": 105.4, "hel1os_counts": 2.4, "prob": 0.05, "class": "quiet"},
    {"timestamp": "2024-07-01 12:01:00", "solexs_counts": 120.1, "hel1os_counts": 3.8, "prob": 0.12, "class": "quiet"},
    {"timestamp": "2024-07-01 12:02:00", "solexs_counts": 240.5, "hel1os_counts": 15.6, "prob": 0.35, "class": "C-class"},
    {"timestamp": "2024-07-01 12:03:00", "solexs_counts": 580.2, "hel1os_counts": 88.3, "prob": 0.78, "class": "M-class"},
    {"timestamp": "2024-07-01 12:04:00", "solexs_counts": 980.4, "hel1os_counts": 220.1, "prob": 0.94, "class": "X-class"},
]

@app.get("/api/scratch-stream")
def get_stream_tick():
    """
    Simulated real-time streaming tick player endpoint.
    Uses locking primitives for thread safety during asynchronous requests.
    """
    global stream_index
    with stream_lock:
        row = stream_data[stream_index % len(stream_data)]
        stream_index += 1
        current_tick = stream_index
        
    return {
        "current": row,
        "currentIndex": current_tick,
        "totalIndex": len(stream_data)
    }

@app.get("/api/scratch-metrics")
def get_metrics():
    """
    Mock metrics endpoint.
    """
    return {
        "event_recall": 0.677,
        "avg_lead_time_minutes": 11.5,
        "far": 0.125,
        "f1_score": 0.710,
        "tss": 0.070,
        "hss": 0.065
    }

if __name__ == "__main__":
    print("Launching scratch telemetry server at http://localhost:8000")
    print("Access endpoints:")
    print("  - http://localhost:8000/api/scratch-stream")
    print("  - http://localhost:8000/api/scratch-metrics")
    uvicorn.run(app, host="127.0.0.1", port=8000)
