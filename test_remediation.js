'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

process.env.AGENT_API_KEY = 'merlot_secure_agent_key_2026';

const inventoryRouter = require('./backend/route');
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/inventory-agent', inventoryRouter);
app.use('/api/workflow', inventoryRouter);
app.use('/', inventoryRouter);

// Lightweight in-process express invoker (0 network socket dependency)
function invokeApp(method, url, headers = {}, body = null) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    const parsedUrl = new URL(url, 'http://localhost');
    req.method = method.toUpperCase();
    req.url = url;
    req.originalUrl = url;
    req.headers = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );
    req.query = Object.fromEntries(parsedUrl.searchParams.entries());
    req.body = body;
    req.connection = { remoteAddress: '127.0.0.1' };
    req.ip = '127.0.0.1';
    req.pipe = () => {};
    req.unpipe = () => {};
    req.resume = () => {};

    let resBody = '';
    const resHeaders = {};
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(name, value) {
        resHeaders[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return resHeaders[name.toLowerCase()];
      },
      json(data) {
        resBody = data;
        resolve({ status: this.statusCode, body: resBody, headers: resHeaders });
      },
      send(data) {
        resBody = data;
        resolve({ status: this.statusCode, body: resBody, headers: resHeaders });
      },
      end(data) {
        if (data) resBody = data;
        resolve({ status: this.statusCode, body: resBody, headers: resHeaders });
      }
    };

    app.handle(req, res);
  });
}

async function runTests() {
  console.log('🧪 Starting In-Process Code Review Remediation Test Suite...\n');

  // TEST 1: Unauthenticated sensitive endpoint must return 401
  console.log('Test 1: Unauthenticated GET /env-config returns 401');
  const res1 = await invokeApp('GET', '/api/inventory-agent/env-config');
  assert.strictEqual(res1.status, 401, `Expected 401, got ${res1.status}`);
  console.log('  ✅ PASSED: 401 Unauthorized blocked unauthenticated caller.\n');

  // TEST 2: Authenticated sensitive endpoint returns 200
  console.log('Test 2: Authenticated GET /env-config with X-Agent-Key returns 200');
  const res2 = await invokeApp('GET', '/api/inventory-agent/env-config', {
    'X-Agent-Key': 'merlot_secure_agent_key_2026'
  });
  assert.strictEqual(res2.status, 200, `Expected 200, got ${res2.status}`);
  assert.ok(res2.body.config, 'Expected config in response');
  console.log('  ✅ PASSED: Authenticated caller retrieved config.\n');

  // TEST 3: Unauthenticated POST /approve-and-pay must return 401
  console.log('Test 3: Unauthenticated POST /approve-and-pay returns 401');
  const res3 = await invokeApp('POST', '/api/inventory-agent/approve-and-pay', {
    'Content-Type': 'application/json'
  }, { settlement: { po_number: 'PO-TEST-123' } });
  assert.strictEqual(res3.status, 401, `Expected 401, got ${res3.status}`);
  console.log('  ✅ PASSED: Financial dispatch unauthorized call rejected with 401.\n');

  // TEST 4: Blind CSV overwrite prevention with pre-validation
  console.log('Test 4: Corrupt CSV payload is rejected and does not corrupt vendors.csv');
  const csvPath = path.resolve(__dirname, 'vendors.csv');
  const originalCSV = fs.readFileSync(csvPath, 'utf8');

  const res4 = await invokeApp('POST', '/api/inventory-agent/import-vendors-csv', {
    'Content-Type': 'application/json',
    'X-Agent-Key': 'merlot_secure_agent_key_2026'
  }, { csv_content: 'this is not a valid csv and has no valid nursery supplier rows' });
  assert.strictEqual(res4.status, 400, `Expected 400, got ${res4.status}`);
  const postCheckCSV = fs.readFileSync(csvPath, 'utf8');
  assert.strictEqual(postCheckCSV, originalCSV, 'vendors.csv should not be modified on validation failure');
  console.log('  ✅ PASSED: Malformed CSV was rejected (400) and vendors.csv remained untouched.\n');

  // TEST 5: WhatsApp Session Hijacking Prevention
  console.log('Test 5: Unrecognized incoming WhatsApp sender is isolated (no session hijacking)');
  const res5 = await invokeApp('POST', '/api/inventory-agent/whatsapp-webhook', {
    'Content-Type': 'application/json'
  }, {
    from: '919999999999', // Unknown random phone number
    message: 'Hello I agree to 100'
  });
  assert.strictEqual(res5.status, 200);
  assert.strictEqual(res5.body.negotiation_status, 'NO_ACTIVE_SESSION');
  assert.strictEqual(res5.body.autonomous_action, 'UNRECOGNIZED_SENDER_ISOLATED');
  console.log('  ✅ PASSED: Unknown sender safely isolated without hijacking another vendor session.\n');

  // TEST 6: False Deal Closure Prevention on Negation ("Not agreed", "No deal")
  console.log('Test 6: False deal closure on negation phrases ("Not agreed", "No deal")');
  const autoRestock = inventoryRouter.ragProcurement.initiateAutoRestockForProduct('p_snake_plant_10in', {
    name: 'Snake Plant (Sansevieria Laurentii)',
    price: 499.00
  }, 50);

  const testSession = autoRestock.session;
  assert.ok(testSession, 'Test session initialized');

  const replyNegated = await inventoryRouter.ragProcurement.handleIncomingWhatsAppReply({
    from: testSession.vendor.whatsapp || '919876543210',
    message: 'Not agreed. Price is too low.',
    sessionId: testSession.sessionId
  });
  assert.notStrictEqual(replyNegated.status, 'DEAL_CLOSED', 'Negated message should NOT close deal');
  assert.strictEqual(replyNegated.status, 'COUNTER_OFFER_SENT', 'Should send counter-offer instead');
  console.log('  ✅ PASSED: "Not agreed" correctly recognized as negation; deal was NOT closed.\n');

  // TEST 7: Mandatory Ceiling Cost Guard
  console.log('Test 7: Vendor message with price above ceiling does NOT auto-close even if affirmative');
  const replyAboveCeiling = await inventoryRouter.ragProcurement.handleIncomingWhatsAppReply({
    from: testSession.vendor.whatsapp || '919876543210',
    message: 'Deal confirmed at ₹450', // 450 is higher than ceilingCost (approx 249-300)
    sessionId: testSession.sessionId
  });
  assert.notStrictEqual(replyAboveCeiling.status, 'DEAL_CLOSED', 'Price above ceiling must NOT close deal');
  assert.strictEqual(replyAboveCeiling.status, 'COUNTER_OFFER_SENT');
  assert.ok(replyAboveCeiling.counterOffered <= testSession.ceilingCost, 'Counter-offer must stay <= ceilingCost');
  console.log(`  ✅ PASSED: Price ₹450 above ceiling (₹${testSession.ceilingCost}) refused deal closure; counter-offered ₹${replyAboveCeiling.counterOffered}.\n`);

  // TEST 8: Valid Acceptance at/below ceiling DOES close deal
  console.log('Test 8: Legitimate agreement at/below ceiling successfully closes deal');
  const acceptablePrice = Math.floor(testSession.ceilingCost * 0.95);
  const replyLegit = await inventoryRouter.ragProcurement.handleIncomingWhatsAppReply({
    from: testSession.vendor.whatsapp || '919876543210',
    message: `Agreed. We can do ₹${acceptablePrice}`,
    sessionId: testSession.sessionId
  });
  assert.strictEqual(replyLegit.status, 'DEAL_CLOSED', 'Legitimate agreement should close deal');
  assert.strictEqual(replyLegit.settlement.final_price, acceptablePrice);
  console.log(`  ✅ PASSED: Legitimate agreement at ₹${acceptablePrice} closed deal cleanly.\n`);

  // TEST 9: Commercial ROI Whitepaper PDF endpoint returns valid PDF
  console.log('Test 9: GET /download-commercial-whitepaper returns valid PDF');
  const res9 = await invokeApp('GET', '/api/inventory-agent/download-commercial-whitepaper');
  assert.strictEqual(res9.status, 200, `Expected 200, got ${res9.status}`);
  assert.strictEqual(res9.headers['content-type'], 'application/pdf');
  console.log('  ✅ PASSED: Commercial ROI Whitepaper PDF served with correct headers.\n');

  // TEST 10: Persistent Vendor Chat Ledger in SQLite
  console.log('Test 10: GET /vendor-chat-ledger retrieves chat turns recorded in SQLite');
  const res10 = await invokeApp('GET', '/api/inventory-agent/vendor-chat-ledger');
  assert.strictEqual(res10.status, 200, `Expected 200, got ${res10.status}`);
  assert.ok(Array.isArray(res10.body.history), 'Expected history array from SQLite ledger');
  console.log(`  ✅ PASSED: SQLite vendor chat ledger verified (${res10.body.history.length} records found).\n`);

  // TEST 11: Zero-Mock Policy Verification
  console.log('Test 11: Zero-Mock Policy when POS Catalog is empty');
  const res11 = await invokeApp('GET', '/api/inventory-agent/analyze');
  assert.strictEqual(res11.status, 200, `Expected 200, got ${res11.status}`);
  // If the retail DB is empty, storeProducts must be empty (0 items) or is_pos_empty: true
  if (res11.body.summary.total_skus === 0) {
    assert.strictEqual(res11.body.is_pos_empty, true, 'is_pos_empty must be true when 0 SKUs');
    console.log('  ✅ PASSED: Zero-Mock policy verified — empty POS catalog returns 0 SKUs and is_pos_empty: true.\n');
  } else {
    console.log(`  ✅ PASSED: Active POS catalog contains ${res11.body.summary.total_skus} live SKUs from database.\n`);
  }

  // TEST 12: Workflow Orchestration Engine Status & Switchable Profiles
  console.log('Test 12: GET /workflow-orchestration retrieves switchable profiles & queue stats');
  const res12 = await invokeApp('GET', '/api/inventory-agent/workflow-orchestration');
  assert.strictEqual(res12.status, 200, `Expected 200, got ${res12.status}`);
  assert.ok(res12.body.availableProfiles.length >= 5, 'Must have at least 5 switchable workflow profiles');
  assert.ok(typeof res12.body.maxConcurrentWorkflows === 'number', 'Must specify queue concurrency limit');
  console.log(`  ✅ PASSED: ${res12.body.availableProfiles.length} switchable workflow profiles loaded with concurrency scaling (${res12.body.maxConcurrentWorkflows} max jobs).\n`);

  // TEST 13: Switch Workflow Profile
  console.log('Test 13: POST /workflow-orchestration/switch-profile switches to HUMAN_APPROVAL_GATE');
  const res13 = await invokeApp('POST', '/api/inventory-agent/workflow-orchestration/switch-profile', {
    'X-Agent-Key': 'merlot_secure_agent_key_2026'
  }, { profile_id: 'HUMAN_APPROVAL_GATE' });
  assert.strictEqual(res13.status, 200, `Expected 200, got ${res13.status}`);
  assert.strictEqual(res13.body.activeProfile.id, 'HUMAN_APPROVAL_GATE');
  console.log('  ✅ PASSED: Switched active workflow orchestration strategy to Human-in-the-Loop.\n');

  // TEST 14: Edit Workflow Configuration Limits
  console.log('Test 14: POST /workflow-orchestration/config edits policy thresholds & scaling knobs');
  const res14 = await invokeApp('POST', '/api/inventory-agent/workflow-orchestration/config', {
    'X-Agent-Key': 'merlot_secure_agent_key_2026'
  }, {
    autoApprovalLimitInr: 30000,
    maxConcurrentWorkflows: 50,
    maxNegotiationRounds: 4
  });
  assert.strictEqual(res14.status, 200, `Expected 200, got ${res14.status}`);
  assert.strictEqual(res14.body.config.autoApprovalLimitInr, 30000);
  assert.strictEqual(res14.body.config.maxConcurrentWorkflows, 50);
  console.log('  ✅ PASSED: Workflow configuration thresholds successfully edited and persisted.\n');

  // TEST 15: Trigger Workflow and Human Approval Resolution
  console.log('Test 15: Trigger workflow execution with state machine persistence and approval resolution');
  const res15 = await invokeApp('POST', '/api/inventory-agent/workflow-orchestration/trigger', {
    'X-Agent-Key': 'merlot_secure_agent_key_2026'
  }, {
    product_id: 'p_snake_plant_10in',
    product_name: 'Snake Plant',
    quantity: 20,
    price: 499
  });
  assert.strictEqual(res15.status, 200, `Expected 200, got ${res15.status}`);
  const wfId = res15.body.execution.workflowId;

  // Allow pipeline to progress to approval gate
  await new Promise(r => setTimeout(r, 400));
  const wfCheck = await inventoryRouter.workflowEngine.getExecution(wfId);
  assert.strictEqual(wfCheck.status, 'AWAITING_HUMAN_APPROVAL', 'Should pause at human gate');

  // Manager approves workflow
  const res15Approve = await invokeApp('POST', `/api/inventory-agent/workflow-orchestration/executions/${wfId}/approve`, {
    'X-Agent-Key': 'merlot_secure_agent_key_2026'
  }, { manager_name: 'Auditor Test' });
  assert.strictEqual(res15Approve.status, 200, `Expected 200, got ${res15Approve.status}`);

  // Confirm state completed in SQLite
  const wfFinal = await inventoryRouter.workflowEngine.getExecution(wfId);
  assert.strictEqual(wfFinal.status, 'COMPLETED', 'Should transition to COMPLETED upon human approval');
  console.log(`  ✅ PASSED: Workflow ${wfId} paused for human gate and completed upon manager approval.\n`);

  // Switch back to AUTONOMOUS_ACKERMAN
  inventoryRouter.workflowEngine.switchProfile('AUTONOMOUS_ACKERMAN');

  // ==================== Developer Handover Guide Compliance Tests ====================
  console.log('Test 16: Developer Handover Contract - GET /api/workflow/orchestration?company_id=...');
  const res16 = await invokeApp('GET', '/api/workflow/orchestration?company_id=company_alpha', {
    'X-Agent-Key': 'merlot_secure_agent_key_2026'
  });
  assert.strictEqual(res16.status, 200, `Expected 200, got ${res16.status}`);
  assert.strictEqual(res16.body.company_id, 'company_alpha');
  assert.ok(res16.body.config.active_workflow_id, 'Must return active_workflow_id');
  console.log('  ✅ PASSED: Retrieved company_alpha orchestration config.\n');

  console.log('Test 17: Developer Handover Contract - POST /api/workflow/orchestration updates policy & mode');
  const res17 = await invokeApp('POST', '/api/workflow/orchestration', {
    'X-Agent-Key': 'merlot_secure_agent_key_2026'
  }, {
    company_id: 'company_alpha',
    updates: {
      failure_policy: 'retry',
      max_retries: 3,
      orchestration_mode: 'planner',
      active_workflow_id: 'HUMAN_APPROVAL_GATE'
    }
  });
  assert.strictEqual(res17.status, 200, `Expected 200, got ${res17.status}`);
  assert.strictEqual(res17.body.config.failure_policy, 'retry');
  assert.strictEqual(res17.body.config.max_retries, 3);
  assert.strictEqual(res17.body.config.active_workflow_id, 'HUMAN_APPROVAL_GATE');
  console.log('  ✅ PASSED: Successfully updated failure_policy=retry, max_retries=3, and active_workflow_id.\n');

  console.log('Test 18: Reject unknown workflow ID without silent fallback');
  const res18 = await invokeApp('POST', '/api/workflow/orchestration', {
    'X-Agent-Key': 'merlot_secure_agent_key_2026'
  }, {
    company_id: 'company_alpha',
    updates: { active_workflow_id: 'NON_EXISTENT_WORKFLOW_ID' }
  });
  assert.strictEqual(res18.status, 400, 'Must reject unknown workflow ID with 400');
  assert.ok(res18.body.error.includes('Unknown workflow ID'), 'Error must specify unknown workflow ID');
  console.log('  ✅ PASSED: Unknown workflow ID rejected (no silent global fallback).\n');

  console.log('Test 19: Reject out-of-range retries (>5) and invalid failure policy enum');
  const res19 = await invokeApp('POST', '/api/workflow/orchestration', {
    'X-Agent-Key': 'merlot_secure_agent_key_2026'
  }, {
    company_id: 'company_alpha',
    updates: { max_retries: 99, failure_policy: 'invalid_enum' }
  });
  assert.strictEqual(res19.status, 400, 'Must reject invalid inputs with 400');
  console.log('  ✅ PASSED: Invalid policy enum and out-of-range retries rejected.\n');

  console.log('Test 20: Cross-tenant access guard returns 403 Forbidden');
  const res20 = await invokeApp('GET', '/api/workflow/orchestration?company_id=unauthorized_competitor_corp', {
    'X-Agent-Key': 'merlot_secure_agent_key_2026',
    'X-Authorized-Company-Id': 'tenant_merlot_01'
  });
  assert.strictEqual(res20.status, 403, 'Must return 403 Forbidden on cross-tenant access attempt');
  console.log('  ✅ PASSED: Cross-tenant unauthorized access blocked with 403 Forbidden.\n');

  console.log('🎉 ALL 20 TESTS PASSED SUCCESSFULLY! Workflow orchestration handover specification fully verified.');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
