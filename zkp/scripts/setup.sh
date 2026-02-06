#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS="${ROOT}/artifacts"

mkdir -p "${ARTIFACTS}"

pushd "${ROOT}" >/dev/null

echo "Compiling circuit..."
circom auth.circom --r1cs --wasm --sym -o "${ARTIFACTS}" -l "${ROOT}/../node_modules"

PTAU="${ARTIFACTS}/pot12_0000.ptau"
PTAU_FINAL="${ARTIFACTS}/pot12_final.ptau"
PTAU_PHASE2="${ARTIFACTS}/pot12_final_phase2.ptau"

if [[ ! -f "${PTAU}" ]]; then
  echo "Generating Powers of Tau..."
  snarkjs powersoftau new bn128 12 "${PTAU}" -v
  snarkjs powersoftau contribute "${PTAU}" "${PTAU_FINAL}" --name="authchain" -v
elif [[ ! -f "${PTAU_FINAL}" ]]; then
  snarkjs powersoftau contribute "${PTAU}" "${PTAU_FINAL}" --name="authchain" -v
fi

if [[ ! -f "${PTAU_PHASE2}" ]]; then
  echo "Preparing phase 2..."
  snarkjs powersoftau prepare phase2 "${PTAU_FINAL}" "${PTAU_PHASE2}"
fi

R1CS="${ARTIFACTS}/auth.r1cs"
ZKEY0="${ARTIFACTS}/auth_0000.zkey"
ZKEY_FINAL="${ARTIFACTS}/auth_final.zkey"
VKEY="${ARTIFACTS}/verification_key.json"

echo "Setting up Groth16..."
snarkjs groth16 setup "${R1CS}" "${PTAU_PHASE2}" "${ZKEY0}"
snarkjs zkey contribute "${ZKEY0}" "${ZKEY_FINAL}" --name="authchain" -v
snarkjs zkey export verificationkey "${ZKEY_FINAL}" "${VKEY}"

popd >/dev/null

echo "ZKP artifacts ready in zkp/artifacts."
