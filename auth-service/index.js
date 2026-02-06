const express = require('express');
const cors = require('cors');
const { generateProof, verifyProof, poseidonHash, normalizeSecret, initPoseidon } = require('../zkp/zkp');
const { getDevice, upsertDevice, updateDeviceStatus, initDb, markLastSeen } = require('./db');
const { getContract } = require('./contract');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const PROVIDER_URL = process.env.PROVIDER_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';
const AUTH_DB_PATH = process.env.AUTH_DB_PATH;

app.use(cors());
app.use(express.json());

const contract = getContract({ providerUrl: PROVIDER_URL, contractAddress: CONTRACT_ADDRESS });

app.post('/register', async (req, res) => {
    const { deviceId, secret } = req.body;
    if (!deviceId || !secret) return res.status(400).json({ error: 'Missing deviceId or secret' });
    const commitment = poseidonHash([normalizeSecret(secret)]);
    const now = Date.now();
    await upsertDevice({
        deviceId,
        commitment,
        status: 'ACTIVE',
        registeredAt: now,
        updatedAt: now
    });
    console.log(`[AuthService] Registered ${deviceId} with commitment ${commitment}`);

    if (contract) {
        try {
            await contract.registerDevice(deviceId, commitment);
        } catch (error) {
            console.error(`[AuthService] Contract register failed: ${error.message}`);
        }
    }

    res.json({ success: true, commitment });
});

app.post('/verify', async (req, res) => {
    const { deviceId, proof, publicSignals } = req.body;

    console.log(`[AuthService] Verifying ${deviceId}`);
    if (!deviceId || !proof || !publicSignals) {
        return res.status(400).json({ error: 'Missing deviceId, proof, or publicSignals' });
    }
    const device = await getDevice(deviceId);
    if (!device) {
        return res.status(404).json({ error: 'Device not found' });
    }
    if (device.status !== 'ACTIVE') {
        return res.status(403).json({ error: `Device is ${device.status}` });
    }
    if (!publicSignals[0] || publicSignals[0] !== device.commitment) {
        if (contract) {
            await contract.logAuth(deviceId, false, 'Commitment mismatch');
        }
        return res.status(401).json({ error: 'Invalid commitment proof' });
    }

    const isValid = await verifyProof(proof, publicSignals);
    if (!isValid) {
        if (contract) {
            await contract.logAuth(deviceId, false, 'Invalid ZK Proof');
        }
        return res.status(401).json({ error: 'Invalid ZK Proof' });
    }
    await markLastSeen(deviceId, Date.now());
    if (contract) {
        await contract.logAuth(deviceId, true, 'OK');
    }
    res.json({ success: true, token: 'mock_jwt_token' });
});

app.post('/prove', async (req, res) => {
    const { secret } = req.body;
    if (!secret) return res.status(400).json({ error: 'Missing secret' });
    try {
        const proofData = await generateProof(secret);
        res.json(proofData);
    } catch (error) {
        console.error(`[AuthService] Proof generation failed: ${error.message}`);
        res.status(500).json({ error: 'Proof generation failed' });
    }
});

app.post('/revoke', async (req, res) => {
    const { deviceId, reason } = req.body;
    console.log(`[AuthService] Revocation Triggered for ${deviceId}: ${reason}`);

    const device = await getDevice(deviceId);
    if (!device) {
        return res.status(404).json({ error: 'Device not found' });
    }
    await updateDeviceStatus(deviceId, 'REVOKED');

    if (contract) {
        try {
            await contract.updateStatus(deviceId, 'REVOKED');
        } catch (error) {
            console.error(`[AuthService] Contract revoke failed: ${error.message}`);
        }
    }

    res.json({ success: true, status: 'REVOKED' });
});

app.get('/health', async (_req, res) => {
    res.json({ status: 'ok' });
});

initDb(AUTH_DB_PATH)
    .then(() => initPoseidon())
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Auth Service running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error(`[AuthService] Failed to init db: ${error.message}`);
        process.exit(1);
    });
