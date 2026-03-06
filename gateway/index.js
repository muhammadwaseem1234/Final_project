const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { verifyJwt } = require('../shared/jwt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const BEHAVIOR_SERVICE_URL = process.env.BEHAVIOR_SERVICE_URL || 'http://localhost:8000';
const JWT_SECRET = process.env.JWT_SECRET || 'local_dev_jwt_secret_change_me';
const JWT_ISSUER = process.env.JWT_ISSUER || 'authchainid-auth-service';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'authchainid-gateway';

app.use(cors());
app.use(express.json());

const getBearerToken = (authorizationHeader = '') => {
    const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);
    if (scheme !== 'Bearer' || !token || rest.length > 0) {
        return null;
    }
    return token;
};

const requireDeviceToken = (req, res, next) => {
    const token = getBearerToken(req.headers.authorization || '');
    if (!token) {
        return res.status(401).json({ error: 'Missing bearer token' });
    }
    try {
        const claims = verifyJwt(token, {
            secret: JWT_SECRET,
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        });
        if (!claims.sub) {
            return res.status(401).json({ error: 'Invalid token subject' });
        }
        req.auth = {
            deviceId: claims.sub,
            claims
        };
        next();
    } catch (error) {
        return res.status(401).json({ error: error.message || 'Invalid bearer token' });
    }
};

app.post('/auth', async (req, res) => {
    try {
        console.log(`[Gateway] Auth Request from ${req.body.deviceId}`);
        const response = await axios.post(`${AUTH_SERVICE_URL}/verify`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error(`[Gateway] Auth Error: ${error.message}`);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Internal Server Error' });
    }
});

app.post('/telemetry', requireDeviceToken, async (req, res) => {
    try {
        const tokenDeviceId = req.auth.deviceId;
        if (req.body.deviceId && req.body.deviceId !== tokenDeviceId) {
            return res.status(403).json({ error: 'Token subject does not match deviceId' });
        }

        const statusResponse = await axios.get(
            `${AUTH_SERVICE_URL}/devices/${encodeURIComponent(tokenDeviceId)}/status`
        );
        if (statusResponse.data.status !== 'ACTIVE') {
            return res.status(403).json({ error: `Device is ${statusResponse.data.status}` });
        }

        const response = await axios.post(`${BEHAVIOR_SERVICE_URL}/telemetry`, {
            ...req.body,
            deviceId: tokenDeviceId
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error(`[Gateway] Telemetry Error: ${error.message}`);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Internal Server Error' });
    }
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Gateway running on port ${PORT}`);
});
