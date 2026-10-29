const fs = require('fs');

function updateRouteWithAutoSend(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  const oldFragment = "const multiRes = ragProcurement.initiateMultiVendorRestockForProduct(product.id, product, quantity || 60);\n    res.json(multiRes);";

  const newFragment = `const multiRes = ragProcurement.initiateMultiVendorRestockForProduct(product.id, product, quantity || 60);

    // 🚀 CRITICAL FIX: Send actual message via WhatsApp Cloud API for all matched vendors
    if (multiRes && multiRes.success && Array.isArray(multiRes.sessions)) {
      for (const item of multiRes.sessions) {
        const vPhone = item.vendor.whatsapp || item.vendor.phone;
        try {
          console.log(\`📲 [Outreach API] Dispatching WhatsApp message to \${item.vendor.vendor_name} (\${vPhone})...\`);
          const sendRes = await whatsappService.sendMessage({
            to: vPhone,
            message: item.openingMsg
          });
          item.dispatchResult = sendRes;
          if (sendRes && sendRes.success) {
            console.log(\`✅ [Outreach API] Successfully sent WhatsApp message to \${vPhone} (ID: \${sendRes.messageId})\`);
          } else {
            console.warn(\`⚠️ [Outreach API] WhatsApp dispatch warning for \${vPhone}:\`, sendRes?.error || sendRes?.reason);
          }
        } catch (sendErr) {
          console.error(\`❌ [Outreach API] WhatsApp send error for \${vPhone}:\`, sendErr.message);
        }
      }
    }

    res.json(multiRes);`;

  if (code.includes(oldFragment)) {
    code = code.replace(oldFragment, newFragment);
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('✅ Successfully updated ' + filePath);
  } else {
    console.log('⚠️ oldFragment not found in ' + filePath);
  }
}

updateRouteWithAutoSend('whatsapp-agent-model-1-centralized/route.js');
updateRouteWithAutoSend('whatsapp-agent-model-2-byon/route.js');
updateRouteWithAutoSend('backend/route.js');
