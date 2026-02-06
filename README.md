# AuthChainID (Improved)

This version adds:
- SQLite persistence for device registry
- Real Circom + snarkjs proof verification
- Contract integration on a local Hardhat chain
- End-to-end test harness

## Prereqs

- Node.js 18+
- Python 3.9+
- `circom` installed and on PATH
- `snarkjs` available via `npx` (installed with npm deps)

## Install

```powershell
npm install
```

## ZKP Setup

```powershell
npm run zkp:setup
```

## Run locally

1. Start Hardhat node (separate terminal):
```powershell
cd contracts
npx hardhat node
```

2. Deploy the registry:
```powershell
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```
Copy the printed address and export it as `CONTRACT_ADDRESS`.

3. Start services:
```powershell
$env:PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
$env:CONTRACT_ADDRESS="0x..."
node auth-service/index.js
```

```powershell
python behavior-service/main.py
```

```powershell
node gateway/index.js
```

4. Start the UI:
```powershell
cd web-ui
npm install
npm run dev
```

## End-to-end test

```powershell
npm run test:e2e
```

This will:
- Start a local Hardhat node
- Deploy `DeviceRegistry`
- Launch auth, behavior, and gateway services
- Run registration, proof-based auth, telemetry, and revocation checks
