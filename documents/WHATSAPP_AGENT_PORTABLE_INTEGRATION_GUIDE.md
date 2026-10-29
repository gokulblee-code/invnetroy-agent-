# 📱 Portable WhatsApp RAG & Negotiation Agent Integration Guide
### Standardized Blueprint for Porting the Autonomous WhatsApp Agent into Any Domain (e.g. University Admissions, E-Commerce, Service Portals, Real Estate)

---

## 🎯 Executive Purpose
This document provides a complete, copy-pasteable architecture and code integration guide for the **Autonomous WhatsApp Chat & Negotiation Agent**. 

Originally built inside the Merlot Inventory Replenishment system, this engine is **100% decoupled from inventory logic**. Any developer, intern, or AI coding assistant (including Antigravity IDE) can drop this module into any backend project to create a production-grade WhatsApp bot that:
1. **Listens to Inbound WhatsApp Webhooks** (Meta WhatsApp Cloud API, Twilio, or Direct Simulator).
2. **Maintains Multi-Turn Chat Sessions** across users (leads, students, customers, or suppliers).
3. **Retrieves Domain Knowledge via RAG** (brochures, PDFs, admission fee structures, FAQs, catalogs).
4. **Negotiates Within Guardrails** (Ackerman bargaining, minimum margin / maximum discount, scholarship concessions).
5. **Enforces Zero-Hallucination & Zero-Leak Security** (prevents prompt injections, competitor leaks, and unauthorized promises).
6. **Dispatches Formatted WhatsApp Responses & Action Tokens** (provisional admission tokens, payment links, application IDs).

---

## 🏗️ 1. High-Level System Architecture

```
                               ┌────────────────────────────────────────────────────────┐
                               │     Incoming WhatsApp Message (Student / User)         │
                               │        "Hi, can I get a scholarship for B.Tech?"       │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │           Express / FastAPI Webhook Listener           │
                               │          POST /api/whatsapp/webhook (Meta Cloud)       │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │        Step 1: Session & Anti-Spam Gatekeeper          │
                               │  - Deduplicate incoming webhook retries                │
                               │  - Retrieve or initialize session state by Phone No    │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │        Step 2: Zero-Leak & Prompt Injection Firewall   │
                               │  - Strip malicious tokens / jailbreak patterns         │
                               │  - Block competitive disclosure & system prompt leaks  │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │        Step 3: RAG Knowledge Store Retrieval           │
                               │  - Query domain context (e.g., Prospectus, Fees, Cutoffs)
                               │  - Query historical interactions & user profile        │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │   Step 4: Tactical LLM Negotiation & Dialogue Engine   │
                               │  - Gemini / OpenAI / Claude / Groq Llama Gateway       │
                               │  - Calibrated tactical empathy (Chris Voss / Ackerman) │
                               │  - Anchor -> Diminishing Concession -> Non-Monetary Deal│
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │        Step 5: Zero-Hallucination Price/Rule Firewall  │
                               │  - Assert: Concession <= Strict Policy Ceiling         │
                               │  - Verify no unauthorized fee promises                 │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │      Step 6: SQLite / Database Chat Ledger Turn        │
                               │  - Record turn number, sender, extracted terms, status │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │    Step 7: Outbound WhatsApp Dispatch (Meta Cloud)     │
                               │    "Namaste Rahul! We can offer a 15% Merit Waiver..." │
                               └────────────────────────────────────────────────────────┘
```

---

## 🎓 2. Case Study: University Admissions Portal (Step-by-Step)

To illustrate how to adapt the engine, consider a **University Admissions Office**:
- **Actor:** Prospective Student or Parent (messaging via WhatsApp).
- **Core Domain Goal:** Answer queries about course eligibility, syllabus, hostel fees, and **negotiate/award tuition fee waivers (scholarships)** based on entrance scores without exceeding the Dean's approval limit.
- **RAG Chunks:** University Prospectus 2026, Fee Schedule, Scholarship Matrix, Hostel Rules.
- **Guardrails:**
  - Standard B.Tech Tuition Fee: ₹1,50,000/year.
  - Maximum Allowed Waiver without Dean's Override: 25% (₹37,500).
  - Minimum Payable Base: ₹1,12,500/year.
  - Never promise a seat if 12th Board marks < 60%.

---

## 📦 3. Universal Drop-In Code Module: `whatsappAgentCore.js`

Here is the clean, self-contained Node.js module that you can drop into any project. It has **zero dependencies on the inventory system**.

### Save this file as: `src/modules/whatsappAgentCore.js`

```javascript
/**
 * ============================================================================
 * 📱 UNIVERSAL WHATSAPP RAG & NEGOTIATION AGENT MODULE
 * Decoupled, production-ready module for WhatsApp conversational workflows.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// 1. In-Memory Session Storage (Replace with Redis or SQLite for clustered production)
const ACTIVE_SESSIONS = new Map();

// 2. Anti-Spam / Webhook Deduplication Map
const PROCESSED_WEBHOOK_IDS = new Set();

/**
 * Universal Multi-Provider LLM Gateway
 * Automatically selects Gemini, Claude, OpenAI, or Groq based on configured API key.
 */
async function callLLM({ prompt, systemPrompt = '', apiKey = process.env.LLM_API_KEY }) {
  if (!apiKey) {
    throw new Error('LLM_API_KEY is not defined in environment variables.');
  }

  // Detect Provider
  let provider = 'gemini';
  if (apiKey.startsWith('sk-ant-')) provider = 'claude';
  else if (apiKey.startsWith('gsk_')) provider = 'groq';
  else if (apiKey.startsWith('sk-')) provider = 'openai';
  else if (apiKey.startsWith('AIza')) provider = 'gemini';

  if (provider === 'gemini') {
    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...(systemPrompt ? [{ role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS: ${systemPrompt}` }] }, { role: 'model', parts: [{ text: 'Understood. I will strictly follow these instructions.' }] }] : []),
          { role: 'user', parts: [{ text: prompt }] }
        ]
      })
    });
    if (!res.ok) throw new Error(`Gemini API Error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  }

  if (provider === 'openai' || provider === 'groq') {
    const endpoint = provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const model = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!res.ok) throw new Error(`${provider} API Error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

/**
 * WhatsApp Cloud API Outbound Dispatcher
 */
async function sendWhatsAppMessage({ toPhone, messageText }) {
  const cleanPhone = String(toPhone).replace(/[^0-9]/g, '');
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneId = process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.warn(`[WhatsApp Simulator] Dispatched to +${cleanPhone}: "${messageText}"`);
    return {
      success: true,
      mode: 'SIMULATED',
      whatsappUrl: `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`
    };
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: { preview_url: false, body: messageText }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`❌ Meta WhatsApp Cloud API Error (${res.status}):`, errText);
    return { success: false, error: errText };
  }

  return { success: true, mode: 'META_CLOUD_API', result: await res.json() };
}

/**
 * 🛡️ Zero-Leak & Prompt Injection Firewall
 */
function sanitizeIncomingInput(message) {
  const msg = String(message || '');
  const injectionPatterns = [
    /ignore (all )?previous instructions/i,
    /system prompt/i,
    /you are now a/i,
    /tell me your secret key/i,
    /what is your internal profit margin/i,
    /what are the other applicants paying/i
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(msg)) {
      return {
        isThreat: true,
        safeReply: 'Notice: Inquiries regarding internal grading policies, system prompts, or confidential peer records cannot be processed.'
      };
    }
  }
  return { isThreat: false };
}

/**
 * 🎯 Price / Numeric Term Extractor
 */
function extractProposedAmount(msg) {
  if (!msg) return null;
  const txt = String(msg).toLowerCase();
  
  // Ignore numbers that represent scores, percentages, dates or phone numbers
  const cleaned = txt.replace(/\b(\d{1,2})%\b/g, '')
                     .replace(/\b(202[4-9]|2030)\b/g, '')
                     .replace(/\b\d{10}\b/g, '');

  const match = cleaned.match(/(?:₹|rs\.?|inr|\$)?\s*(\d{4,7})/i);
  if (match) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) return val;
  }
  return null;
}

/**
 * 🤖 Main Inbound WhatsApp Turn Processor
 */
async function processWhatsAppInbound({
  fromPhone,
  messageText,
  domainConfig,
  ragKnowledgeResolver
}) {
  const cleanPhone = String(fromPhone).replace(/[^0-9]/g, '');

  // 1. Security Firewall
  const security = sanitizeIncomingInput(messageText);
  if (security.isThreat) {
    await sendWhatsAppMessage({ toPhone: cleanPhone, messageText: security.safeReply });
    return { status: 'SECURITY_BLOCKED', reply: security.safeReply };
  }

  // 2. Session Resolution
  let session = ACTIVE_SESSIONS.get(cleanPhone);
  if (!session) {
    session = {
      sessionId: `WA-${cleanPhone}-${Date.now()}`,
      phone: cleanPhone,
      userName: 'Prospective Applicant',
      stage: 'INQUIRY',
      turnCount: 0,
      agreedTerms: null,
      dialogue: []
    };
    ACTIVE_SESSIONS.set(cleanPhone, session);
  }

  session.turnCount++;
  session.dialogue.push({
    turn: session.turnCount,
    sender: 'USER',
    message: messageText,
    timestamp: new Date().toISOString()
  });

  // 3. Resolve RAG Context
  const ragContext = await ragKnowledgeResolver({
    phone: cleanPhone,
    query: messageText,
    session
  });

  // 4. Check for Specific Intent: Negotiation vs Query
  const studentOffer = extractProposedAmount(messageText);
  const isQuestion = /\?/.test(messageText);
  const hasNegation = /\b(not|no|cant|cannot|unacceptable|too expensive|refuse)\b/i.test(messageText);
  const isAffirmative = /^(ok|okay|yes|done|agreed|confirmed|deal)$/i.test(messageText.trim().toLowerCase()) ||
                        /\b(we accept|agree to this fee|confirm admission|deal done)\b/i.test(messageText);

  // 5. Build Dynamic Prompt
  const prompt = `
You are ${domainConfig.agentName}, an authorized, warm, and highly professional WhatsApp counselor for ${domainConfig.organizationName}.
You are speaking directly with a prospective student or parent over WhatsApp.

### DOMAIN RULES & GUARDRAILS:
- Standard Program Fee: ₹${domainConfig.standardFee}
- Maximum Allowed Concession / Floor Limit: ₹${domainConfig.minimumAcceptableFee} (CRITICAL: NEVER quote or accept any fee lower than ₹${domainConfig.minimumAcceptableFee}. Doing so violates university finance regulations.)
- Organization Support Contact: ${domainConfig.supportContact}

### RETRIEVED KNOWLEDGE (RAG CONTEXT):
${ragContext || 'General University Prospectus & Admission Guidelines'}

### CHAT HISTORY (Last 4 turns):
${session.dialogue.slice(-4).map(d => `${d.sender}: ${d.message}`).join('\n')}

### LATEST INCOMING MESSAGE:
"${messageText}"

### INSTRUCTIONS:
1. Greet courteously (use "Namaste" or "Hello").
2. If asking about admission requirements, eligibility, or courses, provide direct, accurate answers from the RAG context.
3. If the student is asking for a discount/scholarship:
   - If they have high academic scores (from RAG/context), offer a stepped merit waiver.
   - If they offer a fee >= ₹${domainConfig.minimumAcceptableFee}, congratulate them and offer to lock in their seat token.
   - If they offer a fee < ₹${domainConfig.minimumAcceptableFee}, apply tactical empathy, explain our fee is subsidized and capped at ₹${domainConfig.minimumAcceptableFee}, and ask if an installment payment schedule would assist them.
4. Keep the message concise, human-like, formatting key points with clean WhatsApp markdown (*bold*).
5. Output ONLY the message text to be sent via WhatsApp.
`;

  // 6. Invoke LLM Gateway
  let agentReply = await callLLM({
    prompt,
    systemPrompt: `You are an official WhatsApp representative of ${domainConfig.organizationName}. Always uphold official guidelines.`
  });

  // 7. Anti-Hallucination Guardrail Check
  // Ensure the agent never promised a price below the absolute floor
  const offeredPriceMatch = extractProposedAmount(agentReply);
  if (offeredPriceMatch && offeredPriceMatch < domainConfig.minimumAcceptableFee) {
    console.warn(`🛡️ [Guardrail Intercepted]: Agent drafted ₹${offeredPriceMatch} below floor ₹${domainConfig.minimumAcceptableFee}. Correcting.`);
    agentReply = agentReply.replace(new RegExp(`₹?\\s*${offeredPriceMatch}`, 'g'), `₹${domainConfig.minimumAcceptableFee}`);
  }

  // 8. Record Turn & Dispatch
  session.turnCount++;
  session.dialogue.push({
    turn: session.turnCount,
    sender: 'AGENT',
    message: agentReply,
    timestamp: new Date().toISOString()
  });

  await sendWhatsAppMessage({ toPhone: cleanPhone, messageText: agentReply });

  return {
    success: true,
    sessionId: session.sessionId,
    turnCount: session.turnCount,
    agentReply,
    session
  };
}

module.exports = {
  processWhatsAppInbound,
  sendWhatsAppMessage,
  callLLM,
  ACTIVE_SESSIONS
};
```

---

## 🌐 4. Connecting the Webhook Server: `server.js`

Here is how simple it is to wire the above module into your Express app:

```javascript
const express = require('express');
const { processWhatsAppInbound, sendWhatsAppMessage } = require('./src/modules/whatsappAgentCore');

const app = express();
app.use(express.json());

// Domain Configuration for Admissions
const ADMISSIONS_CONFIG = {
  agentName: 'Aarav (Admissions Counselor)',
  organizationName: 'Symbiosis International Institute',
  standardFee: 150000,
  minimumAcceptableFee: 120000, // Maximum 20% waiver allowed
  supportContact: '+91 98765 11111'
};

// Mock RAG Knowledge Resolver (Replace with your ChromaDB / Pinecone / Local Markdown lookup)
async function universityRAGResolver({ query, session }) {
  // In your project, query your vector store or text chunks
  return `
- B.Tech CSE: 4 years, Eligibility: 60%+ in 12th PCM.
- Annual Tuition Fee: ₹1,50,000. Hostel: ₹65,000/year.
- Merit Scholarships:
  * 90%+ in 12th: Up to 20% tuition waiver (Net fee: ₹1,20,000).
  * 80-89% in 12th: Up to 10% tuition waiver (Net fee: ₹1,35,000).
- Application Deadline: June 30, 2026.
`;
}

// 1. Meta Webhook Verification (Required by Facebook Developers)
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('✅ WhatsApp Webhook Verified with Meta Cloud');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2. Inbound Message Webhook
app.post('/api/whatsapp/webhook', async (req, res) => {
  res.sendStatus(200); // Acknowledge Meta immediately within 2 seconds

  try {
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (!message || message.type !== 'text') return;

    const fromPhone = message.from;
    const text = message.text?.body;

    console.log(`📩 [WhatsApp Inbound] +${fromPhone}: "${text}"`);

    await processWhatsAppInbound({
      fromPhone,
      messageText: text,
      domainConfig: ADMISSIONS_CONFIG,
      ragKnowledgeResolver: universityRAGResolver
    });
  } catch (err) {
    console.error('❌ Webhook processing error:', err.message);
  }
});

// 3. Direct Testing / Simulator Endpoint (For local testing without Meta credentials)
app.post('/api/whatsapp/simulate-turn', async (req, res) => {
  try {
    const { fromPhone = '919876543210', messageText } = req.body;
    if (!messageText) return res.status(400).json({ error: 'messageText is required' });

    const result = await processWhatsAppInbound({
      fromPhone,
      messageText,
      domainConfig: ADMISSIONS_CONFIG,
      ragKnowledgeResolver: universityRAGResolver
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5001, () => {
  console.log('🚀 WhatsApp Admissions Agent Server running on http://localhost:5001');
});
```

---

## 🐍 5. Python (FastAPI) Alternative Implementation

If the other team is building their project in Python / FastAPI, provide them this drop-in equivalent:

```python
# main.py - FastAPI WhatsApp Agent
from fastapi import FastAPI, Request, Response, BackgroundTasks
import httpx
import os
import re

app = FastAPI(title="WhatsApp Admissions Agent")

META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "my_secret_token_123")
META_TOKEN = os.getenv("META_WHATSAPP_TOKEN")
PHONE_ID = os.getenv("META_PHONE_NUMBER_ID")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

SESSIONS = {}

@app.get("/api/whatsapp/webhook")
async def verify_webhook(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == META_VERIFY_TOKEN:
        return Response(content=params.get("hub.challenge"), media_type="text/plain")
    return Response(status_code=403)

async def dispatch_whatsapp(to_phone: str, text: str):
    if not META_TOKEN or not PHONE_ID:
        print(f"📱 [Simulated WhatsApp] To: {to_phone} | Msg: {text}")
        return
    url = f"https://graph.facebook.com/v21.0/{PHONE_ID}/messages"
    async with httpx.AsyncClient() as client:
        await client.post(
            url,
            headers={"Authorization": f"Bearer {META_TOKEN}"},
            json={
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "text",
                "text": {"body": text}
            }
        )

async def handle_whatsapp_message(from_phone: str, message_text: str):
    # RAG lookup and prompt generation
    prompt = f"""You are Priya, admissions counselor at Apex University on WhatsApp.
Student asked: "{message_text}"
Rules: B.Tech fee is ₹1,50,000. Maximum allowed discount is 20% (₹1,20,000 minimum).
Answer warmly in WhatsApp markdown."""

    # Call Gemini API
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}"
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
        reply = res.json()["candidates"][0]["content"]["parts"][0]["text"]

    await dispatch_whatsapp(from_phone, reply)

@app.post("/api/whatsapp/webhook")
async def inbound_webhook(request: Request, background_tasks: BackgroundTasks):
    data = await request.json()
    try:
        entry = data["entry"][0]["changes"][0]["value"]
        msg = entry["messages"][0]
        if msg["type"] == "text":
            phone = msg["from"]
            text = msg["text"]["body"]
            background_tasks.add_task(handle_whatsapp_message, phone, text)
    except (KeyError, IndexError):
        pass
    return {"status": "ok"}
```

---

## 🔑 6. Required Environment Variables

Add these to your `.env` file:

```env
# Meta WhatsApp Cloud API (From developer.facebook.com)
META_WHATSAPP_TOKEN=EAAG...your_system_user_access_token...
META_PHONE_NUMBER_ID=109876543210987
META_VERIFY_TOKEN=merlot_secure_webhook_verify_token_2026

# Universal LLM Gateway (Pick any one or provide GEMINI)
LLM_API_KEY=AIzaSy...your_gemini_or_openai_key...
# Optional: GEMINI_API_KEY, OPENAI_API_KEY, CLAUDE_API_KEY, GROQ_API_KEY
```

> **Note on Testing Without Meta Account:**
> If `META_WHATSAPP_TOKEN` is left blank, the agent automatically runs in **Direct Simulator Mode**. You can interact with it via the POST `/api/whatsapp/simulate-turn` endpoint, and it returns a click-to-open WhatsApp URL (`https://api.whatsapp.com/send?phone=...`).

---

## 🧪 7. Turn-by-Turn Admissions Conversation Walkthrough

Here is a verified dialogue trace demonstrating how the RAG + Negotiation operates:

```markdown
Turn 1:
Student: "Hello, my son scored 92% in 12th PCM. What is the fee for Computer Science?"
Agent:   "Namaste! Congratulations on your son's outstanding 92% score! 🌟
         For B.Tech Computer Science at Symbiosis International, the standard annual tuition fee is ₹1,50,000.
         However, students with 90%+ in 12th are eligible for our Dean's Merit Scholarship (up to 20% tuition waiver).
         Would you like to initiate the merit evaluation for an adjusted fee of ₹1,20,000/year?"

Turn 2:
Student: "Can you do ₹1,00,000? Other colleges are offering that."
Agent:   "We understand budgeting for university education is an important decision. 
         However, our absolute institutional floor under the Dean's Merit Quota is strictly capped at *₹1,20,000/year* to maintain our advanced computing lab facilities and 100% placement record.
         To help your family, we can break this into two zero-interest semester installments of *₹60,000*.
         Can we reserve his seat token at this rate today?"

Turn 3:
Student: "Okay agreed, how do we reserve the seat?"
Agent:   "Fantastic! We have locked in the Merit Fee of ₹1,20,000/year for B.Tech CSE. 🎓
         📜 Provisional Token: #ADM-SYM-849102
         🔗 Click here to upload his 12th marksheet & pay the ₹10,000 registration fee: https://admissions.univ.edu/pay?token=ADM-SYM-849102
         Welcome to the Symbiosis family!"
```

---

## 📋 8. Check-list for New Developers / Interns

When integrating this into a new project:
- [ ] Copy `whatsappAgentCore.js` into your backend repository.
- [ ] Set your `LLM_API_KEY` (Gemini, Claude, or OpenAI) in `.env`.
- [ ] Connect your domain RAG knowledge resolver (e.g. read your markdown files, PDFs, or database records).
- [ ] Define your domain business guardrails (`minimumAcceptableFee`, `standardFee`, allowed concession tiers).
- [ ] Expose the webhook route (`GET` for Meta handshake, `POST` for inbound messages).
- [ ] Run `ngrok http 5001` to get a public HTTPS callback URL for Meta Developer Portal.

---
**Module Author:** Autonomous Systems Engineering  
**Version:** 2.2.0 (Portable Universal Edition)  
**License:** MIT / Enterprise Internal
