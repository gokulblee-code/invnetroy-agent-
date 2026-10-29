# Requirements & Verification Contract

## 1. Autonomous Sourcing & POS Bridge
- **REQ-01**: Live POS Inventory Synchronization via SQLite bridge (`localdb.sqlite`).
- **REQ-02**: Automatic detection of SKUs breaching Reorder Point (ROP) thresholds.
- **REQ-03**: Real-time supplier ranking based on unit costs, MOQ, lead times, and reliability ratings.

## 2. WhatsApp Multi-Vendor Negotiation
- **REQ-04**: Autonomous outreach dispatch via Meta WhatsApp Business Cloud API.
- **REQ-05**: Reasoning-driven multi-turn bargaining with tactical empathy and instant UPI payment incentives.
- **REQ-06**: Hard walkaway ceiling cost enforcement (never commit above budgeted ceiling).
- **REQ-07**: Post-deal closure protection with automated PO generation and silent confirmation handling.

## 3. Anti-Spam & Operational Reliability
- **REQ-08**: Exact message deduplication within a 15-minute window.
- **REQ-09**: Recipient message throttling (minimum 8-second gap).
- **REQ-10**: Persistent 12-hour restock cooldowns to prevent repeat pings across server reboots.
