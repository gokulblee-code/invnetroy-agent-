'use strict';

/**
 * Playbook Engine — Document & Book Ingestion for RAG Negotiation
 * Handles PDF, Markdown, and Text document uploads, semantic chunking,
 * persistent storage, and real-time tactic retrieval during vendor negotiations.
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

module.exports = {
  initIndex,
  ingestPlaybook,
  retrieveNegotiationTactic,
  listPlaybooks,
  setActivePlaybook
};
