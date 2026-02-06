# ZKP Setup

This project uses a real Circom + snarkjs Groth16 proof for device authentication.

## One-time setup (Windows PowerShell)

```powershell
./zkp/scripts/setup.ps1
```

## One-time setup (bash)

```bash
./zkp/scripts/setup.sh
```

Artifacts will be generated under `zkp/artifacts/` and are required for:
- `auth-service` proof verification
- `zkp/prove.js` proof generation

## Circuit Notes

The circuit proves knowledge of a secret whose Poseidon hash equals the public commitment.
The secret is first SHA-256 hashed into a field element before proof generation.
