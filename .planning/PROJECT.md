# Merlot AutoProcure AI — Autonomous Inventory Replenishment & Sourcing Agent

## Overview
Merlot AutoProcure AI is an autonomous, production-grade retail inventory procurement platform tailored for retail and nursery home decor enterprises. It bridges directly with local Retail POS systems, evaluates inventory levels and stock reorder points in real time, and conducts multi-vendor wholesale negotiations autonomously via Meta WhatsApp Cloud API and Google Gemini LLMs.

## Core Architecture
- **Backend**: Node.js & Express API with SQLite persistence (`merlot_pos_orders.sqlite` & `localdb.sqlite`).
- **Frontend**: Clean enterprise SaaS single-page application dashboard (`frontend/agent.html`).
- **AI & RAG Engine**: Google Gemini (`gemini-3.5-flash`) with tactical bargaining playbooks (Voss tactical empathy, Ackerman bargaining models).
- **Communication Gateway**: Meta WhatsApp Business Cloud API (`v20.0`) with inbound webhook listeners, exact message deduplication, and anti-spam filters.
- **Safety Guardrails**: Programmatic walkaway ceiling enforcement, Zero-Mock policy, and prompt-injection firewalls.

## Client Testing Specifications
- **Target Audience**: Store Owners, Procurement Directors, and Wholesale Suppliers.
- **Verification Suite**: 20 automated remediation unit tests (`test_remediation.js`) + anti-spam test suite (`scratch/test_antispam.js`).
