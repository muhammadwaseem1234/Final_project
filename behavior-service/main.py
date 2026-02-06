from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import uvicorn
import requests
import time
from collections import defaultdict
import numpy as np

app = FastAPI()

AUTH_SERVICE_URL = "http://localhost:3001"

# In-memory store for telemetry: device_id -> list of timestamps
device_history = defaultdict(list)
device_payloads = defaultdict(list)

class TelemetryData(BaseModel):
    deviceId: str
    payloadSize: int
    metricValue: float

@app.post("/telemetry")
async def receive_telemetry(data: TelemetryData):
    current_time = time.time()
    device_history[data.deviceId].append(current_time)
    device_payloads[data.deviceId].append(data.payloadSize)
    
    # Prune old history (> 1 minute)
    device_history[data.deviceId] = [t for t in device_history[data.deviceId] if current_time - t < 60]
    
    # Check for Anomalies
    # Rule 1: High Frequency (Flooding) - More than 10 requests per minute
    frequency = len(device_history[data.deviceId])
    
    # Rule 2: Payload Anomaly (Spike) - > 1000 bytes
    payload_anomaly = data.payloadSize > 1000
    
    print(f"[Behavior] Received from {data.deviceId}: Freq={frequency}/min, Size={data.payloadSize}")

    if frequency > 10 or payload_anomaly:
        reason = f"Anomaly Detected: Freq={frequency}, Size={data.payloadSize}"
        print(f"!!! REVOKING {data.deviceId}: {reason}")
        
        # Trigger Revocation
        try:
            requests.post(f"{AUTH_SERVICE_URL}/revoke", json={
                "deviceId": data.deviceId,
                "reason": reason
            })
        except Exception as e:
            print(f"Failed to contact Auth Service: {e}")
            
        return {"status": "ANOMALY_DETECTED"}

    return {"status": "OK"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
