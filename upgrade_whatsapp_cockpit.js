const fs = require('fs');
const path = require('path');

function patchRoute(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add validateMetaToken method to WhatsAppService if not present
  if (!content.includes('validateMetaToken()')) {
    const marker = 'refreshConfig() {';
    const validateCode = `async validateMetaToken() {
    this.refreshConfig();
    if (!this.meta.phoneNumberId || !this.meta.accessToken) {
      return { valid: false, error: 'Phone Number ID or Access Token is missing' };
    }
    try {
      const url = \`https://graph.facebook.com/\${this.meta.apiVersion}/\${this.meta.phoneNumberId}?access_token=\${this.meta.accessToken}\`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) {
        return {
          valid: false,
          code: data.error?.code || 190,
          error: data.error?.message || 'Meta token validation failed',
          type: data.error?.type
        };
      }
      return {
        valid: true,
        phoneNumberId: this.meta.phoneNumberId,
        displayPhoneNumber: data.display_phone_number || data.id,
        verifiedName: data.verified_name || 'Configured Business Number'
      };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  refreshConfig() {`;
    content = content.replace(marker, validateCode);
    console.log(`[Patch] Added validateMetaToken to ${filePath}`);
  }

  // 2. Add /whatsapp-status and /update-meta-token endpoints if not present
  if (!content.includes('/whatsapp-status')) {
    const endMarker = 'module.exports = router;';
    const newEndpoints = `
// GET /api/inventory-agent/whatsapp-status - Check live Meta token & connection health
router.get(['/api/inventory-agent/whatsapp-status', '/api/inventory/whatsapp-status', '/whatsapp-status'], async (req, res) => {
  try {
    const status = whatsappService.getStatus();
    const tokenCheck = await whatsappService.validateMetaToken();
    res.json({
      ...status,
      tokenCheck,
      phoneNumberId: whatsappService.meta.phoneNumberId,
      senderModel: process.env.SENDER_MODEL || 'MODEL_A_CENTRALIZED'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory-agent/update-meta-token - Live update Meta Cloud API access token
router.post(['/api/inventory-agent/update-meta-token', '/api/inventory/update-meta-token', '/update-meta-token'], async (req, res) => {
  try {
    const { accessToken, phoneNumberId } = req.body || {};
    if (!accessToken && !phoneNumberId) {
      return res.status(400).json({ error: 'accessToken or phoneNumberId is required' });
    }
    const envUpdates = {};
    if (accessToken) {
      process.env.META_WA_ACCESS_TOKEN = accessToken.trim();
      envUpdates.META_WA_ACCESS_TOKEN = process.env.META_WA_ACCESS_TOKEN;
    }
    if (phoneNumberId) {
      process.env.META_WA_PHONE_NUMBER_ID = phoneNumberId.trim();
      envUpdates.META_WA_PHONE_NUMBER_ID = process.env.META_WA_PHONE_NUMBER_ID;
    }
    if (typeof safeUpdateEnv === 'function') {
      safeUpdateEnv(envUpdates);
    }
    whatsappService.refreshConfig();

    const tokenCheck = await whatsappService.validateMetaToken();
    res.json({
      success: tokenCheck.valid,
      message: tokenCheck.valid 
        ? '✅ Meta WhatsApp token updated and verified successfully!' 
        : '⚠️ Token saved, but Meta verification returned: ' + tokenCheck.error,
      tokenCheck
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update token: ' + err.message });
  }
});

module.exports = router;`;
    content = content.replace(endMarker, newEndpoints);
    console.log(`[Patch] Added endpoints to ${filePath}`);
  }

  // 3. Make sure /outreach-all-vendors returns detailed anySent and dispatchErrors
  const outreachOldMatch = content.match(/router\.post\(\['\/api\/inventory-agent\/outreach-all-vendors'[\s\S]*?res\.json\(multiRes\);\s*\}\s*catch/);
  if (outreachOldMatch) {
    const fullBlock = outreachOldMatch[0];
    const improvedBlock = `router.post(['/api/inventory-agent/outreach-all-vendors', '/api/inventory/outreach-all-vendors', '/outreach-all-vendors'], async (req, res) => {
  try {
    const { product_id, quantity } = req.body || {};
    const allProducts = await posBridge.getProducts();
    const product = (allProducts || []).find(p => p.id === product_id) || {
      id: product_id || 'm1',
      name: 'Snake Plant in Ceramic Pot',
      price: 450,
      stock: 3
    };

    const multiRes = ragProcurement.initiateMultiVendorRestockForProduct(product.id, product, quantity || 60);

    // 🚀 CRITICAL FIX: Send actual message via WhatsApp Cloud API for all matched vendors
    let anySent = false;
    let dispatchErrors = [];
    if (multiRes && multiRes.success && Array.isArray(multiRes.sessions)) {
      for (const item of multiRes.sessions) {
        const vPhone = item.vendor.whatsapp || item.vendor.phone;
        item.fallbackUrl = whatsappService.buildFallbackUrl(vPhone, item.openingMsg);
        try {
          console.log(\`📲 [Outreach API] Dispatching WhatsApp message to \${item.vendor.vendor_name} (\${vPhone})...\`);
          const sendRes = await whatsappService.sendMessage({
            to: vPhone,
            message: item.openingMsg
          });
          item.dispatchResult = sendRes;
          if (sendRes && sendRes.success) {
            anySent = true;
            console.log(\`✅ [Outreach API] Successfully sent WhatsApp message to \${vPhone} (ID: \${sendRes.messageId})\`);
          } else {
            const errReason = sendRes?.error || sendRes?.reason || 'Unknown dispatch error';
            console.warn(\`⚠️ [Outreach API] WhatsApp dispatch warning for \${vPhone}:\`, errReason);
            dispatchErrors.push(\`\${item.vendor.vendor_name} (\${vPhone}): \${errReason}\`);
          }
        } catch (sendErr) {
          console.error(\`❌ [Outreach API] WhatsApp send error for \${vPhone}:\`, sendErr.message);
          dispatchErrors.push(\`\${item.vendor.vendor_name}: \${sendErr.message}\`);
        }
      }
    }

    multiRes.anySent = anySent;
    multiRes.dispatchErrors = dispatchErrors;
    res.json(multiRes);
  } catch`;
    content = content.replace(fullBlock, improvedBlock);
    console.log(`[Patch] Updated outreach-all-vendors in ${filePath}`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

patchRoute('whatsapp-agent-model-1-centralized/route.js');
patchRoute('whatsapp-agent-model-2-byon/route.js');
patchRoute('backend/route.js');
console.log('✅ Route patching complete!');
