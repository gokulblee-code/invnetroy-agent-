# Executive Comparison: Model 1 vs Model 2 Architecture

Both working standalone implementations have been built and launched for **Merlot Home Decor & Nursery**:

---

## 🏢 MODEL 1: Centralized Company WhatsApp Gateway
- **Folder Path:** `C:\Users\asus\Downloads\inventory\whatsapp-agent-model-1-centralized`
- **Active URL:** [http://localhost:5011/inventory-agent-ui](http://localhost:5011/inventory-agent-ui)
- **Port:** `5011`
- **Default Minimum Order Batch:** `30 units`

### How It Works:
1. **Zero Setup for Stores:** Store owners (Merlot) **do not** touch Meta Developer accounts, tokens, or webhooks.
2. **Central Dispatch:** Your company provides the verified WhatsApp Business sender (`+1 555-154-1185` or your company's official number).
3. **Vendor Perception:** Suppliers see messages coming from your verified platform on behalf of Merlot (`"Alex here from Merlot Home Decor..."`).
4. **Billing & Limits:** Your company absorbs the 1,000 free chats pool and pays Meta ~₹0.40/chat thereafter, charging the customer a SaaS fee (e.g. ₹999/month or ₹2/restock).
5. **Pros:** 
   - Instant onboarding (customer just installs agent, connects POS, and starts).
   - Zero technical support tickets about Meta tokens expiring.
6. **Cons:**
   - Your company pays Meta for messages above 1,000/month.

---

## 📲 MODEL 2: Bring Your Own Number (BYON)
- **Folder Path:** `C:\Users\asus\Downloads\inventory\whatsapp-agent-model-2-byon`
- **Active URL:** [http://localhost:5012/inventory-agent-ui](http://localhost:5012/inventory-agent-ui)
- **Port:** `5012`
- **Default Minimum Order Batch:** `50 units`

### How It Works:
1. **Independent Store Number:** The store owner (Merlot) registers their **own dedicated WhatsApp Business number** in Meta Business Manager.
2. **Dedicated Free Tier:** Merlot gets their **own 1,000 free service conversations every month** directly from Meta. 100 clients get $100 \times 1,000 = 100,000$ free chats across the fleet!
3. **Vendor Perception:** Suppliers receive messages directly from Merlot's official branded phone number.
4. **Billing & Limits:** If Merlot exceeds 1,000 chats, Meta bills Merlot's attached card directly—**your company pays ₹0**.
5. **Pros:**
   - Zero messaging costs for your company.
   - Ideal for large enterprises/supermarkets wanting their own branded sender.
6. **Cons:**
   - Store owner must complete the one-time Meta Developer / WABA registration.

---

## ⚙️ How Minimum Reorder Quantity (Batch Size) Works in Both Models:
Both models now feature a dual-input control:
- **Low-Stock Alert Trigger:** `Stock <= 3 units` (When to reorder).
- **Minimum Order Batch:** `Order Batch: 30 / 50 units` (How many units to purchase from vendor).
When Snake Plant or Sunflower Plant stock drops $\le 3$, the agent automatically negotiates for the exact configured batch size.
