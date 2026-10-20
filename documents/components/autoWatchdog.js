'use strict';

/**
 * 🤖 Merlot AutoProcure AI - Autonomous Background Inventory Watchdog Daemon
 *
 * Runs 24/7 in the background without needing human clicks.
 * Periodically scans POS database/catalog, detects low-stock items breaching ROP,
 * and initiates negotiation with wholesale vendors via WhatsApp Cloud API.
 */

const ragProcurement = require('./ragProcurement');
const posBridge = require('./posBridge');
const whatsappService = require('./whatsappService');

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
        storeProducts = [
          { id: 'p_snake_plant_10in', name: 'Snake Plant (Sansevieria Laurentii)', stock: 8, min_stock: 20, price: 499 },
          { id: 'p_fiddle_leaf_fig', name: 'Fiddle Leaf Fig Premium (Ficus Lyrata)', stock: 5, min_stock: 15, price: 1499 },
          { id: 'p_monstera_deliciosa', name: 'Monstera Deliciosa Swiss Cheese', stock: 12, min_stock: 25, price: 799 },
          { id: 'p_neem_oil_500ml', name: 'Organic Cold-Pressed Neem Oil Spray (500ml)', stock: 15, min_stock: 20, price: 299 }
        ];
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

module.exports = new AutoWatchdog();
