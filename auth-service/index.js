const express = require('express');
const cors = require('cors');
const { generateProof, verifyProof, poseidonHash, normalizeSecret, initPoseidon } = require('../zkp/zkp');
const { getDevice, upsertDevice, updateDeviceStatus, initDb, markLastSeen } = require('./db');
const { getContract } = require('./contract');
const { signJwt } = require('../shared/jwt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const PROVIDER_URL = process.env.PROVIDER_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';
const AUTH_DB_PATH = process.env.AUTH_DB_PATH;
const JWT_SECRET = process.env.JWT_SECRET || 'local_dev_jwt_secret_change_me';
const JWT_ISSUER = process.env.JWT_ISSUER || 'authchainid-auth-service';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'authchainid-gateway';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

app.use(cors());
app.use(express.json());

const contract = getContract({ providerUrl: PROVIDER_URL, contractAddress: CONTRACT_ADDRESS });

const issueDeviceToken = (deviceId) =>
    signJwt({
        secret: JWT_SECRET,
        subject: deviceId,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: JWT_EXPIRES_IN,
        claims: {
            deviceId,
            scope: ['telemetry:write']
        }
    });

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
    const token = issueDeviceToken(deviceId);
    res.json({ success: true, token, tokenType: 'Bearer', expiresIn: JWT_EXPIRES_IN });
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

app.get('/devices/:deviceId/status', async (req, res) => {
    const { deviceId } = req.params;
    const device = await getDevice(deviceId);
    if (!device) {
        return res.status(404).json({ error: 'Device not found' });
    }
    res.json({ deviceId, status: device.status, updatedAt: device.updatedAt, lastSeenAt: device.lastSeenAt });
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
