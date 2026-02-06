import requests
import time
import sys
import json
import subprocess
import os

GATEWAY_URL = "http://localhost:3000"
AUTH_SERVICE_URL = "http://localhost:3001" # For registration (direct for simplicity)

def get_proof(secret):
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    cmd = ["node", os.path.join(repo_root, "zkp", "prove.js"), "--secret", str(secret)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Proof generation failed")
    return json.loads(result.stdout)

class IoTDevice:
    def __init__(self, device_id, secret, mode="normal"):
        self.device_id = device_id
        self.secret = secret
        self.mode = mode
        self.token = None

    def register(self):
        print(f"[{self.device_id}] Registering...")
        proof_data = get_proof(self.secret)
        # Register directly with Auth Service (Manufacturing step)
        try:
            res = requests.post(f"{AUTH_SERVICE_URL}/register", json={
                "deviceId": self.device_id,
                "secret": self.secret
            })
            if res.status_code == 200:
                print(f"[{self.device_id}] Registered content: {res.json()}")
            else:
                print(f"[{self.device_id}] Registration Failed: {res.text}")
        except Exception as e:
            print(f"Registration Error: {e}")

    def authenticate(self):
        print(f"[{self.device_id}] Authenticating...")
        proof_data = get_proof(self.secret)
        payload = {
            "deviceId": self.device_id,
            "proof": proof_data["proof"],
            "publicSignals": proof_data["publicSignals"]
        }
        try:
            res = requests.post(f"{GATEWAY_URL}/auth", json=payload)
            if res.status_code == 200:
                print(f"[{self.device_id}] Auth Success: {res.json()}")
            else:
                print(f"[{self.device_id}] Auth Failed: {res.text}")
        except Exception as e:
            print(f"Auth Error: {e}")

    def send_telemetry(self):
        payload_size = 50 # Normal
        if self.mode == "anomaly":
             payload_size = 2000 # Anomaly!
        
        data = {
            "deviceId": self.device_id,
            "payloadSize": payload_size,
            "metricValue": 12.5
        }
        try:
            res = requests.post(f"{GATEWAY_URL}/telemetry", json=data)
            print(f"[{self.device_id}] Telemetry Sent: {res.json()}")
        except Exception as e:
             print(f"Telemetry Error: {e}")

    def run(self):
        self.register()
        time.sleep(2)
        
        while True:
            self.authenticate()
            
            # Anomaly Mode: Flood requests
            loops = 10 if self.mode == "anomaly" else 1
            
            for _ in range(loops):
                self.send_telemetry()
                if self.mode == "anomaly":
                    time.sleep(0.1) 
            
            time.sleep(5)

if __name__ == "__main__":
    mode = "normal"
    if len(sys.argv) > 1:
        mode = sys.argv[1]
    
    device_id = f"device_{int(time.time())}"
    secret = "my_super_secret"
    
    device = IoTDevice(device_id, secret, mode)
    device.run()
