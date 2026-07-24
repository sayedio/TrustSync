const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const MERCHANT_URL = process.env.MERCHANT_URL || 'http://localhost:4000/webhook';

console.log("Gateway Simulator Started in MANUAL mode.");
console.log("Automatic webhook firing is DISABLED. Please use the frontend UI to send webhooks manually.");

// Keep the process alive
setInterval(() => {
    // Idle loop to keep the docker container running
}, 1000 * 60 * 60);
