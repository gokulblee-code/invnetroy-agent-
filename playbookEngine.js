'use strict';

/**
 * Playbook Engine — Dual RAG Architecture for Retail POS & Sourcing
 * 🌿 RAG 1: Public Customer Botanical & Plant Detailing Vault (20 Care & Spec Playbooks)
 * 💼 RAG 2: Dealer & Wholesale Vendor Procurement Negotiation Vault (20 Tactical Playbooks)
 *
 * Handles PDF, Markdown, and Text document uploads, semantic chunking,
 * persistent storage, and real-time dual-vault retrieval.
 */

const fs = require('fs');
const path = require('path');
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  pdfParse = null;
}

const PLAYBOOKS_DIR = path.join(__dirname, 'playbooks');
const INDEX_FILE = path.join(PLAYBOOKS_DIR, 'playbooks_index.json');
const CUSTOMER_RAG_DIR = path.join(PLAYBOOKS_DIR, 'customer_rag');
const NEGOTIATION_RAG_DIR = path.join(PLAYBOOKS_DIR, 'negotiation_rag');

// Ensure directories exist
if (!fs.existsSync(PLAYBOOKS_DIR)) fs.mkdirSync(PLAYBOOKS_DIR, { recursive: true });
if (!fs.existsSync(CUSTOMER_RAG_DIR)) fs.mkdirSync(CUSTOMER_RAG_DIR, { recursive: true });
if (!fs.existsSync(NEGOTIATION_RAG_DIR)) fs.mkdirSync(NEGOTIATION_RAG_DIR, { recursive: true });

let loadedIndex = {
  activePlaybookId: 'playbook-default-master',
  activeCustomerPlaybookId: 'playbook_cust_01',
  activeNegotiationPlaybookId: 'playbook-default-master',
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

  const category = (context && context.category) || 'NEGOTIATION_RAG';
  const targetDir = category === 'CUSTOMER_RAG' ? CUSTOMER_RAG_DIR : NEGOTIATION_RAG_DIR;
  const safeFilename = `${category === 'CUSTOMER_RAG' ? 'customer_rag/' : 'negotiation_rag/'}${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
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
  const bookId = `playbook_${category === 'CUSTOMER_RAG' ? 'cust' : 'nego'}_${Date.now()}`;
  const newBook = {
    id: bookId,
    category,
    title: title || filename.replace(/\.[^/.]+$/, ''),
    filename: safeFilename,
    uploaded_at: new Date().toISOString(),
    size_bytes: extractedText.length,
    chunk_count: chunks.length,
    chunks,
    is_active: true
  };

  if (category === 'CUSTOMER_RAG') {
    loadedIndex.activeCustomerPlaybookId = bookId;
  } else {
    loadedIndex.activeNegotiationPlaybookId = bookId;
    loadedIndex.activePlaybookId = bookId;
  }

  loadedIndex.books.unshift(newBook);
  saveIndex();

  return {
    success: true,
    message: `🎉 Successfully ingested into ${category === 'CUSTOMER_RAG' ? 'Customer Botanical Vault (RAG 1)' : 'Vendor Negotiation Vault (RAG 2)'}: "${newBook.title}" (${chunks.length} chapters)!`,
    category,
    book: newBook
  };
}

/**
 * 🌿 RAG 1: Customer Botanical & Plant Detailing Retrieval
 * Matches user query against 20 customer books (plant care, light, humidity, soil, pet safety, delivery)
 */
function queryCustomerRAG(userMessage = '', clientSession = {}) {
  initIndex();
  const customerBooks = (loadedIndex.books || []).filter(b => 
    b.category === 'CUSTOMER_RAG' || 
    (b.filename && b.filename.includes('customer_rag')) ||
    b.id.startsWith('playbook_cust_')
  );

  if (customerBooks.length === 0) {
    return {
      ragVault: 'CUSTOMER_BOTANICAL_RAG',
      matchedChunks: [],
      contextSnippet: 'Standard store botanical guidelines apply. Low-maintenance indoor plants require drying out between waterings.',
      bookCount: 0
    };
  }

  const lowerMsg = (userMessage || '').toLowerCase();
  const scoredChunks = [];

  const queryKeywords = [
    { regex: /\b(hi|hello|hey|namaste|hlo|helo|greet|welcome)\b/i, books: ['playbook_cust_01', 'playbook_cust_14', 'playbook_cust_19'], weight: 5 },
    { regex: /\b(snake\s*plant|sansevieria|bedroom|night|oxygen|cam|benzene|purif)/i, books: ['playbook_cust_02', 'playbook_cust_16'], weight: 6 },
    { regex: /\b(zz\s*plant|zamioculcas|dark|low\s*light|ac|office|desk|it\b|software|cabin|screen)/i, books: ['playbook_cust_03', 'playbook_cust_10'], weight: 6 },
    { regex: /\b(peace\s*lily|spathiphyllum|bloom|flower|droop|humid|white)/i, books: ['playbook_cust_04'], weight: 6 },
    { regex: /\b(monstera|deliciosa|cheese|swiss|living\s*room|lounge|fenestrat|climb)/i, books: ['playbook_cust_05'], weight: 6 },
    { regex: /\b(areca|palm|pet|cat|dog|toxic|non-toxic|aspca|safe|humidif)/i, books: ['playbook_cust_06', 'playbook_cust_11'], weight: 6 },
    { regex: /\b(jade|crassula|money|vastu|feng\s*shui|luck|prosperity|gift|north)/i, books: ['playbook_cust_07', 'playbook_cust_18'], weight: 6 },
    { regex: /\b(pot|planter|ceramic|terracotta|drainage|root\s*rot|overwater)/i, books: ['playbook_cust_08'], weight: 6 },
    { regex: /\b(kerala|monsoon|rain|summer|humidity|coastal|water|watering|schedule|how\s*often)/i, books: ['playbook_cust_09', 'playbook_cust_15'], weight: 5 },
    { regex: /\b(soil|potting|perlite|coco\s*peat|vermicompost|fertil|repott)/i, books: ['playbook_cust_12'], weight: 5 },
    { regex: /\b(pest|bug|mealy|mite|yellow|brown|fungus|neem|sick|dry|cure)/i, books: ['playbook_cust_13'], weight: 5 },
    { regex: /\b(deliver|shipping|carton|pack|box|cushion|transit|doorstep|kottayam|vaikom|ernakulam|kochi)/i, books: ['playbook_cust_17'], weight: 5 },
    { regex: /\b(price|pricing|rate|cost|how\s*much|catalog|items|buy|order)/i, books: ['playbook_cust_01', 'playbook_cust_19'], weight: 4 },
    { regex: /\b(pay|payment|upi|gpay|phonepe|icici|bill|qr)/i, books: ['playbook_cust_20'], weight: 5 }
  ];

  customerBooks.forEach(book => {
    let bookScore = 0;
    queryKeywords.forEach(kw => {
      if (kw.regex.test(lowerMsg)) {
        if (kw.books.includes(book.id)) bookScore += kw.weight;
      }
    });

    (book.chunks || []).forEach(chunk => {
      let chunkScore = bookScore;
      const combined = `${chunk.heading} ${chunk.content}`.toLowerCase();
      
      const words = lowerMsg.split(/\s+/).filter(w => w.length > 3);
      words.forEach(w => {
        if (combined.includes(w)) chunkScore += 1;
      });

      if (chunkScore > 0) {
        scoredChunks.push({
          bookId: book.id,
          bookTitle: book.title,
          heading: chunk.heading,
          content: chunk.content,
          preview: chunk.preview || chunk.content.slice(0, 160),
          score: chunkScore
        });
      }
    });
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  const selectedChunks = scoredChunks.slice(0, 3);

  if (selectedChunks.length === 0 && customerBooks[0] && customerBooks[0].chunks) {
    selectedChunks.push({
      bookId: customerBooks[0].id,
      bookTitle: customerBooks[0].title,
      heading: customerBooks[0].chunks[0].heading,
      content: customerBooks[0].chunks[0].content,
      preview: customerBooks[0].chunks[0].preview,
      score: 1
    });
  }

  const contextSnippet = selectedChunks.map(c => 
    `📘 *[RAG 1 Source: ${c.bookTitle} | Chapter: ${c.heading}]*\n${c.content}`
  ).join('\n\n');

  return {
    ragVault: 'CUSTOMER_BOTANICAL_RAG',
    ragName: 'Public Customer Botanical & Plant Detailing RAG',
    matchedChunks: selectedChunks,
    contextSnippet,
    bookCount: customerBooks.length,
    activeBookId: loadedIndex.activeCustomerPlaybookId || (customerBooks[0] ? customerBooks[0].id : null)
  };
}

/**
 * 💼 RAG 2: Dealer & Wholesale Vendor Procurement Negotiation Retrieval
 * Extracts Voss/Ackerman tactics, margin defense, freight limits, and settlement formulas
 */
function queryNegotiationRAG(turnOrMessage = 1, context = {}) {
  initIndex();
  const negotiationBooks = (loadedIndex.books || []).filter(b => 
    b.category === 'NEGOTIATION_RAG' || 
    (b.filename && b.filename.includes('negotiation_rag')) ||
    b.id.startsWith('playbook_nego_') ||
    b.id === 'playbook-default-master'
  );

  const activeBookId = loadedIndex.activeNegotiationPlaybookId || 'playbook-default-master';
  const activeBook = negotiationBooks.find(b => b.id === activeBookId) || negotiationBooks[0];

  let turn = typeof turnOrMessage === 'number' ? turnOrMessage : (context.turn || 1);
  const textQuery = typeof turnOrMessage === 'string' ? turnOrMessage.toLowerCase() : '';

  let tacticName = 'The Anchoring Precedent & Volume Commitment';
  let matchedChunk = null;

  if (activeBook && activeBook.chunks && activeBook.chunks.length > 0) {
    if (textQuery) {
      // Semantic text matching in negotiation books
      matchedChunk = activeBook.chunks.find(c => 
        c.heading.toLowerCase().includes(textQuery) || c.content.toLowerCase().includes(textQuery)
      );
    }

    if (!matchedChunk) {
      if (turn === 1 || turn === 2) {
        matchedChunk = activeBook.chunks.find(c => /anchor|opening|calibration|historical|first/i.test(c.heading) || /anchor|historical/i.test(c.content)) || activeBook.chunks[0];
        tacticName = 'The Anchoring Precedent & Volume Commitment (Turn 1/2)';
      } else if (turn === 3 || turn === 4) {
        matchedChunk = activeBook.chunks.find(c => /empathy|peat|logistics|ackerman|concession|mirror/i.test(c.heading) || /empathy|transport|cost/i.test(c.content)) || activeBook.chunks[Math.min(1, activeBook.chunks.length - 1)];
        tacticName = 'Tactical Empathy & Non-Monetary Payout Trade-Off (Turn 3/4)';
      } else {
        matchedChunk = activeBook.chunks.find(c => /walkaway|ceiling|discipline|calibrated|margin/i.test(c.heading) || /walkaway|ceiling/i.test(c.content)) || activeBook.chunks[activeBook.chunks.length - 1];
        tacticName = 'Calibrated Walkaway Enforcement & Margin Defense (Final Turn)';
      }
    }
  }

  const chunk = matchedChunk || {
    heading: 'Core Procurement Negotiation Rule',
    content: 'Never exceed the maximum walkaway ceiling cost. Use tactical empathy and instant UPI payment terms to secure wholesale discounts.',
    preview: 'Never exceed the maximum walkaway ceiling cost.'
  };

  return {
    ragVault: 'VENDOR_NEGOTIATION_RAG',
    ragName: 'Dealer & Wholesale Vendor Procurement Negotiation RAG',
    source: activeBook ? activeBook.title : 'Master Procurement Playbook',
    chapter: chunk.heading,
    tacticName,
    guidance: chunk.preview,
    fullContent: chunk.content,
    bookCount: negotiationBooks.length,
    activeBookId: activeBook ? activeBook.id : null,
    turn
  };
}

/**
 * 📊 Get Dual RAG Overview (Both RAGs side-by-side with complete stats)
 */
function getDualRAGOverview() {
  initIndex();
  const customerBooks = (loadedIndex.books || []).filter(b => 
    b.category === 'CUSTOMER_RAG' || 
    (b.filename && b.filename.includes('customer_rag')) ||
    b.id.startsWith('playbook_cust_')
  );

  const negotiationBooks = (loadedIndex.books || []).filter(b => 
    b.category === 'NEGOTIATION_RAG' || 
    (b.filename && b.filename.includes('negotiation_rag')) ||
    b.id.startsWith('playbook_nego_') ||
    b.id === 'playbook-default-master'
  );

  const customerChunksCount = customerBooks.reduce((sum, b) => sum + (b.chunk_count || 0), 0);
  const negotiationChunksCount = negotiationBooks.reduce((sum, b) => sum + (b.chunk_count || 0), 0);

  return {
    success: true,
    dualRagsActive: true,
    rag1_customer: {
      id: 'customer_rag',
      name: '🌿 RAG 1: Public Customer Botanical & Plant Detailing Vault',
      role: 'Customer WhatsApp Consultation, Botanical Care Guides, Pet Toxicity (ASPCA), Soil & Climate Advice',
      totalBooks: customerBooks.length,
      totalChunks: customerChunksCount,
      activeBookId: loadedIndex.activeCustomerPlaybookId || (customerBooks[0] ? customerBooks[0].id : null),
      sampleTopics: ['Snake Plant Air Purification', 'ZZ Plant Low Light AC Office', 'Peace Lily Humidity Care', 'Kerala Monsoon Watering', 'Pet Safety Warnings'],
      books: customerBooks.map(b => ({
        id: b.id,
        title: b.title,
        filename: b.filename,
        chunk_count: b.chunk_count,
        is_active: b.id === loadedIndex.activeCustomerPlaybookId
      }))
    },
    rag2_negotiation: {
      id: 'negotiation_rag',
      name: '💼 RAG 2: Dealer & Wholesale Vendor Negotiation Vault',
      role: 'Autonomous Procurement Bargaining, Chris Voss Tactical Empathy, Ackerman Price Modeling, UPI Trade-offs',
      totalBooks: negotiationBooks.length,
      totalChunks: negotiationChunksCount,
      activeBookId: loadedIndex.activeNegotiationPlaybookId || 'playbook-default-master',
      sampleTopics: ['Chris Voss Tactical Empathy', 'Ackerman Concession Bargaining', 'Price Ceiling Firewall', '100% Instant Corporate UPI', 'Transit SLA Guarantees'],
      books: negotiationBooks.map(b => ({
        id: b.id,
        title: b.title,
        filename: b.filename,
        chunk_count: b.chunk_count,
        is_active: b.id === (loadedIndex.activeNegotiationPlaybookId || 'playbook-default-master')
      }))
    }
  };
}

function listPlaybooks() {
  initIndex();
  const overview = getDualRAGOverview();
  return {
    activeId: loadedIndex.activePlaybookId,
    activeCustomerPlaybookId: loadedIndex.activeCustomerPlaybookId,
    activeNegotiationPlaybookId: loadedIndex.activeNegotiationPlaybookId,
    customerBooksCount: overview.rag1_customer.totalBooks,
    negotiationBooksCount: overview.rag2_negotiation.totalBooks,
    totalBooks: loadedIndex.books.length,
    dualRags: overview,
    books: loadedIndex.books.map(b => ({
      id: b.id,
      category: b.category || (b.id.startsWith('playbook_cust_') ? 'CUSTOMER_RAG' : 'NEGOTIATION_RAG'),
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

function setActivePlaybook(bookId, category = null) {
  initIndex();
  const book = loadedIndex.books.find(b => b.id === bookId);
  if (!book) return { success: false, error: 'Book not found' };

  const isCust = category === 'CUSTOMER_RAG' || book.category === 'CUSTOMER_RAG' || book.id.startsWith('playbook_cust_');
  if (isCust) {
    loadedIndex.activeCustomerPlaybookId = bookId;
  } else {
    loadedIndex.activeNegotiationPlaybookId = bookId;
    loadedIndex.activePlaybookId = bookId;
  }

  loadedIndex.books.forEach(b => {
    if (isCust && (b.category === 'CUSTOMER_RAG' || b.id.startsWith('playbook_cust_'))) {
      b.is_active = (b.id === bookId);
    } else if (!isCust && (b.category === 'NEGOTIATION_RAG' || b.id.startsWith('playbook_nego_') || b.id === 'playbook-default-master')) {
      b.is_active = (b.id === bookId);
    }
  });

  saveIndex();
  return { 
    success: true, 
    activeId: bookId, 
    title: book.title,
    category: isCust ? 'CUSTOMER_RAG' : 'NEGOTIATION_RAG'
  };
}

// Initial bootstrap
initIndex();

module.exports = {
  initIndex,
  ingestPlaybook,
  retrieveNegotiationTactic: queryNegotiationRAG,
  retrieveCustomerRAGContext: queryCustomerRAG,
  queryCustomerRAG,
  queryNegotiationRAG,
  getDualRAGOverview,
  listPlaybooks,
  setActivePlaybook
};
