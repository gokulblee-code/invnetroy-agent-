const fs = require('fs');

function patchHtmlFile(filePath, modelName, port) {
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Add Token Renewal Modal before </body>
  const modalHtml = `
  <!-- Meta Token Renewal Modal -->
  <div id="modal-meta-token" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 hidden flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
      <div class="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <i class="fa-brands fa-whatsapp"></i>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 text-sm">Meta WhatsApp Cloud API Configuration</h3>
            <p class="text-[11px] text-slate-500">${modelName} (Port ${port})</p>
          </div>
        </div>
        <button onclick="closeMetaTokenModal()" class="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
      </div>

      <div class="space-y-3 text-xs">
        <div id="meta-token-alert-box" class="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 leading-snug">
          <div class="font-bold flex items-center gap-1 mb-1">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span id="meta-token-alert-title">Meta Access Token Status</span>
          </div>
          <div id="meta-token-alert-desc">Checking token status...</div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Meta WhatsApp Phone Number ID</label>
          <input id="input-modal-phone-id" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none" placeholder="509442025578031" />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Meta Access Token (Temporary or Permanent System User)</label>
          <textarea id="input-modal-access-token" rows="3" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none" placeholder="EAAZAfn..."></textarea>
          <p class="text-[10px] text-slate-400 mt-1">
            Get from <a href="https://developers.facebook.com/apps" target="_blank" class="text-emerald-600 underline">Meta Developer Portal</a> &rarr; WhatsApp &rarr; API Setup &rarr; <i>Temporary access token</i>.
          </p>
        </div>

        <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 text-[11px] space-y-1">
          <p class="font-semibold text-slate-800"><i class="fa-solid fa-circle-info text-emerald-600"></i> Why did the token expire?</p>
          <p>Meta's free trial tokens expire automatically after 24 hours (Code 190). Generate a new temporary token or a Permanent System User Token in Meta Business Suite to keep it active forever.</p>
        </div>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button onclick="closeMetaTokenModal()" class="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold text-xs hover:bg-slate-50">Cancel</button>
        <button id="btn-save-meta-token" onclick="saveMetaTokenModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center gap-1.5">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <span>Verify & Save Token</span>
        </button>
      </div>
    </div>
  </div>
  `;

  if (!html.includes('id="modal-meta-token"')) {
    html = html.replace('</body>', `${modalHtml}\n</body>`);
  }

  // 2. Add client-side functions for Modal and Token Checking
  const tokenScript = `
    // Meta Token Modal & Live Health Check
    async function checkMetaTokenHealth() {
      try {
        const res = await fetch('/api/inventory-agent/whatsapp-status');
        if (!res.ok) return;
        const data = await res.json();
        const labelWa = document.getElementById('label-wa-status');
        const badgeWa = document.getElementById('badge-wa-status');
        
        if (labelWa && badgeWa) {
          if (data.tokenCheck && data.tokenCheck.valid) {
            labelWa.innerText = '🟢 Meta WhatsApp Live (Autonomous)';
            badgeWa.className = 'bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-md flex items-center space-x-1 cursor-pointer';
            badgeWa.title = 'Meta Cloud API Connected. Number: ' + (data.tokenCheck.displayPhoneNumber || data.phoneNumberId);
          } else {
            labelWa.innerText = '🔴 Meta Token Expired (Code 190) - Click to Renew';
            badgeWa.className = 'bg-rose-50 text-rose-800 border border-rose-300 text-[10px] font-bold px-2.5 py-0.5 rounded-md flex items-center space-x-1 cursor-pointer animate-pulse';
            badgeWa.title = data.tokenCheck?.error || 'Token expired. Click to update.';
          }
          badgeWa.onclick = openMetaTokenModal;
        }
      } catch (e) {
        console.warn('Failed to check WhatsApp status:', e.message);
      }
    }

    function openMetaTokenModal() {
      const modal = document.getElementById('modal-meta-token');
      if (!modal) return;
      modal.classList.remove('hidden');
      
      // Fetch current config
      fetch('/api/inventory-agent/whatsapp-status')
        .then(r => r.json())
        .then(data => {
          const phoneInput = document.getElementById('input-modal-phone-id');
          if (phoneInput && data.phoneNumberId) phoneInput.value = data.phoneNumberId;
          
          const alertBox = document.getElementById('meta-token-alert-box');
          const alertTitle = document.getElementById('meta-token-alert-title');
          const alertDesc = document.getElementById('meta-token-alert-desc');
          
          if (data.tokenCheck && data.tokenCheck.valid) {
            alertBox.className = 'p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 leading-snug';
            alertTitle.innerText = 'Token Active & Verified';
            alertDesc.innerText = 'Connected to Meta number: ' + (data.tokenCheck.displayPhoneNumber || data.phoneNumberId);
          } else {
            alertBox.className = 'p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 leading-snug';
            alertTitle.innerText = 'Token Expired (OAuth Error 190)';
            alertDesc.innerText = data.tokenCheck?.error || 'Your 24-hour Meta temporary token has expired. Paste a fresh token below to re-enable autonomous messaging.';
          }
        });
    }

    function closeMetaTokenModal() {
      const modal = document.getElementById('modal-meta-token');
      if (modal) modal.classList.add('hidden');
    }

    async function saveMetaTokenModal() {
      const phoneInput = document.getElementById('input-modal-phone-id');
      const tokenInput = document.getElementById('input-modal-access-token');
      const btn = document.getElementById('btn-save-meta-token');
      
      const phoneNumberId = phoneInput ? phoneInput.value.trim() : '';
      const accessToken = tokenInput ? tokenInput.value.trim() : '';
      
      if (!accessToken) {
        alert('Please paste the Meta Access Token.');
        return;
      }
      
      if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
      
      try {
        const res = await fetch('/api/inventory-agent/update-meta-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumberId, accessToken })
        });
        const data = await res.json();
        
        if (data.success) {
          alert('🎉 Token Verified & Saved! Meta WhatsApp Cloud API is now 100% active.');
          closeMetaTokenModal();
          checkMetaTokenHealth();
        } else {
          alert('⚠️ Verification Warning: ' + (data.tokenCheck?.error || data.message || 'Token could not be validated with Meta.'));
          checkMetaTokenHealth();
        }
      } catch (e) {
        alert('Failed to save token: ' + e.message);
      } finally {
        if (btn) btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Verify & Save Token</span>';
      }
    }
  `;

  if (!html.includes('checkMetaTokenHealth()')) {
    html = html.replace('updateGatewayAndWatchdogBadges();', 'updateGatewayAndWatchdogBadges();\n    checkMetaTokenHealth();\n    setInterval(checkMetaTokenHealth, 15000);');
    html = html.replace('</script>', `${tokenScript}\n  </script>`);
  }

  // 3. Update triggerMultiVendorOutreach in index.html to handle anySent, dispatchErrors and WhatsApp Web fallback
  const oldOutreachHandler = `        const data = await res.json();
        if (data && data.success) {
          alert('🚀 Multi-Vendor Outreach Launched! Connected to ' + data.count + ' nursery suppliers via WhatsApp.');
          await refreshMultiVendorCockpit();
        } else {
          alert('Outreach notice: ' + (data.error || 'No matching suppliers found.'));
        }`;

  const newOutreachHandler = `        const data = await res.json();
        if (data && data.success) {
          if (data.anySent) {
            alert('🚀 Multi-Vendor Outreach Dispatched! WhatsApp restock offer sent to ' + data.count + ' nursery suppliers via Meta Cloud API.');
          } else if (data.dispatchErrors && data.dispatchErrors.length > 0) {
            const firstFallback = data.sessions?.[0]?.fallbackUrl;
            const errMsg = data.dispatchErrors.join('\\n');
            const openWeb = confirm(
              '⚠️ WhatsApp Cloud API Notice:\\n\\n' + errMsg +
              '\\n\\n[Reason: Meta Access Token is expired (OAuth Code 190)]' +
              '\\n\\nWould you like to open WhatsApp Web / App directly to send this restock negotiation offer to Gokul Botanical Wholesale now?'
            );
            if (openWeb && firstFallback) {
              window.open(firstFallback, '_blank');
            }
          } else {
            alert('🚀 Multi-Vendor Outreach initialized for ' + data.count + ' suppliers.');
          }
          await refreshMultiVendorCockpit();
        } else {
          alert('Outreach notice: ' + (data.error || 'No matching suppliers found.'));
        }`;

  if (html.includes(oldOutreachHandler)) {
    html = html.replace(oldOutreachHandler, newOutreachHandler);
    console.log(`[Patch] Updated triggerMultiVendorOutreach in ${filePath}`);
  }

  // 4. In renderActiveChatStream, add a direct "Open in WhatsApp Web" button if fallbackUrl exists
  const chatStreamMarker = `<div class="flex justify-between items-center text-[10px] opacity-75 mb-1.5 gap-2">`;
  // We can add a vendor header button bar right above the dialogue stream:
  const streamHeaderMarker = `const stream = document.getElementById('mv-chat-stream');\n      if (!stream) return;`;
  const streamHeaderAddition = `const stream = document.getElementById('mv-chat-stream');
      if (!stream) return;

      const directWaUrl = activeSession.whatsappUrl || ('https://api.whatsapp.com/send?phone=' + (activeSession.whatsapp || activeSession.phone || '917012920612') + '&text=' + encodeURIComponent(activeSession.openingMsg || 'Hello'));
      const vendorPhoneDisp = activeSession.whatsapp || activeSession.phone || '917012920612';
      
      const streamHeader = document.getElementById('mv-chat-header-actions');
      if (streamHeader) {
        streamHeader.innerHTML = \`
          <a href="\${directWaUrl}" target="_blank" class="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs transition">
            <i class="fa-brands fa-whatsapp text-xs"></i>
            <span>Chat via WhatsApp Web (+91 \${vendorPhoneDisp.slice(-10)})</span>
          </a>
        \`;
      }`;

  if (!html.includes('id="mv-chat-header-actions"')) {
    // Add header container above chat stream
    html = html.replace(
      `<div id="mv-chat-stream"`,
      `<div class="flex justify-between items-center px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs">
         <span class="font-semibold text-slate-700 flex items-center gap-1.5">
           <i class="fa-solid fa-comments text-emerald-600"></i> Negotiation Thread
         </span>
         <div id="mv-chat-header-actions"></div>
       </div>\n      <div id="mv-chat-stream"`
    );
  }

  if (html.includes(streamHeaderMarker)) {
    html = html.replace(streamHeaderMarker, streamHeaderAddition);
    console.log(`[Patch] Added WhatsApp Web button header in ${filePath}`);
  }

  fs.writeFileSync(filePath, html, 'utf8');
}

patchHtmlFile('whatsapp-agent-model-1-centralized/index.html', 'Model 1: Centralized WhatsApp Gateway', 5011);
patchHtmlFile('whatsapp-agent-model-2-byon/index.html', 'Model 2: Bring Your Own Number (BYON)', 5012);
console.log('✅ Index HTML patching complete!');
