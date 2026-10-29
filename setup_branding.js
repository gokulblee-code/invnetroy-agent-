const fs = require('fs');

// MODEL 1: Centralized WhatsApp Gateway
let h1 = fs.readFileSync('whatsapp-agent-model-1-centralized/index.html', 'utf8');

h1 = h1.replace(
  /<p class="text-xs text-slate-500">Autonomous Multi-Vendor Sourcing[\s\S]*?<\/p>/,
  '<p class="text-xs text-slate-500"><span class="bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded text-[10px] mr-1">MODEL 1: CENTRALIZED GATEWAY</span> Zero Meta Config for Stores • Company Managed Sender</p>'
);

h1 = h1.replace(
  'Multi-vendor outreach & Tactical Playbook negotiation grounded in SQLite RAG memory.',
  '🏢 Centralized Company WhatsApp Gateway (Zero Meta Tokens Required by Store)'
);

fs.writeFileSync('whatsapp-agent-model-1-centralized/index.html', h1, 'utf8');

// MODEL 2: Bring Your Own Number (BYON)
let h2 = fs.readFileSync('whatsapp-agent-model-2-byon/index.html', 'utf8');

h2 = h2.replace(
  /<p class="text-xs text-slate-500">Autonomous Multi-Vendor Sourcing[\s\S]*?<\/p>/,
  '<p class="text-xs text-slate-500"><span class="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[10px] mr-1">MODEL 2: BRING YOUR OWN NUMBER</span> Independent WhatsApp Business Account • Client Direct Sender</p>'
);

h2 = h2.replace(
  'Multi-vendor outreach & Tactical Playbook negotiation grounded in SQLite RAG memory.',
  '📲 Dedicated Store WhatsApp Number (Independent 1,000 Free Chats / Store)'
);

fs.writeFileSync('whatsapp-agent-model-2-byon/index.html', h2, 'utf8');

console.log('✅ Model 1 and Model 2 index.html branded successfully.');
