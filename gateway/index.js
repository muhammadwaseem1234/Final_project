const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const BEHAVIOR_SERVICE_URL = process.env.BEHAVIOR_SERVICE_URL || 'http://localhost:8000';

app.use(cors());
app.use(express.json());

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

app.post('/telemetry', async (req, res) => {
    try {
        const response = await axios.post(`${BEHAVIOR_SERVICE_URL}/telemetry`, req.body);
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
