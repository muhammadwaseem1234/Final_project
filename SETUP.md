# Setup

This repo runs a local full stack:
Hardhat (contracts) + Auth Service + Behavior Service + Gateway + Web UI.

## Requirements

- Node.js 18+ (20 LTS recommended)
- Python 3.9+
- `circom` installed and on PATH
- Git

## Install dependencies

From repo root:

```powershell
npm install
```

For the UI:

```powershell
cd web-ui
npm install
```

Python deps:

```powershell
pip install -r behavior-service/requirements.txt
pip install -r device-sim/requirements.txt
```

## ZKP artifacts (one-time)

```powershell
npm run zkp:setup
```

## Run everything (one command)

```powershell
npm run start:all
```

## Manual run (step-by-step)

### 1) Start Hardhat node

```powershell
cd contracts
npx hardhat node
```

### 2) Compile + deploy contract

```powershell
cd contracts
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```
Copy the printed contract address.

### 3) Start auth-service

```powershell
cd C:\Users\Dell\AuthChainID
$env:PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
$env:CONTRACT_ADDRESS="0x..."
node auth-service/index.js
```

### 4) Start behavior-service

```powershell
cd C:\Users\Dell\AuthChainID
python behavior-service/main.py
```

### 5) Start gateway

```powershell
cd C:\Users\Dell\AuthChainID
node gateway/index.js
```

### 6) Start web UI

```powershell
cd C:\Users\Dell\AuthChainID\web-ui
npm run dev
```

## Optional: device simulator

```powershell
cd C:\Users\Dell\AuthChainID\device-sim
python device_sim.py
```
