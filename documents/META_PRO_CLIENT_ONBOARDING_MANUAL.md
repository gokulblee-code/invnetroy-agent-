# Meta Cloud API & WhatsApp Business Platform Setup Manual
**Enterprise Autonomous Sourcing Agent Client Registration Guide**  
*Document Version: 2.4 | Target: Production & Sandbox Client Onboarding*

---

## 1. Overview
This manual provides the step-by-step procedure to onboard and register the Autonomous Procurement Agent on the **Meta for Developers (WhatsApp Cloud API)** platform. Once registered, the AI Agent interacts directly with wholesale suppliers via WhatsApp to negotiate prices, enforce walkaway ceilings, and settle purchase orders.

---

## 2. Prerequisites
1. **Meta for Developers Account**: An active account at [developers.facebook.com](https://developers.facebook.com/).
2. **Meta Business Account (MBA)**: Verified business manager account for production use.
3. **Dedicated WhatsApp Phone Number**:
   - A clean phone number **not** currently registered on personal WhatsApp or WhatsApp Business mobile app.
   - For initial testing, Meta provides a **free Test Phone Number** with 5 test recipient numbers.

---

## 3. Step-by-Step Registration Workflow

```
[Meta for Developers] ──> [Create App: "Other" -> "Business"]
                                      │
                                      ▼
                           [Add Product: WhatsApp]
                                      │
                                      ▼
                       [API Setup: Obtain Credentials]
                                      │
                                      ├── Phone Number ID
                                      ├── WhatsApp Business Account ID (WABA ID)
                                      └── System User Permanent Token
                                      │
                                      ▼
                     [Configure Webhook: /api/inventory-agent/webhook]
                                      │
                                      ▼
                       [Test Real-Time Bi-Directional Chat]
```

### Step 3.1: Create Meta Developer App
1. Navigate to [https://developers.facebook.com/apps](https://developers.facebook.com/apps).
2. Click **Create App**.
3. Select App Type: **Other** $\rightarrow$ Next $\rightarrow$ Select **Business** $\rightarrow$ Next.
4. Enter **App Display Name** (e.g. `Merlot AutoProcure Agent`).
5. Select your **Meta Business Account** and click **Create App**.

---

### Step 3.2: Add and Configure WhatsApp Product
1. On the App Dashboard, scroll down to **WhatsApp** and click **Set up**.
2. From the left sidebar, navigate to **WhatsApp** $\rightarrow$ **API Setup**.
3. Locate the following three values:
   - **Temporary Access Token** (or create a Permanent System User Token in Step 3.3).
   - **Phone number ID**: (e.g. `104829104829104`).
   - **WhatsApp Business Account ID**: (e.g. `109283019283019`).

---

### Step 3.3: Generate a Permanent System User Token (Required for 24/7 Production)
*Temporary tokens expire in 24 hours. Follow these steps to generate a permanent token:*
1. Go to **Business Settings** at [business.facebook.com/settings](https://business.facebook.com/settings).
2. Under **Users**, select **System Users** $\rightarrow$ click **Add**.
3. Role: **Admin** $\rightarrow$ Click **Create System User**.
4. Click **Add Assets** $\rightarrow$ Select **Apps** $\rightarrow$ Choose your Agent App $\rightarrow$ Grant **Full Control**.
5. Click **Generate New Token**:
   - Select your App.
   - Check the following permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
6. Click **Generate Token** and copy the resulting string (starts with `EAA...`). Store it securely.

---

### Step 3.4: Configure Webhook (Inbound Supplier Replies)
To receive incoming WhatsApp messages from suppliers in real time:
1. In Meta App Dashboard, navigate to **WhatsApp** $\rightarrow$ **Configuration**.
2. Under **Webhook**, click **Edit**.
3. **Callback URL**: 
   - `https://<YOUR_DOMAIN_OR_NGROK_URL>/api/inventory-agent/webhook`
4. **Verify Token**: 
   - `merlot_secure_webhook_token_2026` (or the token specified in `.env` as `META_WA_VERIFY_TOKEN`).
5. Click **Verify and Save**.
6. Under **Webhook Fields**, click **Manage** $\rightarrow$ find **`messages`** $\rightarrow$ click **Subscribe**.

---

### Step 3.5: Configure the Agent Environment File (`.env`)
In the root directory of the application, update the `.env` file with your credentials:

```ini
# Meta WhatsApp Cloud API Credentials
WHATSAPP_PROVIDER=META
META_WA_PHONE_NUMBER_ID=<YOUR_PHONE_NUMBER_ID>
META_WA_BUSINESS_ACCOUNT_ID=<YOUR_WABA_ID>
META_WA_ACCESS_TOKEN=EAA...<YOUR_PERMANENT_OR_ACTIVE_TOKEN>
META_WA_VERIFY_TOKEN=merlot_secure_webhook_token_2026
META_WA_API_VERSION=v21.0

# LLM Cognitive Reasoning Key
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEY=AQ...<YOUR_GEMINI_API_KEY>
```

---

## 4. Resetting and Initializing a Clean Client Profile
Before handing the system over to a new client:
1. Open the Dashboard at `http://localhost:5001/`.
2. In the top navigation bar, click the **Store Profile** badge (e.g. `Merlot Home Decor & Nursery ▾`).
3. Click **Reset Profile to Clean Slate** to flush all previous company names, GSTINs, and UPI IDs.
4. Fill in the client's business details:
   - **Firm Name**: Client's legal store name.
   - **Corporate UPI ID / VPA**: Client's business settlement UPI (e.g. `clientstore@icici`).
   - **Walkaway Ceiling & Margin Limits**: Business policy thresholds.
5. Click **Save Store & UPI Registration**.
6. Click **Reset History** in the dashboard header to ensure 0 previous orders or chat transcripts exist.

---

## 5. POS Direct Integration Notice
> **Status**: The POS direct bridge is fully configured and ready to link directly to your SQLite database (`localdb.sqlite` / `merlot_pos_orders.sqlite`).  
> **Safety Guarantee**: Direct POS writes and catalog locks are currently paused in safe standby mode. The system will only attach to the live POS catalog upon your explicit instruction.
