const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');

async function testMcpServer() {
  console.log('🧪 Testing WhatsApp Agent MCP Server over stdio...');

  const serverPath = path.resolve(__dirname, 'server.js');
  const child = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  let responseBuffer = '';

  function sendRpc(msg) {
    child.stdin.write(JSON.stringify(msg) + '\n');
  }

  function waitForNextResponse() {
    return new Promise((resolve) => {
      const onData = (chunk) => {
        responseBuffer += chunk.toString();
        if (responseBuffer.includes('\n')) {
          const lines = responseBuffer.split('\n');
          const firstLine = lines.shift();
          responseBuffer = lines.join('\n');
          child.stdout.removeListener('data', onData);
          resolve(JSON.parse(firstLine.trim()));
        }
      };
      child.stdout.on('data', onData);
    });
  }

  // 1. Initialize
  console.log('1. Sending "initialize"...');
  sendRpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'TestClient', version: '1.0' }
    }
  });

  const initRes = await waitForNextResponse();
  assert.strictEqual(initRes.id, 1);
  assert.strictEqual(initRes.result.serverInfo.name, 'whatsapp-agent-mcp-server');
  console.log('  ✅ Initialized:', initRes.result.serverInfo);

  // 2. Tools list
  console.log('2. Sending "tools/list"...');
  sendRpc({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  });

  const toolsRes = await waitForNextResponse();
  assert.strictEqual(toolsRes.id, 2);
  const toolNames = toolsRes.result.tools.map(t => t.name);
  console.log('  ✅ Available MCP Tools:', toolNames);
  assert.ok(toolNames.includes('send_whatsapp_message'));
  assert.ok(toolNames.includes('start_procurement_negotiation'));
  assert.ok(toolNames.includes('handle_whatsapp_incoming_reply'));

  // 3. Call tool: send_whatsapp_message
  console.log('3. Calling tool "send_whatsapp_message"...');
  sendRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'send_whatsapp_message',
      arguments: {
        to: '+919876543210',
        message: 'Hello from MCP WhatsApp Server!'
      }
    }
  });

  const callRes = await waitForNextResponse();
  assert.strictEqual(callRes.id, 3);
  const content = JSON.parse(callRes.result.content[0].text);
  assert.strictEqual(content.success, true);
  console.log('  ✅ Tool Call Output:', content.provider, content.to);

  // 4. Call tool: start_procurement_negotiation
  console.log('4. Calling tool "start_procurement_negotiation"...');
  sendRpc({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'start_procurement_negotiation',
      arguments: {
        vendor_phone: '9876543210',
        vendor_name: 'Deccan Flora Farms',
        product_name: 'Snake Plant',
        quantity: 30,
        target_price: 280,
        ceiling_cost: 310
      }
    }
  });

  const negRes = await waitForNextResponse();
  assert.strictEqual(negRes.id, 4);
  const negContent = JSON.parse(negRes.result.content[0].text);
  assert.strictEqual(negContent.status, 'SESSION_INITIALIZED');
  console.log('  ✅ Negotiation Session Initialized:', negContent.sessionId);

  child.kill();
  console.log('\n🎉 ALL MCP SERVER UNIT TESTS PASSED PERFECTLY!');
}

testMcpServer().catch((err) => {
  console.error('❌ MCP Test Failed:', err);
  process.exit(1);
});
