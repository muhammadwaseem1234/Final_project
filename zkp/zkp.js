const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const snarkjs = require('snarkjs');
const circomlib = require('circomlibjs');

let poseidonInstance;
let vkeyCache;

const ARTIFACT_DIR = path.join(__dirname, 'artifacts');
const WASM_PATH = path.join(ARTIFACT_DIR, 'auth_js', 'auth.wasm');
const ZKEY_PATH = path.join(ARTIFACT_DIR, 'auth_final.zkey');
const VKEY_PATH = path.join(ARTIFACT_DIR, 'verification_key.json');

const ensureArtifacts = () => {
  if (!fs.existsSync(WASM_PATH) || !fs.existsSync(ZKEY_PATH) || !fs.existsSync(VKEY_PATH)) {
    throw new Error('ZKP artifacts missing. Run the setup script in zkp/README.md.');
  }
};

const getPoseidon = async () => {
  if (!poseidonInstance) {
    poseidonInstance = await circomlib.buildPoseidon();
  }
  return poseidonInstance;
};

const normalizeSecret = (secret) => {
  const hash = crypto.createHash('sha256').update(String(secret)).digest('hex');
  return BigInt(`0x${hash}`).toString();
};

const poseidonHash = (inputs) => {
  if (!poseidonInstance) {
    throw new Error('Poseidon not initialized. Call generateProof or initPoseidon first.');
  }
  const values = inputs.map((v) => BigInt(v));
  const result = poseidonInstance(values);
  return poseidonInstance.F.toString(result);
};

const initPoseidon = async () => {
  await getPoseidon();
};

const loadVKey = () => {
  if (!vkeyCache) {
    vkeyCache = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf-8'));
  }
  return vkeyCache;
};

const generateProof = async (secret) => {
  ensureArtifacts();
  const poseidon = await getPoseidon();
  const secretScalar = normalizeSecret(secret);
  const commitment = poseidon.F.toString(poseidon([BigInt(secretScalar)]));
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    { secret: secretScalar, commitment },
    WASM_PATH,
    ZKEY_PATH
  );
  return { proof, publicSignals };
};

const verifyProof = async (proof, publicSignals) => {
  ensureArtifacts();
  const vkey = loadVKey();
  return snarkjs.groth16.verify(vkey, publicSignals, proof);
};

module.exports = { generateProof, verifyProof, poseidonHash, normalizeSecret, initPoseidon };
