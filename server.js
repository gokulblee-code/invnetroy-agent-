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

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount the Merlot Inventory Replenishment & Vendor Sourcing Agent router
app.use('/api/inventory-agent', inventoryRouter);
app.use('/api/inventory', inventoryRouter);

// Serve the standalone HTML frontend SPA from frontend folder
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(__dirname));

app.get(['/', '/agent', '/agent.html'], (req, res) => {
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
