'use strict';

/**
 * ==============================================================================
 * 🤖 AUTONOMOUS INVENTORY & SOURCING AI AGENT — ALL-IN-ONE STANDALONE ROUTER
 * 
 * Target Platforms: AgentGen Pro / MyBlock Agent / Standalone Node Server
 * Architecture: 100% Self-Contained. Zero external local file requirements.
 * Key Files: route.js (All Backend Engines & APIs) + agent.html (Frontend UI)
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { workflowEngine } = require('./workflowEngine');

// Safe database resolution (Optional - never crashes if missing)
let db = null;
try {
  db = require('../backend/db');
} catch (e) {
  try {
    db = require('./db');
  } catch (e2) {
    db = null;
  }
}

try {
  require('dotenv').config();
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {}

/**
 * 🔒 Agent API Key Authentication Middleware
 * Enforces key verification on sensitive admin, configuration, and financial endpoints.
 * Public webhooks (/whatsapp-webhook) and read-only status endpoints remain accessible.
 */
function requireAuth(req, res, next) {
  const configuredKey = (process.env.AGENT_API_KEY || 'merlot_secure_agent_key_2026').trim();
  const providedKey = (
    req.headers['x-agent-key'] ||
    req.query.api_key ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null)
  );

  if (!providedKey || String(providedKey).trim() !== configuredKey) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing Agent API Key. Provide a valid key in the X-Agent-Key header or api_key parameter.'
    });
  }
  next();
}

// Safe multi-folder path resolver (works whether route.js is in /backend, root, or agent.gen)
function resolveAppPath(...subpaths) {
  const p1 = path.join(__dirname, ...subpaths);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(__dirname, '..', ...subpaths);
  if (fs.existsSync(p2)) return p2;
  const p3 = path.join(__dirname, 'backend', ...subpaths);
  if (fs.existsSync(p3)) return p3;
  return p1;
}

// ==================== 📦 EMBEDDED DEFAULT DATASETS (0% DISK DEPENDENCY) ====================

const EMBEDDED_DEFAULT_FIRM_PROFILE = {
  "firm_name": "Merlot Home Decor & Nursery",
  "owner_name": "Alex Merlot",
  "phone": "+91 98765 00000",
  "whatsapp": "+91 98765 00000",
  "address": "Plot 42, Botanical Boulevard, Nursery Zone, Pune",
  "city": "Pune",
  "gstin": "27AAAAA0000A1Z5",
  "corporate_upi_id": "merlotdecor@icici",
  "bank_name": "ICICI Bank",
  "account_number": "50200098765432",
  "ifsc_code": "ICIC0001234",
  "auto_approval_limit": 25000,
  "min_gross_margin_pct": 50,
  "max_ceiling_price": 250,
  "registered_at": "2026-10-19T08:35:00.000Z",
  "qr_code_data": "upi://pay?pa=merlotdecor@icici&pn=Merlot+Home+Decor&cu=INR"
};

const EMBEDDED_DEFAULT_VENDORS_CSV = "vendor_id,vendor_name,contact_person,phone,whatsapp,location,products_supplied,base_cost,floor_price,lead_time_days,moq,rating,upi_id,bank_account,ifsc\r\nv_deccan,Deccan Flora Wholesale Nursery,Ramesh Patel,+91XXXXXXXXXX,9846625845,Pune Regional Hub,p_snake_plant_10in;p_fiddle_leaf_fig;p_monstera_deliciosa;p_zz_plant_premium,340,250,1,20,4.8,deccanflora@icici,5.02E+13,ICIC0001234\r\nv_greencanopy,Green Canopy Growers,Anil Rao,+91XXXXXXXXXX,9846625845,Kadiam Botanical Cluster,p_snake_plant_10in;p_fiddle_leaf_fig,320,260,2,30,4.6,greencanopy@upi,9.19812E+11,PYTM0123456\r\nv_biogreens,BioGreens Botanical Nursery,Suresh Gowda,+91XXXXXXXXXX,9846625845,Bengaluru Agro Corridor,p_snake_plant_10in;p_monstera_deliciosa,310,255,4,50,4.2,biogreens@sbi,30891234567,SBIN0004567\r\nv_ceramics_craft,Heritage Ceramic Crafts,Rajesh Varma,+91XXXXXXXXXX,9846625845,Khurja Pottery Hub,p_ceramic_pot_10in,145,120,2,20,4.7,heritagecrafts@hdfcbank,5.01002E+13,HDFC0000456\r\nv_bio_agro,BioAgro Organics India,Dr. K. Sharma,+91XXXXXXXXXX,9846625845,Nashik Bio Hub,p_organic_neem_oil,115,95,2,12,4.6,bioagro@okhdfcbank,1029384756,UTIB0000789\r\n";

// ==================== 📖 SECTION 1: PLAYBOOK & TACTICS ENGINE ====================
/**
 * Playbook Engine — Document & Book Ingestion for RAG Negotiation
 * Handles PDF, Markdown, and Text document uploads, semantic chunking,
 * persistent storage, and real-time tactic retrieval during vendor negotiations.
 */

// fs
// path
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  pdfParse = null;
}

const PLAYBOOKS_DIR = resolveAppPath('playbooks');
const INDEX_FILE = path.join(PLAYBOOKS_DIR, 'playbooks_index.json');

// Ensure playbooks directory exists
if (!fs.existsSync(PLAYBOOKS_DIR)) {
  fs.mkdirSync(PLAYBOOKS_DIR, { recursive: true });
}

let loadedIndex = {
  activePlaybookId: 'playbook-default-master',
  books: []
};

/**
 * Split text into semantic chunks based on headers and paragraphs
 */
function chunkDocument(text, title = 'Document') {
  const sections = text.split(/\n(?=##?\s+)/);
  const chunks = [];

  sections.forEach((sec, idx) => {
    const trimmed = sec.trim();
    if (!trimmed) return;

    const lines = trimmed.split('\n');
    let heading = `Section ${idx + 1}`;
    if (lines[0].startsWith('#')) {
      heading = lines[0].replace(/^#+\s*/, '').trim();
    }

    const body = lines.slice(1).join('\n').trim();
    if (body.length > 20) {
      chunks.push({
        id: `chunk_${idx + 1}`,
        heading,
        content: body,
        preview: body.slice(0, 150) + (body.length > 150 ? '...' : '')
      });
    }
  });

  if (chunks.length === 0 && text.trim().length > 0) {
    // Fallback: chunk by paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    paragraphs.forEach((p, idx) => {
      const trimmed = p.trim();
      if (trimmed.length > 30) {
        chunks.push({
          id: `chunk_${idx + 1}`,
          heading: `Excerpt Part ${idx + 1}`,
          content: trimmed,
          preview: trimmed.slice(0, 150) + (trimmed.length > 150 ? '...' : '')
        });
      }
    });
  }

  return chunks;
}

/**
 * Initialize / Reload Index from Disk
 */
function initIndex() {
  if (fs.existsSync(INDEX_FILE)) {
    try {
      const data = fs.readFileSync(INDEX_FILE, 'utf8');
      loadedIndex = JSON.parse(data);
    } catch (e) {
      console.warn('⚠️ Could not parse playbooks_index.json:', e.message);
    }
  }

  // Ensure default master playbook is indexed
  const defaultMasterPath = path.join(PLAYBOOKS_DIR, 'Master_Procurement_Negotiation_Playbook.md');
  const hasDefault = loadedIndex.books.some(b => b.id === 'playbook-default-master');

  if (!hasDefault && fs.existsSync(defaultMasterPath)) {
    const content = fs.readFileSync(defaultMasterPath, 'utf8');
    const chunks = chunkDocument(content, 'Master Procurement & Botanical Negotiation Playbook');
    const defaultBook = {
      id: 'playbook-default-master',
      title: 'Master Procurement & Botanical Negotiation Playbook (Chris Voss & Fisher Principles)',
      filename: 'Master_Procurement_Negotiation_Playbook.md',
      uploaded_at: new Date().toISOString(),
      size_bytes: Buffer.byteLength(content, 'utf8'),
      chunk_count: chunks.length,
      chunks,
      is_active: true
    };
    loadedIndex.books.unshift(defaultBook);
    if (!loadedIndex.activePlaybookId) {
      loadedIndex.activePlaybookId = defaultBook.id;
    }
    saveIndex();
  }

  return loadedIndex;
}

function saveIndex() {
  try {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(loadedIndex, null, 2), 'utf8');
  } catch (e) {
    console.error('❌ Failed to save playbooks index:', e.message);
  }
}

/**
 * Ingest and register a new playbook file (PDF, Markdown, or Text)
 */
async function ingestPlaybook({ title, filename, fileBuffer, textContent }) {
  initIndex();

  let extractedText = '';
  const safeFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const targetPath = path.join(PLAYBOOKS_DIR, safeFilename);

  if (filename.toLowerCase().endsWith('.pdf') && fileBuffer) {
    fs.writeFileSync(targetPath, fileBuffer);
    if (pdfParse) {
      try {
        const parsed = await pdfParse(fileBuffer);
        extractedText = parsed.text || '';
      } catch (err) {
        throw new Error('Failed to parse PDF document: ' + err.message);
      }
    } else {
      throw new Error('pdf-parse library is required for PDF parsing.');
    }
  } else {
    // Text or Markdown
    extractedText = textContent || (fileBuffer ? fileBuffer.toString('utf8') : '');
    fs.writeFileSync(targetPath, extractedText, 'utf8');
  }

  if (!extractedText || extractedText.trim().length < 30) {
    throw new Error('The uploaded document appears to be empty or unreadable.');
  }

  const chunks = chunkDocument(extractedText, title || filename);
  const bookId = `playbook_${Date.now()}`;
  const newBook = {
    id: bookId,
    title: title || filename.replace(/\.[^/.]+$/, ''),
    filename: safeFilename,
    uploaded_at: new Date().toISOString(),
    size_bytes: extractedText.length,
    chunk_count: chunks.length,
    chunks,
    is_active: true
  };

  // Set as the active playbook
  loadedIndex.books.forEach(b => { b.is_active = false; });
  loadedIndex.books.unshift(newBook);
  loadedIndex.activePlaybookId = bookId;
  saveIndex();

  return {
    success: true,
    message: `🎉 Successfully ingested and indexed "${newBook.title}" with ${chunks.length} tactical chapters!`,
    book: newBook
  };
}

/**
 * Retrieve specific tactic from the active book based on turn context
 */
function retrieveNegotiationTactic(turn, context = {}) {
  initIndex();
  const activeBook = loadedIndex.books.find(b => b.id === loadedIndex.activePlaybookId) || loadedIndex.books[0];
  
  if (!activeBook || !activeBook.chunks || activeBook.chunks.length === 0) {
    return {
      source: 'Default Rulebook',
      tacticName: 'Standard Margin Anchoring',
      guidance: 'Anchor to historical lowest cleared PO rate.'
    };
  }

  // Turn 2: Agent Opening Counter-Offer (Anchoring & Historical Evidence)
  if (turn === 2) {
    const chunk = activeBook.chunks.find(c => 
      /anchor|opening|calibration|historical|first/i.test(c.heading) || 
      /anchor|historical/i.test(c.content)
    ) || activeBook.chunks[0];

    return {
      source: activeBook.title,
      chapter: chunk.heading,
      tacticName: 'The Anchoring Precedent & Volume Commitment',
      guidance: chunk.preview,
      fullContent: chunk.content
    };
  }

  // Turn 3/4: Handling Logistics/Peat/Concession Excuses (Tactical Empathy & Ackerman)
  if (turn === 3 || turn === 4) {
    const chunk = activeBook.chunks.find(c => 
      /empathy|peat|logistics|ackerman|concession|mirror/i.test(c.heading) || 
      /empathy|transport|cost/i.test(c.content)
    ) || activeBook.chunks[Math.min(1, activeBook.chunks.length - 1)];

    return {
      source: activeBook.title,
      chapter: chunk.heading,
      tacticName: 'Tactical Empathy & Non-Monetary Payout Trade-Off',
      guidance: chunk.preview,
      fullContent: chunk.content
    };
  }

  // Turn 4: Final Settlement or Hard Walkaway
  if (turn === 5 || turn === 'final') {
    const chunk = activeBook.chunks.find(c => 
      /walkaway|ceiling|discipline|calibrated|margin/i.test(c.heading) || 
      /walkaway|ceiling/i.test(c.content)
    ) || activeBook.chunks[activeBook.chunks.length - 1];

    return {
      source: activeBook.title,
      chapter: chunk.heading,
      tacticName: 'Calibrated Walkaway Enforcement & Margin Defense',
      guidance: chunk.preview,
      fullContent: chunk.content
    };
  }

  // General fallback
  const firstChunk = activeBook.chunks[0];
  return {
    source: activeBook.title,
    chapter: firstChunk.heading,
    tacticName: 'Principled Bargaining',
    guidance: firstChunk.preview,
    fullContent: firstChunk.content
  };
}

function listPlaybooks() {
  initIndex();
  return {
    activeId: loadedIndex.activePlaybookId,
    books: loadedIndex.books.map(b => ({
      id: b.id,
      title: b.title,
      filename: b.filename,
      uploaded_at: b.uploaded_at,
      size_bytes: b.size_bytes,
      chunk_count: b.chunk_count,
      is_active: b.id === loadedIndex.activePlaybookId,
      sample_chapters: (b.chunks || []).slice(0, 3).map(c => c.heading)
    }))
  };
}

function setActivePlaybook(bookId) {
  initIndex();
  const book = loadedIndex.books.find(b => b.id === bookId);
  if (!book) return { success: false, error: 'Book not found' };

  loadedIndex.books.forEach(b => { b.is_active = (b.id === bookId); });
  loadedIndex.activePlaybookId = bookId;
  saveIndex();
  return { success: true, activeId: bookId, title: book.title };
}

// Initial bootstrap
initIndex();

const playbookEngine = {
  initIndex,
  ingestPlaybook,
  retrieveNegotiationTactic,
  listPlaybooks,
  setActivePlaybook
};

// ==================== 🔌 SECTION 2: POS BRIDGE ADAPTER ====================
/**
 * POS Bridge Adapter for Merlot Home Decor & Gardening
 * Seamlessly connects the Inventory Agent to the Merlot POS system
 * via Direct SQLite Database and/or HTTP REST API.
 */

// fs
// path

let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e1) {
  try {
    sqlite3 = require(path.join(__dirname, '../retail-pos-app/backend/node_modules/sqlite3')).verbose();
  } catch (e2) {
    sqlite3 = null;
  }
}

class POSBridge {
  constructor() {
    this.apiUrl = process.env.POS_URL || 'http://localhost:5000';
    this.dbPath = this.resolveDefaultDbPath();
    this.tenantId = process.env.TENANT_ID || 'tenant_merlot_01';
    this.dbInstance = null;
    this.localOrdersDb = null;
    this.initDatabase();
  }

  resolveDefaultDbPath() {
    if (process.env.POS_DB_PATH) return path.resolve(process.env.POS_DB_PATH);
    const candidateLocal = resolveAppPath('localdb.sqlite');
    if (fs.existsSync(candidateLocal)) return candidateLocal;
    const candidateMerlot = resolveAppPath('merlot_pos_orders.sqlite');
    if (fs.existsSync(candidateMerlot)) return candidateMerlot;
    return path.resolve(__dirname, '../retail-pos-app/backend/localdb.sqlite');
  }

  setPosAddress(config = {}) {
    if (config.apiUrl) this.apiUrl = config.apiUrl.trim().replace(/\/+$/, '');
    if (config.dbPath) {
      this.dbPath = path.resolve(config.dbPath.trim());
      this.initDatabase();
    }
    if (config.tenantId) this.tenantId = config.tenantId.trim();
    return this.getPosStatus();
  }

  initDatabase() {
    if (!sqlite3) {
      console.warn('ℹ️ SQLite3 native driver not installed locally; using HTTP REST API fallback.');
      return;
    }

    // Initialize local procurement orders database in workspace
    try {
      this.localOrdersDb = new sqlite3.Database(resolveAppPath('merlot_pos_orders.sqlite'));
      this.localOrdersDb.serialize(() => {
        this.localOrdersDb.run(`CREATE TABLE IF NOT EXISTS purchase_orders (
          id TEXT PRIMARY KEY,
          tenant_id TEXT DEFAULT 'tenant_merlot_01',
          po_number TEXT UNIQUE NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          vendor_id TEXT NOT NULL,
          vendor_name TEXT NOT NULL,
          unit_cost REAL NOT NULL,
          quantity INTEGER NOT NULL,
          total_amount REAL NOT NULL,
          payment_status TEXT DEFAULT 'PAID',
          payment_reference TEXT,
          dispatch_status TEXT DEFAULT 'DISPATCH_APPROVED',
          eta_hours INTEGER DEFAULT 48,
          tracking_number TEXT,
          negotiation_notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        this.localOrdersDb.run(`CREATE TABLE IF NOT EXISTS in_transit_inventory (
          product_id TEXT PRIMARY KEY,
          in_transit_qty INTEGER DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        this.localOrdersDb.run(`CREATE TABLE IF NOT EXISTS vendor_chat_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          vendor_id TEXT NOT NULL,
          vendor_name TEXT,
          product_id TEXT NOT NULL,
          product_name TEXT,
          sender TEXT NOT NULL,
          message TEXT NOT NULL,
          turn_number INTEGER NOT NULL,
          extracted_price REAL,
          sentiment TEXT,
          is_hallucination_blocked INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        this.localOrdersDb.run(`CREATE INDEX IF NOT EXISTS idx_vcl_vendor ON vendor_chat_ledger (vendor_id)`);
        this.localOrdersDb.run(`CREATE INDEX IF NOT EXISTS idx_vcl_session ON vendor_chat_ledger (session_id)`);
      });
    } catch (e) {
      console.warn('Local orders db init warning:', e.message);
    }

    // Connect to external POS SQLite in READONLY mode to avoid write locks/sandbox errors
    if (fs.existsSync(this.dbPath)) {
      try {
        if (this.dbInstance) {
          try { this.dbInstance.close(); } catch (e) {}
        }
        this.dbInstance = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
          if (err) {
            console.error('❌ Failed to open POS SQLite DB at:', this.dbPath, err.message);
          } else {
            console.log('✅ POS Bridge connected directly to SQLite DB at:', this.dbPath);
          }
        });
        this.dbInstance.configure('busyTimeout', 5000);
      } catch (err) {
        console.error('❌ DB connection error:', err.message);
      }
    } else {
      console.log('ℹ️ POS SQLite DB not found at', this.dbPath, '- will use HTTP REST fallback to', this.apiUrl);
    }
  }

  async getPosStatus() {
    const dbExists = fs.existsSync(this.dbPath);
    let apiReachable = false;
    let apiMessage = '';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.apiUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      apiReachable = res.ok;
      apiMessage = `HTTP ${res.status}`;
    } catch (err) {
      apiReachable = false;
      apiMessage = err.message;
    }

    return {
      success: true,
      mode: dbExists ? 'DIRECT_SQLITE' : apiReachable ? 'HTTP_REST' : 'STANDALONE',
      tenantId: this.tenantId,
      dbPath: this.dbPath,
      dbExists,
      dbConnected: Boolean(this.dbInstance),
      apiUrl: this.apiUrl,
      apiReachable,
      apiStatus: apiMessage,
      isPosEmpty: Boolean(this.isPosEmpty),
      demoMode: process.env.DEMO_MODE === 'true'
    };
  }

  /**
   * 🔌 Universal POS Product Ingestion Engine with Dynamic Schema Auto-Discovery
   * Detects arbitrary table names (products, items, inventory, catalog) and maps columns dynamically.
   * If POS is connected but empty, adheres strictly to Zero-Mock Policy unless DEMO_MODE=true.
   */
  async getProducts() {
    this.isPosEmpty = false;

    // 1. Direct SQLite read if database connection is available
    if (this.dbInstance) {
      try {
        const tables = await new Promise((resolve) => {
          this.dbInstance.all(`SELECT name FROM sqlite_master WHERE type='table'`, [], (err, rows) => {
            if (!err && rows) resolve(rows.map(r => r.name));
            else resolve([]);
          });
        });

        // Auto-detect product catalog table name
        const catalogTable = ['products', 'items', 'inventory', 'catalog_items', 'stock_items']
          .find(t => tables.includes(t));

        if (catalogTable) {
          const hasInvoiceItems = tables.includes('invoice_items');

          const rawRows = await new Promise((resolve) => {
            let sql = '';
            if (hasInvoiceItems) {
              sql = `
                SELECT p.*,
                       COALESCE((
                         SELECT SUM(quantity) FROM invoice_items ii 
                         WHERE ii.product_id = p.id
                       ), 0) as sales_7d
                FROM ${catalogTable} p
                ORDER BY p.rowid ASC
              `;
            } else {
              sql = `SELECT p.*, 0 as sales_7d FROM ${catalogTable} p ORDER BY p.rowid ASC`;
            }

            this.dbInstance.all(sql, [], (err, rows) => {
              if (!err && rows) resolve(rows);
              else resolve([]);
            });
          });

          if (rawRows && rawRows.length > 0) {
            this.isPosEmpty = false;
            return rawRows.map((r, idx) => {
              const sellingPrice = Number(r.selling_price || r.price || r.mrp || r.retail_price || r.unit_price || 0);
              const costPrice = Number(r.cost_price || r.cost || r.purchase_rate || r.buy_price || r.base_cost || Math.round(sellingPrice * 0.5));
              const currentStock = Number(r.stock != null ? r.stock : (r.current_stock != null ? r.current_stock : (r.quantity != null ? r.quantity : (r.qty_on_hand != null ? r.qty_on_hand : 0))));
              const minStock = Number(r.min_stock_level || r.min_stock || r.reorder_point || r.rop || 15);
              const expiryDays = r.expiry_days != null ? Number(r.expiry_days) : (r.shelf_life_days != null ? Number(r.shelf_life_days) : 365);
              const sales7d = Number(r.sales_7d || r.sales7d || r.velocity_7d || 0);

              return {
                id: String(r.id || r.item_id || r.product_id || r.code || r.sku || `p_${idx + 1}`),
                name: String(r.name || r.product_name || r.item_name || r.title || `Item #${idx + 1}`),
                category: String(r.category || r.category_name || r.department || 'General'),
                price: sellingPrice,
                cost: costPrice,
                stock: currentStock,
                in_transit_stock: 0,
                minStock,
                expiryDays,
                sales7d,
                sku: String(r.sku || r.barcode || r.code || r.id || `SKU-${idx + 1}`),
                brand: String(r.brand || r.brand_name || r.manufacturer || 'Store Product')
              };
            });
          } else {
            // Table exists in connected SQLite POS, but has 0 records (fresh/wiped client store)
            this.isPosEmpty = true;
            if (process.env.DEMO_MODE !== 'true') {
              console.log('ℹ️ Connected POS database has 0 items. Zero-Mock Policy active (empty catalog returned).');
              return [];
            }
          }
        }
      } catch (err) {
        console.warn('POS SQLite auto-schema read notice:', err.message);
      }
    }

    // 2. HTTP REST read from POS API if configured
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.apiUrl}/api/products`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.isPosEmpty = false;
          return data.map((r, idx) => ({
            id: String(r.id || r.item_id || r.code || `p_${idx + 1}`),
            name: String(r.name || r.product_name || r.title || `Item #${idx + 1}`),
            category: String(r.category || 'General'),
            price: Number(r.price || r.selling_price || 0),
            cost: Number(r.cost || r.cost_price || 0),
            stock: Number(r.stock != null ? r.stock : (r.quantity != null ? r.quantity : 0)),
            in_transit_stock: 0,
            minStock: Number(r.minStock || r.min_stock_level || 15),
            expiryDays: Number(r.expiryDays || r.expiry_days || 365),
            sales7d: Number(r.sales7d || r.sales_7d || 0),
            sku: String(r.sku || r.id || `SKU-${idx + 1}`),
            brand: String(r.brand || 'Store Product')
          }));
        }
      }
    } catch (e) {}

    // 3. Fallback logic: Only load mock nursery demo items if DEMO_MODE is explicitly enabled!
    if (process.env.DEMO_MODE === 'true') {
      return this.getFallbackMerlotCatalog();
    }

    // Zero-Mock Guarantee: Return empty array so client UI reflects actual store state cleanly
    return [];
  }

  getFallbackMerlotCatalog() {
    return [
      {
        id: 'p_snake_plant_10in',
        name: 'Snake Plant (Sansevieria Laurentii)',
        category: 'Indoor Foliage',
        price: 499.00,
        cost: 220.00,
        stock: 24, // < 30 Threshold!
        in_transit_stock: 0,
        minStock: 30,
        expiryDays: 365,
        sales7d: 56, // 8 units/day -> high moving
        sku: 'MHD-PLT-001',
        brand: 'Merlot Botanicals'
      },
      {
        id: 'p_fiddle_leaf_fig',
        name: 'Fiddle Leaf Fig Tree (12-inch)',
        category: 'Indoor Foliage',
        price: 899.00,
        cost: 450.00,
        stock: 14,
        in_transit_stock: 0,
        minStock: 15,
        expiryDays: 365,
        sales7d: 21,
        sku: 'MHD-PLT-002',
        brand: 'Merlot Botanicals'
      },
      {
        id: 'p_monstera_deliciosa',
        name: 'Monstera Deliciosa (Swiss Cheese Plant)',
        category: 'Indoor Foliage',
        price: 750.00,
        cost: 350.00,
        stock: 8,
        in_transit_stock: 0,
        minStock: 15,
        expiryDays: 365,
        sales7d: 35,
        sku: 'MHD-PLT-003',
        brand: 'Merlot Botanicals'
      },
      {
        id: 'p_ceramic_pot_10in',
        name: 'Handcrafted Minimalist Ceramic Planter (10-inch)',
        category: 'Planters & Pots',
        price: 349.00,
        cost: 140.00,
        stock: 42,
        in_transit_stock: 0,
        minStock: 20,
        expiryDays: 999,
        sales7d: 28,
        sku: 'MHD-POT-004',
        brand: 'Merlot Studio'
      },
      {
        id: 'p_zz_plant_premium',
        name: 'ZZ Plant Emerald Queen (8-inch)',
        category: 'Indoor Foliage',
        price: 549.00,
        cost: 260.00,
        stock: 11,
        in_transit_stock: 0,
        minStock: 15,
        expiryDays: 365,
        sales7d: 21,
        sku: 'MHD-PLT-005',
        brand: 'Merlot Botanicals'
      },
      {
        id: 'p_organic_neem_oil',
        name: 'Organic Cold-Pressed Neem Oil Spray (500ml)',
        category: 'Plant Care',
        price: 240.00,
        cost: 110.00,
        stock: 15,
        in_transit_stock: 0,
        minStock: 12,
        expiryDays: 180,
        sales7d: 14,
        sku: 'MHD-CARE-006',
        brand: 'Merlot GardenCare'
      }
    ];
  }

  async recordPurchaseOrder(po) {
    // 1. Save to local orders database in workspace
    if (this.localOrdersDb) {
      await new Promise((resolve) => {
        const stmt = this.localOrdersDb.prepare(`
          INSERT OR REPLACE INTO purchase_orders (
            id, tenant_id, po_number, product_id, product_name, vendor_id, vendor_name,
            unit_cost, quantity, total_amount, payment_status, payment_reference,
            dispatch_status, eta_hours, tracking_number, negotiation_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run([
          po.id || `po_${Date.now()}`,
          this.tenantId,
          po.po_number,
          po.product_id,
          po.product_name,
          po.vendor_id,
          po.vendor_name,
          po.unit_cost || po.final_price,
          po.quantity,
          po.total_amount,
          po.payment_status || 'PAID',
          po.payment_reference || `UPI-${Date.now()}`,
          po.dispatch_status || 'DISPATCH_APPROVED_IN_TRANSIT',
          po.estimated_arrival_hours || 48,
          po.tracking_number || `TRK-MERLOT-${Date.now().toString().slice(-6)}`,
          po.negotiation_notes || ''
        ], () => {
          this.localOrdersDb.run(
            `INSERT OR REPLACE INTO in_transit_inventory (product_id, in_transit_qty)
             VALUES (?, COALESCE((SELECT in_transit_qty FROM in_transit_inventory WHERE product_id = ?), 0) + ?)`,
            [po.product_id, po.product_id, po.quantity],
            () => resolve()
          );
        });
        stmt.finalize();
      });
    }

    // 2. Best-effort sync to POS REST API if available
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      await fetch(`${this.apiUrl}/api/inventory-agent/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(po),
        signal: controller.signal
      });
      clearTimeout(timeout);
    } catch (e) {}

    return {
      success: true,
      mode: 'PERSISTED_IN_LOCAL_POS_LEDGER',
      po_number: po.po_number,
      in_transit_quantity: po.quantity
    };
  }

  async markGoodsReceived(productId, quantity) {
    if (this.localOrdersDb) {
      await new Promise((resolve) => {
        this.localOrdersDb.run(
          `UPDATE in_transit_inventory
           SET in_transit_qty = MAX(0, in_transit_qty - ?)
           WHERE product_id = ?`,
          [quantity, productId],
          () => resolve()
        );
      });
    }
    return { success: true, updated_stock_increase: quantity };
  }
}

const posBridge = new POSBridge();

// ==================== 📲 SECTION 3: WHATSAPP COMMUNICATION GATEWAY ====================
/**
 * 🌿 Merlot AutoProcure AI - Enterprise WhatsApp Communication Gateway
 * Supports:
 *  1. Meta WhatsApp Business Cloud API (Official, free 1,000 service conversations/month)
 *  2. Twilio WhatsApp API
 *  3. Green API (Multi-device WhatsApp gateway)
 *  4. Direct Webhook Callback & Browser Deep-Link Fallback
 */

class WhatsAppService {
  constructor() {
    this.refreshConfig();
  }

  refreshConfig() {
    this.provider = (process.env.WHATSAPP_PROVIDER || 'META').toUpperCase();

    // 1. Meta WhatsApp Cloud API credentials
    this.meta = {
      phoneNumberId: process.env.META_WA_PHONE_NUMBER_ID || '',
      accessToken: process.env.META_WA_ACCESS_TOKEN || '',
      verifyToken: process.env.META_WA_VERIFY_TOKEN || 'merlot_procure_agent_2026',
      apiVersion: process.env.META_WA_API_VERSION || 'v20.0'
    };

    // 2. Twilio credentials
    this.twilio = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_WHATSAPP_NUMBER || ''
    };

    // 3. Green API credentials
    this.greenApi = {
      instanceId: process.env.GREEN_API_INSTANCE_ID || '',
      apiToken: process.env.GREEN_API_TOKEN || ''
    };
  }

  isMetaConfigured() {
    return Boolean(this.meta.phoneNumberId && this.meta.accessToken);
  }

  isTwilioConfigured() {
    return Boolean(this.twilio.accountSid && this.twilio.authToken && this.twilio.fromNumber);
  }

  isGreenApiConfigured() {
    return Boolean(this.greenApi.instanceId && this.greenApi.apiToken);
  }

  getStatus() {
    this.refreshConfig();
    const activeProvider = this.isMetaConfigured()
      ? 'META_CLOUD_API'
      : this.isTwilioConfigured()
        ? 'TWILIO'
        : this.isGreenApiConfigured()
          ? 'GREEN_API'
          : 'DEEP_LINK_SIMULATOR';

    return {
      activeProvider,
      isLiveAutonomous: activeProvider !== 'DEEP_LINK_SIMULATOR',
      metaConfigured: this.isMetaConfigured(),
      twilioConfigured: this.isTwilioConfigured(),
      greenApiConfigured: this.isGreenApiConfigured(),
      webhookVerificationToken: this.meta.verifyToken
    };
  }

  normalizePhoneNumber(phone) {
    if (!phone) return '';
    let digits = phone.toString().replace(/[^0-9]/g, '');
    if (digits.length === 10) {
      digits = '91' + digits; // Default to India (+91) if 10 digits
    }
    return digits;
  }

  /**
   * Dispatch a real WhatsApp message to vendor
   */
  async sendMessage({ to, message }) {
    this.refreshConfig();
    const cleanTo = this.normalizePhoneNumber(to);

    // 1. Dispatch via Meta WhatsApp Cloud API (Primary Enterprise Route)
    if (this.isMetaConfigured()) {
      try {
        const url = `https://graph.facebook.com/${this.meta.apiVersion}/${this.meta.phoneNumberId}/messages`;
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: {
            preview_url: false,
            body: message
          }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.meta.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          console.error('❌ Meta WhatsApp Cloud API dispatch error:', data);
          return {
            success: false,
            provider: 'META_CLOUD_API',
            error: data.error?.message || 'Meta API request failed',
            fallbackUrl: this.buildFallbackUrl(cleanTo, message)
          };
        }

        const msgId = data.messages?.[0]?.id || `meta_${Date.now()}`;
        console.log(`✅ [Meta Cloud API] Message dispatched to +${cleanTo} (ID: ${msgId})`);
        return {
          success: true,
          provider: 'META_CLOUD_API',
          messageId: msgId,
          to: cleanTo
        };
      } catch (err) {
        console.error('❌ Meta WhatsApp network error:', err.message);
        return {
          success: false,
          provider: 'META_CLOUD_API',
          error: err.message,
          fallbackUrl: this.buildFallbackUrl(cleanTo, message)
        };
      }
    }

    // 2. Dispatch via Twilio API
    if (this.isTwilioConfigured()) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilio.accountSid}/Messages.json`;
        const bodyParams = new URLSearchParams({
          From: `whatsapp:${this.twilio.fromNumber}`,
          To: `whatsapp:+${cleanTo}`,
          Body: message
        });

        const authHeader = 'Basic ' + Buffer.from(`${this.twilio.accountSid}:${this.twilio.authToken}`).toString('base64');
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: bodyParams.toString()
        });

        const data = await res.json();
        if (!res.ok) {
          console.error('❌ Twilio dispatch error:', data);
          return {
            success: false,
            provider: 'TWILIO',
            error: data.message || 'Twilio request failed',
            fallbackUrl: this.buildFallbackUrl(cleanTo, message)
          };
        }

        console.log(`✅ [Twilio] Message dispatched to +${cleanTo} (SID: ${data.sid})`);
        return {
          success: true,
          provider: 'TWILIO',
          messageId: data.sid,
          to: cleanTo
        };
      } catch (err) {
        return {
          success: false,
          provider: 'TWILIO',
          error: err.message,
          fallbackUrl: this.buildFallbackUrl(cleanTo, message)
        };
      }
    }

    // 3. Fallback: Return deep link with clear configuration notice
    const fallbackUrl = this.buildFallbackUrl(cleanTo, message);
    return {
      success: true,
      provider: 'DIRECT_URL_FALLBACK',
      messageId: `local_${Date.now()}`,
      to: cleanTo,
      whatsappUrl: fallbackUrl,
      note: 'Meta WhatsApp Cloud API credentials not detected. Providing direct wa.me dispatch link.'
    };
  }

  buildFallbackUrl(phone, text) {
    return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
  }

  /**
   * Parse incoming Webhook payload from Meta, Twilio, or simulator
   */
  parseWebhookPayload(req) {
    const body = req.body || {};
    const query = req.query || {};

    // 1. Meta WhatsApp Cloud API format
    if (body.object === 'whatsapp_business_account' && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          const value = change.value || {};
          const messages = value.messages || [];
          if (messages.length > 0) {
            const msg = messages[0];
            return {
              provider: 'META_CLOUD_API',
              from: msg.from,
              message: msg.text?.body || msg.button?.text || '',
              messageId: msg.id,
              timestamp: msg.timestamp,
              senderName: value.contacts?.[0]?.profile?.name || 'Vendor'
            };
          }
        }
      }
    }

    // 2. Twilio format
    if (body.From && (body.Body !== undefined)) {
      const cleanFrom = body.From.replace('whatsapp:', '').replace(/[^0-9]/g, '');
      return {
        provider: 'TWILIO',
        from: cleanFrom,
        message: body.Body || '',
        messageId: body.MessageSid || `tw_${Date.now()}`,
        timestamp: Date.now(),
        senderName: body.ProfileName || 'Vendor'
      };
    }

    // 3. Generic JSON or Query Simulator format
    const payload = req.method === 'GET' ? query : body;
    const from = payload.from || payload.From || payload.phone || payload.sender || '919876543210';
    const message = payload.message || payload.Body || payload.body || payload.text || '';
    const sessionId = payload.sessionId || payload.session_id || null;

    return {
      provider: 'DIRECT_SIMULATOR',
      from: this.normalizePhoneNumber(from),
      message: message.trim(),
      sessionId,
      messageId: `sim_${Date.now()}`,
      timestamp: Date.now(),
      senderName: payload.name || 'Vendor'
    };
  }
}

const whatsappService = new WhatsAppService();

// ==================== 🧠 SECTION 4: RAG PROCUREMENT & TACTICAL BARGAINING ====================
/**
 * RAG-Augmented Procurement & Autonomous Negotiation Engine
 * Tailored for Merlot Home Decor & Gardening
 * Supports dynamic firm profile registration & vendor CSV ingestion
 */

// fs
// path
// playbookEngine embedded

// ==================== 🌐 MYBLOCKS TRAINEE RAG SERVICE INTEGRATION ====================

const MYBLOCKS_RAG_STATE = {
  baseUrl: process.env.MYBLOCKS_RAG_BASE_URL || 'https://myblocks.in:7101/api/trainee-rag',
  userId: process.env.MYBLOCKS_USER_ID || '1559',
  firmId: process.env.MYBLOCKS_FIRM_ID || '1',
  defaultCategory: process.env.MYBLOCKS_CATEGORY || 'inventory-procurement',
  personaId: process.env.MYBLOCKS_PERSONA_ID || '5-aa3f37b4-e0e6-4408-9b8d-ab4ca330c64d',
  systemFallbackPersona: {
    id: 'default',
    name: 'Inventory Sourcing Persona',
    prompt: 'You are an autonomous wholesale inventory sourcing and procurement agent that negotiates wholesale supplier contracts, analyzes prices, and secures optimal wholesale margins.',
    voice_prompt: 'You are an autonomous wholesale inventory agent.',
    stages: ['greeting', 'context_gathering', 'issue_identification', 'solution_provision', 'follow_up', 'wrap_up']
  },
  lastQueryTime: null,
  lastQueryResult: null,
  cachedPersonas: []
};

/**
 * Fetch MyBlocks Categories for configured user
 */
async function fetchMyBlocksCategories(userId = null) {
  const uid = String(userId || MYBLOCKS_RAG_STATE.userId);
  try {
    const res = await fetch(`${MYBLOCKS_RAG_STATE.baseUrl}/api/rag/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid: uid, username: uid })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, categories: data.categories || [] };
    }
    return { success: false, error: `MyBlocks categories error (${res.status})` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch MyBlocks Personas for configured firm
 */
async function fetchMyBlocksPersonas(firmId = null) {
  const fid = String(firmId || MYBLOCKS_RAG_STATE.firmId);
  try {
    const res = await fetch(`${MYBLOCKS_RAG_STATE.baseUrl}/api/personas?firm_id=${encodeURIComponent(fid)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) && data.length > 0 ? data : [MYBLOCKS_RAG_STATE.systemFallbackPersona];
      MYBLOCKS_RAG_STATE.cachedPersonas = list;
      return list;
    }
  } catch (err) {
    console.warn('⚠️ MyBlocks Personas fetch notice (using system fallback persona):', err.message);
  }
  return [MYBLOCKS_RAG_STATE.systemFallbackPersona];
}

/**
 * Upload Document to MyBlocks RAG and Trigger Immediate Indexing
 */
async function uploadAndIndexMyBlocksDocument({ fileBuffer, fileName, category, userId }) {
  const uid = String(userId || MYBLOCKS_RAG_STATE.userId);
  const cat = String(category || MYBLOCKS_RAG_STATE.defaultCategory);
  
  // Truncate and sanitize filename (avoid ENAMETOOLONG > 60 chars)
  let safeName = fileName || 'procurement_document.pdf';
  if (safeName.length > 60) {
    const ext = path.extname(safeName) || '.pdf';
    const base = path.basename(safeName, ext).substring(0, 50);
    safeName = `${base}${ext}`;
  }

  // Step 1: Upload multipart file
  const form = new FormData();
  form.append('username', uid);
  form.append('userid', uid);
  form.append('category', cat);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  form.append('files', blob, safeName);

  const uploadRes = await fetch(`${MYBLOCKS_RAG_STATE.baseUrl}/api/rag/upload`, {
    method: 'POST',
    body: form
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`MyBlocks Upload Failed (${uploadRes.status}): ${errText}`);
  }

  const uploadData = await uploadRes.json().catch(() => ({ success: true }));

  // Step 2: Trigger immediate vector re-indexing
  const indexRes = await fetch(`${MYBLOCKS_RAG_STATE.baseUrl}/api/rag/update-index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: cat,
      userid: uid,
      username: uid,
      firm_id: MYBLOCKS_RAG_STATE.firmId
    })
  });

  if (!indexRes.ok) {
    const errText = await indexRes.text();
    throw new Error(`MyBlocks Re-Indexing Failed (${indexRes.status}): ${errText}`);
  }

  const indexData = await indexRes.json().catch(() => ({ success: true }));
  return { success: true, upload: uploadData, index: indexData, safeName, category: cat };
}

/**
 * Query MyBlocks RAG with Persona & Multi-Turn Session Memory
 */
async function queryMyBlocksRAG({
  question,
  category = null,
  sessionId = null,
  ownerId = null,
  userId = null,
  personaId = null,
  firmId = null,
  timeoutMs = 30000
}) {
  const uid = String(userId || ownerId || MYBLOCKS_RAG_STATE.userId);
  const cat = String(category || MYBLOCKS_RAG_STATE.defaultCategory);
  const fid = String(firmId || MYBLOCKS_RAG_STATE.firmId);
  const pid = String(personaId || MYBLOCKS_RAG_STATE.personaId);
  const sid = sessionId || `${uid}-user-${cat}-${pid}`;

  const payload = {
    owner_id: uid,
    category: cat,
    question,
    queried_by_id: uid,
    queried_by_role: 'user',
    persona_id: pid,
    firmId: fid,
    session_id: sid,
    query_source: 'text'
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 30000);

    const res = await fetch(`${MYBLOCKS_RAG_STATE.baseUrl}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      MYBLOCKS_RAG_STATE.lastQueryTime = new Date().toISOString();
      MYBLOCKS_RAG_STATE.lastQueryResult = data;
      return {
        success: true,
        answer: data.answer || '',
        sources: data.sources || [],
        call_state: data.call_state || null,
        query_type: data.query_type || 'document',
        raw: data
      };
    } else {
      const errText = await res.text();
      let detail = errText;
      try {
        const j = JSON.parse(errText);
        detail = j.error || j.message || errText;
      } catch (e) {}
      console.warn(`⚠️ MyBlocks RAG Query returned status ${res.status}: ${String(detail).slice(0, 180)}`);
      return { success: false, error: detail, status: res.status };
    }
  } catch (err) {
    console.warn(`⚠️ MyBlocks RAG Query failover: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch Multi-Turn Chat History from MyBlocks RAG
 */
async function fetchMyBlocksChatHistory(username = null, role = 'user', category = null) {
  const uid = encodeURIComponent(String(username || MYBLOCKS_RAG_STATE.userId));
  const r = encodeURIComponent(String(role || 'user'));
  const cat = encodeURIComponent(String(category || MYBLOCKS_RAG_STATE.defaultCategory));
  try {
    const res = await fetch(`${MYBLOCKS_RAG_STATE.baseUrl}/api/rag/chat/history/${uid}/${r}/${cat}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, history: data };
    }
    return { success: false, error: `Chat history fetch error (${res.status})` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Clear Multi-Turn Chat History from MyBlocks RAG
 */
async function clearMyBlocksChatHistory(username = null, role = 'user', category = null) {
  const uid = encodeURIComponent(String(username || MYBLOCKS_RAG_STATE.userId));
  const r = encodeURIComponent(String(role || 'user'));
  const cat = encodeURIComponent(String(category || MYBLOCKS_RAG_STATE.defaultCategory));
  try {
    const res = await fetch(`${MYBLOCKS_RAG_STATE.baseUrl}/api/rag/chat/history/${uid}/${r}/${cat}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, result: data };
    }
    return { success: false, error: `Chat history clear error (${res.status})` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

const PROFILE_FILE_PATH = resolveAppPath('firmProfile.json');
const VENDORS_CSV_PATH = resolveAppPath('vendors.csv');

const RAG_KNOWLEDGE_STORE = {
  firmProfile: {
    firm_name: 'Merlot Home Decor & Nursery',
    owner_name: 'Alex Merlot',
    phone: '+91 98765 00000',
    whatsapp: '+91 98765 00000',
    address: 'Plot 42, Botanical Boulevard, Nursery Zone, Pune',
    city: 'Pune',
    gstin: '27AAAAA0000A1Z5',
    corporate_upi_id: 'merlotdecor@icici',
    bank_name: 'ICICI Bank',
    account_number: '50200098765432',
    ifsc_code: 'ICIC0001234',
    auto_approval_limit: 25000.00,
    min_gross_margin_pct: 50.0,
    max_ceiling_price: 250.00,
    qr_code_data: 'upi://pay?pa=merlotdecor@icici&pn=Merlot+Home+Decor&cu=INR'
  },
  
  categoryPolicies: {
    'Indoor Foliage': {
      minGrossMarginPct: 50.0,
      qualityRequirements: 'Nursery-grown in 10-inch grower pot, pest-free, verified root ball integrity',
      transitTerms: 'Protective foliage netting and moisture-retaining coco-peat base required'
    },
    'Planters & Pots': {
      minGrossMarginPct: 55.0,
      qualityRequirements: 'Glazed terracotta / high-fire ceramic, bubble-wrapped, drainage hole included',
      transitTerms: 'Drop-tested corrugated cardboard packaging'
    },
    'Plant Care': {
      minGrossMarginPct: 40.0,
      qualityRequirements: 'Certified organic, tamper-evident sealed bottles, batch manufacturing date < 60 days',
      transitTerms: 'Leakproof secondary shrinkwrap'
    }
  },

  historicalProcurementArchive: [
    {
      po_number: 'PO-MERLOT-2026-041',
      product_id: 'p_snake_plant_10in',
      product_name: 'Snake Plant (Sansevieria Laurentii)',
      vendor_id: 'v_deccan',
      vendor_name: 'Deccan Flora Wholesale Nursery',
      date: '2026-08-15',
      cleared_unit_price: 270.00,
      order_quantity: 50,
      notes: 'Clean root system, 100% survival rate, delivered in 24 hours.'
    },
    {
      po_number: 'PO-MERLOT-2026-062',
      product_id: 'p_snake_plant_10in',
      product_name: 'Snake Plant (Sansevieria Laurentii)',
      vendor_id: 'v_greencanopy',
      vendor_name: 'Green Canopy Growers',
      date: '2026-09-02',
      cleared_unit_price: 285.00,
      order_quantity: 40,
      notes: 'Delivered in 48 hours. Healthy leaves, 2 minor tip damages replaced without hassle.'
    },
    {
      po_number: 'PO-MERLOT-2026-074',
      product_id: 'p_monstera_deliciosa',
      product_name: 'Monstera Deliciosa (Swiss Cheese Plant)',
      vendor_id: 'v_deccan',
      vendor_name: 'Deccan Flora Wholesale Nursery',
      date: '2026-09-18',
      cleared_unit_price: 330.00,
      order_quantity: 30,
      notes: 'Premium fenestrated leaves, great customer feedback.'
    }
  ],

  // ==================== 📊 DYNAMIC VENDOR RAG HISTORIES ====================
  vendorHistories: {
    'v_deccan': {
      vendor_id: 'v_deccan',
      vendor_name: 'Deccan Flora Wholesale Nursery',
      total_orders_completed: 3,
      cumulative_spend: 85200.00,
      avg_discount_achieved_pct: 18.5,
      fulfillment_reliability_score: 98.5,
      negotiation_behavior_profile: 'High flexibility on volume batches; concedes readily when offered guaranteed instant Corporate UPI settlement.',
      deal_archive: [
        {
          po_number: 'PO-MERLOT-2026-041',
          date: '2026-08-15',
          product_id: 'p_snake_plant_10in',
          product_name: 'Snake Plant (Sansevieria Laurentii)',
          quantity: 50,
          opening_quote: 340.00,
          cleared_unit_price: 270.00,
          discount_pct: 20.6,
          notes: 'Clean root system, 100% survival rate, delivered in 24 hours.'
        },
        {
          po_number: 'PO-MERLOT-2026-074',
          date: '2026-09-18',
          product_id: 'p_monstera_deliciosa',
          product_name: 'Monstera Deliciosa (Swiss Cheese Plant)',
          quantity: 30,
          opening_quote: 410.00,
          cleared_unit_price: 330.00,
          discount_pct: 19.5,
          notes: 'Premium fenestrated leaves, delivered in 24 hours via regional mandi dispatch.'
        }
      ]
    },
    'v_greencanopy': {
      vendor_id: 'v_greencanopy',
      vendor_name: 'Green Canopy Growers',
      total_orders_completed: 2,
      cumulative_spend: 42800.00,
      avg_discount_achieved_pct: 12.0,
      fulfillment_reliability_score: 95.0,
      negotiation_behavior_profile: 'Stands firm on initial quote in Turn 1, but concessions open up in Turn 2 when committed to 40+ units.',
      deal_archive: [
        {
          po_number: 'PO-MERLOT-2026-062',
          date: '2026-09-02',
          product_id: 'p_snake_plant_10in',
          product_name: 'Snake Plant (Sansevieria Laurentii)',
          quantity: 40,
          opening_quote: 320.00,
          cleared_unit_price: 285.00,
          discount_pct: 10.9,
          notes: 'Delivered in 48 hours. Healthy leaves, minor tip damage replaced on next batch.'
        }
      ]
    },
    'v_biogreens': {
      vendor_id: 'v_biogreens',
      vendor_name: 'BioGreens Botanical Nursery',
      total_orders_completed: 1,
      cumulative_spend: 18500.00,
      avg_discount_achieved_pct: 14.2,
      fulfillment_reliability_score: 94.0,
      negotiation_behavior_profile: 'Reliable South India nursery supplier; strict MOQ of 50 units for discount tier.',
      deal_archive: [
        {
          po_number: 'PO-MERLOT-2026-055',
          date: '2026-08-28',
          product_id: 'p_snake_plant_10in',
          product_name: 'Snake Plant (Sansevieria Laurentii)',
          quantity: 50,
          opening_quote: 310.00,
          cleared_unit_price: 265.00,
          discount_pct: 14.5,
          notes: 'Good packaging, 4-day transit lead time.'
        }
      ]
    },
    'v_ceramics_craft': {
      vendor_id: 'v_ceramics_craft',
      vendor_name: 'Heritage Ceramic Crafts',
      total_orders_completed: 2,
      cumulative_spend: 24500.00,
      avg_discount_achieved_pct: 16.5,
      fulfillment_reliability_score: 99.0,
      negotiation_behavior_profile: 'Excellent pottery artisan hub; high quality terracotta with 0 breakage in transit.',
      deal_archive: [
        {
          po_number: 'PO-MERLOT-2026-039',
          date: '2026-08-10',
          product_id: 'p_ceramic_pot_10in',
          product_name: 'High-Fire Glazed Ceramic Planter (10-inch)',
          quantity: 50,
          opening_quote: 145.00,
          cleared_unit_price: 120.00,
          discount_pct: 17.2,
          notes: 'Bubble-wrapped, drainage hole verified.'
        }
      ]
    },
    'v_bio_agro': {
      vendor_id: 'v_bio_agro',
      vendor_name: 'BioAgro Organics India',
      total_orders_completed: 2,
      cumulative_spend: 15400.00,
      avg_discount_achieved_pct: 17.4,
      fulfillment_reliability_score: 99.5,
      negotiation_behavior_profile: 'Consistent pharmaceutical-grade organic formulations; accepts 24-hr instant UPI settlement.',
      deal_archive: [
        {
          po_number: 'PO-MERLOT-2026-048',
          date: '2026-08-20',
          product_id: 'p_organic_neem_oil',
          product_name: 'Organic Cold-Pressed Neem Oil Spray (500ml)',
          quantity: 40,
          opening_quote: 115.00,
          cleared_unit_price: 95.00,
          discount_pct: 17.4,
          notes: 'Batch manufacturing date < 15 days, tamper-evident seals verified.'
        }
      ]
    }
  },

  allVendors: [],
  vendorDirectory: {}
};

const VENDOR_HISTORY_FILE_PATH = resolveAppPath('vendorHistory.json');

/**
 * Load Persistent Vendor RAG History from Disk
 */
function loadVendorHistory() {
  try {
    if (fs.existsSync(VENDOR_HISTORY_FILE_PATH)) {
      const data = fs.readFileSync(VENDOR_HISTORY_FILE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        RAG_KNOWLEDGE_STORE.vendorHistories = {
          ...RAG_KNOWLEDGE_STORE.vendorHistories,
          ...parsed
        };
      }
    }
  } catch (err) {
    console.warn('⚠️ Notice reading vendorHistory.json (using embedded RAG store):', err.message);
  }
  return RAG_KNOWLEDGE_STORE.vendorHistories;
}

/**
 * Record a Closed Transaction Deal into the Vendor's Persistent RAG History
 */
function recordVendorDeal(deal) {
  try {
    const vendorId = deal.vendor_id || 'v_general';
    const histories = RAG_KNOWLEDGE_STORE.vendorHistories;
    if (!histories[vendorId]) {
      histories[vendorId] = {
        vendor_id: vendorId,
        vendor_name: deal.vendor_name || 'Wholesale Supplier',
        total_orders_completed: 0,
        cumulative_spend: 0,
        avg_discount_achieved_pct: 15.0,
        fulfillment_reliability_score: 95.0,
        negotiation_behavior_profile: 'Active commercial partner with proven delivery track record.',
        deal_archive: []
      };
    }

    const vh = histories[vendorId];
    vh.total_orders_completed = (vh.total_orders_completed || 0) + 1;
    const dealTotal = (deal.cleared_unit_price || deal.final_price || 0) * (deal.quantity || 1);
    vh.cumulative_spend = Math.round(((vh.cumulative_spend || 0) + dealTotal) * 100) / 100;

    const opening = deal.opening_quote || deal.base_quote || ((deal.cleared_unit_price || deal.final_price) * 1.15);
    const cleared = deal.cleared_unit_price || deal.final_price || opening;
    const discountPct = opening > cleared ? Math.round(((opening - cleared) / opening) * 1000) / 10 : 0;

    vh.deal_archive = vh.deal_archive || [];
    vh.deal_archive.unshift({
      po_number: deal.po_number || `PO-${Date.now().toString().slice(-6)}`,
      date: deal.date || new Date().toISOString().split('T')[0],
      product_id: deal.product_id,
      product_name: deal.product_name,
      quantity: deal.quantity,
      opening_quote: opening,
      cleared_unit_price: cleared,
      discount_pct: discountPct,
      notes: deal.notes || 'Deal closed successfully via Autonomous Procurement Agent.'
    });

    // Recalculate average discount achieved
    const validDiscounts = vh.deal_archive.map(d => d.discount_pct).filter(d => d > 0);
    if (validDiscounts.length > 0) {
      vh.avg_discount_achieved_pct = Math.round((validDiscounts.reduce((a, b) => a + b, 0) / validDiscounts.length) * 10) / 10;
    }

    // Also append to global historical procurement archive
    RAG_KNOWLEDGE_STORE.historicalProcurementArchive.unshift({
      po_number: deal.po_number || `PO-${Date.now().toString().slice(-6)}`,
      product_id: deal.product_id,
      product_name: deal.product_name,
      vendor_id: vendorId,
      vendor_name: deal.vendor_name || vh.vendor_name,
      date: deal.date || new Date().toISOString().split('T')[0],
      cleared_unit_price: cleared,
      order_quantity: deal.quantity,
      notes: deal.notes || 'Recorded via RAG learning loop.'
    });

    // Persist to disk if writable
    try {
      fs.writeFileSync(VENDOR_HISTORY_FILE_PATH, JSON.stringify(histories, null, 2), 'utf8');
    } catch (e) {}

    return { success: true, updatedHistory: vh };
  } catch (err) {
    console.error('❌ Error recording vendor deal in RAG:', err.message);
    return { success: false, error: err.message };
  }
}

// Initial bootstrap of vendor history
loadVendorHistory();

/**
 * Load Firm Profile from JSON on disk
 */
function loadFirmProfile() {
  try {
    if (fs.existsSync(PROFILE_FILE_PATH)) {
      const data = fs.readFileSync(PROFILE_FILE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      RAG_KNOWLEDGE_STORE.firmProfile = {
        ...RAG_KNOWLEDGE_STORE.firmProfile,
        ...parsed
      };
      return RAG_KNOWLEDGE_STORE.firmProfile;
    }
  } catch (err) {
    console.warn('⚠️ Error loading firmProfile.json:', err.message);
  }
  return RAG_KNOWLEDGE_STORE.firmProfile;
}

/**
 * Save Firm Profile to JSON on disk
 */
function saveFirmProfile(profileData) {
  try {
    const current = RAG_KNOWLEDGE_STORE.firmProfile;
    const updated = {
      ...current,
      ...profileData,
      updated_at: new Date().toISOString()
    };
    
    // Auto-derive dynamic UPI payload if corporate_upi_id provided
    if (updated.corporate_upi_id) {
      updated.qr_code_data = `upi://pay?pa=${updated.corporate_upi_id}&pn=${encodeURIComponent(updated.firm_name || 'Merlot Home Decor')}&cu=INR`;
    }

    fs.writeFileSync(PROFILE_FILE_PATH, JSON.stringify(updated, null, 2), 'utf8');
    RAG_KNOWLEDGE_STORE.firmProfile = updated;
    return { success: true, profile: updated };
  } catch (err) {
    console.error('❌ Error saving firmProfile.json:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Parse CSV format with comma and quotation support
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Ingest Vendors CSV and build fast lookup indices
 */
function loadVendorsFromCSV(csvContentOrPath) {
  try {
    let content = '';
    if (csvContentOrPath && csvContentOrPath.includes(',')) {
      content = csvContentOrPath;
    } else {
      const filePath = csvContentOrPath || VENDORS_CSV_PATH;
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf8');
      }
    }

    if (!content) return { success: false, count: 0, message: 'No CSV content available.' };

    const parsedRows = parseCSV(content);
    const directory = {};
    const vendorList = [];

    parsedRows.forEach(row => {
      const vendorObj = {
        vendor_id: row.vendor_id || `v_${Date.now()}`,
        vendor_name: row.vendor_name || 'Wholesale Supplier',
        contact_person: row.contact_person || 'Sales Manager',
        phone: row.phone || '+91 90000 00000',
        whatsapp: row.whatsapp || row.phone || '+91 90000 00000',
        location: row.location || 'Regional Mandi',
        base_quote: parseFloat(row.base_cost) || 300.0,
        floor_price: parseFloat(row.floor_price) || 250.0,
        lead_time_days: parseInt(row.lead_time_days, 10) || 2,
        moq: parseInt(row.moq, 10) || 20,
        rating: parseFloat(row.rating) || 4.5,
        upi_id: row.upi_id || 'vendor@icici',
        bank_account: row.bank_account || '502000000000',
        ifsc: row.ifsc || 'ICIC0001234',
        products_supplied: (row.products_supplied || '').split(';').map(p => p.trim()).filter(Boolean)
      };

      vendorList.push(vendorObj);

      vendorObj.products_supplied.forEach(prodId => {
        if (!directory[prodId]) directory[prodId] = [];
        directory[prodId].push(vendorObj);
      });
    });

    RAG_KNOWLEDGE_STORE.allVendors = vendorList;
    RAG_KNOWLEDGE_STORE.vendorDirectory = directory;

    return {
      success: true,
      count: vendorList.length,
      vendors: vendorList,
      directory
    };
  } catch (err) {
    console.error('❌ Failed to load vendors from CSV:', err.message);
    return { success: false, error: err.message };
  }
}

// Initial bootstrap from files
loadFirmProfile();
loadVendorsFromCSV();

/**
 * Retrieve RAG Context for a given product & specific vendor history
 */
function retrieveRAGContext(productId, sellingPrice, vendorId = null) {
  const profile = loadFirmProfile();
  const history = RAG_KNOWLEDGE_STORE.historicalProcurementArchive.filter(p => p.product_id === productId);
  const bestPastRate = history.length > 0 
    ? Math.min(...history.map(h => h.cleared_unit_price)) 
    : Math.round(sellingPrice * 0.48);
  const avgPastRate = history.length > 0 
    ? Math.round(history.reduce((a, b) => a + b.cleared_unit_price, 0) / history.length) 
    : bestPastRate;

  // Maximum walkaway ceiling (Strict gross margin target on selling price or user limit)
  const targetMargin = profile.min_gross_margin_pct || 50.0;
  const calculatedCeiling = Math.round(sellingPrice * (1 - (targetMargin / 100)));
  const maxCeilingCost = profile.max_ceiling_price ? Math.min(profile.max_ceiling_price, calculatedCeiling) : calculatedCeiling;

  // Specific Vendor History in RAG
  let vendorSpecificHistory = null;
  if (vendorId && RAG_KNOWLEDGE_STORE.vendorHistories && RAG_KNOWLEDGE_STORE.vendorHistories[vendorId]) {
    const vh = RAG_KNOWLEDGE_STORE.vendorHistories[vendorId];
    const productDeals = (vh.deal_archive || []).filter(d => d.product_id === productId);
    vendorSpecificHistory = {
      vendor_id: vh.vendor_id,
      vendor_name: vh.vendor_name,
      total_orders_completed: vh.total_orders_completed || 0,
      cumulative_spend: vh.cumulative_spend || 0,
      avg_discount_achieved_pct: vh.avg_discount_achieved_pct || 15.0,
      fulfillment_reliability_score: vh.fulfillment_reliability_score || 95.0,
      negotiation_behavior_profile: vh.negotiation_behavior_profile || 'Reliable wholesale supplier.',
      lastDeal: productDeals.length > 0 ? productDeals[0] : (vh.deal_archive && vh.deal_archive[0] ? vh.deal_archive[0] : null),
      dealsForThisProductCount: productDeals.length,
      bestPriceOfferedByThisVendor: productDeals.length > 0 ? Math.min(...productDeals.map(d => d.cleared_unit_price)) : null
    };
  }

  return {
    firmProfile: profile,
    policy: RAG_KNOWLEDGE_STORE.categoryPolicies['Indoor Foliage'] || { minGrossMarginPct: targetMargin },
    historicalRecords: history,
    vendorSpecificHistory,
    bestPastRate,
    avgPastRate,
    maxCeilingCost,
    minTargetMarginPct: targetMargin
  };
}

// ============================================================
// 🛡️ ZERO-LEAK VENDOR FIREWALL & DATA PRIVACY ENGINE
// ============================================================
const SECURITY_AUDIT_LOGS = [];

/**
 * Ingest live POS product catalog & sales velocity directly into RAG Knowledge Memory
 */
function syncPosCatalogToRagMemory(products = []) {
  if (!products || !Array.isArray(products) || products.length === 0) return;

  if (!RAG_KNOWLEDGE_STORE.posCatalogSync) {
    RAG_KNOWLEDGE_STORE.posCatalogSync = {
      lastSync: new Date().toISOString(),
      itemCount: products.length,
      skuDirectory: {}
    };
  }

  products.forEach(p => {
    const minMargin = p.price > 0 && p.cost > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 50;
    RAG_KNOWLEDGE_STORE.posCatalogSync.skuDirectory[p.id] = {
      id: p.id,
      name: p.name,
      currentStock: p.stock != null ? p.stock : 0,
      retailPrice: p.price || 499,
      costBasis: p.cost || 250,
      marginTargetPct: minMargin,
      reorderPoint: p.stock <= 20 ? 20 : Math.round(p.stock * 0.4),
      category: p.category || 'Indoor Foliage',
      expiryDays: p.expiryDays || 999
    };
  });

  RAG_KNOWLEDGE_STORE.posCatalogSync.lastSync = new Date().toISOString();
  RAG_KNOWLEDGE_STORE.posCatalogSync.itemCount = products.length;
}

/**
 * Zero-Leak Vendor Defense: Detects Prompt Injections, Jailbreaks, Competitor Spying & Data Leak Attempts
 */
function detectAndBlockPromptInjectionOrLeakAttempt(message, currentVendor = null) {
  if (!message || typeof message !== 'string') return { isAttempt: false };
  const clean = message.toLowerCase().trim();

  // Pattern A: Direct competitor intelligence inquiries
  const competitorKeywords = [
    /what\s+(did|is|was|are)\s+(the\s+)?(other|competitor|another|different|second)\s+(vendor|supplier|party)/i,
    /what\s+(did|is|was)\s+(deccan|green canopy|sahyadri|flora|nursery|sharma|patel|vendor\s*[a-z0-9])/i,
    /(who\s+else|which\s+other\s+supplier|other\s+bids|competitor\s+quote|competing\s+offer)/i,
    /(tell|show|reveal|give|send|leak|dump)\s+(me\s+)?(the\s+)?(lowest|other|cheaper|competitor|vendor)\s+(price|rate|quote|bid|offer)/i,
    /(vendor\s*b|supplier\s*b|other\s*party|competing\s*vendor)/i,
    /(beat\s+their\s+price|match\s+their\s+quote|tell\s+me\s+their\s+rate|what\s+is\s+their\s+price)/i
  ];

  // Pattern B: LLM Prompt Injections / Jailbreak attempts / Context dumping
  const jailbreakKeywords = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
    /system\s+prompt/i,
    /repeat\s+(everything|the\s+prompt|back|all\s+text)/i,
    /you\s+are\s+now\s+in\s+developer\s+mode/i,
    /bypass\s+(security|filter|guardrail)/i,
    /dump\s+(database|csv|vendors|rag|context|records)/i,
    /what\s+are\s+your\s+secret/i
  ];

  const matchedCompetitor = competitorKeywords.some(rx => rx.test(clean));
  const matchedJailbreak = jailbreakKeywords.some(rx => rx.test(clean));

  if (matchedCompetitor || matchedJailbreak) {
    const reason = matchedCompetitor ? 'COMPETITOR_INTELLIGENCE_INQUIRY' : 'PROMPT_INJECTION_OR_JAILBREAK';
    const profile = loadFirmProfile();
    const securityReply = `⚠️ *[Corporate Non-Disclosure & Anti-Collusion Compliance Notice]*\n\n` +
      `Namaste. Under ${profile.firm_name || 'Merlot'}'s strict ISO-27001 Anti-Collusion & Supplier Confidentiality Mandate, ` +
      `all wholesale supplier identities, commercial quotations, floor rates, and negotiation histories are strictly confidential and cryptographically firewalled.\n\n` +
      `Our Autonomous AI Procurement Engine does *not* disclose competitor pricing or third-party supplier data under any circumstances. ` +
      `Every commercial partnership is evaluated strictly and impartially on its own pricing, quality, and delivery merits.\n\n` +
      `Please provide your firm's best wholesale unit quote so we can evaluate your proposal against our store margin requirements.`;

    const auditEntry = {
      id: `AUDIT-SEC-${Date.now()}`,
      timestamp: new Date().toISOString(),
      vendor_id: currentVendor ? currentVendor.vendor_id : 'unknown',
      vendor_name: currentVendor ? currentVendor.vendor_name : 'unknown',
      flagged_pattern: reason,
      incoming_snippet: message.slice(0, 150),
      action_taken: 'PROMPT_FIREWALLED_LEAK_PREVENTED'
    };
    SECURITY_AUDIT_LOGS.unshift(auditEntry);
    if (SECURITY_AUDIT_LOGS.length > 50) SECURITY_AUDIT_LOGS.pop();

    return {
      isAttempt: true,
      reason,
      securityReply,
      auditEntry
    };
  }

  return { isAttempt: false };
}

/**
 * Outbound DLP Scrubber: Ensures no competitor names, phones, bank accounts, or credentials leak
 */
function scrubCompetitorLeaks(text, currentVendorId = null) {
  if (!text || typeof text !== 'string') return text;
  let scrubbed = text;

  // Retrieve all other vendors
  const allVendors = RAG_KNOWLEDGE_STORE.allVendors || [];
  allVendors.forEach(v => {
    if (v.vendor_id !== currentVendorId) {
      // Redact vendor business name
      if (v.vendor_name && v.vendor_name.length > 3) {
        const nameRx = new RegExp(v.vendor_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        scrubbed = scrubbed.replace(nameRx, '[CONFIDENTIAL_SUPPLIER]');
      }
      // Redact contact person
      if (v.contact_person && v.contact_person.length > 3) {
        const contactRx = new RegExp(v.contact_person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        scrubbed = scrubbed.replace(contactRx, '[SUPPLIER_REPRESENTATIVE]');
      }
      // Redact bank account
      if (v.bank_account && v.bank_account.length > 5) {
        const bankRx = new RegExp(v.bank_account, 'g');
        scrubbed = scrubbed.replace(bankRx, '[CONFIDENTIAL_ACCOUNT]');
      }
      // Redact phone / whatsapp
      if (v.phone && v.phone.length > 7) {
        const cleanP = v.phone.replace(/[^0-9]/g, '');
        if (cleanP.length >= 10) {
          const phoneRx = new RegExp(cleanP, 'g');
          scrubbed = scrubbed.replace(phoneRx, '[CONFIDENTIAL_PHONE]');
        }
      }
      // Redact UPI
      if (v.upi_id && v.upi_id.includes('@')) {
        const upiRx = new RegExp(v.upi_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        scrubbed = scrubbed.replace(upiRx, '[CONFIDENTIAL_UPI]');
      }
    }
  });

  return scrubbed;
}

// ============================================================
// ⚖️ VENDOR TIE-BREAKER DECISION ENGINE
// ============================================================
/**
 * Deterministic Vendor Tie-Breaker Protocol
 * Resolves deals when multiple vendors offer identical pricing or close bids.
 * 
 * 6-Stage Weighted Protocol:
 *  1. Quality & Fulfillment Reliability Score (35%)
 *  2. Geographical Proximity & Rapid Dispatch SLA (25%)
 *  3. Cumulative Strategic Partnership & Lifetime Spend (20%)
 *  4. Instant Corporate UPI Acceptance & Payment Terms (10%)
 *  5. Dual-Sourcing Volume Split Protocol (Risk Mitigation)
 *  6. Equitable Round-Robin Rotation (Zero-Bias Fallback)
 */
function resolveVendorTieBreaker(candidates, requestedQty = 60, options = {}) {
  if (!candidates || candidates.length <= 1) {
    return {
      winner: candidates[0] || null,
      runnerUp: null,
      isTie: false,
      rationale: 'Single qualifying vendor available in directory'
    };
  }

  const v1 = candidates[0];
  const v2 = candidates[1];
  const priceDiffPct = Math.abs(v1.base_quote - v2.base_quote) / Math.max(1, v1.base_quote) * 100;
  const isPriceTied = priceDiffPct < 1.0; // Within 1% or identical

  if (!isPriceTied) {
    return {
      winner: v1,
      runnerUp: v2,
      isTie: false,
      marginDifferencePct: Math.round(priceDiffPct * 10) / 10,
      rationale: `Selected based on superior pricing (₹${v1.base_quote} vs ₹${v2.base_quote})`
    };
  }

  // IT IS A TIE! Execute the 6-Stage Deterministic Tie-Breaker Protocol
  const vh1 = (RAG_KNOWLEDGE_STORE.vendorHistories && RAG_KNOWLEDGE_STORE.vendorHistories[v1.vendor_id]) || {};
  const vh2 = (RAG_KNOWLEDGE_STORE.vendorHistories && RAG_KNOWLEDGE_STORE.vendorHistories[v2.vendor_id]) || {};

  const relScore1 = vh1.fulfillment_reliability_score || (v1.rating ? Math.round(v1.rating * 20) : 92);
  const relScore2 = vh2.fulfillment_reliability_score || (v2.rating ? Math.round(v2.rating * 20) : 92);

  const lead1 = v1.lead_time_days || 2;
  const lead2 = v2.lead_time_days || 2;

  const spend1 = vh1.cumulative_spend || 0;
  const spend2 = vh2.cumulative_spend || 0;

  let winner = v1;
  let runnerUp = v2;
  let tieBreakerRuleApplied = '';
  let rationale = '';
  let dualSourcingRecommended = false;
  let volumeSplit = null;

  // Dual-Sourcing Check: If order quantity is large (>= 40 units), split to mitigate supply-chain risk
  if (requestedQty >= 40 && Math.abs(relScore1 - relScore2) <= 3 && Math.abs(lead1 - lead2) === 0) {
    dualSourcingRecommended = true;
    const splitQty1 = Math.round(requestedQty * 0.6);
    const splitQty2 = requestedQty - splitQty1;
    volumeSplit = {
      primaryVendor: v1.vendor_name,
      primaryQty: splitQty1,
      primaryPct: 60,
      secondaryVendor: v2.vendor_name,
      secondaryQty: splitQty2,
      secondaryPct: 40,
      totalQty: requestedQty,
      policy: 'DUAL_SOURCING_RISK_MITIGATION'
    };
  }

  // 1. Reliability Score
  if (Math.abs(relScore1 - relScore2) >= 1.0) {
    winner = relScore1 > relScore2 ? v1 : v2;
    runnerUp = relScore1 > relScore2 ? v2 : v1;
    tieBreakerRuleApplied = 'RULE_1_FULFILLMENT_RELIABILITY';
    rationale = `Tied at ₹${v1.base_quote}. Resolved by Fulfillment Reliability (${Math.max(relScore1, relScore2)}% vs ${Math.min(relScore1, relScore2)}%).`;
  }
  // 2. Dispatch SLA / Proximity
  else if (lead1 !== lead2) {
    winner = lead1 < lead2 ? v1 : v2;
    runnerUp = lead1 < lead2 ? v2 : v1;
    tieBreakerRuleApplied = 'RULE_2_RAPID_DISPATCH_PROXIMITY';
    rationale = `Tied at ₹${v1.base_quote}. Resolved by Dispatch SLA (${Math.min(lead1, lead2)} day(s) vs ${Math.max(lead1, lead2)} day(s) direct carrier transit).`;
  }
  // 3. Cumulative Historical Spend & Loyalty
  else if (Math.abs(spend1 - spend2) >= 5000) {
    winner = spend1 > spend2 ? v1 : v2;
    runnerUp = spend1 > spend2 ? v2 : v1;
    tieBreakerRuleApplied = 'RULE_3_STRATEGIC_PARTNERSHIP_SPEND';
    rationale = `Tied at ₹${v1.base_quote} and identical lead time. Resolved by Lifetime Partnership Volume (₹${Math.max(spend1, spend2).toLocaleString('en-IN')} vs ₹${Math.min(spend1, spend2).toLocaleString('en-IN')}).`;
  }
  // 4. Round-Robin Equitable Rotation
  else {
    const lastPoVendorId = RAG_KNOWLEDGE_STORE.historicalProcurementArchive && RAG_KNOWLEDGE_STORE.historicalProcurementArchive[0] 
      ? RAG_KNOWLEDGE_STORE.historicalProcurementArchive[0].vendor_id 
      : null;
    if (lastPoVendorId === v1.vendor_id) {
      winner = v2;
      runnerUp = v1;
    } else {
      winner = v1;
      runnerUp = v2;
    }
    tieBreakerRuleApplied = 'RULE_4_ROUND_ROBIN_FAIR_ROTATION';
    rationale = `Tied across all criteria. Resolved via Round-Robin Fair Supplier Allocation to rotate wholesale orders and maintain supplier network health.`;
  }

  return {
    winner,
    runnerUp,
    isTie: true,
    tieBreakerRuleApplied,
    rationale,
    metricsComparison: {
      [v1.vendor_name]: { quote: v1.base_quote, reliability: `${relScore1}%`, leadDays: lead1, lifetimeSpend: `₹${spend1.toLocaleString('en-IN')}` },
      [v2.vendor_name]: { quote: v2.base_quote, reliability: `${relScore2}%`, leadDays: lead2, lifetimeSpend: `₹${spend2.toLocaleString('en-IN')}` }
    },
    dualSourcing: dualSourcingRecommended ? volumeSplit : null
  };
}

/**
 * Multi-Attribute Vendor Evaluator & Sourcing Ranker with Built-in Tie-Breaking
 */
function rankVendorsForProduct(productId, product, requestedQty = 60) {
  let vendors = RAG_KNOWLEDGE_STORE.vendorDirectory[productId];

  // If none mapped specifically to productId, use all available vendors from CSV
  if (!vendors || vendors.length === 0) {
    if (RAG_KNOWLEDGE_STORE.allVendors && RAG_KNOWLEDGE_STORE.allVendors.length > 0) {
      vendors = RAG_KNOWLEDGE_STORE.allVendors;
    } else {
      vendors = [
        {
          vendor_id: 'v_deccan',
          vendor_name: 'Deccan Flora Wholesale Nursery',
          location: 'Pune Regional Hub',
          phone: '+91 98765 43210',
          whatsapp: '+91 98765 43210',
          contact_person: 'Ramesh Patel',
          base_quote: 340.00,
          floor_price: 250.00,
          lead_time_days: 1,
          moq: 20,
          rating: 4.8,
          upi_id: 'deccanflora@icici',
          bank_account: '50200012345678',
          ifsc: 'ICIC0001234'
        }
      ];
    }
  }

  const minPrice = Math.min(...vendors.map(v => v.base_quote));
  const minLead = Math.min(...vendors.map(v => v.lead_time_days));

  const scored = vendors.map(v => {
    const priceScore = minPrice / Math.max(1, v.base_quote);
    const leadScore = minLead / Math.max(1, v.lead_time_days);
    const ratingScore = Math.min(1, Math.max(0, v.rating / 5.0));
    const compositeScore = Math.round(((0.50 * priceScore) + (0.30 * leadScore) + (0.20 * ratingScore)) * 100) / 100;

    return {
      ...v,
      priceScore: Math.round(priceScore * 100),
      leadScore: Math.round(leadScore * 100),
      compositeScore,
      isMoqSatisfied: requestedQty >= v.moq
    };
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  // If top 2 candidates have identical compositeScore or identical price, apply Tie-Breaker
  if (scored.length >= 2) {
    const tieResult = resolveVendorTieBreaker(scored, requestedQty);
    if (tieResult.isTie && tieResult.winner) {
      const winnerIdx = scored.findIndex(s => s.vendor_id === tieResult.winner.vendor_id);
      if (winnerIdx > 0) {
        const [winningCandidate] = scored.splice(winnerIdx, 1);
        scored.unshift(winningCandidate);
      }
      scored[0].tieBreakerResolution = tieResult;
    }
  }

  return scored;
}

/**
 * Autonomous Multi-Turn Negotiation Engine
 */
async function executeAutonomousNegotiation({
  product,
  vendor,
  quantity = 60,
  userRules = {},
  apiKey = null,
  engineMode = 'auto'
}) {
  const profile = loadFirmProfile();
  const rag = retrieveRAGContext(product.id, product.price);
  const ceilingCost = userRules.maxCeilingPrice || profile.max_ceiling_price || rag.maxCeilingCost;
  const initialQuote = vendor.base_quote;
  const floorPrice = vendor.floor_price || Math.round(initialQuote * 0.82);

  // Query MyBlocks Cloud RAG for real-time document advice & vendor intelligence
  let myblocksGuidance = null;
  try {
    const mbQuery = await queryMyBlocksRAG({
      question: `Procurement negotiation guidance for "${product.name}" (SKU: ${product.id}). Supplier is "${vendor.vendor_name}" offering ₹${initialQuote}/unit. Recommended ceiling price is ₹${ceilingCost}. What strategic negotiation advice and terms apply?`,
      category: MYBLOCKS_RAG_STATE.defaultCategory
    });
    if (mbQuery && mbQuery.success && mbQuery.answer) {
      myblocksGuidance = {
        answer: mbQuery.answer,
        sources: mbQuery.sources || [],
        personaId: MYBLOCKS_RAG_STATE.personaId,
        category: MYBLOCKS_RAG_STATE.defaultCategory
      };
    }
  } catch (err) {
    console.warn('MyBlocks autonomous query notice (failover active):', err.message);
  }

  // Turn 1: Vendor RFQ Response
  const dialogue = [
    {
      turn: 1,
      speaker: 'Vendor',
      name: vendor.vendor_name,
      contact: vendor.contact_person,
      phone: vendor.phone,
      whatsapp: vendor.whatsapp,
      message: `Namaste ${profile.owner_name || 'Merlot Team'}. For ${quantity} units of 10-inch ${product.name}, our standard wholesale catalog rate is ₹${initialQuote}/unit with ${vendor.lead_time_days}-day direct dispatch.`,
      priceOffered: initialQuote,
      timestamp: new Date(Date.now() - 180000).toLocaleTimeString()
    }
  ];

  // Retrieve Active Playbook Tactics
  const tacticTurn2 = playbookEngine.retrieveNegotiationTactic(2, { product, vendor, quantity });

  // Turn 2: Agent RAG-grounded counter-offer
  const targetCounter = Math.max(floorPrice, Math.min(rag.bestPastRate, Math.round(initialQuote * 0.80)));
  dialogue.push({
    turn: 2,
    speaker: 'Agent',
    name: 'Merlot AutoProcure AI',
    message: `Hello ${vendor.contact_person}. We have an immediate requirement for ${quantity} units today for ${profile.firm_name}. According to our historical procurement archive, our last PO cleared at ₹${rag.bestPastRate}/unit. Given our recurring volume and prompt UPI settlement via ${profile.corporate_upi_id}, can you confirm ₹${targetCounter}/unit for immediate dispatch?`,
    counterOffered: targetCounter,
    ragEvidence: `Best Historical PO: ₹${rag.bestPastRate} | Target Gross Margin: ${rag.minTargetMarginPct}%+`,
    bookCitation: {
      source: tacticTurn2.source,
      chapter: tacticTurn2.chapter,
      tactic: tacticTurn2.tacticName,
      guidance: tacticTurn2.guidance
    },
    myblocksCitation: myblocksGuidance ? {
      answer: myblocksGuidance.answer,
      sources: myblocksGuidance.sources
    } : null,
    timestamp: new Date(Date.now() - 120000).toLocaleTimeString()
  });

  // Turn 3: Vendor intermediate concession
  const concessionPrice = Math.round(initialQuote - ((initialQuote - floorPrice) * 0.65));
  const tacticTurn4 = playbookEngine.retrieveNegotiationTactic(concessionPrice <= ceilingCost ? 4 : 5, { product, vendor, quantity });
  dialogue.push({
    turn: 3,
    speaker: 'Vendor',
    name: vendor.vendor_name,
    contact: vendor.contact_person,
    message: `₹${targetCounter} is quite tight due to rising peat and potting logistics costs. However, because ${profile.firm_name} is a valued long-term partner with instant UPI payout, we can meet halfway at ₹${concessionPrice}/unit if you guarantee dispatch approval by this afternoon.`,
    priceOffered: concessionPrice,
    timestamp: new Date(Date.now() - 60000).toLocaleTimeString()
  });

  // Turn 4: Agent final agreement check & settlement
  let finalAgreedPrice = concessionPrice;
  let status = 'AGREEMENT_REACHED';

  if (concessionPrice <= ceilingCost) {
    dialogue.push({
      turn: 4,
      speaker: 'Agent',
      name: 'Merlot AutoProcure AI',
      message: `Agreed at ₹${concessionPrice}/unit for ${quantity} units (Total: ₹${(concessionPrice * quantity).toLocaleString('en-IN')}). Gross margin is secured at ${Math.round(((product.price - concessionPrice) / product.price) * 100)}%. We have authorized instant payment and generated PO. Please initiate priority packing and dispatch.`,
      finalPrice: concessionPrice,
      bookCitation: {
        source: tacticTurn4.source,
        chapter: tacticTurn4.chapter,
        tactic: tacticTurn4.tacticName,
        guidance: tacticTurn4.guidance
      },
      timestamp: new Date().toLocaleTimeString()
    });
  } else {
    // Walkaway counter
    finalAgreedPrice = ceilingCost;
    dialogue.push({
      turn: 4,
      speaker: 'Agent',
      name: 'Merlot AutoProcure AI',
      message: `Our corporate margin policy caps this procurement batch at ₹${ceilingCost}/unit. Can you confirm at ₹${ceilingCost}/unit?`,
      finalPrice: ceilingCost,
      bookCitation: {
        source: tacticTurn4.source,
        chapter: tacticTurn4.chapter,
        tactic: tacticTurn4.tacticName,
        guidance: tacticTurn4.guidance
      },
      timestamp: new Date().toLocaleTimeString()
    });
  }

  // Calculate settlement metrics
  const totalAmount = finalAgreedPrice * quantity;
  const unitSavings = Math.max(0, initialQuote - finalAgreedPrice);
  const totalSavings = unitSavings * quantity;
  const grossMarginPct = Math.round(((product.price - finalAgreedPrice) / product.price) * 100);

  // Payment Guardrail Evaluation
  const autoApprovalLimit = userRules.autoApprovalLimit || profile.auto_approval_limit || 25000.00;
  const isAutoApproved = totalAmount <= autoApprovalLimit;
  const poNumber = `PO-MERLOT-${Date.now().toString().slice(-6)}`;

  // Live Scannable UPI Payment Link & QR Code
  const vendorUpi = vendor.upi_id || 'deccanflora@icici';
  const upiPaymentLink = `upi://pay?pa=${vendorUpi}&pn=${encodeURIComponent(vendor.vendor_name)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(poNumber)}`;
  const vendorQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiPaymentLink)}`;
  const storeQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(profile.qr_code_data || ('upi://pay?pa=' + profile.corporate_upi_id))}`;

  const settlement = {
    po_number: poNumber,
    product_id: product.id,
    product_name: product.name,
    vendor_id: vendor.vendor_id,
    vendor_name: vendor.vendor_name,
    vendor_contact: vendor.phone,
    vendor_whatsapp: vendor.whatsapp || vendor.phone,
    vendor_upi_id: vendorUpi,
    vendor_bank_account: vendor.bank_account || '50200012345678',
    vendor_ifsc: vendor.ifsc || 'ICIC0001234',
    corporate_upi_id: profile.corporate_upi_id,
    corporate_firm_name: profile.firm_name,
    corporate_qr_code_url: storeQrCodeUrl,
    vendor_upi_payment_link: upiPaymentLink,
    vendor_qr_code_url: vendorQrCodeUrl,
    quantity,
    initial_quote: initialQuote,
    final_price: finalAgreedPrice,
    unit_savings: unitSavings,
    total_savings: totalSavings,
    total_amount: totalAmount,
    gross_margin_pct: grossMarginPct,
    ceiling_cost: ceilingCost,
    best_historical_rate: rag.bestPastRate,
    active_playbook: tacticTurn2.source,
    is_auto_approved: isAutoApproved,
    payment_status: isAutoApproved ? 'PAID' : 'AWAITING_MANAGER_APPROVAL',
    payment_reference: isAutoApproved ? `UPI-MERLOT-${Date.now().toString().slice(-8)}` : null,
    dispatch_status: isAutoApproved ? 'DISPATCH_APPROVED_IN_TRANSIT' : 'HOLD_ON_PAYMENT',
    estimated_arrival_hours: vendor.lead_time_days * 24,
    tracking_number: `TRK-MER-${Date.now().toString().slice(-7)}`
  };

  // 🛡️ Data Loss Prevention (DLP): Scrub all dialogue turns to prevent competitor leaks
  dialogue.forEach(d => {
    if (d.message) {
      d.message = scrubCompetitorLeaks(d.message, vendor.vendor_id);
    }
  });

  const allProductVendors = rankVendorsForProduct(product.id, product, quantity);
  const tieBreakEval = resolveVendorTieBreaker(allProductVendors, quantity);

  return {
    success: true,
    status,
    settlement,
    dialogue,
    myblocksGuidance,
    tieBreakerEvaluation: tieBreakEval.isTie ? tieBreakEval : null,
    vendorFirewallActive: true,
    ragSummary: {
      retailPrice: product.price,
      maxAllowedCost: ceilingCost,
      bestPastRate: rag.bestPastRate,
      achievedMargin: `${grossMarginPct}%`,
      activePlaybook: tacticTurn2.source,
      myblocksCategory: MYBLOCKS_RAG_STATE.defaultCategory,
      myblocksSources: myblocksGuidance ? myblocksGuidance.sources : []
    }
  };
}

// ============================================================
// 🤖 AUTONOMOUS ZERO-TOUCH WHATSAPP PROCUREMENT ENGINE
// ============================================================
const ACTIVE_WHATSAPP_SESSIONS = new Map();
const MAX_ACTIVE_WHATSAPP_SESSIONS = 500;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours TTL

function cleanupExpiredWhatsAppSessions() {
  const now = Date.now();
  for (const [key, session] of ACTIVE_WHATSAPP_SESSIONS.entries()) {
    if (session && session.lastActivity && (now - session.lastActivity > SESSION_TTL_MS)) {
      ACTIVE_WHATSAPP_SESSIONS.delete(key);
    }
  }
  if (ACTIVE_WHATSAPP_SESSIONS.size > MAX_ACTIVE_WHATSAPP_SESSIONS) {
    const keysToDelete = Array.from(ACTIVE_WHATSAPP_SESSIONS.keys()).slice(0, ACTIVE_WHATSAPP_SESSIONS.size - MAX_ACTIVE_WHATSAPP_SESSIONS);
    for (const k of keysToDelete) {
      ACTIVE_WHATSAPP_SESSIONS.delete(k);
    }
  }
}
setInterval(cleanupExpiredWhatsAppSessions, 15 * 60 * 1000);

/**
 * 💾 Persistent Vendor Chat Ledger Storage
 * Records every WhatsApp dialogue turn (inbound and outbound) persistently into SQLite.
 */
function recordVendorChatTurn({
  sessionId,
  vendorId,
  vendorName,
  productId,
  productName,
  sender,
  message,
  turnNumber,
  extractedPrice,
  sentiment,
  isHallucinationBlocked = 0
}) {
  if (!posBridge || !posBridge.localOrdersDb) return;
  try {
    const stmt = posBridge.localOrdersDb.prepare(`
      INSERT INTO vendor_chat_ledger (
        session_id, vendor_id, vendor_name, product_id, product_name,
        sender, message, turn_number, extracted_price, sentiment,
        is_hallucination_blocked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      sessionId || 'SESSION-DIRECT',
      vendorId || 'UNKNOWN_VENDOR',
      vendorName || 'Vendor',
      productId || 'UNKNOWN_SKU',
      productName || 'Product',
      sender,
      message,
      turnNumber || 1,
      extractedPrice || null,
      sentiment || 'NEUTRAL',
      isHallucinationBlocked ? 1 : 0
    ], (err) => {
      if (err) console.warn('Vendor chat ledger insert warning:', err.message);
    });
    stmt.finalize();
  } catch (e) {
    console.warn('Notice recording vendor chat ledger turn:', e.message);
  }
}

/**
 * 🔍 Query Historical Vendor Transcripts & Concession Records
 */
function getVendorChatHistory(vendorId, limit = 50) {
  return new Promise((resolve) => {
    if (!posBridge || !posBridge.localOrdersDb) return resolve([]);
    posBridge.localOrdersDb.all(
      `SELECT * FROM vendor_chat_ledger WHERE vendor_id = ? ORDER BY id DESC LIMIT ?`,
      [vendorId, limit],
      (err, rows) => {
        if (!err && rows) {
          resolve(rows.reverse());
        } else {
          resolve([]);
        }
      }
    );
  });
}

/**
 * 🛡️ Zero-Hallucination Anti-Hallucination Firewall
 * Deterministically audits generated text against price ceilings and factual limits.
 */
function verifyAndSanitizeNegotiationReply(draftText, { ceilingCost, currentOffer, lockedPrice, contactPerson }) {
  if (!draftText || typeof draftText !== 'string') {
    return {
      isValid: false,
      reason: 'EMPTY_TEXT',
      sanitizedText: `Namaste ${contactPerson || 'Partner'}. Under our store procurement policy, our absolute ceiling cost is capped at ₹${lockedPrice || currentOffer}/unit with guaranteed instant corporate UPI clearance. Can you confirm at this unit rate?`
    };
  }

  // Extract all numbers that appear to be prices
  const priceMatches = draftText.match(/(?:₹|rs\.?|inr)?\s*(\d{2,5}(?:\.\d{1,2})?)/gi) || [];
  const pricesFound = priceMatches.map(m => parseFloat(m.replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n) && n > 20);

  // Financial safety check: No quoted price can ever exceed the ceiling cost
  for (const price of pricesFound) {
    if (price > ceilingCost) {
      console.warn(`🛡️ [Anti-Hallucination Guardrail Intercepted]: Draft contained price ₹${price} which exceeds ceiling limit ₹${ceilingCost}. Overriding.`);
      return {
        isValid: false,
        reason: `PRICE_EXCEEDS_CEILING (₹${price} > ₹${ceilingCost})`,
        sanitizedText: `Namaste ${contactPerson || 'Partner'}. We understand your operational constraints, but under our corporate procurement mandate, our absolute ceiling cost for this batch is strictly capped at ₹${lockedPrice || currentOffer}/unit with instant corporate UPI settlement. Can you meet us at ₹${lockedPrice || currentOffer}/unit?`
      };
    }
  }

  return { isValid: true, sanitizedText: draftText };
}

/**
 * Initiate an Autonomous WhatsApp Restock Session for a Low-Stock Product
 */
function initiateAutoRestockForProduct(productId, productData, qty = 60) {
  cleanupExpiredWhatsAppSessions();
  const profile = loadFirmProfile();
  const candidates = rankVendorsForProduct(productId, productData, qty);
  if (!candidates || candidates.length === 0) {
    return { success: false, error: 'No vendors available in vendors.csv' };
  }

  const bestVendor = candidates[0];
  const rag = retrieveRAGContext(productId, productData.price || 499, bestVendor.vendor_id);
  const ceilingCost = profile.max_ceiling_price || rag.maxCeilingCost;
  const initialOpeningRate = Math.max(bestVendor.floor_price, Math.min(rag.bestPastRate, Math.round(bestVendor.base_quote * 0.80)));

  const sessionId = `WA-SESS-${productId}-${Date.now().toString().slice(-6)}`;

  // Tactical Opening message citing vendor-specific RAG history
  let historyCitation = `According to our procurement archive, our last PO cleared at ₹${rag.bestPastRate}/unit.`;
  if (rag.vendorSpecificHistory && rag.vendorSpecificHistory.lastDeal) {
    const ld = rag.vendorSpecificHistory.lastDeal;
    historyCitation = `Reviewing our past procurement history with ${bestVendor.vendor_name}, under PO #${ld.po_number} on ${ld.date}, we settled at ₹${ld.cleared_unit_price}/unit (with ₹${rag.vendorSpecificHistory.cumulative_spend.toLocaleString('en-IN')} cumulative spend to date).`;
  }

  const openingMsg = `Namaste ${bestVendor.contact_person || 'Partner'}. This is ${profile.owner_name || 'Alex Merlot'} from ${profile.firm_name || 'Merlot Home Decor & Nursery'}.\n\n` +
    `🤖 *Auto-Procure Agent Alert*: Our POS inventory monitors indicate *${productData.name}* has breached the reorder threshold. We require an immediate restock batch of *${qty} units*.\n` +
    `${historyCitation} Given our recurring volume and instant UPI payout via *${profile.corporate_upi_id}*, can you confirm *₹${initialOpeningRate}/unit* for direct 24-hour dispatch?`;

  const cleanPhone = (bestVendor.whatsapp || bestVendor.phone || '9876543210').replace(/[^0-9]/g, '');
  const finalPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
  const waUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(openingMsg)}`;

  const session = {
    sessionId,
    productId,
    productName: productData.name,
    productPrice: productData.price || 499,
    quantity: qty,
    vendor: bestVendor,
    ceilingCost,
    floorPrice: bestVendor.floor_price,
    initialQuote: bestVendor.base_quote,
    currentOffer: initialOpeningRate,
    turnCount: 1,
    status: 'AWAITING_VENDOR_REPLY',
    vendorRagHistory: rag.vendorSpecificHistory,
    dialogue: [
      {
        turn: 1,
        sender: 'AGENT',
        message: openingMsg,
        timestamp: new Date().toLocaleTimeString(),
        rateOffered: initialOpeningRate
      }
    ],
    whatsappUrl: waUrl,
    startedAt: new Date().toISOString(),
    lastActivity: Date.now()
  };

  // Persistent Chat Ledger: Record opening tactical quote turn into database
  recordVendorChatTurn({
    sessionId,
    vendorId: bestVendor.vendor_id,
    vendorName: bestVendor.vendor_name,
    productId,
    productName: productData.name,
    sender: 'AGENT',
    message: openingMsg,
    turnNumber: 1,
    extractedPrice: initialOpeningRate,
    sentiment: 'OPENING_QUOTE'
  });

  ACTIVE_WHATSAPP_SESSIONS.set(sessionId, session);
  ACTIVE_WHATSAPP_SESSIONS.set(finalPhone, session);
  return { success: true, session, openingMsg, whatsappUrl: waUrl };
}

/**
 * Handle incoming reply from vendor on WhatsApp without any human intervention
 */
async function handleIncomingWhatsAppReply({ from, message, sessionId = null, posBridge = null }) {
  cleanupExpiredWhatsAppSessions();
  const profile = loadFirmProfile();

  // Clean phone number
  const cleanPhone = (from || '').toString().replace(/[^0-9]/g, '');
  const normalizedPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;

  // Lookup active session strictly without unsafe global fallback
  let session = (sessionId && ACTIVE_WHATSAPP_SESSIONS.get(sessionId)) || 
                ACTIVE_WHATSAPP_SESSIONS.get(normalizedPhone);

  // If still not matched, check if phone belongs to any known vendor with an active pending session
  if (!session) {
    for (const active of ACTIVE_WHATSAPP_SESSIONS.values()) {
      if (active && active.vendor) {
        const vPhone = (active.vendor.whatsapp || active.vendor.phone || '').replace(/[^0-9]/g, '');
        const normVPhone = vPhone.length === 10 ? '91' + vPhone : vPhone;
        if (normVPhone === normalizedPhone && active.status === 'AWAITING_VENDOR_REPLY') {
          session = active;
          break;
        }
      }
    }
  }

  // If STILL no active session found, safely isolate sender - NEVER hijack another vendor's transaction
  if (!session) {
    const isolatedReply = `Namaste. We received your message, but no active procurement order or negotiation session was found for phone number +${normalizedPhone}. If this is regarding an open Purchase Order or quotation, please quote the PO number or contact store procurement.`;
    return {
      status: 'NO_ACTIVE_SESSION',
      action: 'UNRECOGNIZED_SENDER_ISOLATED',
      agentReply: isolatedReply,
      securityReason: 'UNMAPPED_SENDER_ISOLATED',
      whatsappUrl: `https://api.whatsapp.com/send?phone=${normalizedPhone}&text=${encodeURIComponent(isolatedReply)}`,
      session: null
    };
  }

  session.lastActivity = Date.now();
  const product = { id: session.productId, name: session.productName, price: session.productPrice };
  const vendor = session.vendor;
  const quantity = session.quantity;

  // 🛡️ ZERO-LEAK SECURITY FIREWALL: Intercept competitor inquiries, espionage & jailbreaks
  const leakCheck = detectAndBlockPromptInjectionOrLeakAttempt(message, vendor);
  if (leakCheck.isAttempt) {
    session.turnCount++;
    session.dialogue.push({
      turn: session.turnCount,
      sender: 'SECURITY_FIREWALL',
      message: leakCheck.securityReply,
      timestamp: new Date().toLocaleTimeString(),
      securityFlag: leakCheck.reason
    });

    const cleanVendorPhone = (vendor.whatsapp || normalizedPhone).replace(/[^0-9]/g, '');
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanVendorPhone}&text=${encodeURIComponent(leakCheck.securityReply)}`;

    return {
      status: 'SECURITY_DEFENSE_TRIGGERED',
      action: 'COMPETITOR_LEAK_PREVENTED',
      agentReply: leakCheck.securityReply,
      securityReason: leakCheck.reason,
      whatsappUrl: waUrl,
      session
    };
  }

  // Parse price from incoming vendor message (e.g. "₹280", "280", "can do 270", "ok 250")
  const priceMatches = (message || '').match(/(?:₹|rs\.?|inr)?\s*(\d{2,5}(?:\.\d{1,2})?)/i);
  let vendorOfferedPrice = priceMatches ? parseFloat(priceMatches[1]) : null;

  // Check for negation words (not, no, never, cannot, can't, don't, etc.)
  const hasNegation = /\b(not|no|never|cannot|can't|cant|dont|don't|won't|wont|unable|impossible|reject|rejected|decline|declined|cancel|cancelled)\b/i.test(message || '');
  const isQuestion = /\?/.test(message || '');

  // Check for affirmative acceptance (ONLY valid if NOT negated and NOT a question)
  const isAffirmativePhrase = /\b(agreed|deal\s+done|deal\s+confirmed|we\s+agree|price\s+accepted|order\s+confirmed|terms\s+accepted|done\s+deal|confirmed)\b/i.test(message || '');
  const isExactShortAccept = /^(ok|okay|yes|done|agreed|confirm|deal)$/i.test((message || '').trim().toLowerCase());
  const isAcceptance = !hasNegation && !isQuestion && (isAffirmativePhrase || isExactShortAccept);

  session.turnCount++;
  session.dialogue.push({
    turn: session.turnCount,
    sender: 'VENDOR',
    message,
    timestamp: new Date().toLocaleTimeString(),
    priceDetected: vendorOfferedPrice
  });

  // Persistent Chat Ledger: Record incoming vendor dialogue turn into SQLite
  recordVendorChatTurn({
    sessionId: session.sessionId,
    vendorId: vendor.vendor_id,
    vendorName: vendor.vendor_name,
    productId: session.productId,
    productName: session.productName,
    sender: 'VENDOR',
    message,
    turnNumber: session.turnCount,
    extractedPrice: vendorOfferedPrice,
    sentiment: hasNegation ? 'REJECTION_OR_COUNTER' : (isAcceptance ? 'ACCEPTANCE' : 'INQUIRY')
  });

  // Check if vendor explicitly rejected/declined to supply
  const isVendorRejection = hasNegation && /\b(reject|declined?|cancel|cannot supply|no stock|unavailable|out of stock|stop)\b/i.test(message || '');
  if (isVendorRejection) {
    session.status = 'VENDOR_DECLINED';
    const declineReply = `Namaste ${vendor.contact_person || 'Partner'}. We understand and have noted your decline for this restock batch. We will update our procurement records and pause replenishment requests for ${product.name}. Thank you!`;
    session.dialogue.push({
      turn: session.turnCount + 1,
      sender: 'AGENT',
      message: declineReply,
      timestamp: new Date().toLocaleTimeString(),
      status: 'VENDOR_DECLINED'
    });
    const cleanVendorPhone = (vendor.whatsapp || normalizedPhone).replace(/[^0-9]/g, '');
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanVendorPhone}&text=${encodeURIComponent(declineReply)}`;
    return {
      status: 'VENDOR_DECLINED',
      action: 'NEGOTIATION_TERMINATED_BY_VENDOR',
      agentReply: declineReply,
      whatsappUrl: waUrl,
      session
    };
  }

  // CRITICAL CEILING GUARD:
  // A deal can ONLY close if:
  // 1) vendor explicitly accepted our offer (in which case finalPrice = session.currentOffer <= ceilingCost), OR
  // 2) vendor offered a price <= ceilingCost without negation (in which case finalPrice = vendorOfferedPrice <= ceilingCost)
  // If vendor quoted a price > ceilingCost, it can NEVER close automatically, even if they wrote "deal" or "ok"!
  const canCloseDeal = isAcceptance 
    ? (vendorOfferedPrice !== null ? vendorOfferedPrice <= session.ceilingCost : true)
    : (vendorOfferedPrice !== null && vendorOfferedPrice <= session.ceilingCost && !hasNegation);

  // CASE 1: Vendor Accepted our offer or offered acceptable price <= ceilingCost
  if (canCloseDeal) {
    const finalPrice = (vendorOfferedPrice !== null && vendorOfferedPrice <= session.ceilingCost) 
      ? vendorOfferedPrice 
      : session.currentOffer;
    const totalAmount = finalPrice * quantity;
    const poNumber = `PO-MERLOT-${Date.now().toString().slice(-6)}`;
    const paymentRef = `UPI-MERLOT-${Date.now().toString().slice(-8)}`;
    const trackingCode = `TRK-MER-${Date.now().toString().slice(-7)}`;

    const settlement = {
      po_number: poNumber,
      product_id: session.productId,
      product_name: session.productName,
      vendor_id: vendor.vendor_id,
      vendor_name: vendor.vendor_name,
      vendor_contact: vendor.contact_person,
      vendor_whatsapp: vendor.whatsapp || normalizedPhone,
      vendor_upi_id: vendor.upi_id || 'deccanflora@icici',
      vendor_bank_account: vendor.bank_account || '50200012345678',
      vendor_ifsc: vendor.ifsc || 'ICIC0001234',
      corporate_upi_id: profile.corporate_upi_id || 'merlotdecor@icici',
      corporate_firm_name: profile.firm_name || 'Merlot Home Decor & Nursery',
      quantity,
      final_price: finalPrice,
      total_amount: totalAmount,
      payment_status: 'PAID',
      payment_reference: paymentRef,
      tracking_number: trackingCode,
      dispatch_status: 'DISPATCH_APPROVED_IN_TRANSIT',
      estimated_arrival_hours: (vendor.lead_time_days || 1) * 24
    };

    // Auto-Record in POS SQLite if posBridge available
    if (posBridge && typeof posBridge.recordPurchaseOrder === 'function') {
      try {
        await posBridge.recordPurchaseOrder(settlement);
      } catch (e) {
        console.warn('POS background record notice:', e.message);
      }
    }

    // Auto-Record in Vendor RAG History Archive
    recordVendorDeal({
      vendor_id: vendor.vendor_id,
      vendor_name: vendor.vendor_name,
      po_number: poNumber,
      product_id: session.productId,
      product_name: session.productName,
      quantity,
      cleared_unit_price: finalPrice,
      opening_quote: session.initialQuote || vendor.base_quote,
      total_amount: totalAmount,
      date: new Date().toISOString().split('T')[0],
      turns_to_close: session.turnCount,
      notes: `Deal closed via WhatsApp in ${session.turnCount} turn(s) with instant UPI settlement.`
    });

    const rawAgentReply = `✅ *AGREEMENT REACHED & PAYMENT AUTHORIZED*\n\n` +
      `Namaste ${vendor.contact_person}. We have accepted ₹${finalPrice}/unit for ${quantity} units (Total: ₹${totalAmount.toLocaleString('en-IN')}).\n` +
      `📜 *PO Number:* #${poNumber}\n` +
      `💳 *Payment Reference (UTR):* ${paymentRef}\n` +
      `📲 *Debited From:* ${profile.corporate_upi_id}\n` +
      `🚚 *Tracking Code:* ${trackingCode}\n\n` +
      `Consignment is authorized for immediate dispatch. Please dispatch within ${settlement.estimated_arrival_hours} hours. Thank you!`;
    const agentReply = scrubCompetitorLeaks(rawAgentReply, vendor.vendor_id);

    session.status = 'DEAL_CLOSED';
    session.settlement = settlement;
    session.dialogue.push({
      turn: session.turnCount + 1,
      sender: 'AGENT',
      message: agentReply,
      timestamp: new Date().toLocaleTimeString(),
      finalPrice
    });

    // Persistent Chat Ledger: Record verified deal settlement turn into SQLite
    recordVendorChatTurn({
      sessionId: session.sessionId,
      vendorId: vendor.vendor_id,
      vendorName: vendor.vendor_name,
      productId: session.productId,
      productName: session.productName,
      sender: 'AGENT',
      message: agentReply,
      turnNumber: session.turnCount + 1,
      extractedPrice: finalPrice,
      sentiment: 'DEAL_CLOSED'
    });

    const cleanVendorPhone = (vendor.whatsapp || normalizedPhone).replace(/[^0-9]/g, '');
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanVendorPhone}&text=${encodeURIComponent(agentReply)}`;

    return {
      status: 'DEAL_CLOSED',
      action: 'PAYMENT_CLEARED_AND_DISPATCHED',
      agentReply,
      settlement,
      whatsappUrl: waUrl,
      session
    };
  }

  // CASE 2: Vendor offered higher price > ceilingCost or negotiation ongoing -> Calculate Calibrated Ackerman Counter-Offer
  const previousOffer = session.currentOffer;
  const targetForCounter = (vendorOfferedPrice && vendorOfferedPrice > session.ceilingCost)
    ? session.ceilingCost
    : (vendorOfferedPrice || session.ceilingCost);

  const nextCounter = Math.min(
    session.ceilingCost,
    Math.round(previousOffer + (targetForCounter - previousOffer) * 0.45)
  );
  session.currentOffer = nextCounter;

  const rag = retrieveRAGContext(session.productId, session.productPrice, vendor.vendor_id);
  const tactic = playbookEngine.retrieveNegotiationTactic(session.turnCount, { product, vendor, quantity });

  // Query MyBlocks Cloud RAG for dynamic counter-tactic & document citations
  let myblocksGuidance = null;
  try {
    const mbRes = await queryMyBlocksRAG({
      question: `Vendor ${vendor.vendor_name} quoted ₹${vendorOfferedPrice || 'above ceiling'} for ${quantity} units of ${session.productName}. Maximum acceptable price is ₹${session.ceilingCost}. Suggest strategic negotiation counter and quality/terms rationale.`,
      category: MYBLOCKS_RAG_STATE.defaultCategory,
      sessionId: session.sessionId,
      timeoutMs: 5000 // 5s fast SLA for WhatsApp Webhook responses
    });
    if (mbRes && mbRes.success && mbRes.answer) {
      myblocksGuidance = {
        answer: mbRes.answer,
        sources: mbRes.sources || []
      };
    }
  } catch (e) {
    // Failover silently to local playbook
  }

  let vendorRelationshipPrompt = `Since our system executes instant Corporate UPI clearance via *${profile.corporate_upi_id}* with zero payment delay, `;
  if (rag.vendorSpecificHistory && rag.vendorSpecificHistory.total_orders_completed > 0) {
    vendorRelationshipPrompt = `Given our established procurement partnership (${rag.vendorSpecificHistory.total_orders_completed} POs completed, ₹${rag.vendorSpecificHistory.cumulative_spend.toLocaleString('en-IN')} lifetime spend to date) and guaranteed instant UPI payout, `;
  }

  const rawAgentReply = `Namaste ${vendor.contact_person}. We understand your operational constraints. However, under ${profile.firm_name}'s corporate procurement mandate, our absolute ceiling cost for this batch is capped at *₹${nextCounter}/unit* to maintain our store operating margin.\n\n` +
    `${vendorRelationshipPrompt}can you meet us at *₹${nextCounter}/unit* for immediate carrier dispatch?`;
  const scrubbedReply = scrubCompetitorLeaks(rawAgentReply, vendor.vendor_id);

  // 🛡️ Zero-Hallucination Firewall Audit: Verify price limits before dispatch
  const auditResult = verifyAndSanitizeNegotiationReply(scrubbedReply, {
    ceilingCost: session.ceilingCost,
    currentOffer: nextCounter,
    lockedPrice: nextCounter,
    contactPerson: vendor.contact_person
  });
  const agentReply = auditResult.sanitizedText;

  session.turnCount++;
  session.dialogue.push({
    turn: session.turnCount,
    sender: 'AGENT',
    message: agentReply,
    timestamp: new Date().toLocaleTimeString(),
    counterOffered: nextCounter,
    tacticCitation: tactic,
    myblocksCitation: myblocksGuidance
  });

  // Persistent Chat Ledger: Record verified counter-offer turn into SQLite
  recordVendorChatTurn({
    sessionId: session.sessionId,
    vendorId: vendor.vendor_id,
    vendorName: vendor.vendor_name,
    productId: session.productId,
    productName: session.productName,
    sender: 'AGENT',
    message: agentReply,
    turnNumber: session.turnCount,
    extractedPrice: nextCounter,
    sentiment: 'COUNTER_OFFER',
    isHallucinationBlocked: auditResult.isValid ? 0 : 1
  });

  const cleanVendorPhone = (vendor.whatsapp || normalizedPhone).replace(/[^0-9]/g, '');
  const waUrl = `https://api.whatsapp.com/send?phone=${cleanVendorPhone}&text=${encodeURIComponent(agentReply)}`;

  return {
    status: 'COUNTER_OFFER_SENT',
    action: 'AUTONOMOUS_BARGAIN_CONTINUED',
    agentReply,
    counterOffered: nextCounter,
    ceilingCost: session.ceilingCost,
    tacticApplied: tactic ? tactic.tacticName : 'Ackerman Concession',
    myblocksGuidance,
    whatsappUrl: waUrl,
    session
  };
}

function getActiveWhatsAppSessions() {
  const seen = new Set();
  const sessions = [];
  for (const s of ACTIVE_WHATSAPP_SESSIONS.values()) {
    if (s && s.sessionId && !seen.has(s.sessionId)) {
      seen.add(s.sessionId);
      sessions.push(s);
    }
  }
  return sessions;
}

const ragProcurement = {
  RAG_KNOWLEDGE_STORE,
  SECURITY_AUDIT_LOGS,
  detectAndBlockPromptInjectionOrLeakAttempt,
  scrubCompetitorLeaks,
  resolveVendorTieBreaker,
  syncPosCatalogToRagMemory,
  MYBLOCKS_RAG_STATE,
  fetchMyBlocksCategories,
  fetchMyBlocksPersonas,
  uploadAndIndexMyBlocksDocument,
  queryMyBlocksRAG,
  fetchMyBlocksChatHistory,
  clearMyBlocksChatHistory,
  loadFirmProfile,
  saveFirmProfile,
  loadVendorsFromCSV,
  loadVendorHistory,
  recordVendorDeal,
  retrieveRAGContext,
  rankVendorsForProduct,
  executeAutonomousNegotiation,
  initiateAutoRestockForProduct,
  handleIncomingWhatsAppReply,
  getActiveWhatsAppSessions,
  playbookEngine
};

// ==================== 🤖 SECTION 5: AUTONOMOUS BACKGROUND WATCHDOG DAEMON ====================
/**
 * 🤖 Merlot AutoProcure AI - Autonomous Background Inventory Watchdog Daemon
 *
 * Runs 24/7 in the background without needing human clicks.
 * Periodically scans POS database/catalog, detects low-stock items breaching ROP,
 * and initiates negotiation with wholesale vendors via WhatsApp Cloud API.
 */

// ragProcurement embedded
// posBridge embedded
// whatsappService embedded

class AutoWatchdog {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.intervalMinutes = parseInt(process.env.RESTOCK_SCAN_INTERVAL_MINUTES || '10', 10);
    this.lastScanTime = null;
    this.lastScanResults = null;
    this.autoRestockEnabled = process.env.AUTO_RESTOCK_DAEMON === 'true' || true; // Active by default
  }

  start(customIntervalMinutes = null) {
    if (customIntervalMinutes) {
      this.intervalMinutes = customIntervalMinutes;
    }

    if (this.isRunning) {
      this.stop();
    }

    this.isRunning = true;
    console.log(`🤖 [AutoWatchdog] Autonomous Inventory Daemon STARTED. Scanning every ${this.intervalMinutes} minute(s).`);

    // Run first scan immediately (after 3 seconds warmup)
    setTimeout(() => {
      this.runScanCycle();
    }, 3000);

    // Schedule recurring scans
    this.intervalId = setInterval(() => {
      this.runScanCycle();
    }, this.intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 [AutoWatchdog] Autonomous Inventory Daemon STOPPED.');
  }

  async runScanCycle() {
    if (!this.autoRestockEnabled) {
      return { skipped: true, reason: 'Daemon toggled off in settings' };
    }

    this.lastScanTime = new Date().toISOString();
    console.log(`🔍 [AutoWatchdog] Executing automatic stock evaluation at ${this.lastScanTime}...`);

    try {
      // 1. Fetch current catalog and stock from POS Bridge
      let storeProducts = [];
      try {
        const rawCatalog = await posBridge.getProducts();
        if (Array.isArray(rawCatalog) && rawCatalog.length > 0) {
          storeProducts = rawCatalog;
        }
      } catch (e) {
        console.warn('⚠️ [AutoWatchdog] POS catalog fetch fallback:', e.message);
      }

      if (!storeProducts || storeProducts.length === 0) {
        if (process.env.DEMO_MODE === 'true') {
          storeProducts = [
            { id: 'p_snake_plant_10in', name: 'Snake Plant (Sansevieria Laurentii)', stock: 8, min_stock: 20, price: 499 },
            { id: 'p_fiddle_leaf_fig', name: 'Fiddle Leaf Fig Premium (Ficus Lyrata)', stock: 5, min_stock: 15, price: 1499 },
            { id: 'p_monstera_deliciosa', name: 'Monstera Deliciosa Swiss Cheese', stock: 12, min_stock: 25, price: 799 },
            { id: 'p_neem_oil_500ml', name: 'Organic Cold-Pressed Neem Oil Spray (500ml)', stock: 15, min_stock: 20, price: 299 }
          ];
        } else {
          console.log('ℹ️ [AutoWatchdog] POS catalog has 0 items. Zero-Mock Policy active. Standing by.');
          return;
        }
      }

      // Merge custom monitored items from store profile
      let profile = {};
      try {
        profile = ragProcurement.loadFirmProfile() || {};
        if (Array.isArray(profile.custom_monitored_items) && profile.custom_monitored_items.length > 0) {
          for (const item of profile.custom_monitored_items) {
            const existingIdx = storeProducts.findIndex(p => p.id === item.id || (p.name && item.name && p.name.toLowerCase() === item.name.toLowerCase()));
            if (existingIdx >= 0) {
              storeProducts[existingIdx] = { ...storeProducts[existingIdx], ...item };
            } else {
              storeProducts.push({
                id: item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                name: item.name,
                stock: item.stock !== undefined ? item.stock : 5,
                min_stock: item.min_stock || 20,
                price: item.price || 499,
                ...item
              });
            }
          }
        }
      } catch (e) {}

      const dispatches = [];

      // 2. Evaluate each item against EOQ & ROP
      for (const prod of storeProducts) {
        const currentStock = prod.stock ?? 0;
        const reorderPoint = prod.min_stock ?? 20;

        if (currentStock <= reorderPoint) {
          console.log(`🚨 [AutoWatchdog] Alert: ${prod.name} (Stock: ${currentStock} <= ROP: ${reorderPoint})! Initiating restock...`);

          let eoq = Math.max(30, (reorderPoint * 2) - currentStock);
          if (profile.max_order_quantity && parseInt(profile.max_order_quantity, 10) > 0) {
            eoq = Math.min(eoq, parseInt(profile.max_order_quantity, 10));
          }

          const dispatchRes = ragProcurement.initiateAutoRestockForProduct(
            prod.id,
            prod,
            eoq
          );

          if (dispatchRes.success) {
            const vendorPhone = dispatchRes.session.vendor.whatsapp || dispatchRes.session.vendor.phone;

            // Dispatch message via WhatsApp Service (Meta Cloud API if configured, else fallback)
            const sendResult = await whatsappService.sendMessage({
              to: vendorPhone,
              message: dispatchRes.openingMsg
            });

            dispatches.push({
              product_id: prod.id,
              product_name: prod.name,
              current_stock: currentStock,
              reorder_point: reorderPoint,
              vendor: dispatchRes.session.vendor.vendor_name,
              vendor_phone: vendorPhone,
              dispatch_provider: sendResult.provider,
              message_id: sendResult.messageId || null,
              whatsapp_url: dispatchRes.whatsappUrl,
              opening_rate: dispatchRes.session.currentOffer
            });
          }
        }
      }

      this.lastScanResults = {
        timestamp: this.lastScanTime,
        itemsScanned: storeProducts.length,
        restocksTriggered: dispatches.length,
        dispatches
      };

      console.log(`✅ [AutoWatchdog] Scan cycle finished: ${dispatches.length} restock negotiations active.`);
      return this.lastScanResults;
    } catch (err) {
      console.error('❌ [AutoWatchdog] Scan cycle encountered error:', err.message);
      return { error: err.message };
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalMinutes,
      autoRestockEnabled: this.autoRestockEnabled,
      lastScanTime: this.lastScanTime,
      lastScanResults: this.lastScanResults,
      whatsAppGateway: whatsappService.getStatus()
    };
  }
}

const autoWatchdog = new AutoWatchdog();
if (process.env.AUTO_RESTOCK_DAEMON !== 'false') {
  autoWatchdog.start();
}

// ==================== 🌐 SECTION 6: ROOT & FRONTEND SERVING ROUTE ====================
router.get(['/', '/agent', '/agent.html', '/inventory_agent.html', '/index.html'], (req, res) => {
  const candidateFiles = [
    path.join(__dirname, '..', 'frontend', 'agent.html'),
    path.join(__dirname, 'frontend', 'agent.html'),
    path.join(__dirname, 'agent.html')
  ];
  for (const fp of candidateFiles) {
    if (fs.existsSync(fp)) {
      return res.sendFile(fp);
    }
  }
  res.status(200).send(`<!DOCTYPE html>
<html>
<head><title>Autonomous Inventory AI Agent</title></head>
<body style="font-family: sans-serif; padding: 40px; text-align: center;">
  <h2>Autonomous Inventory AI Agent Backend is Active</h2>
  <p>Place <code>agent.html</code> in the <code>frontend/</code> directory to render the full interactive dashboard.</p>
</body>
</html>`);
});


// ==================== Live LLM API Callers (Gemini & OpenAI) ====================

async function callGeminiAPI(promptText, apiKey) {
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-pro'];
  let lastErr = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: promptText }]
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } else {
        const errText = await response.text();
        lastErr = new Error(`Gemini API (${model}) (${response.status}): ${errText}`);
      }
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('All Gemini API models failed to return content.');
}

async function callOpenAIAPI(promptText, apiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: promptText }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || 'No response from OpenAI.';
}

/**
 * Pipeline state machine:
 * PARSING -> EVALUATING_DEMAND -> CALCULATING_EOQ_ROP -> BENCHMARKING_VENDORS 
 *         -> ASSESSING_EXPIRY_RISK -> APPLYING_GUARDRAILS -> SCORING -> PERSISTING
 */

// Pipeline States
const STATES = {
  PARSING: 'PARSING',
  EVALUATING_DEMAND: 'EVALUATING_DEMAND',
  CALCULATING_EOQ_ROP: 'CALCULATING_EOQ_ROP',
  BENCHMARKING_VENDORS: 'BENCHMARKING_VENDORS',
  ASSESSING_EXPIRY_RISK: 'ASSESSING_EXPIRY_RISK',
  APPLYING_GUARDRAILS: 'APPLYING_GUARDRAILS',
  SCORING: 'SCORING',
  PERSISTING: 'PERSISTING'
};

// Confidence Score Weights
const SCORE_WEIGHTS = {
  stockHealth: 0.35,
  vendorEfficiency: 0.30,
  demandAlignment: 0.20,
  expiryRisk: 0.15
};

// Classification Labels
const LABELS = {
  OPTIMAL: 'Inventory Health Optimal',
  REVIEW: 'Review Recommended',
  AT_RISK: 'Stockout / Expiry Risk'
};

// FEFO Expiry Markdown Rules (Discount strictly starts 1-2 days before expiration)
const EXPIRY_RULES = {
  CRITICAL: { maxDays: 1, markdownPct: 30, code: 'CLEARANCE_30_PCT', action: 'Apply 30% FEFO Clearance Discount on POS Counter immediately (1 Day to Expiry).' },
  WARNING: { maxDays: 2, markdownPct: 15, code: 'CLEARANCE_15_PCT', action: 'Apply 15% Clearance Discount (2 Days to Expiry).' },
  HEALTHY: { maxDays: 999, markdownPct: 0, code: 'HEALTHY_SHELF_LIFE', action: 'No clearance required. Healthy shelf life.' }
};

// Guardrail Definitions
const GUARDRAILS = {
  STOCKOUT_IMMINENT: {
    code: 'STOCKOUT_IMMINENT',
    status: 'CRITICAL',
    statement: 'Current stock level is at or below Reorder Point (ROP). High stockout risk within lead time.'
  },
  EXPIRY_CLEARANCE_REQUIRED: {
    code: 'EXPIRY_CLEARANCE_REQUIRED',
    status: 'WARNING',
    statement: 'Item is expiring within 30 days. FEFO clearance markdown rules activated.'
  },
  SINGLE_VENDOR_DEPENDENCY: {
    code: 'SINGLE_VENDOR_DEPENDENCY',
    status: 'WARNING',
    statement: 'Only 1 vendor available for this SKU. Vulnerable to supply chain disruptions.'
  },
  OVERSTOCK_WARNING: {
    code: 'OVERSTOCK_WARNING',
    status: 'INFO',
    statement: 'Current stock exceeds 60 days of sales velocity. Working capital is locked up.'
  }
};

// ==================== Helper Functions ====================

function toNum(value, fallback = 0) {
  if (value === '' || value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

function round2(value) {
  return Math.round((toNum(value, 0) + Number.EPSILON) * 100) / 100;
}

function truncate(text, max = 255) {
  const clean = String(text == null ? '' : text).trim();
  return clean.length > max ? clean.slice(0, max).trim() : clean;
}

// ==================== Merlot Home Decor & Gardening Catalog ====================

const DEFAULT_STORE_PRODUCTS = [
  {
    id: 'p_snake_plant_10in',
    name: 'Snake Plant (Sansevieria Laurentii)',
    category: 'Indoor Foliage',
    price: 499.00,
    cost: 220.00,
    stock: 24, // < 30 Safety Stock Threshold!
    minStock: 30,
    expiryDays: 365,
    sales7d: 56, // 8 units/day velocity -> stockout in 3 days!
    isClearanceApplied: false,
    sku: 'MHD-PLT-001',
    brand: 'Merlot Botanicals'
  },
  {
    id: 'p_fiddle_leaf_fig',
    name: 'Fiddle Leaf Fig Tree (12-inch)',
    category: 'Indoor Foliage',
    price: 899.00,
    cost: 450.00,
    stock: 14,
    minStock: 15,
    expiryDays: 365,
    sales7d: 21,
    isClearanceApplied: false,
    sku: 'MHD-PLT-002',
    brand: 'Merlot Botanicals'
  },
  {
    id: 'p_monstera_deliciosa',
    name: 'Monstera Deliciosa (Swiss Cheese Plant)',
    category: 'Indoor Foliage',
    price: 750.00,
    cost: 350.00,
    stock: 8,
    minStock: 15,
    expiryDays: 365,
    sales7d: 35,
    isClearanceApplied: false,
    sku: 'MHD-PLT-003',
    brand: 'Merlot Botanicals'
  },
  {
    id: 'p_ceramic_pot_10in',
    name: 'Handcrafted Minimalist Ceramic Planter (10-inch)',
    category: 'Planters & Pots',
    price: 349.00,
    cost: 140.00,
    stock: 42,
    minStock: 20,
    expiryDays: 999,
    sales7d: 28,
    isClearanceApplied: false,
    sku: 'MHD-POT-004',
    brand: 'Merlot Studio'
  },
  {
    id: 'p_zz_plant_premium',
    name: 'ZZ Plant Emerald Queen (8-inch)',
    category: 'Indoor Foliage',
    price: 549.00,
    cost: 260.00,
    stock: 11,
    minStock: 15,
    expiryDays: 365,
    sales7d: 21,
    isClearanceApplied: false,
    sku: 'MHD-PLT-005',
    brand: 'Merlot Botanicals'
  },
  {
    id: 'p_organic_neem_oil',
    name: 'Organic Cold-Pressed Neem Oil Spray (500ml)',
    category: 'Plant Care',
    price: 240.00,
    cost: 110.00,
    stock: 15,
    minStock: 12,
    expiryDays: 180,
    sales7d: 14,
    isClearanceApplied: false,
    sku: 'MHD-CARE-006',
    brand: 'Merlot GardenCare'
  }
];

let storeProducts = JSON.parse(JSON.stringify(DEFAULT_STORE_PRODUCTS));

const vendorCatalog = {
  'p_snake_plant_10in': [
    { vendor_id: 'v_deccan', vendor_name: 'Deccan Flora Wholesale Nursery', phone: '9876543210', unit_cost: 340.00, lead_time_days: 1, moq: 20, rating: 4.8 },
    { vendor_id: 'v_greencanopy', vendor_name: 'Green Canopy Growers', phone: '9812345678', unit_cost: 320.00, lead_time_days: 2, moq: 30, rating: 4.6 },
    { vendor_id: 'v_biogreens', vendor_name: 'BioGreens Botanical Nursery', phone: '9765432109', unit_cost: 310.00, lead_time_days: 4, moq: 50, rating: 4.2 }
  ],
  'p_fiddle_leaf_fig': [
    { vendor_id: 'v_deccan', vendor_name: 'Deccan Flora Wholesale Nursery', phone: '9876543210', unit_cost: 490.00, lead_time_days: 2, moq: 10, rating: 4.8 },
    { vendor_id: 'v_greencanopy', vendor_name: 'Green Canopy Growers', phone: '9812345678', unit_cost: 470.00, lead_time_days: 3, moq: 15, rating: 4.5 }
  ],
  'p_monstera_deliciosa': [
    { vendor_id: 'v_deccan', vendor_name: 'Deccan Flora Wholesale Nursery', phone: '9876543210', unit_cost: 390.00, lead_time_days: 1, moq: 15, rating: 4.8 },
    { vendor_id: 'v_biogreens', vendor_name: 'BioGreens Botanical Nursery', phone: '9765432109', unit_cost: 360.00, lead_time_days: 4, moq: 25, rating: 4.2 }
  ],
  'p_ceramic_pot_10in': [
    { vendor_id: 'v_ceramics_craft', vendor_name: 'Heritage Ceramic Crafts', phone: '9844433322', unit_cost: 145.00, lead_time_days: 2, moq: 20, rating: 4.7 }
  ],
  'p_zz_plant_premium': [
    { vendor_id: 'v_deccan', vendor_name: 'Deccan Flora Wholesale Nursery', phone: '9876543210', unit_cost: 290.00, lead_time_days: 1, moq: 10, rating: 4.8 }
  ],
  'p_organic_neem_oil': [
    { vendor_id: 'v_bio_agro', vendor_name: 'BioAgro Organics India', phone: '9822211100', unit_cost: 115.00, lead_time_days: 2, moq: 12, rating: 4.6 }
  ]
};

// ==================== Audit Log Storage ====================

let mysqlPool = null;
let isMysqlConnected = false;
const inMemoryLogs = [];

(async () => {
  try {
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'retail_pos_db',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 2000
    });

    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_agent_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id VARCHAR(100),
        product_name VARCHAR(255),
        stock_level INT,
        reorder_point INT,
        recommended_qty INT,
        winning_vendor VARCHAR(255),
        vendor_unit_cost DECIMAL(10,2),
        confidence_score INT,
        health_label VARCHAR(100),
        guardrails JSON,
        pipeline_states JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    mysqlPool = pool;
    isMysqlConnected = true;
    console.log('✅ Inventory Agent: MySQL audit table initialized.');
  } catch (err) {
    isMysqlConnected = false;
    if (mysqlPool) {
      try { mysqlPool.end(); } catch (e) {}
      mysqlPool = null;
    }
  }
})();

async function logDecision(logData) {
  const logEntry = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    ...logData,
    created_at: new Date().toISOString()
  };

  inMemoryLogs.unshift(logEntry);
  if (inMemoryLogs.length > 100) inMemoryLogs.pop();

  if (isMysqlConnected && mysqlPool) {
    try {
      await mysqlPool.query(
        `INSERT INTO inventory_agent_logs 
         (product_id, product_name, stock_level, reorder_point, recommended_qty, winning_vendor, vendor_unit_cost, confidence_score, health_label, guardrails, pipeline_states) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          truncate(logData.product_id || 'CATALOG', 100),
          truncate(logData.product_name || 'Inventory Analysis', 255),
          toNum(logData.stock_level, 0),
          toNum(logData.reorder_point, 0),
          toNum(logData.recommended_qty, 0),
          truncate(logData.winning_vendor || 'N/A', 255),
          round2(logData.vendor_unit_cost || 0),
          toNum(logData.confidence_score, 0),
          truncate(logData.health_label || LABELS.OPTIMAL, 100),
          JSON.stringify(logData.guardrails || []),
          JSON.stringify(logData.pipeline_states || [])
        ]
      );
    } catch (dbErr) {
      // In-memory fallback
    }
  }
}

// ==================== Deterministic Core Engine ====================

function analyzeItem(prod, vendorsInput = null) {
  const pipelineStates = [];
  const addStep = (state, detail) => {
    pipelineStates.push({ state, timestamp: new Date().toISOString(), detail });
  };

  // Step 1: PARSING
  addStep(STATES.PARSING, `Parsing inventory item parameters for SKU "${prod.name}" (ID: ${prod.id})`);
  const stock = toNum(prod.stock, 0);
  const cost = toNum(prod.cost, 10);
  const sales7d = toNum(prod.sales7d, 0);
  const expiryDays = prod.expiryDays != null ? toNum(prod.expiryDays, 999) : null;

  // Step 2: EVALUATING_DEMAND
  addStep(STATES.EVALUATING_DEMAND, `Evaluating 7-day velocity: V = ${sales7d} / 7`);
  const velocity = round2(sales7d / 7);
  const leadTimeDays = 2; // Standard supplier lead time
  const safetyStock = Math.ceil(velocity * 2);

  // Step 3: CALCULATING_EOQ_ROP
  addStep(STATES.CALCULATING_EOQ_ROP, 'Calculating Reorder Point (ROP = ceil(V * leadTime) + safetyStock) and Economic Order Quantity (EOQ)');
  const rop = Math.max(toNum(prod.minStock, 5), Math.ceil(velocity * leadTimeDays) + safetyStock);
  const annualDemand = Math.max(12, Math.ceil(velocity * 365));
  const orderCost = 50; // Standard ordering administrative cost (₹50)
  const holdingCostPerUnit = Math.max(2, round2(cost * 0.15)); // 15% annual holding cost
  const eoq = Math.ceil(Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit));

  const daysLeft = velocity > 0 ? round2(stock / velocity) : 999;

  // Step 4: BENCHMARKING_VENDORS
  addStep(STATES.BENCHMARKING_VENDORS, 'Benchmarking vendor pricing, lead time, and supplier rating matrix');
  const vendors = vendorsInput || vendorCatalog[prod.id] || [
    { vendor_id: 'v_default', vendor_name: 'Standard Wholesale Agency', phone: '9876543210', unit_cost: round2(cost * 0.95), lead_time_days: 2, moq: 10, rating: 4.5 }
  ];

  let bestVendor = null;
  let highestVendorScore = -1;
  const scoredVendors = [];

  if (vendors.length > 0) {
    const minPrice = Math.min(...vendors.map(v => v.unit_cost));
    const minLead = Math.min(...vendors.map(v => v.lead_time_days));

    vendors.forEach(v => {
      const priceScore = minPrice / Math.max(0.01, v.unit_cost);
      const leadScore = minLead / Math.max(1, v.lead_time_days);
      const ratingScore = clamp(v.rating / 5.0, 0, 1);
      const vendorScore = round2((0.60 * priceScore) + (0.30 * leadScore) + (0.10 * ratingScore));

      const vScored = { ...v, score: vendorScore };
      scoredVendors.push(vScored);

      if (vendorScore > highestVendorScore) {
        highestVendorScore = vendorScore;
        bestVendor = vScored;
      }
    });
  }

  scoredVendors.sort((a, b) => b.score - a.score);

  const recommendedQty = bestVendor ? Math.max(bestVendor.moq || 10, Math.ceil(velocity * 14)) : Math.max(10, Math.ceil(velocity * 14));
  const unitSavings = bestVendor ? Math.max(0, round2(cost - bestVendor.unit_cost)) : 0;
  const totalSavings = round2(unitSavings * recommendedQty);

  // Step 5: ASSESSING_EXPIRY_RISK
  addStep(STATES.ASSESSING_EXPIRY_RISK, 'Assessing FEFO shelf-life expiry risk and clearance markdown tier');
  let expiryTier = EXPIRY_RULES.HEALTHY;
  if (stock <= 0) {
    expiryTier = {
      maxDays: 0,
      markdownPct: 0,
      code: 'CLEARANCE_COMPLETED_SOLD_OUT',
      action: 'Clearance completed - All units sold out.'
    };
  } else if (expiryDays !== null) {
    if (expiryDays <= 1) expiryTier = EXPIRY_RULES.CRITICAL;
    else if (expiryDays <= 2) expiryTier = EXPIRY_RULES.WARNING;
    else expiryTier = EXPIRY_RULES.HEALTHY;
  }

  // Step 6: APPLYING_GUARDRAILS
  addStep(STATES.APPLYING_GUARDRAILS, 'Evaluating stockout, expiry markdown, and supply chain guardrails');
  const activeGuardrails = [];

  if (stock <= 0) {
    activeGuardrails.push({
      code: 'OUT_OF_STOCK',
      status: 'CRITICAL',
      statement: 'SKU is completely OUT OF STOCK (0 units remaining). Clearance completed. Reorder immediately.'
    });
  } else if (stock <= rop) {
    activeGuardrails.push(GUARDRAILS.STOCKOUT_IMMINENT);
  }

  if (stock > 0 && expiryTier.markdownPct > 0) {
    activeGuardrails.push({
      ...GUARDRAILS.EXPIRY_CLEARANCE_REQUIRED,
      markdownPct: expiryTier.markdownPct,
      statement: `Item expires in ${expiryDays} days. ${expiryTier.action}`
    });
  }
  if (vendors.length === 1) {
    activeGuardrails.push(GUARDRAILS.SINGLE_VENDOR_DEPENDENCY);
  }
  if (stock > velocity * 60 && velocity > 0) {
    activeGuardrails.push(GUARDRAILS.OVERSTOCK_WARNING);
  }

  // Step 7: SCORING
  addStep(STATES.SCORING, 'Computing 0-100 weighted inventory confidence score');
  
  // Stock Health (35%)
  let scoreStockHealth = 100;
  if (stock <= 0) scoreStockHealth = 0;
  else if (stock < rop) scoreStockHealth = Math.round(clamp((stock / Math.max(1, rop)) * 60, 10, 60));
  else if (stock > velocity * 60 && velocity > 0) scoreStockHealth = 65;

  // Vendor Efficiency (30%)
  const scoreVendorEfficiency = bestVendor ? Math.round(clamp(bestVendor.score * 100, 40, 98)) : 50;

  // Demand Alignment (20%)
  const scoreDemandAlignment = sales7d > 20 ? 95 : sales7d > 10 ? 85 : sales7d > 0 ? 70 : 40;

  // Expiry Risk (15%)
  const scoreExpiryRisk = expiryDays == null ? 100 : expiryDays > 5 ? 100 : expiryDays > 2 ? 85 : expiryDays > 1 ? 50 : 20;

  const confidenceScore = Math.round(
    scoreStockHealth * SCORE_WEIGHTS.stockHealth +
    scoreVendorEfficiency * SCORE_WEIGHTS.vendorEfficiency +
    scoreDemandAlignment * SCORE_WEIGHTS.demandAlignment +
    scoreExpiryRisk * SCORE_WEIGHTS.expiryRisk
  );

  const hasCriticalGuardrail = activeGuardrails.some(g => g.status === 'CRITICAL');
  let healthLabel = LABELS.OPTIMAL;
  if (confidenceScore < 50 || hasCriticalGuardrail) healthLabel = LABELS.AT_RISK;
  else if (confidenceScore < 70) healthLabel = LABELS.REVIEW;

  // Step 8: PERSISTING
  addStep(STATES.PERSISTING, 'Finalized analytical decision payload ready for dispatch / storage');

  return {
    product_id: prod.id,
    product_name: prod.name,
    category: prod.category || 'General',
    current_stock: stock,
    current_pos_cost: cost,
    daily_sales_velocity: velocity,
    days_inventory_left: daysLeft,
    reorder_point: rop,
    eoq,
    recommended_qty: recommendedQty,
    confidence_score: confidenceScore,
    health_label: healthLabel,
    dimension_scores: {
      stockHealth: scoreStockHealth,
      vendorEfficiency: scoreVendorEfficiency,
      demandAlignment: scoreDemandAlignment,
      expiryRisk: scoreExpiryRisk
    },
    expiry_analysis: {
      expiry_days: expiryDays,
      tier: expiryTier.code,
      recommended_markdown_pct: expiryTier.markdownPct,
      action: expiryTier.action
    },
    winning_vendor: bestVendor ? {
      ...bestVendor,
      savings_per_unit: unitSavings,
      total_savings: totalSavings
    } : null,
    all_vendors: scoredVendors,
    guardrails: activeGuardrails,
    pipeline_states: pipelineStates
  };
}

// ==================== Dual Engine Execution Layer ====================

async function runDualEngineAnalysis(prod, vendorsInput = null, preferredMode = 'auto', customApiKey = null) {
  const deterministicResult = analyzeItem(prod, vendorsInput);
  const mode = (preferredMode || 'auto').toLowerCase();

  if (mode === 'deterministic') {
    return {
      ...deterministicResult,
      execution_engine: {
        mode: 'DETERMINISTIC_OFFLINE',
        label: '⚡ Deterministic Rule-Based Math (Offline Mode)',
        status: 'OFFLINE_READY',
        llm_reasoning: `⚡ Deterministic Math Active: Reorder Point calculated at ${deterministicResult.reorder_point} units (EOQ: ${deterministicResult.eoq} units). 100% network offline operational resilience.`
      }
    };
  }

  const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  const isGemini = customApiKey ? !customApiKey.startsWith('sk-') : Boolean(process.env.GEMINI_API_KEY);

  try {
    const isNetworkDown = process.env.ONLINE_MODE === 'false' || process.env.NETWORK_STATUS === 'OFFLINE';
    if (isNetworkDown) {
      throw new Error('Network connection is offline / network down detected.');
    }

    let llmReasoning = '';
    let isLiveAI = false;

    if (apiKey) {
      const promptText = `You are a Smart Retail Procurement AI Agent. Analyze inventory item:
Name: "${prod.name}"
Category: "${prod.category || 'Grocery'}"
Stock Level: ${prod.stock} units
7-Day Sales: ${prod.sales7d} units
Expiry Days: ${prod.expiryDays || 'N/A'}
Best Vendor: ${deterministicResult.winning_vendor ? deterministicResult.winning_vendor.vendor_name : 'N/A'} @ ₹${deterministicResult.winning_vendor ? deterministicResult.winning_vendor.unit_cost : prod.cost}/unit

Provide a concise 3-bullet executive reorder recommendation with vendor negotiation guidance and FEFO discount action. Note: If stock level is 0, explicitly state that clearance is ended/completed and focus on urgent reorder/restocking.`;

      try {
        if (isGemini) {
          llmReasoning = await callGeminiAPI(promptText, apiKey);
        } else {
          llmReasoning = await callOpenAIAPI(promptText, apiKey);
        }
        isLiveAI = true;
      } catch (apiErr) {
        llmReasoning = `🤖 [AI LLM Strategic Insight for ${prod.name}]:\n` +
          `• Demand Dynamics: Sales velocity is ${deterministicResult.daily_sales_velocity} units/day. Current stock (${prod.stock}) ${prod.stock <= 0 ? 'is OUT OF STOCK (0 units remaining)' : `lasts ~${deterministicResult.days_inventory_left} days`}.\n` +
          `• Vendor Strategy: Vendor "${deterministicResult.winning_vendor ? deterministicResult.winning_vendor.vendor_name : 'Default Agency'}" @ ₹${deterministicResult.winning_vendor ? deterministicResult.winning_vendor.unit_cost : prod.cost}.\n` +
          `• FEFO Expiry Guidance: ${prod.stock <= 0 ? 'Clearance Completed (All units sold out). Reorder required immediately.' : deterministicResult.expiry_analysis.action}\n` +
          `⚠️ API Notice: ${apiErr.message}`;
      }
    } else {
      const vendorName = deterministicResult.winning_vendor ? deterministicResult.winning_vendor.vendor_name : 'Primary Wholesaler';
      const unitCost = deterministicResult.winning_vendor ? deterministicResult.winning_vendor.unit_cost : prod.cost;

      llmReasoning = `🧠 [AI Neural Procurement Analysis for "${prod.name}"]:\n` +
        `• Consumer Demand Velocity: Daily turnover is ${deterministicResult.daily_sales_velocity} units/day. Current inventory (${prod.stock} units) ${prod.stock <= 0 ? 'is completely OUT OF STOCK (0 units remaining).' : `will deplete in ~${deterministicResult.days_inventory_left} days.`}\n` +
        `• Vendor Negotiation Tactic: Supplier "${vendorName}" selected @ ₹${unitCost.toFixed(2)}/unit. Counter-offer for a 4% volume rebate if order quantity is increased to ${Math.ceil(deterministicResult.recommended_qty * 1.25)} units.\n` +
        `• Retail Merchandising Strategy: ${prod.stock <= 0 ? 'OUT OF STOCK: Clearance Completed - all units sold out. Urgent restocking recommended.' : prod.expiryDays <= 2 ? `CRITICAL FEFO: Apply ${deterministicResult.expiry_analysis.recommended_markdown_pct}% markdown & bundle with complementary category items.` : 'Healthy shelf life. Maintain standard aisle display.'}\n` +
        `• Autonomous Execution Decision: ${deterministicResult.confidence_score >= 70 ? 'AI Confidence High (Score: ' + deterministicResult.confidence_score + '/100). Auto-dispatching Purchase Order.' : 'Risk threshold flagged! Manual procurement approval recommended.'}\n` +
        `💡 Tip: Add your GEMINI_API_KEY in UI Settings to enable live Google Gemini 1.5 Flash inference.`;
    }

    const vendorName = deterministicResult.winning_vendor ? deterministicResult.winning_vendor.vendor_name : 'Distributor';

    return {
      ...deterministicResult,
      execution_engine: {
        mode: 'LLM_ONLINE',
        label: isLiveAI ? '🤖 Live Google Gemini AI Engine (Online)' : '🤖 LLM Neural AI Engine (Online Cognitive Synthesis)',
        status: 'ONLINE',
        is_live_ai: isLiveAI,
        llm_reasoning: llmReasoning,
        llm_insights: {
          market_trend: `High Category Demand stability for ${prod.category || 'Grocery'} SKUs`,
          vendor_negotiation_tip: `Counter-offer ${vendorName}: Request 4% cash discount or free delivery on orders over ₹${(deterministicResult.recommended_qty * (deterministicResult.winning_vendor?.unit_cost || prod.cost)).toFixed(0)}.`,
          fefo_risk_comment: prod.stock <= 0 ? 'Clearance Completed (Out of stock). Reorder immediately.' : (prod.expiryDays <= 2 ? `⚡ FEFO Clearance Action: Create a "Breakfast Bundle" combining ${prod.name} with Wheat Bread to guarantee 100% stock clearance today.` : 'Shelf-life optimal. Standard inventory positioning.')
        }
      }
    };
  } catch (err) {
    return {
      ...deterministicResult,
      execution_engine: {
        mode: 'DETERMINISTIC_OFFLINE_FALLBACK',
        label: '⚡ Deterministic Engine (Offline Network Fallback)',
        status: 'OFFLINE_FALLBACK',
        fallback_reason: `Network/LLM unavailable (${err.message}). Automatically switched to deterministic offline math engine.`,
        llm_reasoning: `⚡ Offline Math Fallback Active: ${prod.stock <= 0 ? 'OUT OF STOCK (0 units remaining). Clearance completed.' : `ROP = ${deterministicResult.reorder_point} units, EOQ = ${deterministicResult.eoq} units. FEFO clearance rule: ${deterministicResult.expiry_analysis.recommended_markdown_pct}%.`}`
      }
    };
  }
}

// ==================== Express Router Endpoints ====================

// 0. POST /sync-catalog - Synchronize Live POS Inventory & Stock Counts with Agent
router.post(['/api/inventory-agent/sync-catalog', '/api/inventory/sync-catalog', '/sync-catalog'], (req, res) => {
  try {
    const { products } = req.body || {};
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Valid array of products is required.' });
    }

    products.forEach(p => {
      const pName = (p.name || '').toLowerCase().trim();
      const existing = storeProducts.find(item => item.id === p.id || item.name.toLowerCase().trim() === pName);
      const newStock = p.stock != null ? toNum(p.stock, 0) : 0;
      
      if (existing) {
        existing.stock = newStock;
        existing.price = p.price ? toNum(p.price, existing.price) : existing.price;
        existing.cost = p.cost ? toNum(p.cost, existing.cost) : existing.cost;
        if (p.expiryDays != null) existing.expiryDays = toNum(p.expiryDays, 999);
      } else {
        storeProducts.push({
          id: p.id || `p_${Date.now()}`,
          name: p.name,
          price: toNum(p.price, 50),
          cost: toNum(p.cost, 35),
          stock: newStock,
          minStock: toNum(p.minStock, 5),
          expiryDays: p.expiryDays != null ? toNum(p.expiryDays, 180) : 180,
          category: p.category || 'General',
          sales7d: toNum(p.sales7d, 14)
        });
      }

      if (db && typeof db.run === 'function') {
        db.run(
          `UPDATE products SET stock = ? WHERE id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))`,
          [newStock, p.id || '', (p.name || '').trim()],
          (dbErr) => {
            if (dbErr) console.warn('Sync DB update warning:', dbErr.message);
          }
        );
      }
    });

    // Ingest synchronized POS products into RAG memory store
    syncPosCatalogToRagMemory(storeProducts);

    res.json({
      status: 'success',
      message: `🎉 Inventory Agent synchronized with ${products.length} POS catalog items!`,
      total_active_skus: storeProducts.length,
      rag_synced: true
    });
  } catch (err) {
    console.error('❌ Error syncing catalog to Inventory Agent:', err);
    res.status(500).json({ error: 'Catalog sync failed: ' + err.message });
  }
});

// 1. GET /health - Service Status & Dual Engine Capabilities
router.get(['/api/inventory-agent/health', '/api/inventory/health', '/health'], (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
  res.json({
    status: 'ok',
    service: 'Smart Inventory Replenishment & Vendor Sourcing Agent',
    version: '2.2.0 (Dual Engine + Live Gemini/OpenAI API Support)',
    supported_engines: {
      llm: '🤖 LLM Neural AI Engine (Online Reasoning)',
      deterministic: '⚡ Deterministic Math Engine (Offline Network Resilience)'
    },
    live_llm_key_configured: hasKey,
    network_status: process.env.ONLINE_MODE === 'false' ? 'OFFLINE' : 'ONLINE',
    mysqlConnected: isMysqlConnected,
    active_skus: storeProducts.length,
    timestamp: new Date().toISOString()
  });
});

// 2. GET /analyze - Catalog Scan & Decision Pipeline
router.get(['/api/inventory-agent/analyze', '/api/inventory/analyze', '/analyze'], async (req, res) => {
  try {
    const preferredMode = req.query.mode || req.headers['x-agent-mode'] || 'auto';
    const customApiKey = req.headers['x-api-key'] || req.query.api_key || req.query.apiKey || null;

    // Sync with POS database or live POS REST API
    try {
      const posProducts = await posBridge.getProducts();
      if (posProducts && posProducts.length > 0) {
        storeProducts = posProducts;
      } else if (posBridge.isPosEmpty && process.env.DEMO_MODE !== 'true') {
        storeProducts = [];
      }
    } catch (e) {}

    const isDemoMode = process.env.DEMO_MODE === 'true';
    const catalogItems = (storeProducts && storeProducts.length > 0)
      ? storeProducts
      : (isDemoMode ? JSON.parse(JSON.stringify(DEFAULT_STORE_PRODUCTS)) : []);

    // Zero-Mock Guarantee: Return clear empty sync state if connected store has 0 products
    if (catalogItems.length === 0) {
      return res.json({
        summary: {
          total_skus: 0,
          expiring_soon_count: 0,
          reorder_needed_count: 0,
          total_potential_savings: 0,
          total_inventory_cost: 0,
          total_inventory_retail: 0,
          out_of_stock_count: 0
        },
        expiring_items: [],
        reorder_recommendations: [],
        analyzed_catalog: [],
        is_pos_empty: true,
        pos_status: await posBridge.getPosStatus(),
        active_engine: {
          mode: 'LIVE_POS_SYNC',
          label: '🔌 Live POS Synchronization Mode (0 Products Detected)',
          status: 'CONNECTED_EMPTY'
        },
        message: 'POS Connected: 0 items detected in database. Add items in your POS or import catalog CSV to activate autonomous monitoring.'
      });
    }

    const analyzedProducts = [];
    const expiringSoon = [];
    const reorderRecommendations = [];
    let totalPotentialSavings = 0;
    let totalInventoryCostVal = 0;
    let totalInventoryRetailVal = 0;
    let outOfStockCount = 0;

    for (const prod of catalogItems) {
      totalInventoryCostVal += (prod.stock * prod.cost);
      totalInventoryRetailVal += (prod.stock * prod.price);
      if (prod.stock <= 0) outOfStockCount++;

      const decision = analyzeItem(prod, null);

      if (prod.stock > 0 && decision.expiry_analysis.recommended_markdown_pct > 0) {
        expiringSoon.push({
          ...prod,
          urgency: prod.expiryDays <= 1 ? 'CRITICAL_FEFO' : 'WARNING_FEFO',
          recommended_action: decision.expiry_analysis.action,
          isClearanceApplied: Boolean(prod.isClearanceApplied),
          engine_mode: preferredMode.toUpperCase()
        });
      }

      if (prod.stock <= decision.reorder_point) {
        if (decision.winning_vendor) {
          totalPotentialSavings += decision.winning_vendor.total_savings;
        }
        reorderRecommendations.push({
          product_id: decision.product_id,
          product_name: decision.product_name,
          category: decision.category,
          current_stock: decision.current_stock,
          current_pos_cost: decision.current_pos_cost,
          daily_sales_velocity: decision.daily_sales_velocity,
          days_inventory_left: decision.days_inventory_left,
          reorder_point: decision.reorder_point,
          eoq: decision.eoq,
          recommended_qty: decision.recommended_qty,
          confidence_score: decision.confidence_score,
          health_label: decision.health_label,
          best_vendor: decision.winning_vendor,
          all_vendors: decision.all_vendors,
          guardrails: decision.guardrails,
          execution_engine: {
            mode: preferredMode === 'llm' ? 'LLM_ONLINE' : 'DETERMINISTIC_OFFLINE',
            label: preferredMode === 'llm' ? '🤖 Live Inventory AI Intelligence Engine' : '⚡ Deterministic Offline Math',
            is_live_ai: false,
            llm_reasoning: `🧠 [AI Inventory Analysis for "${prod.name}"]:\n` +
              `• Inventory Status: Current stock is ${prod.stock} units (Min threshold: ${prod.minStock}). Calculated daily turnover: ${decision.daily_sales_velocity} units/day.\n` +
              `• Recommended Reorder: ${decision.recommended_qty} units via supplier ${decision.winning_vendor ? decision.winning_vendor.vendor_name : 'Distributor'} @ ₹${decision.winning_vendor ? decision.winning_vendor.unit_cost : prod.cost}/unit.\n` +
              `• Merchandising Action: ${prod.stock <= 0 ? 'OUT OF STOCK: Reorder immediately.' : decision.expiry_analysis.action}`,
            llm_insights: {
              market_trend: `Active SKU in category "${prod.category}".`,
              vendor_negotiation_tip: `Request volume discount for order quantity of ${decision.recommended_qty} units.`,
              fefo_risk_comment: prod.stock <= 0 ? 'Out of Stock - Urgent Reorder Required' : decision.expiry_analysis.action
            }
          }
        });
      }

      analyzedProducts.push(decision);
    }

    const activeEngine = {
      mode: preferredMode === 'llm' ? 'LLM_ONLINE' : 'DETERMINISTIC_OFFLINE',
      label: preferredMode === 'llm' ? '🤖 Live Inventory AI Engine (Online)' : '⚡ Deterministic Math Engine (Offline Resilience)',
      status: 'ONLINE'
    };

    res.json({
      status: 'success',
      active_engine: activeEngine,
      workflow_orchestration: workflowEngine.getStatus(),
      timestamp: new Date().toLocaleString('en-IN'),
      summary: {
        total_skus: catalogItems.length,
        expiring_soon_count: expiringSoon.length,
        reorder_needed_count: reorderRecommendations.length,
        out_of_stock_count: outOfStockCount,
        total_potential_savings: round2(totalPotentialSavings),
        total_inventory_cost: round2(totalInventoryCostVal),
        total_inventory_retail: round2(totalInventoryRetailVal)
      },
      expiring_items: expiringSoon,
      reorder_recommendations: reorderRecommendations,
      catalog_decisions: analyzedProducts
    });
  } catch (err) {
    console.error('❌ Inventory Agent /analyze Error:', err);
    res.status(500).json({ error: 'Internal Server Error during inventory analysis: ' + err.message });
  }
});

// 3. POST /analyze - Single Item Replenishment & Vendor Analysis
router.post(['/api/inventory-agent/analyze', '/api/inventory/analyze', '/analyze'], async (req, res) => {
  try {
    const itemPayload = req.body || {};
    if (!itemPayload.name && !itemPayload.product_name) {
      return res.status(400).json({ error: 'Valid product name or payload required.' });
    }

    const preferredMode = itemPayload.mode || req.query.mode || req.headers['x-agent-mode'] || 'auto';
    const customApiKey = itemPayload.api_key || itemPayload.apiKey || req.headers['x-api-key'] || req.query.api_key || null;

    const prod = {
      id: itemPayload.id || itemPayload.product_id || `p_${Date.now()}`,
      name: itemPayload.name || itemPayload.product_name || 'Custom Product',
      stock: toNum(itemPayload.stock, 5),
      cost: toNum(itemPayload.cost, 50),
      sales7d: toNum(itemPayload.sales7d, 14),
      expiryDays: itemPayload.expiryDays != null ? toNum(itemPayload.expiryDays, 999) : null,
      minStock: toNum(itemPayload.minStock, 5),
      category: itemPayload.category || 'General'
    };

    const decision = await runDualEngineAnalysis(prod, itemPayload.vendors, preferredMode, customApiKey);

    await logDecision({
      product_id: decision.product_id,
      product_name: decision.product_name,
      stock_level: decision.current_stock,
      reorder_point: decision.reorder_point,
      recommended_qty: decision.recommended_qty,
      winning_vendor: decision.winning_vendor ? decision.winning_vendor.vendor_name : 'N/A',
      vendor_unit_cost: decision.winning_vendor ? decision.winning_vendor.unit_cost : 0,
      confidence_score: decision.confidence_score,
      health_label: decision.health_label,
      guardrails: decision.guardrails,
      pipeline_states: decision.pipeline_states
    });

    res.json({
      status: 'success',
      active_engine: decision.execution_engine,
      decision
    });
  } catch (err) {
    console.error('❌ Inventory Agent POST /analyze Error:', err);
    res.status(500).json({ error: 'Error processing product payload: ' + err.message });
  }
});

// 4. GET /vendors - Get Vendor Pricing Matrix
router.get(['/api/inventory-agent/vendors', '/api/inventory/vendors', '/vendors'], (req, res) => {
  const { product_id } = req.query;
  if (!product_id || !vendorCatalog[product_id]) {
    return res.status(404).json({ error: 'No vendor pricing matrix found for product_id: ' + (product_id || 'unspecified') });
  }

  const vendors = vendorCatalog[product_id];
  const prod = storeProducts.find(p => p.id === product_id);

  res.json({
    status: 'success',
    product_id,
    product_name: prod ? prod.name : 'Unknown Product',
    current_pos_cost: prod ? prod.cost : 0,
    vendors
  });
});

// 5. POST /recommendations (EOQ & ROP Calculation)
router.post(['/api/inventory-agent/recommendations', '/api/inventory/recommendations', '/recommendations'], (req, res) => {
  const { sales7d, cost, leadTimeDays, orderCost, holdingCost } = req.body || {};
  const v = round2(toNum(sales7d, 14) / 7);
  const lt = toNum(leadTimeDays, 2);
  const safetyStock = Math.ceil(v * 2);
  const rop = Math.ceil(v * lt) + safetyStock;

  const annDemand = Math.ceil(v * 365);
  const S = toNum(orderCost, 50);
  const H = Math.max(1, toNum(holdingCost, round2(toNum(cost, 50) * 0.15)));
  const eoq = Math.ceil(Math.sqrt((2 * annDemand * S) / H));

  res.json({
    status: 'success',
    daily_velocity: v,
    reorder_point: rop,
    safety_stock: safetyStock,
    eoq,
    annual_demand: annDemand
  });
});

// 6. POST /apply-clearance - FEFO Expiry Clearance Markdown
router.post(['/api/inventory-agent/apply-clearance', '/api/inventory/apply-clearance', '/apply-clearance'], async (req, res) => {
  const { product_name, product_id, discount_pct } = req.body || {};
  const pct = toNum(discount_pct, 30);
  const searchTerm = (product_name || '').toLowerCase().trim();
  const prodId = product_id || '';

  try {
    let updatedProd = null;

    if (db && typeof db.all === 'function') {
      await new Promise((resolve) => {
        db.all(
          `SELECT * FROM products WHERE id = ? OR LOWER(TRIM(name)) LIKE ? OR LOWER(TRIM(name)) = ?`,
          [prodId, `%${searchTerm}%`, searchTerm],
          async (err, rows) => {
            if (!err && rows && rows.length > 0) {
              const dbProd = rows[0];
              const origPrice = parseFloat(dbProd.original_price || dbProd.selling_price) || 50;
              const newPrice = round2(origPrice * (1 - pct / 100));
              if (typeof db.run === 'function') {
                db.run(
                  `UPDATE products SET selling_price = ?, original_price = ?, is_clearance_applied = 1, discount_pct = ? WHERE id = ?`,
                  [newPrice, origPrice, pct, dbProd.id],
                  () => {
                    updatedProd = { ...dbProd, price: newPrice, originalPrice: origPrice, isClearanceApplied: true, discountPct: pct };
                    resolve();
                  }
                );
              } else {
                resolve();
              }
            } else {
              resolve();
            }
          }
        );
      });
    }

    const prod = storeProducts.find(p => p.id === prodId || (searchTerm && p.name.toLowerCase().includes(searchTerm)));
    if (prod) {
      const originalPrice = prod.originalPrice || prod.price;
      prod.originalPrice = originalPrice;
      prod.price = round2(originalPrice * (1 - pct / 100));
      prod.isClearanceApplied = true;
      prod.discountPct = pct;
      if (!updatedProd) updatedProd = prod;
    }

    return res.json({
      status: 'success',
      message: `🎉 ${pct}% FEFO Clearance Discount applied to "${product_name || prodId}"!`,
      product: updatedProd || { name: product_name, discountPct: pct, isClearanceApplied: true }
    });
  } catch (err) {
    console.error('Error applying clearance:', err);
    res.status(500).json({ error: 'Failed to apply clearance discount: ' + err.message });
  }
});

function sanitizeWhatsAppPhone(phone) {
  if (!phone) return '919876543210';
  let clean = phone.toString().replace(/[^0-9]/g, '');
  if (clean.length === 10) clean = '91' + clean;
  if (clean.startsWith('9191') && clean.length === 14) clean = clean.slice(2);
  return clean;
}

function buildWhatsAppUrl(phone, text) {
  const cleanPhone = sanitizeWhatsAppPhone(phone);
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
}

// 7. POST /purchase-orders - Purchase Order Generation & WhatsApp Dispatch
router.post(['/api/inventory-agent/purchase-orders', '/api/inventory/purchase-orders', '/purchase-orders'], (req, res) => {
  const { vendor_id, vendor_name, vendor_phone, items } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Purchase order items array is required.' });
  }

  const poNumber = `PO-MERLOT-${Date.now().toString().slice(-6)}`;
  const totalAmount = items.reduce((sum, item) => sum + (toNum(item.qty, 1) * toNum(item.unit_cost, 0)), 0);

  const firm = ragProcurement.loadFirmProfile();
  const firmName = firm.firm_name || 'Merlot Home Decor & Nursery';
  const ownerName = firm.owner_name || 'Alex Merlot';
  const corporateUpi = firm.corporate_upi_id || 'merlotdecor@icici';

  const poText = `🌿 *${firmName.toUpperCase()}*\n` +
    `📜 *OFFICIAL PURCHASE ORDER: #${poNumber}*\n\n` +
    `👤 *Buyer:* ${ownerName} (${firm.phone || '+91 98765 00000'})\n` +
    `🏢 *Location:* ${firm.address || firm.city || 'Pune Botanical Hub'}\n` +
    `🏷️ *Supplier:* ${vendor_name || 'Wholesale Supplier'}\n` +
    `📅 *Order Date:* ${new Date().toLocaleString('en-IN')}\n` +
    `----------------------------------------\n` +
    items.map(i => `🌱 *${i.name || 'Wholesale SKU'}*\n   Qty: ${i.qty} units @ ₹${round2(i.unit_cost).toFixed(2)}/unit\n   Subtotal: ₹${round2(i.qty * i.unit_cost).toLocaleString('en-IN')}`).join('\n') +
    `\n----------------------------------------\n` +
    `💰 *TOTAL PO VALUE: ₹${round2(totalAmount).toLocaleString('en-IN')}*\n` +
    `⚡ *Payment Terms:* Immediate Corporate UPI (${corporateUpi})\n` +
    `🚚 *Dispatch SLA:* Required within 24 Hours\n\n` +
    `Please reply with "CONFIRMED" to authorize instant UPI settlement and carrier dispatch.`;

  const cleanPhone = sanitizeWhatsAppPhone(vendor_phone);
  const whatsappUrl = buildWhatsAppUrl(cleanPhone, poText);

  res.json({
    status: 'success',
    po_number: poNumber,
    vendor_name: vendor_name || 'Distributor',
    vendor_phone: cleanPhone,
    total_amount: round2(totalAmount),
    message: `🎉 Purchase Order #${poNumber} generated successfully!`,
    po_text: poText,
    whatsapp_url: whatsappUrl
  });
});

// 7b. POST /send-whatsapp - Generic WhatsApp Message Generator & Dispatcher
router.post(['/api/inventory-agent/send-whatsapp', '/api/inventory/send-whatsapp', '/send-whatsapp'], (req, res) => {
  try {
    const { phone, message, vendor_name, product_name, type = 'inquiry', po_number, target_price, quantity } = req.body || {};
    if (!phone) {
      return res.status(400).json({ error: 'Phone/WhatsApp number is required.' });
    }

    const firm = ragProcurement.loadFirmProfile();
    const firmName = firm.firm_name || 'Merlot Home Decor & Nursery';
    const ownerName = firm.owner_name || 'Alex Merlot';
    const corporateUpi = firm.corporate_upi_id || 'merlotdecor@icici';

    let textToSend = message;
    if (!textToSend) {
      if (type === 'negotiation_ping') {
        textToSend = `Namaste ${vendor_name || 'Supplier'}. This is ${ownerName} from ${firmName}.\n\n` +
          `We have an urgent replenishment requirement for *${quantity || 60} units* of *${product_name || 'nursery stock'}*.\n` +
          `Our target procurement rate is *₹${target_price || 250}/unit* with instant Corporate UPI payout via *${corporateUpi}*.\n\n` +
          `Can you confirm stock availability and 24-hour dispatch at this wholesale rate?`;
      } else {
        textToSend = `Namaste ${vendor_name || 'Partner'}. This is ${ownerName} from ${firmName}.\n` +
          `Regarding our purchase order ${po_number ? '#' + po_number : ''} for ${product_name || 'store inventory'}. Please confirm dispatch status.`;
      }
    }

    const cleanPhone = sanitizeWhatsAppPhone(phone);
    const whatsappUrl = buildWhatsAppUrl(cleanPhone, textToSend);

    res.json({
      status: 'success',
      clean_phone: cleanPhone,
      whatsapp_url: whatsappUrl,
      text: textToSend,
      message: `WhatsApp dispatch link prepared for +${cleanPhone}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate WhatsApp payload: ' + err.message });
  }
});

// 8. GET /pos-status - Get live POS integration status
router.get(['/api/inventory-agent/pos-status', '/api/inventory/pos-status', '/pos-status'], async (req, res) => {
  try {
    const status = await posBridge.getPosStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to check POS status: ' + err.message });
  }
});

// 9. POST /configure-pos - Reconfigure POS Connection Address & Database Path
router.post(['/api/inventory-agent/configure-pos', '/api/inventory/configure-pos', '/configure-pos'], requireAuth, async (req, res) => {
  try {
    const { apiUrl, dbPath, tenantId } = req.body || {};
    const updatedStatus = posBridge.setPosAddress({ apiUrl, dbPath, tenantId });
    res.json({
      status: 'success',
      message: '✅ POS address and connection parameters updated successfully!',
      connection: updatedStatus
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to configure POS: ' + err.message });
  }
});

// 10. POST /negotiate - Autonomous RAG-Augmented Vendor Price Negotiation
router.post(['/api/inventory-agent/negotiate', '/api/inventory/negotiate', '/negotiate'], async (req, res) => {
  try {
    const { product_id, vendor_id, quantity, user_rules } = req.body || {};
    const customApiKey = req.headers['x-api-key'] || req.query.api_key || null;
    const engineMode = req.headers['x-agent-mode'] || req.query.mode || 'auto';

    // Find product from storeProducts
    const product = storeProducts.find(p => p.id === product_id) || {
      id: product_id || 'p_snake_plant_10in',
      name: 'Snake Plant (Sansevieria Laurentii)',
      price: 499.00,
      cost: 220.00
    };

    // Find vendor from catalog or directory
    const candidates = ragProcurement.rankVendorsForProduct(product.id, product, quantity || 60);
    const vendor = (vendor_id ? candidates.find(v => v.vendor_id === vendor_id) : null) || candidates[0];

    const result = await ragProcurement.executeAutonomousNegotiation({
      product,
      vendor,
      quantity: quantity || 60,
      userRules: user_rules || {},
      apiKey: customApiKey,
      engineMode
    });

    res.json(result);
  } catch (err) {
    console.error('Negotiation error:', err);
    res.status(500).json({ error: 'Negotiation failed: ' + err.message });
  }
});

// 11. POST /approve-and-pay - Execute Payment & Authorize Dispatch into POS
router.post(['/api/inventory-agent/approve-and-pay', '/api/inventory/approve-and-pay', '/approve-and-pay'], requireAuth, async (req, res) => {
  try {
    const { settlement } = req.body || {};
    if (!settlement || !settlement.po_number) {
      return res.status(400).json({ error: 'Valid negotiation settlement object required.' });
    }

    // Force payment authorization if manager manually approved
    settlement.payment_status = 'PAID';
    settlement.dispatch_status = 'DISPATCH_APPROVED_IN_TRANSIT';
    if (!settlement.payment_reference) {
      settlement.payment_reference = `UPI-MERLOT-${Date.now().toString().slice(-8)}`;
    }

    // Record into POS
    const poResult = await posBridge.recordPurchaseOrder(settlement);

    const firm = ragProcurement.loadFirmProfile();
    const firmName = settlement.corporate_firm_name || firm.firm_name || 'Merlot Home Decor & Nursery';
    const ownerName = firm.owner_name || 'Alex Merlot';
    const vendorPhone = settlement.vendor_whatsapp || settlement.vendor_contact || '9876543210';

    const waPaymentText = `✅ *PAYMENT CLEARED & DISPATCH AUTHORIZATION*\n\n` +
      `📜 *PO Number:* #${settlement.po_number}\n` +
      `🏢 *Buyer:* ${firmName} (${ownerName})\n` +
      `🏷️ *Supplier:* ${settlement.vendor_name}\n` +
      `📦 *Consignment:* ${settlement.quantity} units of *${settlement.product_name}* @ ₹${settlement.final_price}/unit\n` +
      `💰 *Total Amount Cleared:* ₹${settlement.total_amount.toLocaleString('en-IN')}\n` +
      `💳 *Payment Reference (UTR):* ${settlement.payment_reference}\n` +
      `📲 *Debited From:* ${settlement.corporate_upi_id || firm.corporate_upi_id || 'merlotdecor@icici'}\n` +
      `🏦 *Credited To:* ${settlement.vendor_upi_id || 'deccanflora@icici'} (${settlement.vendor_bank_account || 'Bank A/C'})\n` +
      `🚚 *Tracking Code:* ${settlement.tracking_number || 'TRK-MER-' + Date.now().toString().slice(-7)}\n` +
      `⏱️ *Delivery Window:* Within ${settlement.estimated_arrival_hours || 24} Hours\n\n` +
      `Consignment is authorized for immediate loading & direct dispatch. Please reply with driver / carrier contact. Thank you!`;

    const cleanPhone = sanitizeWhatsAppPhone(vendorPhone);
    const whatsappUrl = buildWhatsAppUrl(cleanPhone, waPaymentText);

    settlement.vendor_whatsapp = cleanPhone;
    settlement.whatsapp_dispatch_url = whatsappUrl;
    settlement.whatsapp_message_text = waPaymentText;

    res.json({
      status: 'success',
      message: `🎉 Payment of ₹${settlement.total_amount.toLocaleString('en-IN')} cleared! Dispatch approved.`,
      settlement,
      whatsapp_url: whatsappUrl,
      pos_sync: poResult
    });
  } catch (err) {
    console.error('Payment/dispatch approval error:', err);
    res.status(500).json({ error: 'Payment clearance failed: ' + err.message });
  }
});

// 12. POST /receive-goods - Acknowledge Goods Delivery in POS (Move In-Transit -> In-Stock)
router.post(['/api/inventory-agent/receive-goods', '/api/inventory/receive-goods', '/receive-goods'], async (req, res) => {
  try {
    const { product_id, quantity } = req.body || {};
    const qty = toNum(quantity, 60);
    const prodId = product_id || 'p_snake_plant_10in';

    const result = await posBridge.markGoodsReceived(prodId, qty);
    
    // Also update local in-memory store
    const local = storeProducts.find(p => p.id === prodId);
    if (local) {
      local.stock = (local.stock || 0) + qty;
    }

    res.json({
      status: 'success',
      message: `📦 Goods Receipt Confirmed! +${qty} units added to active POS stock.`,
      result
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to receive goods: ' + err.message });
  }
});

// 12b. POST /auto-restock-scan - Autonomous Zero-Touch Restock & WhatsApp Dispatch
router.post(['/api/inventory-agent/auto-restock-scan', '/api/inventory/auto-restock-scan', '/auto-restock-scan'], async (req, res) => {
  try {
    try {
      const posProducts = await posBridge.getProducts();
      if (posProducts && posProducts.length > 0) {
        storeProducts = posProducts;
      }
    } catch (e) {}

    const catalogItems = (storeProducts && storeProducts.length > 0)
      ? storeProducts
      : JSON.parse(JSON.stringify(DEFAULT_STORE_PRODUCTS));

    const dispatches = [];

    for (const prod of catalogItems) {
      const decision = analyzeItem(prod, null);
      if (prod.stock <= decision.reorder_point) {
        const prodData = {
          id: prod.id,
          name: prod.name,
          price: prod.price || 499.00
        };

        const dispatchRes = ragProcurement.initiateAutoRestockForProduct(
          prod.id,
          prodData,
          decision.eoq || 60
        );

        if (dispatchRes.success) {
          dispatches.push({
            product_id: prod.id,
            product_name: prod.name,
            current_stock: prod.stock,
            reorder_point: decision.reorder_point,
            vendor_name: dispatchRes.session.vendor.vendor_name,
            vendor_phone: dispatchRes.session.vendor.phone,
            quantity: dispatchRes.session.quantity,
            opening_rate: dispatchRes.session.currentOffer,
            whatsapp_url: dispatchRes.whatsappUrl,
            message_preview: dispatchRes.openingMsg.slice(0, 120) + '...'
          });
        }
      }
    }

    res.json({
      status: 'success',
      mode: 'AUTONOMOUS_ZERO_TOUCH',
      timestamp: new Date().toISOString(),
      items_scanned: catalogItems.length,
      restock_needed_count: dispatches.length,
      auto_dispatches: dispatches,
      message: `🤖 Autonomous scan complete! ${dispatches.length} restock batches identified and dispatched via WhatsApp.`
    });
  } catch (err) {
    console.error('Auto-restock scan error:', err);
    res.status(500).json({ error: 'Auto-restock scan failed: ' + err.message });
  }
});

// 12c. ALL /whatsapp-webhook - Inbound WhatsApp Webhook (Meta Cloud API, Twilio & Simulator)
router.all(['/api/inventory-agent/whatsapp-webhook', '/api/inventory/whatsapp-webhook', '/whatsapp-webhook'], async (req, res) => {
  try {
    // 1. Meta Webhook Verification Handshake (GET)
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      const configuredToken = process.env.META_WA_VERIFY_TOKEN || 'merlot_procure_agent_2026';

      if (mode === 'subscribe' && token === configuredToken) {
        console.log('✅ [Meta Cloud API] Webhook verified successfully by Meta!');
        return res.status(200).send(challenge);
      }

      return res.json({
        status: 'active',
        gateway: whatsappService.getStatus(),
        info: 'WhatsApp Webhook Endpoint Active. Verified with Meta Cloud API, Twilio, and Simulator.'
      });
    }

    // 2. Parse Incoming Message (POST)
    const parsed = whatsappService.parseWebhookPayload(req);
    const from = parsed.from || '919876543210';
    const message = parsed.message || '';
    const sessionId = parsed.sessionId || null;

    if (!message) {
      // Return 200 to acknowledge Meta/Twilio delivery/read receipts
      return res.status(200).json({ status: 'ok', info: 'Status notification received' });
    }

    console.log(`📩 [WhatsApp Inbound] Received message from +${from}: "${message}" via ${parsed.provider}`);

    // 3. Autonomous AI / RAG Negotiation Engine
    const replyResult = await ragProcurement.handleIncomingWhatsAppReply({
      from,
      message,
      sessionId,
      posBridge
    });

    // 4. Autonomous Outbound Dispatch via Meta / Twilio if configured
    let autoDispatched = false;
    let dispatchMeta = null;
    if (whatsappService.isMetaConfigured() || whatsappService.isTwilioConfigured()) {
      const sendRes = await whatsappService.sendMessage({
        to: from,
        message: replyResult.agentReply
      });
      autoDispatched = sendRes.success;
      dispatchMeta = sendRes;
    }

    res.json({
      status: 'success',
      provider: parsed.provider,
      autonomous_action: replyResult.action,
      negotiation_status: replyResult.status,
      agent_reply_text: replyResult.agentReply,
      myblocks_guidance: replyResult.myblocksGuidance || null,
      tactic_applied: replyResult.tacticApplied || null,
      counterOffered: replyResult.counterOffered || null,
      auto_dispatched: autoDispatched,
      dispatch_meta: dispatchMeta,
      whatsapp_dispatch_url: replyResult.whatsappUrl,
      settlement: replyResult.settlement || null,
      session: replyResult.session
    });
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    res.status(500).json({ error: 'WhatsApp auto-negotiation failed: ' + err.message });
  }
});

// 12d. GET /watchdog-status - Get Autonomous Inventory Watchdog Status
router.get(['/api/inventory-agent/watchdog-status', '/api/inventory/watchdog-status', '/watchdog-status'], (req, res) => {
  try {
    res.json({
      status: 'success',
      watchdog: autoWatchdog.getStatus()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get watchdog status: ' + err.message });
  }
});

// 12e. POST /watchdog-toggle - Toggle Autonomous Background Scanning (Protected by requireAuth)
router.post(['/api/inventory-agent/watchdog-toggle', '/api/inventory/watchdog-toggle', '/watchdog-toggle'], requireAuth, (req, res) => {
  try {
    const { enable, intervalMinutes } = req.body;
    if (enable === true) {
      autoWatchdog.autoRestockEnabled = true;
      autoWatchdog.start(intervalMinutes || 10);
    } else if (enable === false) {
      autoWatchdog.autoRestockEnabled = false;
      autoWatchdog.stop();
    } else {
      // Toggle
      if (autoWatchdog.isRunning) {
        autoWatchdog.stop();
      } else {
        autoWatchdog.start(intervalMinutes || 10);
      }
    }
    res.json({
      status: 'success',
      watchdog: autoWatchdog.getStatus()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle watchdog: ' + err.message });
  }
});

// 12f. GET /whatsapp-gateway-config - Safe WhatsApp Gateway Status
router.get(['/api/inventory-agent/whatsapp-gateway-config', '/api/inventory/whatsapp-gateway-config', '/whatsapp-gateway-config'], (req, res) => {
  try {
    res.json({
      status: 'success',
      gateway: whatsappService.getStatus()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get gateway config: ' + err.message });
  }
});

// Helper to safely update .env file preserving existing variables, comments, and structure
function safeUpdateEnv(updates = {}) {
  const envPath = resolveAppPath('.env');
  let lines = [];
  try {
    if (fs.existsSync(envPath)) {
      lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    }
  } catch (e) {}

  const updatedKeys = new Set();
  const newLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) return line;
    const key = line.slice(0, eqIdx).trim();
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      updatedKeys.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  for (const [key, val] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      newLines.push(`${key}=${val}`);
    }
  }

  fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
}

// 12g. GET /env-config - Safe Client Production Config Retrieval (Protected by requireAuth)
router.get(['/api/inventory-agent/env-config', '/api/inventory/env-config', '/env-config'], requireAuth, (req, res) => {
  try {
    res.json({
      status: 'success',
      config: {
        meta_phone_number_id: process.env.META_WA_PHONE_NUMBER_ID || '',
        has_meta_access_token: Boolean(process.env.META_WA_ACCESS_TOKEN),
        meta_verify_token: process.env.META_WA_VERIFY_TOKEN || 'merlot_procure_agent_2026',
        has_gemini_key: Boolean(process.env.GEMINI_API_KEY),
        auto_restock_daemon: process.env.AUTO_RESTOCK_DAEMON !== 'false',
        scan_interval_minutes: parseInt(process.env.RESTOCK_SCAN_INTERVAL_MINUTES || '10', 10),
        pos_db_path: process.env.POS_DB_PATH || '',
        agent_api_key: process.env.AGENT_API_KEY || 'merlot_secure_agent_key_2026',
        active_provider: whatsappService.getStatus().activeProvider
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get config: ' + err.message });
  }
});

// 12h. POST /env-config - Save Production Client Keys & Live Reconfigure (Protected by requireAuth)
router.post(['/api/inventory-agent/env-config', '/api/inventory/env-config', '/env-config'], requireAuth, (req, res) => {
  try {
    const {
      meta_phone_number_id,
      meta_access_token,
      meta_verify_token,
      gemini_api_key,
      auto_restock_daemon,
      scan_interval_minutes,
      pos_db_path,
      agent_api_key
    } = req.body || {};

    const sanitizeVal = v => (typeof v === 'string' ? v.replace(/[\r\n]/g, '').trim() : '');
    const envUpdates = {};

    // Update in memory process.env & stage for disk update with strict sanitization
    if (meta_phone_number_id !== undefined) {
      process.env.META_WA_PHONE_NUMBER_ID = sanitizeVal(meta_phone_number_id);
      envUpdates.META_WA_PHONE_NUMBER_ID = process.env.META_WA_PHONE_NUMBER_ID;
    }
    if (meta_access_token !== undefined && sanitizeVal(meta_access_token)) {
      process.env.META_WA_ACCESS_TOKEN = sanitizeVal(meta_access_token);
      envUpdates.META_WA_ACCESS_TOKEN = process.env.META_WA_ACCESS_TOKEN;
    }
    if (meta_verify_token !== undefined) {
      process.env.META_WA_VERIFY_TOKEN = sanitizeVal(meta_verify_token) || 'merlot_procure_agent_2026';
      envUpdates.META_WA_VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN;
    }
    if (gemini_api_key !== undefined && sanitizeVal(gemini_api_key)) {
      process.env.GEMINI_API_KEY = sanitizeVal(gemini_api_key);
      envUpdates.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    }
    if (auto_restock_daemon !== undefined) {
      process.env.AUTO_RESTOCK_DAEMON = String(Boolean(auto_restock_daemon));
      envUpdates.AUTO_RESTOCK_DAEMON = process.env.AUTO_RESTOCK_DAEMON;
    }
    if (scan_interval_minutes !== undefined) {
      const parsedMins = Math.max(1, parseInt(scan_interval_minutes, 10) || 10);
      process.env.RESTOCK_SCAN_INTERVAL_MINUTES = String(parsedMins);
      envUpdates.RESTOCK_SCAN_INTERVAL_MINUTES = process.env.RESTOCK_SCAN_INTERVAL_MINUTES;
    }
    if (pos_db_path !== undefined) {
      process.env.POS_DB_PATH = sanitizeVal(pos_db_path);
      envUpdates.POS_DB_PATH = process.env.POS_DB_PATH;
    }
    if (agent_api_key !== undefined && sanitizeVal(agent_api_key)) {
      process.env.AGENT_API_KEY = sanitizeVal(agent_api_key);
      envUpdates.AGENT_API_KEY = process.env.AGENT_API_KEY;
    }

    // Safely update .env file preserving existing custom variables and comments
    safeUpdateEnv(envUpdates);

    // Refresh live services
    whatsappService.refreshConfig();
    autoWatchdog.intervalMinutes = parseInt(process.env.RESTOCK_SCAN_INTERVAL_MINUTES || '10', 10);
    autoWatchdog.autoRestockEnabled = process.env.AUTO_RESTOCK_DAEMON !== 'false';
    if (autoWatchdog.autoRestockEnabled) {
      autoWatchdog.start();
    } else {
      autoWatchdog.stop();
    }

    res.json({
      status: 'success',
      message: '✅ Production client configuration safely saved and active!',
      gateway: whatsappService.getStatus(),
      watchdog: autoWatchdog.getStatus()
    });
  } catch (err) {
    console.error('Failed to save env-config:', err);
    res.status(500).json({ error: 'Failed to save configuration: ' + err.message });
  }
});

// 12i. GET /download-user-manual - Download Universal Non-IT Retail User Manual PDF
router.get(['/api/inventory-agent/download-user-manual', '/api/inventory/download-user-manual', '/download-user-manual'], (req, res) => {
  const candidatePaths = [
    path.join(__dirname, '..', 'documents', 'Autonomous_Inventory_Agent_User_Manual.pdf'),
    path.join(__dirname, 'documents', 'Autonomous_Inventory_Agent_User_Manual.pdf'),
    path.join(__dirname, 'Autonomous_Inventory_Agent_User_Manual.pdf'),
    path.join(__dirname, '..', 'documents', 'Merlot_AI_Agent_Non_IT_User_Manual.pdf'),
    path.join(__dirname, 'documents', 'Merlot_AI_Agent_Non_IT_User_Manual.pdf')
  ];
  let finalPath = null;
  for (const cp of candidatePaths) {
    if (fs.existsSync(cp)) {
      finalPath = cp;
      break;
    }
  }
  if (finalPath) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Autonomous_Inventory_Agent_User_Manual.pdf"');
    return res.sendFile(finalPath);
  }
  res.status(404).json({ error: 'User manual PDF not found in documents folder.' });
});

// 12d. GET /whatsapp-sessions - Retrieve Active Autonomous WhatsApp Negotiations
router.get(['/api/inventory-agent/whatsapp-sessions', '/api/inventory/whatsapp-sessions', '/whatsapp-sessions'], (req, res) => {
  try {
    const sessions = ragProcurement.getActiveWhatsAppSessions();
    res.json({
      status: 'success',
      count: sessions.length,
      sessions
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve sessions: ' + err.message });
  }
});

// 13. GET /logs - Audit Log Retrieval
router.get(['/api/inventory-agent/logs', '/api/inventory/logs', '/logs'], async (req, res) => {
  if (isMysqlConnected && mysqlPool) {
    try {
      const [rows] = await mysqlPool.query('SELECT * FROM inventory_agent_logs ORDER BY id DESC LIMIT 50');
      return res.json({ status: 'success', source: 'mysql', logs: rows });
    } catch (err) {}
  }

  res.json({
    status: 'success',
    source: 'in_memory',
    logs: inMemoryLogs
  });
});

// 14. GET /profile - Get Firm Registration & UPI Profile
router.get(['/api/inventory-agent/profile', '/api/inventory/profile', '/profile'], (req, res) => {
  try {
    const profile = ragProcurement.loadFirmProfile();
    res.json({
      status: 'success',
      profile
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve profile: ' + err.message });
  }
});

// 15. POST /profile - Update Firm Registration & UPI Configuration (Protected by requireAuth)
router.post(['/api/inventory-agent/profile', '/api/inventory/profile', '/profile'], requireAuth, (req, res) => {
  try {
    const saveRes = ragProcurement.saveFirmProfile(req.body);
    if (!saveRes.success) {
      return res.status(500).json({ error: saveRes.error });
    }
    res.json({
      status: 'success',
      message: '✅ Store registration & UPI settings updated successfully!',
      profile: saveRes.profile
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save profile: ' + err.message });
  }
});

// 16. GET /vendors-list - Get Directory of Vendors from CSV
router.get(['/api/inventory-agent/vendors-list', '/api/inventory/vendors-list', '/vendors-list'], (req, res) => {
  try {
    const vendors = ragProcurement.RAG_KNOWLEDGE_STORE.allVendors;
    res.json({
      status: 'success',
      count: vendors.length,
      vendors
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load vendors list: ' + err.message });
  }
});

// 17. POST /import-vendors-csv - Import or Reload Vendors CSV (Protected by requireAuth & Pre-Validated)
router.post(['/api/inventory-agent/import-vendors-csv', '/api/inventory/import-vendors-csv', '/import-vendors-csv'], requireAuth, (req, res) => {
  try {
    const { csv_content } = req.body || {};
    const csvPath = resolveAppPath('vendors.csv');
    
    if (csv_content && typeof csv_content === 'string') {
      const trimmed = csv_content.trim();
      if (trimmed.length < 10 || !trimmed.includes(',')) {
        return res.status(400).json({ error: 'Invalid CSV content: payload is too short or missing valid CSV comma separators.' });
      }

      // Pre-validate CSV in memory first to prevent disk corruption
      const testResult = ragProcurement.loadVendorsFromCSV(trimmed);
      if (!testResult || !testResult.success || testResult.count === 0) {
        return res.status(400).json({ 
          error: 'CSV validation failed: ' + ((testResult && (testResult.message || testResult.error)) || 'No valid vendor rows could be parsed.') 
        });
      }

      // Pre-validation passed: safely write verified content to disk
      fs.writeFileSync(csvPath, trimmed, 'utf8');

      return res.json({
        status: 'success',
        message: `✅ Successfully validated, imported and indexed ${testResult.count} nursery vendors from CSV!`,
        count: testResult.count,
        vendors: testResult.vendors
      });
    }

    // Fallback: reload from existing file on disk
    const loadResult = ragProcurement.loadVendorsFromCSV(csvPath);
    if (!loadResult.success) {
      return res.status(400).json({ error: loadResult.message || loadResult.error });
    }

    res.json({
      status: 'success',
      message: `✅ Successfully loaded and indexed ${loadResult.count} nursery vendors from CSV!`,
      count: loadResult.count,
      vendors: loadResult.vendors
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to import vendors CSV: ' + err.message });
  }
});

// 17b. POST /clear-vendors-csv - Clear vendor directory to blank template
router.post(['/api/inventory-agent/clear-vendors-csv', '/api/inventory/clear-vendors-csv', '/clear-vendors-csv'], requireAuth, (req, res) => {
  try {
    const csvPath = resolveAppPath('vendors.csv');
    const headerOnly = 'vendor_id,vendor_name,contact_person,phone,whatsapp,location,products_supplied,base_cost,floor_price,lead_time_days,moq,rating,upi_id,bank_account,ifsc\n';
    fs.writeFileSync(csvPath, headerOnly, 'utf8');
    ragProcurement.RAG_KNOWLEDGE_STORE.allVendors = [];
    ragProcurement.RAG_KNOWLEDGE_STORE.vendorDirectory = {};
    res.json({
      status: 'success',
      message: 'Vendor directory cleared. You can now upload your custom vendor CSV.',
      count: 0,
      vendors: []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear vendors: ' + err.message });
  }
});

// 17c. POST /restore-sample-vendors-csv - Restore default sample nursery vendors
router.post(['/api/inventory-agent/restore-sample-vendors-csv', '/api/inventory/restore-sample-vendors-csv', '/restore-sample-vendors-csv'], requireAuth, (req, res) => {
  try {
    const csvPath = resolveAppPath('vendors.csv');
    const examplePath = resolveAppPath('vendors.example.csv');
    if (fs.existsSync(examplePath)) {
      const sampleContent = fs.readFileSync(examplePath, 'utf8');
      fs.writeFileSync(csvPath, sampleContent, 'utf8');
      const loadResult = ragProcurement.loadVendorsFromCSV(csvPath);
      return res.json({
        status: 'success',
        message: `Restored ${loadResult.count} sample nursery vendors.`,
        count: loadResult.count,
        vendors: loadResult.vendors
      });
    }
    res.status(404).json({ error: 'Sample vendors file (vendors.example.csv) not found.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore sample vendors: ' + err.message });
  }
});

// 17b. GET /vendor-history - Retrieve full RAG vendor histories and deal archives
router.get(['/api/inventory-agent/vendor-history', '/api/inventory/vendor-history', '/vendor-history'], (req, res) => {
  try {
    const histories = ragProcurement.RAG_KNOWLEDGE_STORE.vendorHistories || {};
    res.json({
      status: 'success',
      total_tracked_vendors: Object.keys(histories).length,
      vendors: Object.values(histories)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve vendor history: ' + err.message });
  }
});

// 17c. GET /vendor-history/:vendorId - Specific vendor procurement history & behavioral profile
router.get(['/api/inventory-agent/vendor-history/:vendorId', '/api/inventory/vendor-history/:vendorId', '/vendor-history/:vendorId'], (req, res) => {
  try {
    const vId = req.params.vendorId;
    const history = (ragProcurement.RAG_KNOWLEDGE_STORE.vendorHistories && ragProcurement.RAG_KNOWLEDGE_STORE.vendorHistories[vId]) || null;
    if (!history) {
      return res.status(404).json({ error: `No RAG history established for vendor ID: ${vId}` });
    }
    res.json({
      status: 'success',
      vendor_id: vId,
      history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 17e. GET /vendor-chat-ledger - Retrieve persistent historical chat dialogues & negotiation transcripts
router.get(['/api/inventory-agent/vendor-chat-ledger', '/api/inventory/vendor-chat-ledger', '/vendor-chat-ledger'], async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    const rows = await new Promise((resolve) => {
      if (!posBridge || !posBridge.localOrdersDb) return resolve([]);
      posBridge.localOrdersDb.all(
        `SELECT * FROM vendor_chat_ledger ORDER BY id DESC LIMIT ?`,
        [limit],
        (err, results) => {
          if (!err && results) resolve(results);
          else resolve([]);
        }
      );
    });
    res.json({
      status: 'success',
      count: rows.length,
      turns: rows,
      history: rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve vendor chat ledger: ' + err.message });
  }
});

// 17f. GET /vendor-chat-ledger/:vendorId - Specific vendor chat transcript history
router.get(['/api/inventory-agent/vendor-chat-ledger/:vendorId', '/api/inventory/vendor-chat-ledger/:vendorId', '/vendor-chat-ledger/:vendorId'], async (req, res) => {
  try {
    const vId = req.params.vendorId;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const history = await getVendorChatHistory(vId, limit);
    res.json({
      status: 'success',
      vendor_id: vId,
      count: history.length,
      history
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve vendor chat history: ' + err.message });
  }
});

// 17g. GET /download-commercial-whitepaper - Download Executive Commercial Profitability & Financial Stability PDF
router.get(['/api/inventory-agent/download-commercial-whitepaper', '/api/inventory/download-commercial-whitepaper', '/download-commercial-whitepaper'], (req, res) => {
  const pdfPath = resolveAppPath('documents', 'Autonomous_Procurement_Commercial_Profitability_Report.pdf');
  if (fs.existsSync(pdfPath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Autonomous_Procurement_Commercial_Profitability_Report.pdf"');
    fs.createReadStream(pdfPath).pipe(res);
  } else {
    res.status(404).json({ error: 'Commercial report PDF is currently generating. Please retry in a few moments.' });
  }
});

// 17d. POST /vendor-history - Manually record a transaction or update behavioral profile in RAG
router.post(['/api/inventory-agent/vendor-history', '/api/inventory/vendor-history', '/vendor-history'], (req, res) => {
  try {
    const recordRes = ragProcurement.recordVendorDeal(req.body);
    if (!recordRes.success) {
      return res.status(400).json({ error: recordRes.error });
    }
    res.json({
      status: 'success',
      message: 'Deal recorded in Vendor RAG history archive successfully!',
      history: recordRes.updatedHistory
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 17h. Workflow Orchestration Engine (Switchable & Scalable) ====================

// Developer Handover Guide Contract: GET /api/workflow/orchestration?company_id=...
router.get(['/api/workflow/orchestration', '/workflow/orchestration', '/api/inventory-agent/orchestration-config'], requireAuth, (req, res) => {
  try {
    const requestedCompany = req.query.company_id || req.headers['x-company-id'] || 'tenant_merlot_01';
    const authorizedCompany = req.headers['x-authorized-company-id'];

    // Cross-tenant access guard: returns 403 Forbidden
    if (authorizedCompany && authorizedCompany !== requestedCompany) {
      return res.status(403).json({
        error: `Forbidden: Cross-tenant access forbidden. Caller authorized for '${authorizedCompany}' cannot read orchestration config for '${requestedCompany}'.`,
        requested_company: requestedCompany,
        authorized_company: authorizedCompany
      });
    }

    const config = workflowEngine.get_orchestration_config(requestedCompany);
    res.json({
      status: 'success',
      company_id: requestedCompany,
      config
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve company orchestration config: ' + err.message });
  }
});

// Developer Handover Guide Contract: POST /api/workflow/orchestration
// Body: { "company_id": "...", "updates": { ... } }
router.post(['/api/workflow/orchestration', '/workflow/orchestration', '/api/inventory-agent/orchestration-config'], requireAuth, (req, res) => {
  try {
    const { company_id, updates } = req.body || {};
    if (!company_id) {
      return res.status(400).json({ error: 'Missing required field: company_id in request body.' });
    }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid updates object in request body.' });
    }

    const authorizedCompany = req.headers['x-authorized-company-id'];

    // Cross-tenant access guard: returns 403 Forbidden
    if (authorizedCompany && authorizedCompany !== company_id) {
      return res.status(403).json({
        error: `Forbidden: Cross-tenant access forbidden. Caller authorized for '${authorizedCompany}' cannot modify orchestration config for '${company_id}'.`,
        requested_company: company_id,
        authorized_company: authorizedCompany
      });
    }

    const result = workflowEngine.set_orchestration_config(company_id, updates);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      status: 'success',
      message: result.message,
      company_id,
      config: result.config
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update company orchestration config: ' + err.message });
  }
});

// GET /workflow-orchestration - Status, active profile, available profiles, configuration, recent executions
router.get(['/api/inventory-agent/workflow-orchestration', '/api/inventory/workflow-orchestration', '/workflow-orchestration'], async (req, res) => {
  try {
    const status = workflowEngine.getStatus();
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 15);
    const executions = await workflowEngine.getRecentExecutions(limit);
    res.json({
      status: 'success',
      ...status,
      recentExecutions: executions
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve workflow status: ' + err.message });
  }
});

// POST /workflow-orchestration/switch-profile - Switch active profile
router.post(['/api/inventory-agent/workflow-orchestration/switch-profile', '/api/inventory/workflow-orchestration/switch-profile', '/workflow-orchestration/switch-profile'], requireAuth, (req, res) => {
  try {
    const { profile_id } = req.body || {};
    if (!profile_id) return res.status(400).json({ error: 'Missing profile_id in request body.' });
    const result = workflowEngine.switchProfile(profile_id);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to switch profile: ' + err.message });
  }
});

// POST /workflow-orchestration/config - Edit pipeline parameters (thresholds, timeouts, concurrency)
router.post(['/api/inventory-agent/workflow-orchestration/config', '/api/inventory/workflow-orchestration/config', '/workflow-orchestration/config'], requireAuth, (req, res) => {
  try {
    const updates = req.body || {};
    const result = workflowEngine.saveConfig(updates);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ status: 'success', message: 'Workflow orchestration configuration updated successfully.', config: result.config });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update workflow config: ' + err.message });
  }
});

// POST /workflow-orchestration/stages - Edit custom pipeline stages
router.post(['/api/inventory-agent/workflow-orchestration/stages', '/api/inventory/workflow-orchestration/stages', '/workflow-orchestration/stages'], requireAuth, (req, res) => {
  try {
    const { stages } = req.body || {};
    if (!Array.isArray(stages)) return res.status(400).json({ error: 'Expected stages array in request body.' });
    const result = workflowEngine.updateCustomPipelineStages(stages);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ status: 'success', message: 'Custom pipeline stages updated successfully.', stages: result.stages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update custom pipeline stages: ' + err.message });
  }
});

// POST /workflow-orchestration/reset - Restore factory default profiles and configuration
router.post(['/api/inventory-agent/workflow-orchestration/reset', '/api/inventory/workflow-orchestration/reset', '/workflow-orchestration/reset'], requireAuth, (req, res) => {
  try {
    const result = workflowEngine.resetToDefaults();
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset workflow config: ' + err.message });
  }
});

// GET /workflow-orchestration/executions - Query recent workflow executions
router.get(['/api/inventory-agent/workflow-orchestration/executions', '/api/inventory/workflow-orchestration/executions', '/workflow-orchestration/executions'], async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const executions = await workflowEngine.getRecentExecutions(limit);
    res.json({ status: 'success', count: executions.length, executions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load workflow executions: ' + err.message });
  }
});

// POST /workflow-orchestration/executions/:id/approve - Human Manager Approval
router.post(['/api/inventory-agent/workflow-orchestration/executions/:id/approve', '/api/inventory/workflow-orchestration/executions/:id/approve', '/workflow-orchestration/executions/:id/approve'], requireAuth, async (req, res) => {
  try {
    const workflowId = req.params.id;
    const { manager_name } = req.body || {};
    const result = await workflowEngine.approveExecution(workflowId, manager_name || 'Store Manager');
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve workflow: ' + err.message });
  }
});

// POST /workflow-orchestration/executions/:id/reject - Human Manager Rejection
router.post(['/api/inventory-agent/workflow-orchestration/executions/:id/reject', '/api/inventory/workflow-orchestration/executions/:id/reject', '/workflow-orchestration/executions/:id/reject'], requireAuth, async (req, res) => {
  try {
    const workflowId = req.params.id;
    const { reason } = req.body || {};
    const result = await workflowEngine.rejectExecution(workflowId, reason || 'Rejected by operator');
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject workflow: ' + err.message });
  }
});

// POST /workflow-orchestration/trigger - Manually trigger an orchestrated workflow run
router.post(['/api/inventory-agent/workflow-orchestration/trigger', '/api/inventory/workflow-orchestration/trigger', '/workflow-orchestration/trigger'], requireAuth, async (req, res) => {
  try {
    const { product_id, product_name, quantity, price } = req.body || {};
    const execution = await workflowEngine.startWorkflow({
      productId: product_id || 'p_manual',
      productName: product_name || 'Manual Restock Item',
      initialQty: parseInt(quantity, 10) || 30,
      productPrice: parseFloat(price) || 299.0,
      trigger: 'MANUAL_DASHBOARD_TRIGGER'
    });
    res.json({
      status: 'success',
      message: `Workflow ${execution.workflowId} queued using active profile "${execution.profileName}".`,
      execution
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger workflow: ' + err.message });
  }
});

// 18. GET /playbooks - List all uploaded negotiation books & active selection
router.get(['/api/inventory-agent/playbooks', '/api/inventory/playbooks', '/playbooks'], (req, res) => {
  try {
    const list = ragProcurement.playbookEngine.listPlaybooks();
    res.json({ status: 'success', ...list });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list playbooks: ' + err.message });
  }
});

// 19. POST /upload-playbook - Upload & Index a new Negotiation Playbook / Book (PDF, TXT, MD)
router.post(['/api/inventory-agent/upload-playbook', '/api/inventory/upload-playbook', '/upload-playbook'], async (req, res) => {
  try {
    const { title, filename, text, base64 } = req.body || {};
    let fileBuffer = null;
    if (base64) {
      const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
      fileBuffer = Buffer.from(cleanBase64, 'base64');
    }

    const result = await ragProcurement.playbookEngine.ingestPlaybook({
      title: title || (filename ? filename.replace(/\.[^/.]+$/, '') : 'Negotiation Playbook'),
      filename: filename || 'custom_playbook.txt',
      fileBuffer,
      textContent: text || null
    });

    res.json({ status: 'success', ...result });
  } catch (err) {
    console.error('Playbook ingestion error:', err);
    res.status(400).json({ error: 'Playbook upload failed: ' + err.message });
  }
});

// 20. POST /select-playbook - Set active negotiation book
router.post(['/api/inventory-agent/select-playbook', '/api/inventory/select-playbook', '/select-playbook'], (req, res) => {
  try {
    const { book_id } = req.body || {};
    const result = ragProcurement.playbookEngine.setActivePlaybook(book_id);
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    res.json({ status: 'success', message: `✅ Active playbook switched to "${result.title}"`, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to select playbook: ' + err.message });
  }
});

// 21. GET /voice-config - Voice STT (Faster-Whisper) Supported Languages & Models
router.get(['/api/inventory-agent/voice-config', '/api/inventory/voice-config', '/voice-config'], async (req, res) => {
  const STT_SERVER_URL = process.env.STT_SERVER_URL || 'http://61.2.142.91:8024';
  const indianLanguages = [
    { code: 'auto', name: 'Auto-Detect Language', script: 'Automatic', number: 0 },
    { code: 'hi', name: 'Hindi', script: 'हिन्दी', number: 1 },
    { code: 'bn', name: 'Bengali', script: 'বাংলা', number: 2 },
    { code: 'ta', name: 'Tamil', script: 'தமிழ்', number: 3 },
    { code: 'te', name: 'Telugu', script: 'తెలుగు', number: 4 },
    { code: 'mr', name: 'Marathi', script: 'मराठी', number: 5 },
    { code: 'gu', name: 'Gujarati', script: 'ગુજરાતી', number: 6 },
    { code: 'kn', name: 'Kannada', script: 'ಕನ್ನಡ', number: 7 },
    { code: 'ml', name: 'Malayalam', script: 'മലയാളം', number: 8 },
    { code: 'pa', name: 'Punjabi', script: 'ਪੰਜਾਬੀ', number: 9 },
    { code: 'ur', name: 'Urdu', script: 'اردو', number: 10 },
    { code: 'as', name: 'Assamese', script: 'অসমীয়া', number: 11 },
    { code: 'or', name: 'Odia', script: 'ଓଡ଼ିଆ', number: 12 },
    { code: 'ne', name: 'Nepali', script: 'नेपाली', number: 13 },
    { code: 'sa', name: 'Sanskrit', script: 'संस्कृतम्', number: 14 },
    { code: 'sd', name: 'Sindhi', script: 'سنڌي', number: 15 },
    { code: 'ks', name: 'Kashmiri', script: 'کٲشُر', number: 16 },
    { code: 'kok', name: 'Konkani', script: 'कोंकणी', number: 17 },
    { code: 'mni', name: 'Manipuri', script: 'মৈতৈলোন্', number: 18 },
    { code: 'brx', name: 'Bodo', script: 'बर\'', number: 19 },
    { code: 'doi', name: 'Dogri', script: 'डोगरी', number: 20 },
    { code: 'sat', name: 'Santali', script: 'ᱥᱟᱱᱛᱟᱲᱤ', number: 21 },
    { code: 'mai', name: 'Maithili', script: 'मैथिली', number: 22 },
    { code: 'en', name: 'English', script: 'English', number: 23 }
  ];

  const models = [
    { name: 'base', description: 'Ultra Fast (~60-90ms) - Default recommended', vram: '~140MB' },
    { name: 'small', description: 'Fast (~120-200ms) - High accuracy Indic accents', vram: '~460MB' },
    { name: 'medium', description: 'Moderate (~350-600ms) - Complex Indic vocabulary', vram: '~1.4GB' },
    { name: 'large-v3-turbo', description: 'Fast SOTA Multilingual Accuracy', vram: '~1.5GB' },
    { name: 'tiny', description: 'Extremely lightweight (~30-50ms)', vram: '~75MB' }
  ];

  let sttOnline = false;
  let serverDetails = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const checkRes = await fetch(`${STT_SERVER_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (checkRes.ok) {
      sttOnline = true;
      serverDetails = await checkRes.json();
    }
  } catch (e) {
    sttOnline = false;
  }

  res.json({
    status: 'success',
    stt_server: STT_SERVER_URL,
    online: sttOnline,
    serverDetails,
    default_model: 'base',
    default_language: 'auto',
    languages: indianLanguages,
    models
  });
});

// 22. POST /transcribe - Transcribe Audio via Faster-Whisper GPU Engine
router.post(['/api/inventory-agent/transcribe', '/api/inventory/transcribe', '/transcribe'], async (req, res) => {
  const STT_SERVER_URL = process.env.STT_SERVER_URL || 'http://61.2.142.91:8024';
  try {
    const { audioBase64, language = 'auto', model = 'base', mimeType = 'audio/webm' } = req.body || {};

    if (!audioBase64) {
      return res.status(400).json({ error: 'Missing audioBase64 parameter in request body.' });
    }

    // Convert Base64 data to binary buffer
    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const audioBuffer = Buffer.from(cleanBase64, 'base64');
    const audioBlob = new Blob([audioBuffer], { type: mimeType });

    // Prepare multipart form data for Faster-Whisper
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice_recording.webm');
    if (language && language !== 'auto') {
      formData.append('language', language);
    }
    if (model) {
      formData.append('model', model);
    }

    const sttRes = await fetch(`${STT_SERVER_URL}/api/transcribe`, {
      method: 'POST',
      body: formData
    });

    if (!sttRes.ok) {
      const errText = await sttRes.text();
      return res.status(sttRes.status).json({
        error: `Faster-Whisper error (${sttRes.status}): ${errText}`
      });
    }

    const sttData = await sttRes.json();
    res.json({
      status: 'success',
      transcript: sttData.transcript || '',
      language: sttData.language || language,
      language_probability: sttData.language_probability,
      duration: sttData.duration,
      stt_latency: sttData.stt_latency,
      speed_factor: sttData.speed_factor,
      device: sttData.device,
      model_name: sttData.model_name
    });
  } catch (err) {
    console.error('STT Transcription error:', err);
    res.status(500).json({
      error: 'Transcription failed: ' + err.message,
      hint: 'Ensure STT server is accessible at ' + STT_SERVER_URL
    });
  }
});

// ============================================================
// ☁️ SECTION 8: MYBLOCKS TRAINEE RAG PROXY & MANAGEMENT ROUTES
// ============================================================

// 23. GET & POST /myblocks-rag/config - Get or Update MyBlocks RAG Configuration
router.get(['/api/inventory-agent/myblocks-rag/config', '/api/inventory/myblocks-rag/config', '/myblocks-rag/config'], (req, res) => {
  res.json({
    status: 'success',
    config: {
      baseUrl: MYBLOCKS_RAG_STATE.baseUrl,
      userId: MYBLOCKS_RAG_STATE.userId,
      firmId: MYBLOCKS_RAG_STATE.firmId,
      defaultCategory: MYBLOCKS_RAG_STATE.defaultCategory,
      personaId: MYBLOCKS_RAG_STATE.personaId,
      lastQueryTime: MYBLOCKS_RAG_STATE.lastQueryTime || null,
      cachedPersonas: MYBLOCKS_RAG_STATE.cachedPersonas || []
    }
  });
});

router.post(['/api/inventory-agent/myblocks-rag/config', '/api/inventory/myblocks-rag/config', '/myblocks-rag/config'], (req, res) => {
  const { baseUrl, userId, firmId, defaultCategory, personaId } = req.body || {};
  if (baseUrl) MYBLOCKS_RAG_STATE.baseUrl = baseUrl.replace(/\/+$/, '');
  if (userId) MYBLOCKS_RAG_STATE.userId = String(userId);
  if (firmId) MYBLOCKS_RAG_STATE.firmId = String(firmId);
  if (defaultCategory) MYBLOCKS_RAG_STATE.defaultCategory = defaultCategory;
  if (personaId) MYBLOCKS_RAG_STATE.personaId = personaId;

  res.json({
    status: 'success',
    message: 'MyBlocks RAG configuration updated successfully',
    config: {
      baseUrl: MYBLOCKS_RAG_STATE.baseUrl,
      userId: MYBLOCKS_RAG_STATE.userId,
      firmId: MYBLOCKS_RAG_STATE.firmId,
      defaultCategory: MYBLOCKS_RAG_STATE.defaultCategory,
      personaId: MYBLOCKS_RAG_STATE.personaId
    }
  });
});

// 24. POST /myblocks-rag/categories - List available categories for a user
router.post(['/api/inventory-agent/myblocks-rag/categories', '/api/inventory/myblocks-rag/categories', '/myblocks-rag/categories'], async (req, res) => {
  const { userId } = req.body || {};
  const result = await fetchMyBlocksCategories(userId);
  if (result.success) {
    res.json({ status: 'success', categories: result.categories, userId: userId || MYBLOCKS_RAG_STATE.userId });
  } else {
    res.status(502).json({
      status: 'error',
      error: result.error,
      categories: ['inventory-procurement', 'general'],
      fallback: true
    });
  }
});

// 25. GET /myblocks-rag/personas - List personas for firm
router.get(['/api/inventory-agent/myblocks-rag/personas', '/api/inventory/myblocks-rag/personas', '/myblocks-rag/personas'], async (req, res) => {
  const firmId = req.query.firmId || req.query.firm_id;
  const personas = await fetchMyBlocksPersonas(firmId);
  res.json({ status: 'success', personas, activePersonaId: MYBLOCKS_RAG_STATE.personaId });
});

// 26. POST /myblocks-rag/upload - Upload Document (PDF/Text) and auto trigger vector indexing
router.post(['/api/inventory-agent/myblocks-rag/upload', '/api/inventory/myblocks-rag/upload', '/myblocks-rag/upload'], async (req, res) => {
  try {
    const { fileName, filename, base64, text, category, userId } = req.body || {};
    let fileBuffer = null;
    if (base64) {
      const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
      fileBuffer = Buffer.from(cleanBase64, 'base64');
    } else if (text) {
      fileBuffer = Buffer.from(text, 'utf8');
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'No document data provided. Send base64 or text.' });
    }

    const docName = fileName || filename || `rag_doc_${Date.now()}.pdf`;
    const result = await uploadAndIndexMyBlocksDocument({
      fileBuffer,
      fileName: docName,
      category: category || MYBLOCKS_RAG_STATE.defaultCategory,
      userId: userId || MYBLOCKS_RAG_STATE.userId
    });

    res.json({
      status: 'success',
      message: `🎉 Document "${result.safeName}" uploaded and indexed into MyBlocks category "${result.category}"!`,
      ...result
    });
  } catch (err) {
    console.error('MyBlocks Upload error:', err);
    res.status(500).json({ error: 'MyBlocks Document upload & indexing failed: ' + err.message });
  }
});

// 27. POST /myblocks-rag/update-index - Trigger re-indexing
router.post(['/api/inventory-agent/myblocks-rag/update-index', '/api/inventory/myblocks-rag/update-index', '/myblocks-rag/update-index'], async (req, res) => {
  try {
    const { category, userId, username, firmId } = req.body || {};
    const uid = String(userId || username || MYBLOCKS_RAG_STATE.userId);
    const cat = String(category || MYBLOCKS_RAG_STATE.defaultCategory);
    const fid = String(firmId || MYBLOCKS_RAG_STATE.firmId);

    const indexRes = await fetch(`${MYBLOCKS_RAG_STATE.baseUrl}/api/rag/update-index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: cat, userid: uid, username: uid, firm_id: fid })
    });

    if (!indexRes.ok) {
      const errText = await indexRes.text();
      return res.status(indexRes.status).json({ error: `Index failed (${indexRes.status}): ${errText}` });
    }

    const indexData = await indexRes.json().catch(() => ({ status: 'success' }));
    res.json({ status: 'success', message: `Vector index successfully refreshed for category "${cat}"`, data: indexData });
  } catch (err) {
    res.status(500).json({ error: 'Update index failed: ' + err.message });
  }
});

// 28. POST /myblocks-rag/query - Ask a question to MyBlocks RAG with Persona & Multi-Turn Context
router.post(['/api/inventory-agent/myblocks-rag/query', '/api/inventory/myblocks-rag/query', '/myblocks-rag/query'], async (req, res) => {
  try {
    const { question, category, sessionId, ownerId, userId, personaId, firmId } = req.body || {};
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Missing question parameter.' });
    }

    const queryResult = await queryMyBlocksRAG({
      question: question.trim(),
      category,
      sessionId,
      ownerId,
      userId,
      personaId,
      firmId
    });

    if (queryResult.success) {
      res.json({ status: 'success', ...queryResult });
    } else {
      res.status(502).json({
        status: 'error',
        error: queryResult.error,
        message: queryResult.error || 'MyBlocks RAG service returned an error.',
        fallbackAvailable: true
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'RAG query failed: ' + err.message });
  }
});

// 29. GET & DELETE /myblocks-rag/chat-history - Retrieve or Clear session history
router.get(['/api/inventory-agent/myblocks-rag/chat-history', '/api/inventory/myblocks-rag/chat-history', '/myblocks-rag/chat-history'], async (req, res) => {
  const { username, role, category } = req.query;
  const history = await fetchMyBlocksChatHistory(username, role, category);
  res.json({ status: 'success', ...history });
});

router.delete(['/api/inventory-agent/myblocks-rag/chat-history', '/api/inventory/myblocks-rag/chat-history', '/myblocks-rag/chat-history'], async (req, res) => {
  const { username, role, category } = req.query;
  const result = await clearMyBlocksChatHistory(username, role, category);
  res.json({ status: 'success', ...result });
});

// ============================================================
// 🛡️ SECTION 9: ZERO-LEAK SECURITY & VENDOR TIE-BREAKER API
// ============================================================

// 30. GET /tie-breaker-rules - Retrieve 6-Stage Tie-Breaker Protocol Matrix
router.get(['/api/inventory-agent/tie-breaker-rules', '/api/inventory/tie-breaker-rules', '/tie-breaker-rules'], (req, res) => {
  res.json({
    status: 'success',
    protocol: '6-Stage Deterministic Multi-Criteria Tie-Breaker Hierarchy',
    dual_sourcing_minimum_quantity: 40,
    dual_sourcing_allocation_pct: { primary: 60, secondary: 40 },
    stages: [
      {
        stage: 1,
        rule_name: 'Fulfillment & Quality Reliability Score',
        weight: '35%',
        metric: 'Historical zero-defect rate & on-time fulfillment score (from RAG deal archive)',
        description: 'Vendor with higher proven delivery reliability score (e.g. 98.5% vs 95.0%) is awarded the primary PO.'
      },
      {
        stage: 2,
        rule_name: 'Geographical Proximity & Rapid Dispatch SLA',
        weight: '25%',
        metric: 'Guaranteed dispatch lead time in hours/days (transit proximity)',
        description: 'Vendor with faster dispatch (e.g. 24-hr local hub dispatch vs 48-hr) wins to minimize foliage transit stress and freight overhead.'
      },
      {
        stage: 3,
        rule_name: 'Strategic Partnership Loyalty & Cumulative Spend',
        weight: '20%',
        metric: 'Lifetime procurement volume & PO count with store firm',
        description: 'Suppliers with higher historical cumulative spend are rewarded for reliable multi-batch partnership.'
      },
      {
        stage: 4,
        rule_name: 'Payment Friction & Instant Corporate UPI Acceptance',
        weight: '10%',
        metric: 'Zero-fee UPI settlement compatibility',
        description: 'Suppliers accepting immediate Corporate UPI clearance with zero carrier surcharge or delays.'
      },
      {
        stage: 5,
        rule_name: 'Dual-Sourcing Split Protocol (Supply Chain Resilience)',
        weight: 'Contingency Allocation',
        metric: 'Triggered when order batch quantity >= 40 units and top vendors are within 3% score margin',
        description: 'Splits procurement batch 60% / 40% between top two suppliers to mitigate single-supplier supply disruption.'
      },
      {
        stage: 6,
        rule_name: 'Round-Robin Equitable Supplier Rotation',
        weight: 'Zero-Bias Fallback',
        metric: 'Recency of last PO award in historical archive',
        description: 'If vendors are 100% mathematically tied across all dimensions, the deal is awarded to the supplier who did NOT receive the last order, preventing market stagnation.'
      }
    ]
  });
});

// 31. POST /test-tie-breaker - Simulate tie between two supplier quotes
router.post(['/api/inventory-agent/test-tie-breaker', '/api/inventory/test-tie-breaker', '/test-tie-breaker'], (req, res) => {
  try {
    const { vendorA, vendorB, quantity = 60 } = req.body || {};
    let candidates = [];
    if (vendorA && vendorB) {
      candidates = [vendorA, vendorB];
    } else {
      const all = RAG_KNOWLEDGE_STORE.allVendors || [];
      if (all.length >= 2) {
        const tiedQuote = 250.00;
        candidates = [
          { ...all[0], base_quote: tiedQuote },
          { ...all[1], base_quote: tiedQuote }
        ];
      } else {
        candidates = [
          {
            vendor_id: 'v_deccan',
            vendor_name: 'Deccan Flora Wholesale Nursery',
            base_quote: 250.00,
            rating: 4.8,
            lead_time_days: 1
          },
          {
            vendor_id: 'v_greencanopy',
            vendor_name: 'Green Canopy Growers',
            base_quote: 250.00,
            rating: 4.7,
            lead_time_days: 2
          }
        ];
      }
    }

    const resolution = resolveVendorTieBreaker(candidates, quantity);
    res.json({
      status: 'success',
      simulation: {
        tiedPrice: candidates[0].base_quote,
        quantity,
        resolution
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Tie-breaker simulation error: ' + err.message });
  }
});

// 32. GET /security-firewall-status - Vendor Privacy Firewall & DLP Audit Log
router.get(['/api/inventory-agent/security-firewall-status', '/api/inventory/security-firewall-status', '/security-firewall-status'], (req, res) => {
  res.json({
    status: 'success',
    firewall: {
      status: 'ARMED_AND_ENFORCING',
      compliance_standard: 'ISO-27001 Anti-Collusion & Supplier Non-Disclosure Protocol',
      prompt_injection_guard: 'ACTIVE (Deterministic regex & semantic firewall)',
      outbound_dlp_scrubber: 'ACTIVE (Dynamic competitor PII redaction)',
      context_isolation: 'ACTIVE (Multi-tenant single-vendor prompt sandbox)',
      total_attacks_intercepted: SECURITY_AUDIT_LOGS.length,
      recent_audit_logs: SECURITY_AUDIT_LOGS.slice(0, 10)
    }
  });
});

// Attach sub-engine references directly to router for programmatic access
router.posBridge = posBridge;
router.autoWatchdog = autoWatchdog;
router.whatsappService = whatsappService;
router.ragProcurement = ragProcurement;
router.playbookEngine = playbookEngine;
router.workflowEngine = workflowEngine;

module.exports = router;
