'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const inventoryRouter = require('./backend/route');
const posBridge = inventoryRouter.posBridge;
const autoWatchdog = inventoryRouter.autoWatchdog;
const whatsappService = inventoryRouter.whatsappService;

const app = express();
const PORT = process.env.PORT || 5001;

// Standard Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Lightweight In-Memory Rate Limiter for API endpoints (prevents DoS & brute force)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 180; // max 180 reqs / min / IP
const clientRequestCounts = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of clientRequestCounts.entries()) {
    if (now - data.startTime > RATE_LIMIT_WINDOW_MS) {
      clientRequestCounts.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

app.use('/api', (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();
  let clientData = clientRequestCounts.get(clientIp);

  if (!clientData || now - clientData.startTime > RATE_LIMIT_WINDOW_MS) {
    clientData = { count: 1, startTime: now };
    clientRequestCounts.set(clientIp, clientData);
  } else {
    clientData.count++;
  }

  if (clientData.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please retry in a few moments.'
    });
  }
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount the Merlot Inventory Replenishment & Vendor Sourcing Agent router
app.use('/api/inventory-agent', inventoryRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/workflow', inventoryRouter);
app.use('/workflow', inventoryRouter);
app.use('/api', inventoryRouter);

// Serve the standalone HTML frontend SPA from frontend folder
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(__dirname));

app.get(['/', '/agent', '/agent.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'frontend', 'agent.html'));
});

const server = app.listen(PORT, async () => {
  const posStatus = await posBridge.getPosStatus();
  const waStatus = whatsappService.getStatus();
  console.log('================================================================');
  console.log('🌿 Merlot AutoProcure AI - Inventory & Sourcing Agent Active');
  console.log(`🌐 Agent UI Dashboard   : http://localhost:${PORT}/`);
  console.log(`🔌 POS Integration     : ${posStatus.mode} (${posStatus.dbExists ? posStatus.dbPath : posStatus.apiUrl})`);
  console.log(`📲 WhatsApp Gateway     : ${waStatus.activeProvider} (Autonomous: ${waStatus.isLiveAutonomous})`);
  console.log(`📡 Health Check Endpoint: http://localhost:${PORT}/api/inventory-agent/health`);
  console.log('================================================================');

  // Start Autonomous 24/7 Watchdog Daemon
  autoWatchdog.start();
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`ℹ️ Port ${PORT} in use, agent server already active or running.`);
  } else {
    console.error('❌ Server error:', err.message);
  }
});

module.exports = { app, server };
