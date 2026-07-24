const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 4000;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

let isDegraded = false;

// Simulate health changes (only telemetry now, no random degradation)
setInterval(() => {
    // Send telemetry to AI Service
    const latency = isDegraded ? Math.floor(Math.random() * 500) + 500 : Math.floor(Math.random() * 100) + 50; // 500-1000ms if degraded, 50-150ms if normal
    const error_rate = isDegraded ? Math.random() * 0.4 + 0.1 : 0.01; // 10-50% error if degraded, 1% if normal

    axios.post(`${AI_SERVICE_URL}/update_telemetry?latency=${latency}&error_rate=${error_rate}`)
        .catch(err => console.log("Could not update telemetry on AI Service."));

}, 5000); // update every 5s

app.post('/webhook', (req, res) => {
    console.log(`[Merchant] Received webhook: ${JSON.stringify(req.body.payload)}`);
    
    if (isDegraded) {
        // 50% chance to fail completely if degraded
        if (Math.random() < 0.5) {
            console.error(`[Merchant] ❌ Internal Server Error! Failing webhook.`);
            return res.status(500).json({ error: "Internal Server Error - Database Timeout" });
        }
        
        // Otherwise simulate high latency
        const delay = Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds
        setTimeout(() => {
            console.log(`[Merchant] ⚠️ Webhook processed slowly after ${delay}ms`);
            res.status(200).json({ status: "success", delayed: true });
        }, delay);
    } else {
        // Normal fast response
        res.status(200).json({ status: "success" });
    }
});

app.get('/status', (req, res) => {
    res.json({ degraded: isDegraded });
});

// Admin endpoint to force degradation or chaos (for demo purposes)
app.post('/admin/set-chaos', (req, res) => {
    const { latency, error_rate } = req.body;
    
    if (error_rate > 0.05) {
        isDegraded = true;
    } else {
        isDegraded = false;
    }
    
    console.log(`[Chaos Engineering] Adjusted health. Degraded: ${isDegraded}, Requested Error Rate: ${error_rate}, Latency: ${latency}`);
    res.json({ degraded: isDegraded, applied: true });
});

app.listen(PORT, () => {
    console.log(`Merchant Simulator running on port ${PORT}`);
});
