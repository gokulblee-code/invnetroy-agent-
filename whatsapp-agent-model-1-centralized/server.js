/**
 * Centralized WhatsApp Gateway (Model 1) Server
 * Port 5011
 */
require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5011;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount the Tactical Sourcing & Procurement Router
const agentRouter = require('./route');
app.use('/api/inventory-agent', agentRouter);
app.use('/api/inventory', agentRouter);

// Serve the Model 1 Frontend
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/inventory-agent-ui', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🏢 [MODEL 1: CENTRALIZED GATEWAY] Running on http://localhost:${PORT}`);
  console.log(`📲 Meta Sender: Company Central Verified Number (+1 555-154-1185)`);
  console.log(`🌐 Dashboard UI: http://localhost:${PORT}/inventory-agent-ui`);
  console.log(`================================================================`);
});
