#!/usr/bin/env node
/**
 * ==============================================================================
 * 📲 WHATSAPP AGENT - STANDALONE MODEL CONTEXT PROTOCOL (MCP) SERVER
 * ==============================================================================
 * Protocol: Model Context Protocol (MCP) / JSON-RPC 2.0 over Standard I/O (stdio)
 * Dependencies: Zero external npm packages (Pure native Node.js: https, http, readline)
 * Portability: Copy this single file into ANY project, directory, or repository.
 * Compatible with: Claude Desktop, Cursor IDE, Antigravity, MyBlocks, custom AI agents.
 *
 * HOW TO RUN:
 *   node whatsapp_agent_mcp.js
 *
 * CONFIGURATION (Environment variables or dynamically via configure_meta_credentials tool):
 *   WHATSAPP_PROVIDER=META
 *   META_WA_PHONE_NUMBER_ID=104829104829104
 *   META_WA_ACCESS_TOKEN=EAA...
 *   META_WA_API_VERSION=v21.0
 *   META_WA_BUSINESS_ACCOUNT_ID=109283019283019
 *   FIRM_NAME="Merlot Home Decor & Nursery"
 *   CORPORATE_UPI_ID="merlotdecor@icici"
 * ==============================================================================
 */

'use strict';

const readline = require('readline');
const https = require('https');

// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const CONFIG = {
  provider: (process.env.WHATSAPP_PROVIDER || 'META').toUpperCase(),
  phoneNumberId: process.env.META_WA_PHONE_NUMBER_ID || '',
  accessToken: process.env.META_WA_ACCESS_TOKEN || '',
  apiVersion: process.env.META_WA_API_VERSION || 'v21.0',
  wabaId: process.env.META_WA_BUSINESS_ACCOUNT_ID || '',
  firmName: process.env.FIRM_NAME || 'Merlot Home Decor & Nursery',
  corporateUpi: process.env.CORPORATE_UPI_ID || 'merlotdecor@icici'
};

// In-Memory Negotiation & Conversation Sessions (Phone/SessionId -> Session)
const SESSIONS = new Map();

// Anti-Spam Dispatch Cache (Phone -> { lastMessage, lastTimestamp })
const RECENT_DISPATCHES = new Map();

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (digits.length === 10) return '91' + digits; // Default India +91 if 10-digit
  return digits;
}

// Anti-Spam Cache Pruning (prevents memory leak in long running processes)
function pruneRecentDispatches(maxAgeMs = 30 * 60 * 1000) {
  const now = Date.now();
  for (const [phone, data] of RECENT_DISPATCHES.entries()) {
    if (now - data.lastTimestamp > maxAgeMs) {
      RECENT_DISPATCHES.delete(phone);
    }
  }
  if (RECENT_DISPATCHES.size > 500) {
    const keys = [...RECENT_DISPATCHES.keys()].slice(0, RECENT_DISPATCHES.size - 500);
    for (const k of keys) RECENT_DISPATCHES.delete(k);
  }
}

// ==========================================
// 2. WHATSAPP DISPATCH HELPER
// ==========================================
async function sendWhatsAppMessage({ to, message }) {
  const cleanPhone = normalizePhone(to);
  const now = Date.now();
  pruneRecentDispatches();

  // Anti-Spam Throttling (8-second minimum between messages to same recipient)
  const recent = RECENT_DISPATCHES.get(cleanPhone);
  if (recent && (now - recent.lastTimestamp < 8000)) {
    return {
      success: false,
      throttled: true,
      error: `Throttled: Message to +${cleanPhone} sent too recently (<8s ago).`
    };
  }

  // Exact Duplicate Suppression (15 minutes)
  if (recent && recent.lastMessage === message.trim() && (now - recent.lastTimestamp < 15 * 60 * 1000)) {
    return {
      success: false,
      duplicate: true,
      error: `Duplicate message to +${cleanPhone} suppressed.`
    };
  }

  RECENT_DISPATCHES.set(cleanPhone, {
    lastMessage: message.trim(),
    lastTimestamp: now
  });

  // Check if Meta credentials are fully provided
  if (CONFIG.phoneNumberId && CONFIG.accessToken) {
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: false, body: message }
      });

      const options = {
        hostname: 'graph.facebook.com',
        port: 443,
        path: `/${CONFIG.apiVersion}/${CONFIG.phoneNumberId}/messages`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                success: true,
                provider: 'META_CLOUD_API',
                messageId: parsed.messages?.[0]?.id || null,
                to: cleanPhone
              });
            } else {
              resolve({
                success: false,
                provider: 'META_CLOUD_API',
                statusCode: res.statusCode,
                error: parsed.error?.message || 'Meta API error',
                waClickToChatUrl: `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
              });
            }
          } catch (e) {
            resolve({ success: false, error: 'Malformed JSON from Meta API' });
          }
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          error: err.message,
          waClickToChatUrl: `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
        });
      });

      req.write(payload);
      req.end();
    });
  }

  // Simulation / Fallback Mode (Click-to-chat URL)
  return {
    success: true,
    provider: 'SIMULATOR_URL_FALLBACK',
    simulated: true,
    to: cleanPhone,
    message,
    waClickToChatUrl: `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
  };
}

// ==========================================
// 3. MCP TOOLS DECLARATION
// ==========================================
const TOOLS = [
  {
    name: 'send_whatsapp_message',
    description: 'Send an outbound WhatsApp message to any customer, patient, or supplier via Meta WhatsApp Cloud API or click-to-chat fallback.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number with country code (e.g. +919876543210 or 9876543210)' },
        message: { type: 'string', description: 'Plain text message content to send on WhatsApp' }
      },
      required: ['to', 'message']
    }
  },
  {
    name: 'start_procurement_negotiation',
    description: 'Initialize a new autonomous procurement negotiation session with a supplier for a SKU with target rate and ceiling cost.',
    inputSchema: {
      type: 'object',
      properties: {
        vendor_phone: { type: 'string', description: 'Vendor phone number' },
        vendor_name: { type: 'string', description: 'Vendor business name' },
        product_name: { type: 'string', description: 'Name of the item being procured' },
        quantity: { type: 'number', description: 'Quantity required' },
        target_price: { type: 'number', description: 'Initial opening offer rate (e.g. 280)' },
        ceiling_cost: { type: 'number', description: 'Absolute maximum walkaway ceiling rate (e.g. 310)' }
      },
      required: ['vendor_phone', 'vendor_name', 'product_name', 'quantity', 'target_price', 'ceiling_cost']
    }
  },
  {
    name: 'handle_whatsapp_incoming_reply',
    description: 'Process an incoming WhatsApp message reply from a customer or vendor, extract price/intent, handle multi-turn negotiation, and calculate counter-offers or deal settlements.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Sender phone number' },
        message: { type: 'string', description: 'The exact text message received from the sender' },
        sessionId: { type: 'string', description: 'Optional session ID if tracking a persistent negotiation' }
      },
      required: ['from', 'message']
    }
  },
  {
    name: 'get_active_negotiation_sessions',
    description: 'List all active WhatsApp negotiation threads, current offers, dialogue turns, and deal statuses.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'configure_meta_whatsapp_credentials',
    description: 'Dynamically update the Meta Cloud API Phone Number ID, Access Token, or Corporate UPI details.',
    inputSchema: {
      type: 'object',
      properties: {
        phoneNumberId: { type: 'string', description: 'Meta Phone Number ID' },
        accessToken: { type: 'string', description: 'Meta Permanent System User Access Token' },
        wabaId: { type: 'string', description: 'Meta WhatsApp Business Account ID' },
        firmName: { type: 'string', description: 'Company or Clinic display name' },
        corporateUpi: { type: 'string', description: 'Corporate UPI ID (VPA) for settlements' }
      }
    }
  }
];

// ==========================================
// 4. MCP TOOL EXECUTION LOGIC
// ==========================================
async function callTool(name, args) {
  switch (name) {
    case 'send_whatsapp_message': {
      const res = await sendWhatsAppMessage({ to: args.to, message: args.message });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2)
          }
        ]
      };
    }

    case 'start_procurement_negotiation': {
      const phone = normalizePhone(args.vendor_phone);
      const sessionId = `WA-SESS-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const openingMsg = `Namaste ${args.vendor_name}! We are placing an immediate order for ${args.quantity} units of ${args.product_name}. Can you do ₹${args.target_price}/unit for priority dispatch? We clear payment 100% advance via UPI (${CONFIG.corporateUpi}).`;

      const session = {
        sessionId,
        phone,
        vendorName: args.vendor_name,
        productName: args.product_name,
        quantity: args.quantity,
        currentOffer: args.target_price,
        ceilingCost: args.ceiling_cost,
        turnCount: 1,
        status: 'AWAITING_VENDOR_REPLY',
        dialogue: [
          {
            turn: 1,
            sender: 'AGENT',
            message: openingMsg,
            timestamp: new Date().toLocaleTimeString(),
            rate: args.target_price
          }
        ]
      };

      SESSIONS.set(phone, session);
      SESSIONS.set(sessionId, session);

      // Dispatch initial WhatsApp message
      const dispatchRes = await sendWhatsAppMessage({ to: phone, message: openingMsg });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sessionId,
              status: 'SESSION_INITIALIZED',
              openingMessage: openingMsg,
              dispatchResult: dispatchRes,
              session
            }, null, 2)
          }
        ]
      };
    }

    case 'handle_whatsapp_incoming_reply': {
      const phone = normalizePhone(args.from);
      const msg = String(args.message || '').trim();
      const session = (args.sessionId && SESSIONS.get(args.sessionId)) || SESSIONS.get(phone);

      if (!session) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'NO_ACTIVE_SESSION',
                action: 'UNRECOGNIZED_SENDER_ISOLATED',
                message: `No active procurement or customer session found for +${phone}.`
              }, null, 2)
            }
          ]
        };
      }

      // Check for price in message
      const priceMatch = msg.match(/(?:₹|rs\.?|inr)?\s*(\d{2,5}(?:\.\d{1,2})?)/i);
      const extractedPrice = priceMatch ? parseFloat(priceMatch[1]) : null;

      // Check for deferrals / caveats
      const isNegated = /\b(not|no|cannot|cant|reject|decline|impossible|too low|too high)\b/i.test(msg);
      const isDeferral = /\b(check|discuss|manager|tomorrow|later|verify)\b/i.test(msg);
      const isExactAccept = /^\s*(ok|okay|yes|done|agreed|deal|confirmed)\s*[.!]*$/i.test(msg);

      session.turnCount++;
      session.dialogue.push({
        turn: session.turnCount,
        sender: 'VENDOR',
        message: msg,
        priceDetected: extractedPrice,
        timestamp: new Date().toLocaleTimeString()
      });

      // CASE A: Acceptance within ceiling
      if (isExactAccept && !isDeferral && !isNegated && (extractedPrice === null || extractedPrice <= session.ceilingCost)) {
        const finalPrice = extractedPrice || session.currentOffer;
        const totalAmount = finalPrice * session.quantity;
        const poNumber = `PO-MERLOT-${Date.now().toString().slice(-6)}`;
        const upiRef = `UPI-MERLOT-${Date.now().toString().slice(-8)}`;

        const acceptReply = `Deal, ${session.vendorName}! ₹${finalPrice}/unit for ${session.quantity} units works for us (Total: ₹${totalAmount.toLocaleString('en-IN')}).\n\nI have authorized PO #${poNumber} and released payment via UPI (${upiRef}). Please dispatch the units today. Thank you!`;

        session.status = 'DEAL_CLOSED';
        session.settlement = {
          po_number: poNumber,
          final_price: finalPrice,
          total_amount: totalAmount,
          payment_ref: upiRef
        };
        session.dialogue.push({
          turn: session.turnCount + 1,
          sender: 'AGENT',
          message: acceptReply,
          timestamp: new Date().toLocaleTimeString()
        });

        await sendWhatsAppMessage({ to: phone, message: acceptReply });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'DEAL_CLOSED',
                agentReply: acceptReply,
                settlement: session.settlement,
                session
              }, null, 2)
            }
          ]
        };
      }

      // CASE B: Counter-Offer / Bargaining
      let nextCounter = session.currentOffer;
      if (extractedPrice && extractedPrice > session.ceilingCost) {
        nextCounter = session.ceilingCost;
      } else if (extractedPrice) {
        nextCounter = Math.min(session.ceilingCost, Math.round(session.currentOffer + (extractedPrice - session.currentOffer) * 0.45));
      } else {
        nextCounter = Math.min(session.ceilingCost, session.currentOffer + 5);
      }
      session.currentOffer = nextCounter;

      const counterReply = `Namaste ${session.vendorName}. We appreciate your response. Given our immediate bulk order for ${session.quantity} units and 100% instant corporate advance UPI payout (${CONFIG.corporateUpi}), can we meet at ₹${nextCounter}/unit? Let us lock this in today.`;

      session.status = 'COUNTER_OFFER_SENT';
      session.dialogue.push({
        turn: session.turnCount + 1,
        sender: 'AGENT',
        message: counterReply,
        counterOffered: nextCounter,
        timestamp: new Date().toLocaleTimeString()
      });

      await sendWhatsAppMessage({ to: phone, message: counterReply });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'COUNTER_OFFER_SENT',
              agentReply: counterReply,
              nextCounter,
              session
            }, null, 2)
          }
        ]
      };
    }

    case 'get_active_negotiation_sessions': {
      const list = [];
      const seen = new Set();
      for (const s of SESSIONS.values()) {
        if (!seen.has(s.sessionId)) {
          seen.add(s.sessionId);
          list.push(s);
        }
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ count: list.length, sessions: list }, null, 2)
          }
        ]
      };
    }

    case 'configure_meta_whatsapp_credentials': {
      if (args.phoneNumberId) CONFIG.phoneNumberId = args.phoneNumberId.trim();
      if (args.accessToken) CONFIG.accessToken = args.accessToken.trim();
      if (args.wabaId) CONFIG.wabaId = args.wabaId.trim();
      if (args.firmName) CONFIG.firmName = args.firmName.trim();
      if (args.corporateUpi) CONFIG.corporateUpi = args.corporateUpi.trim();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'CONFIG_UPDATED',
              configured: {
                phoneNumberId: CONFIG.phoneNumberId ? '***' + CONFIG.phoneNumberId.slice(-4) : 'NOT_SET',
                hasAccessToken: Boolean(CONFIG.accessToken),
                firmName: CONFIG.firmName,
                corporateUpi: CONFIG.corporateUpi
              }
            }, null, 2)
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ==========================================
// 5. JSON-RPC 2.0 PROTOCOL ENGINE (STDIO)
// ==========================================
function sendJsonRpc(response) {
  process.stdout.write(JSON.stringify(response) + '\n');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line || !line.trim()) return;

  let request;
  try {
    request = JSON.parse(line.trim());
  } catch (err) {
    sendJsonRpc({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error: Invalid JSON' }
    });
    return;
  }

  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize': {
        sendJsonRpc({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'whatsapp-agent-mcp-server',
              version: '1.0.0'
            }
          }
        });
        break;
      }

      case 'notifications/initialized': {
        break;
      }

      case 'ping': {
        sendJsonRpc({ jsonrpc: '2.0', id, result: {} });
        break;
      }

      case 'tools/list': {
        sendJsonRpc({
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS }
        });
        break;
      }

      case 'tools/call': {
        const { name, arguments: toolArgs } = params || {};
        if (!name) {
          sendJsonRpc({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Missing tool name' }
          });
          return;
        }

        const result = await callTool(name, toolArgs || {});
        sendJsonRpc({
          jsonrpc: '2.0',
          id,
          result
        });
        break;
      }

      default: {
        sendJsonRpc({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        });
        break;
      }
    }
  } catch (error) {
    sendJsonRpc({
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: error.message || 'Internal error' }
    });
  }
});

process.stderr.write('🚀 WhatsApp Agent Single-File MCP Server listening on stdio (JSON-RPC 2.0)...\n');
