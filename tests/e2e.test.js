const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const repoRoot = path.resolve(__dirname, '..');

const spawnProcess = (command, args, options = {}) => {
  const child = spawn(command, args, { stdio: 'pipe', ...options });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
};

const waitForJsonRpc = async (url, retries = 30) => {
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] })
      });
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Hardhat node did not start');
};

const waitForHealth = async (url, retries = 30) => {
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Service not healthy: ${url}`);
};

let hardhatNode;
let authService;
let behaviorService;
let gateway;
let contractAddress;

before(async () => {
  hardhatNode = spawnProcess('npx', ['hardhat', 'node'], { cwd: path.join(repoRoot, 'contracts') });
  await waitForJsonRpc('http://127.0.0.1:8545');

  const deploy = spawnProcess(
    'npx',
    ['hardhat', 'run', 'scripts/deploy.js', '--network', 'localhost'],
    { cwd: path.join(repoRoot, 'contracts') }
  );
  const output = await new Promise((resolve, reject) => {
    let data = '';
    deploy.stdout.on('data', (chunk) => {
      data += chunk.toString();
    });
    deploy.stderr.on('data', (chunk) => {
      data += chunk.toString();
    });
    deploy.on('close', (code) => {
      if (code === 0) resolve(data.trim());
      else reject(new Error(`Deploy failed: ${data}`));
    });
  });
  contractAddress = output.split('\n').pop().trim();
  assert.ok(contractAddress.startsWith('0x'));

  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'authchain-')), 'auth.db');
  authService = spawnProcess('node', ['auth-service/index.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AUTH_DB_PATH: dbPath,
      PROVIDER_URL: 'http://127.0.0.1:8545',
      CONTRACT_ADDRESS: contractAddress,
      PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      PORT: '3001'
    }
  });

  behaviorService = spawnProcess(process.env.PYTHON || 'python', ['behavior-service/main.py'], {
    cwd: repoRoot,
    env: { ...process.env }
  });

  gateway = spawnProcess('node', ['gateway/index.js'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: '3000', AUTH_SERVICE_URL: 'http://localhost:3001', BEHAVIOR_SERVICE_URL: 'http://localhost:8000' }
  });

  await waitForHealth('http://localhost:3001/health');
  await waitForHealth('http://localhost:3000/health');
});

after(() => {
  [gateway, behaviorService, authService, hardhatNode].forEach((proc) => {
    if (proc && !proc.killed) {
      proc.kill();
    }
  });
});

test('end-to-end auth + telemetry + revoke', async () => {
  const deviceId = `device_${Date.now()}`;
  const secret = 'my_super_secret';

  const regRes = await fetch('http://localhost:3001/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, secret })
  });
  const regData = await regRes.json();
  assert.equal(regRes.status, 200);
  assert.ok(regData.commitment);

  const proofRes = await fetch('http://localhost:3001/prove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret })
  });
  const proofData = await proofRes.json();
  assert.equal(proofRes.status, 200);
  assert.ok(proofData.proof);

  const authRes = await fetch('http://localhost:3000/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      proof: proofData.proof,
      publicSignals: proofData.publicSignals
    })
  });
  const authData = await authRes.json();
  assert.equal(authRes.status, 200);
  assert.ok(authData.token);

  const telemetryOk = await fetch('http://localhost:3000/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, payloadSize: 50, metricValue: 12.5 })
  });
  const telemetryOkData = await telemetryOk.json();
  assert.equal(telemetryOk.status, 200);
  assert.equal(telemetryOkData.status, 'OK');

  const telemetryBad = await fetch('http://localhost:3000/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, payloadSize: 2000, metricValue: 12.5 })
  });
  const telemetryBadData = await telemetryBad.json();
  assert.equal(telemetryBad.status, 200);
  assert.equal(telemetryBadData.status, 'ANOMALY_DETECTED');

  const authRes2 = await fetch('http://localhost:3000/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      proof: proofData.proof,
      publicSignals: proofData.publicSignals
    })
  });
  const authData2 = await authRes2.json();
  assert.equal(authRes2.status, 403);
  assert.ok(authData2.error.includes('REVOKED'));
});
