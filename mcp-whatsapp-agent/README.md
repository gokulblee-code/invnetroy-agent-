# 📲 WhatsApp Agent MCP Server (Model Context Protocol)

A standalone, 100% portable **Model Context Protocol (MCP)** server providing WhatsApp messaging, Meta Cloud API integration, and autonomous multi-turn price negotiation for any AI agent or project.

---

## 🌟 Features
- **Zero External npm Dependencies**: Built entirely using native Node.js (`https`, `readline`). Works out of the box with `node server.js`.
- **Standard MCP Protocol**: Communicates via **JSON-RPC 2.0 over standard I/O (`stdio`)**.
- **Universal Client Support**: Plug-and-play into **Claude Desktop**, **Cursor IDE**, **Antigravity**, **MyBlocks**, or custom MCP host agents.
- **Built-in Anti-Spam Guards**:
  - Minimum 8-second interval per recipient.
  - 15-minute exact message deduplication.
- **Bi-Directional Procurement Engine**:
  - Initiates structured WhatsApp RFQ outreach.
  - Analyzes supplier counter-offers, handles volume/lead-time constraints, and computes calibrated Ackerman counter-offers.

---

## 🛠️ Exposed MCP Tools

| Tool Name | Description |
|-----------|-------------|
| `send_whatsapp_message` | Send outbound WhatsApp messages via Meta Cloud API or click-to-chat fallback URL. |
| `start_procurement_negotiation` | Start an autonomous procurement negotiation session with target opening rate and ceiling cost. |
| `handle_whatsapp_incoming_reply` | Process supplier/customer replies, extract prices, and calculate counter-offers or deal closures. |
| `get_active_negotiation_sessions` | Retrieve active negotiation sessions, current offers, and turn-by-turn dialogue history. |
| `configure_meta_whatsapp_credentials` | Dynamically update Meta Phone Number ID, Access Token, or Corporate UPI VPA. |

---

## 🚀 How to Add This MCP to Any Project

### Option A: Using with Claude Desktop (`claude_desktop_config.json`)

Add the following to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "whatsapp-agent": {
      "command": "node",
      "args": ["c:/Users/asus/Downloads/inventory/mcp-whatsapp-agent/server.js"],
      "env": {
        "WHATSAPP_PROVIDER": "META",
        "META_WA_PHONE_NUMBER_ID": "104829104829104",
        "META_WA_ACCESS_TOKEN": "EAA...",
        "CORPORATE_UPI_ID": "merlotdecor@icici",
        "FIRM_NAME": "Merlot Home Decor & Nursery"
      }
    }
  }
}
```

---

### Option B: Using in Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "whatsapp-agent": {
      "command": "node",
      "args": ["./mcp-whatsapp-agent/server.js"]
    }
  }
}
```

---

### Option C: Standalone CLI Testing

Run the included verification suite:
```bash
node mcp-whatsapp-agent/test_mcp.js
```
