/**
 * 🌿 Autonomous WhatsApp Gateway - Powered by @whiskeysockets/baileys
 * Self-Hosted, Zero-Meta, 100% Autonomous WhatsApp Bridge
 * 
 * Features:
 * - Direct WebSocket Multi-Device WhatsApp connection (no Chromium/Puppeteer overhead)
 * - Persistent session storage in ./data/baileys_auth
 * - Real-time QR Code streaming for instant 1-click phone pairing
 * - Autonomous Inbound/Outbound Negotiation Worker with human-like typing simulation
 */

const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const pino = require('pino');
const Baileys = require('@whiskeysockets/baileys');

const makeWASocket = Baileys.default || Baileys.makeWASocket;
const { useMultiFileAuthState, DisconnectReason } = Baileys;

class BaileysWhatsAppGateway {
  constructor() {
    this.authDir = path.resolve(__dirname, '..', 'data', 'baileys_auth');
    this.status = 'DISCONNECTED'; // 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTED' | 'CONNECTING'
    this.qrRaw = null;
    this.qrDataUrl = null;
    this.connectedPhone = null;
    this.sock = null;
    this.logger = pino({ level: 'silent' });
    this.activeNegotiations = new Map(); // vendorPhone -> negotiationContext
    this.recentLogs = [];
    this.negotiationCallback = null;
  }

  log(msg, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, message: msg, data };
    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > 50) this.recentLogs.pop();
    console.log(`[Baileys-WA] ${timestamp} - ${msg}`);
  }

  setNegotiationHandler(handlerFn) {
    this.negotiationCallback = handlerFn;
  }

  async init() {
    try {
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      this.status = 'CONNECTING';
      this.log('Initializing Baileys Multi-Device WhatsApp Engine...');

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.sock = makeWASocket({
        auth: state,
        logger: this.logger,
        printQRInTerminal: false,
        browser: ['Merlot AutoProcure AI', 'Chrome', '120.0.0'],
        syncFullHistory: false
      });

      // Save credentials update
      this.sock.ev.on('creds.update', saveCreds);

      // Connection state lifecycle
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = 'SCAN_QR';
          this.qrRaw = qr;
          try {
            this.qrDataUrl = await qrcode.toDataURL(qr, { width: 300, margin: 2 });
            this.log('New pairing QR code generated. Ready for phone scan in dashboard.');
          } catch (err) {
            this.log('QR Code rendering error: ' + err.message);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          this.status = 'DISCONNECTED';
          this.connectedPhone = null;
          this.qrRaw = null;
          this.qrDataUrl = null;

          this.log(`Connection closed. StatusCode: ${statusCode}. Reconnecting: ${shouldReconnect}`);

          if (shouldReconnect) {
            setTimeout(() => this.init(), 3000);
          } else {
            this.log('Logged out from WhatsApp. Clear auth folder to re-pair.');
          }
        } else if (connection === 'open') {
          this.status = 'CONNECTED';
          this.qrRaw = null;
          this.qrDataUrl = null;
          
          const rawId = this.sock.user?.id || '';
          this.connectedPhone = rawId.split(':')[0] || rawId.split('@')[0];
          this.log(`✅ WhatsApp Connected successfully! Linked Phone: +${this.connectedPhone}`);
        }
      });

      // Inbound Messages Listener for Autonomous Negotiation
      this.sock.ev.on('messages.upsert', async (m) => {
        try {
          if (m.type !== 'notify') return;

          for (const msg of m.messages) {
            if (msg.key.fromMe) continue; // Skip self messages

            const senderJid = msg.key.remoteJid;
            if (!senderJid || senderJid.includes('@g.us')) continue; // Skip group chats for now

            const text = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || '';

            if (!text.trim()) continue;

            const cleanPhone = senderJid.replace('@s.whatsapp.net', '');
            this.log(`📩 Inbound WhatsApp message from +${cleanPhone}: "${text}"`);

            // If an autonomous negotiation is registered for this vendor or general inquiry
            if (this.negotiationCallback) {
              await this.negotiationCallback({
                senderPhone: cleanPhone,
                senderJid,
                text,
                gateway: this
              });
            }
          }
        } catch (err) {
          this.log('Error processing inbound message: ' + err.message);
        }
      });

      return { success: true, status: this.status };
    } catch (err) {
      this.status = 'ERROR';
      this.log('Baileys initialization failed: ' + err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send WhatsApp message with realistic typing delay & presence update
   */
  async sendMessage(phoneOrJid, messageText, options = {}) {
    if (this.status !== 'CONNECTED' || !this.sock) {
      return { success: false, error: 'WhatsApp is not connected. Please scan QR code in settings.' };
    }

    try {
      let jid = phoneOrJid;
      if (!jid.includes('@s.whatsapp.net')) {
        const digits = phoneOrJid.replace(/\D/g, '');
        // Default to Indian country code +91 if 10 digits
        const fullPhone = digits.length === 10 ? `91${digits}` : digits;
        jid = `${fullPhone}@s.whatsapp.net`;
      }

      // Simulate human typing presence
      const simulateDelayMs = options.delayMs || 2500;
      await this.sock.sendPresenceUpdate('composing', jid);
      await new Promise(r => setTimeout(r, simulateDelayMs));
      await this.sock.sendPresenceUpdate('paused', jid);

      // Dispatch message
      const res = await this.sock.sendMessage(jid, { text: messageText });
      this.log(`📤 Outbound WhatsApp message sent to ${jid}: "${messageText.substring(0, 50)}..."`);
      return { success: true, messageId: res.key.id, jid };
    } catch (err) {
      this.log(`Failed to send WhatsApp message: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Reset session and generate fresh QR
   */
  async logoutAndReset() {
    try {
      if (this.sock) {
        try { await this.sock.logout(); } catch (e) {}
      }
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      }
      this.status = 'DISCONNECTED';
      this.connectedPhone = null;
      this.qrRaw = null;
      this.qrDataUrl = null;
      this.log('Session reset. Starting clean pairing...');
      setTimeout(() => this.init(), 1000);
      return { success: true, message: 'Session reset successfully.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  getStatus() {
    return {
      status: this.status,
      connected: this.status === 'CONNECTED',
      connectedPhone: this.connectedPhone,
      hasQr: Boolean(this.qrDataUrl),
      qrDataUrl: this.qrDataUrl,
      recentLogs: this.recentLogs.slice(0, 10),
      engine: '@whiskeysockets/baileys (Self-Hosted WebSocket Gateway)',
      activeNegotiationsCount: this.activeNegotiations.size
    };
  }
}

// Export singleton instance
const baileysGateway = new BaileysWhatsAppGateway();
module.exports = baileysGateway;
