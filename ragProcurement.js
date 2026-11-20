'use strict';

/**
 * RAG-Augmented Procurement & Autonomous Negotiation Engine
 * Tailored for Merlot Home Decor & Gardening
 * Supports dynamic firm profile registration & vendor CSV ingestion
 */

const fs = require('fs');
const path = require('path');
const playbookEngine = require('./playbookEngine');

const PROFILE_FILE_PATH = path.join(__dirname, 'firmProfile.json');
const VENDORS_CSV_PATH = path.join(__dirname, 'vendors.csv');

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

  allVendors: [],
  vendorDirectory: {}
};

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
 * Retrieve RAG Context for a given product
 */
function retrieveRAGContext(productId, sellingPrice) {
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

  return {
    firmProfile: profile,
    policy: RAG_KNOWLEDGE_STORE.categoryPolicies['Indoor Foliage'] || { minGrossMarginPct: targetMargin },
    historicalRecords: history,
    bestPastRate,
    avgPastRate,
    maxCeilingCost,
    minTargetMarginPct: targetMargin
  };
}

/**
 * Multi-Attribute Vendor Evaluator & Sourcing Ranker
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

  return {
    success: true,
    status,
    settlement,
    dialogue,
    ragSummary: {
      retailPrice: product.price,
      maxAllowedCost: ceilingCost,
      bestPastRate: rag.bestPastRate,
      achievedMargin: `${grossMarginPct}%`,
      activePlaybook: tacticTurn2.source
    }
  };
}

module.exports = {
  RAG_KNOWLEDGE_STORE,
  loadFirmProfile,
  saveFirmProfile,
  loadVendorsFromCSV,
  retrieveRAGContext,
  rankVendorsForProduct,
  executeAutonomousNegotiation,
  playbookEngine
};
