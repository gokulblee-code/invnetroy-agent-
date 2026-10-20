# 🤖 Autonomous Inventory & Sourcing AI Agent — Enterprise Deployment Guide
**Universal Autonomous Procurement & WhatsApp Replenishment Copilot**
*Document Version: 3.2.0 (Universal Multi-Firm Release) | Merlot Home Decor & Nursery referenced as Pilot Store (Client Node A)*

---

## 1. Executive Summary

The **Autonomous Inventory Agent** is an enterprise-grade autonomous procurement platform designed to eliminate manual stockouts, automate wholesale price negotiations, and streamline vendor disbursements for **any retail or wholesale firm**.

> **Note on Multi-Firm Architecture:** The agent is 100% white-label. Merlot Home Decor & Nursery is configured as **Client Node A (Alpha Pilot Store)** to demonstrate live POS synchronization and botanical supplier negotiations. The exact same agent deploys seamlessly for supermarkets, apparel boutiques, pharmacies, hardware wholesalers, or electronics stores by updating the store name, GSTIN, and vendor CSV.

Unlike basic notification bots, this agent operates in **Zero-Touch Autonomous Mode**:
1. **24/7 Background Stock Watchdog**: Continuously inspects POS inventory and sales velocity against Reorder Points (ROP) and Economic Order Quantity (EOQ).
2. **Autonomous WhatsApp Outreach**: Instantly reaches out to wholesale vendors via the official **Meta WhatsApp Cloud API** the moment stock breaches safety thresholds.
3. **Tactical Multi-Turn Bargaining**: Reads incoming vendor counter-offers and autonomously bargains using calibrated game-theory playbooks (*Never Split the Difference*, *Getting to Yes*, Ackerman 65/85/95 concession models).
4. **Automated PO & POS Sync**: Records settled Purchase Orders directly into the POS SQLite / ERP database.
5. **Instant Financial Settlement**: Initiates instant UPI payment vouchers with dynamic QR codes and UTR transaction references within pre-approved corporate spending limits.

---

## 2. Client Readiness Checklist: What the Client Needs to Provide

To deploy this agent into production for **Merlot** or any retail/wholesale enterprise with **zero ongoing software subscription fees**, only **5 standard credentials** are required:

| # | Domain | Required Details / Keys | Free vs Paid Option | Setup Time |
|---|---|---|---|---|
| **1** | **WhatsApp Business Channel** | • `META_WA_PHONE_NUMBER_ID`<br>• `META_WA_ACCESS_TOKEN`<br>• `META_WA_VERIFY_TOKEN` | **100% FREE** (Meta includes 1,000 free service conversations/month) | 10 mins |
| **2** | **AI Reasoning Brain** | • `GEMINI_API_KEY` *(or `OPENAI_API_KEY`)* | **100% FREE** via Google AI Studio (15 req/min, 1M tokens/min free tier) | 2 mins |
| **3** | **POS / ERP Connection** | • Database Path or Database Connection String (`POS_DB_PATH`) | **FREE** (Direct SQLite / MySQL / PostgreSQL) | 1 min |
| **4** | **Firm Profile & Financial Rules** | • Corporate UPI ID (e.g. `merlotdecor@icici`)<br>• Auto-Approval Limit (e.g. ₹50,000)<br>• Target Margin % (e.g. 50%) | **FREE** (Configured via Agent UI or JSON) | 2 mins |
| **5** | **Public HTTPS Webhook URL** | • Public HTTPS domain for Meta's incoming WhatsApp callbacks | **100% FREE** via Cloudflare Tunnel or Render | 5 mins |

---

## 3. Step-by-Step Setup Guide for Client Credentials

### Step A: Meta WhatsApp Business Cloud API (Official & Free Tier)
> **Cost:** Meta provides **1,000 free conversations per month** to every WhatsApp Business account. Perfect for vendor procurement without paying third-party SaaS fees.

1. Go to **[Meta for Developers](https://developers.facebook.com/)** and log in with your Facebook/Meta account.
2. Click **Create App** → Select **Other** → Select **Business** type.
3. In App Dashboard, scroll down to **WhatsApp** and click **Set up**.
4. You will be taken to **WhatsApp > API Setup**:
   - You will see a **Temporary Access Token** (for testing) and your **Phone Number ID**.
   - Copy the **Phone Number ID** → paste into `META_WA_PHONE_NUMBER_ID`.
5. **Get Permanent System User Token** (Production):
   - Go to **Meta Business Suite** → **Settings** → **System Users**.
   - Create a System User (Admin role).
   - Click **Generate New Token** → Select your App → Grant permissions: `whatsapp_business_messaging`, `whatsapp_business_management`.
   - Copy this token → paste into `META_WA_ACCESS_TOKEN`.
6. **Configure Webhook**:
   - In Meta App Dashboard, go to **WhatsApp > Configuration**.
   - Set **Callback URL**: `https://your-domain.com/api/inventory-agent/whatsapp-webhook`
   - Set **Verify Token**: `merlot_procure_agent_2026` (must match `.env`).
   - Click **Verify and Save**.
   - Under **Webhook fields**, click **Manage** and subscribe to `messages`.

---

### Step B: AI Reasoning Engine (Google Gemini 1.5 Flash Free Tier)
> **Cost:** Google AI Studio offers a completely free tier with high rate limits (15 requests per minute, 1 million tokens per minute), ideal for autonomous procurement RAG analysis.

1. Navigate to **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2. Sign in with the corporate Google account.
3. Click **Create API Key** → Select or create a Google Cloud project.
4. Copy the generated key string (`AIzaSy...`).
5. Paste into `.env` as `GEMINI_API_KEY=` or enter it into the Agent UI top bar under **🔑 Set LLM API Key**.

---

### Step C: POS / ERP System Integration
The agent includes native dual-mode database synchronization:
1. **Local Retail POS (SQLite)**:
   - Already configured for `retail-pos-app/backend/localdb.sqlite`.
   - Zero configuration needed if running on the same store terminal.
2. **Central ERP / Cloud POS (MySQL / PostgreSQL / Shopify / Tally)**:
   - Provide standard DB connection string in `.env`:
     `DATABASE_URL=mysql://root:password@127.0.0.1:3306/merlot_pos`
   - When a deal closes, the agent writes directly to `purchase_orders` and updates `inventory_items`.

---

### Step D: Corporate Firm Profile & Financial Rules
Configurable directly inside `inventory_agent.html` or `firmProfile.json`:
- **Corporate Name:** `Merlot Home Decor & Nursery`
- **Owner / Signatory:** `Alex Merlot`
- **Corporate UPI ID:** `merlotdecor@icici` (or merchant VPA)
- **Auto-Approval Threshold:** `₹50,000` (Transactions below this amount execute zero-touch; above require manager biometric/PIN sign-off)
- **Default Gross Margin Target:** `50%`
- **Safety Lead Time Buffer:** `24 Hours`

---

### Step E: Public HTTPS Webhook Domain (Cloudflare Tunnel - 100% Free)
Meta's WhatsApp server requires a valid HTTPS endpoint to deliver incoming vendor replies.
To expose your local store server to Meta securely without port forwarding or public IP costs:
1. Download Cloudflare Tunnel:
   ```powershell
   winget install Cloudflare.cloudflared
   ```
2. Start an instant secure HTTPS tunnel to port 5001:
   ```powershell
   cloudflared tunnel --url http://localhost:5001
   ```
3. Cloudflare gives you a free URL (e.g. `https://merlot-procure.trycloudflare.com`).
4. Set that URL in your Meta WhatsApp Webhook dashboard!

---

## 4. Production `.env` File Template

Clients can simply create a `.env` file in the `inventory` folder:

```bash
# 🌿 Merlot AutoProcure AI - Production Configuration
PORT=5001
NODE_ENV=production

# 1. Meta WhatsApp Business Cloud API
META_WA_PHONE_NUMBER_ID=100609346426845
META_WA_ACCESS_TOKEN=EAAG...YOUR_PERMANENT_TOKEN...
META_WA_VERIFY_TOKEN=merlot_procure_agent_2026
META_WA_API_VERSION=v20.0

# 2. Free Google Gemini API Key
GEMINI_API_KEY=AIzaSy...YOUR_KEY...

# 3. 24/7 Autonomous Background Restock Daemon
AUTO_RESTOCK_DAEMON=true
RESTOCK_SCAN_INTERVAL_MINUTES=10

# 4. POS Integration Path
POS_DB_PATH=C:/Users/asus/Downloads/retail-pos-app/backend/localdb.sqlite
```

---

## 5. End-to-End Autonomous Lifecycle Flowchart

```mermaid
flowchart TD
    A["POS Inventory Level Drops Below Reorder Point (ROP)"] --> B["24/7 Autonomous Watchdog Detects Breach"]
    B --> C["RAG Procurement Engine Selects Best Vendor & Strategy"]
    C --> D["Meta WhatsApp Cloud API Dispatches Opening Offer Directly to Vendor Phone"]
    D --> E["Vendor Receives WhatsApp on Their Mobile Device"]
    E --> F["Vendor Sends Counter-Offer: 'We can do Rs 260'"]
    F --> G["Meta Webhook Delivers Message to /api/inventory-agent/whatsapp-webhook"]
    G --> H["Gemini LLM + Ackerman Strategy Evaluates Margin & Counter-Offers"]
    H --> I{"Is Price <= Corporate Ceiling Price?"}
    I -- Yes --> J["Send Acceptance & PO Confirmation via WhatsApp"]
    I -- No --> K["Send Calibrated Counter-Offer via WhatsApp"]
    K --> E
    J --> L["Record PO in POS SQLite Database"]
    J --> M["Generate Dynamic UPI Payment Link & UTR Reference"]
    M --> N["Consignment Dispatched within 24 Hours"]
```

---

## 6. Security, Compliance & Governance

1. **Financial Guardrails**: The agent strictly enforces the client's `auto_approval_limit`. It can never commit funds beyond the pre-set ceiling without human escalation.
2. **Encrypted Webhook Signature**: All inbound Meta requests are verified using HMAC SHA-256 signatures (`x-hub-signature-256`).
3. **Auditable Decision Log**: Every quote, concession step, book citation, and WhatsApp timestamp is saved into `inventory_agent_logs` for compliance review.
4. **Offline Resiliency**: If external cloud LLM or internet fails, the agent instantly falls back to 100% deterministic local math matrix without crashing.

---
*Prepared by AgentGen Pro & Antigravity Engineering for Merlot Home Decor & Partner Firms.*
