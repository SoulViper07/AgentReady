# AgentReady — AI Commerce Readiness & Remediation Engine
### Razorpay AI Buildathon 2026 • Track 01: AI Growth & Agentic Commerce

> **Bridging the trust and settlement chasm between messy, informal Indian commerce and autonomous AI buyer agents through Human-in-the-Loop remediation, deterministic invariant gates, and cryptographic Razorpay payment rails.**

---

## 📌 Executive Summary & The Problem

The next frontier of digital commerce belongs to **autonomous AI buyer agents** executing purchasing requests on behalf of consumers. However, India's MSME retail backbone (over 63 million informal merchants across tier-1, tier-2, and tier-3 cities) does not run on unified, machine-readable ERP systems. Instead, they operate across:
- **WhatsApp chats and status messages** with incomplete price lists.
- **Unformatted spreadsheets and legacy CSVs** containing conflicting or outdated catalog entries.
- **Instagram direct messages and paper menus** lacking machine-readable cancellation or refund policies.

### The Hallucination & Fintech Risk
Autonomous AI buyers cannot safely conduct financial transactions against probabilistic, unstructured merchant data:
1. **Hallucination Risk**: Large Language Models (LLMs) frequently fabricate missing attributes (inventing prices, guessing stock levels, or assuming liberal return policies).
2. **Double-Spend & Overselling Risk**: Probabilistic agents attempting direct checkout cause payment capture on out-of-stock items, leading to severe chargeback disputes.
3. **Absence of a Fintech Boundary**: Allowing probabilistic AI models direct authority over monetary values and inventory deduction violates core fintech principles.

**AgentReady solves this fundamental bottleneck.** It establishes a strict **Deterministic Fintech Boundary**: AI assists in extraction and drafts proposed remediation, but **zero probabilistic code is ever granted transaction authority**. 

---

## 🏛️ Architectural Principles: The Separation of Authority

AgentReady enforces an inviolable separation between probabilistic intelligence and deterministic financial execution:

```
┌────────────────────────────────────────────────────────────────────────┐
│ PROBABILISTIC ZONE (AI Assisting Layer)                                │
│                                                                        │
│  Raw Unstructured Inputs             AI Extraction & Remediation       │
│  [WhatsApp / CSV / Text]   ───────►  [Provenance-Checked Zod Schema]   │
│                                      - Strict null default             │
│                                      - Quoted evidence required        │
│                                      - AI proposes policy drafts       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ HUMAN AUTHORITY (Merchant Verification)                                │
│                                                                        │
│  Merchant Console (HITL)             Ground Truth Verification         │
│  [Remediation Dashboard]   ───────►  - Authoritative price selection   │
│                                      - Inventory confirmation          │
│                                      - Perishable policy approval      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ DETERMINISTIC ENGINE (Zero-LLM Authority)                              │
│                                                                        │
│  Readiness Invariant Gate            Readiness Quality Index (0-100)   │
│  [Pure TypeScript Rules]   ───────►  - Product Data Completeness (25%) │
│  - Verified Price > 0                - Price Reliability (25%)         │
│  - Verified Inventory > 0            - Inventory Confidence (20%)      │
│  - Verified Policy Exists            - Policy Readiness (15%)          │
│  - Zero CRITICAL Issues              - Data Consistency (15%)          │
│                                      Status: NOT_READY / READY         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ AGENT COMMERCE RAILS                                                   │
│                                                                        │
│  Agent-Readable Catalog              Autonomous Buyer Simulator        │
│  GET /api/catalog          ───────►  POST /api/buyer                   │
│  - Filters NOT_READY stores          - Tool-calling discovery loop     │
│  - Strict JSON schema for bots       - Proposal formulation (PROPOSED) │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ DETERMINISTIC TRANSACTION GATE (Financial Perimeter)                   │
│                                                                        │
│  validateAndReserveProposal()                                          │
│  1. Merchant status !== NOT_READY                                      │
│  2. Product priceVerified === true && status === 'VERIFIED'            │
│  3. Proposal offeredPrice === catalog price                            │
│  4. Calculated total === requestedQuantity * unitPrice                 │
│  5. Hard stock invariant: inventory >= requestedQuantity               │
│                                                                        │
│  [FAIL] ──► Block transaction (BLOCKED) + Log TRANSACTION_BLOCKED      │
│  [PASS] ──► Lock inventory with 10-min TTL (RESERVED) + Log RESERVED   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ RAZORPAY SETTLEMENT RAILS                                              │
│                                                                        │
│  Razorpay Orders API                 Cryptographic Verification        │
│  POST /api/transaction/checkout ──►  POST /api/transaction/verify      │
│  - Server-side amount in paise       - HMAC SHA-256 signature check    │
│  - razorpay_order_id generated       - Permanent inventory deduction   │
│                                      - Immutable audit entry created   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Key Technical Highlights

### 1. Zero-Hallucination Extraction with Explicit Provenance
The extraction pipeline uses strict Zod schemas with nullable primitives. If a price or inventory count is not explicitly stated in merchant source text, it **must default to `null`**. Every extracted attribute requires a `sourceEvidence` quotation directly from the merchant's input. Heuristic guesses and fabricated defaults are forbidden.

### 2. Dual-Tier Readiness Model
AgentReady decouples merchant discovery from transaction authorization:
- **Quality Index (0–100 Score)**: A 5-category index weighting completeness, price reliability, inventory confidence, policy readiness, and consistency. Dictates search relevance and marketplace ranking.
- **Binary Invariant Gate (Pass / Fail)**: A set of non-negotiable checks (price verified, inventory verified, return policy active, zero critical issues). Merchants cannot transact until all invariants pass.

### 3. Graceful Failure & Overselling Protection
When an autonomous buyer requests quantities exceeding verified in-stock inventory (e.g. prompt: *"Order 20 boxes of Signature Choco Chip Cookies"* when stock is 10), the deterministic Transaction Gate halts checkout before payment initiation:
- Transitions proposal to `BLOCKED`.
- Returns an explicit structured error payload: `INSUFFICIENT_INVENTORY: Requested 20 units, but only 10 verified units remain in stock.`
- Commits an immutable `TRANSACTION_BLOCKED` audit log.
- Renders an unambiguous gate violation alert card in the UI showing invariant violations and cryptographic log references.

### 4. Server-Side Cryptographic Integrity (Razorpay Test Mode)
- Amounts are calculated strictly server-side in **paise** (`₹1 = 100 paise`), preventing client-side price tampering.
- Razorpay order creation issues `razorpay_order_id` associated with a 10-minute temporary inventory reservation.
- Payments must supply a cryptographically valid `razorpay_signature`. The system computes `crypto.createHmac('sha256', secret).update(order_id + '|' + payment_id).digest('hex')` and rejects mismatches before inventory is permanently decremented.

### 5. Immutable System Audit Feed
Every lifecycle event (`MERCHANT_ONBOARDED`, `DATA_INGESTION_COMPLETED`, `MERCHANT_VERIFIED_PRICE`, `POLICY_APPROVED`, `TRANSACTION_PROPOSAL_CREATED`, `TRANSACTION_RESERVED`, `RAZORPAY_ORDER_CREATED`, `TRANSACTION_BLOCKED`, `PAYMENT_VERIFIED`, `INVENTORY_DEDUCTED`) is written to an append-only `AuditLog` table and displayed on a reverse-chronological timeline on the dashboard.

---

## 📡 API Reference Table

| Method | Endpoint | Description | Key Request / Response Parameters |
|:---|:---|:---|:---|
| `GET` | `/api/catalog` | Autonomous Agent-readable catalog discovery endpoint | **Query:** `merchantSlug`, `eggless`, `maxPrice`, `search`<br/>**Response:** Standardized JSON catalog filtering unverified items and `NOT_READY` stores. |
| `POST` | `/api/buyer` | Autonomous Buyer Simulator executing structured tool loop | **Body:** `{ "query": "Buy 2 boxes of Signature Choco Chip Cookies" }`<br/>**Response:** Thought chain, tool traces, and structured proposal. |
| `POST` | `/api/transaction/checkout` | Invariant Gate evaluation and Razorpay order creation | **Body:** `{ "proposalId": "cmto..." }`<br/>**Response:** `{ "orderId": "order_...", "amount": 50000, "currency": "INR", "keyId": "rzp_..." }` or HTTP 400 `TRANSACTION_BLOCKED`. |
| `POST` | `/api/transaction/verify` | Razorpay HMAC SHA-256 signature verification & inventory deduction | **Body:** `{ "proposalId", "razorpay_order_id", "razorpay_payment_id", "razorpay_signature" }`<br/>**Response:** `{ "success": true, "remainingInventory": 8 }`. |
| `GET` | `/api/readiness` | Real-time score breakdown and invariant checklist | **Query:** `slug=sweet-crumbs`<br/>**Response:** Readiness score (0–100), invariants result, products, policies, issues. |
| `POST` | `/api/verify` | Human-in-the-Loop merchant remediation actions | **Body:** `{ "action": "VERIFY_PRODUCT" \| "RESOLVE_CONFLICT" \| "APPROVE_POLICY", ... }` |
| `GET` | `/api/audit` | Chronological immutable system audit ledger | **Query:** `merchantSlug`, `limit`, `eventType`<br/>**Response:** Array of audit events with timestamps and details. |
| `POST` | `/api/seed/reset` | Resets demo state to unverified baseline (36/100, NOT_READY) | **Response:** `{ "success": true, "message": "Demo reset to unverified baseline" }`. |

---

## 🚀 Local Setup Guide

### Prerequisites
- Node.js 18+ or 20+
- npm (or pnpm / yarn)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/SoulViper07/AgentReady.git
cd AgentReady
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL="file:./dev.db"

# AI Pipeline (Fallback logic enabled: app operates smoothly even with mock/deterministic fallback)
GEMINI_API_KEY=""
OPENAI_API_KEY=""

# Razorpay Test Mode Credentials
# App includes graceful simulation fallback if credentials are empty strings
RAZORPAY_KEY_ID="rzp_test_YourKeyIdHere"
RAZORPAY_KEY_SECRET="YourSecretKeyHere"

# Next.js Public Key for Client SDK
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_YourKeyIdHere"
```

### 3. Initialize & Seed the Database
```bash
# Push Prisma schema to SQLite
npx prisma db push

# Seed the initial demo merchant ("Sweet Crumbs" at baseline score 0, NOT_READY)
npx prisma db seed
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Remediation Dashboard**: `http://localhost:3000/dashboard`
- **AI Buyer Playground**: `http://localhost:3000/agent-demo`
- **Agent-Readable Catalog API**: `http://localhost:3000/api/catalog`
- **Audit Ledger API**: `http://localhost:3000/api/audit`

---

## 🧪 Comprehensive Test Suites

Run the full end-to-end verification suites covering all architectural phases:

```bash
# Test Phase 5: AI Remediation & HITL Verification
npm run test:phase5

# Test Phase 6: Agent Catalog & AI Buyer Simulator
npm run test:phase6

# Test Phase 7: Deterministic Transaction Gate & Razorpay HMAC Signature
npm run test:phase7

# Test Phase 8: Graceful Gate Failure & Immutable Audit Ledger
npm run test:phase8

# Linting & Type Checks
npm run lint

# Production Build
npm run build
```

---

## 🎯 Razorpay Buildathon 2026 Evaluation Walkthrough

To experience the full agentic commerce lifecycle during evaluation:

1. **Step 1 — Baseline Unverified State**: Open `/dashboard`. Merchant *"Sweet Crumbs"* starts with unverified WhatsApp inputs, pricing conflicts, missing inventory counts, and missing return policies (Score: 36/100, Status: `NOT_READY`).
2. **Step 2 — Invariant Enforcement in Playground**: Navigate to `/agent-demo`. Notice the prominent readiness alert banner. The catalog endpoint `/api/catalog` strictly refuses to serve unverified merchants to autonomous buyers.
3. **Step 3 — HITL Remediation**: In the dashboard, click **"Resolve Conflict"** (accept authoritative ₹250 price), click **"Verify Product"**, and click **"Approve AI-Drafted Policy"**. Watch the score recalculate in real time to **96/100 (`READY`)**.
4. **Step 4 — AI Buyer Query**: In `/agent-demo`, click Quick Prompt #2 (*"Buy 2 boxes of Signature Choco Chip Cookies"*). The AI Buyer executes its tool-calling loop, discovers the verified item, and constructs a proposal.
5. **Step 5 — Deterministic Gate & Razorpay Checkout**: Click **"Proceed to Transaction Gate →"**. Invariants pass, inventory is temporarily held for 10 minutes, and the Razorpay modal / simulation opens. Complete verification to observe cryptographic HMAC SHA-256 validation and inventory decrement.
6. **Step 6 — Graceful Failure Demonstration**: Click Quick Prompt #3 (*"Order 20 boxes of Signature Choco Chip Cookies"*). Click **"Proceed to Transaction Gate →"**. The gate deterministically blocks the transaction due to `INSUFFICIENT_INVENTORY`, logs the violation, and displays the red alert card.
7. **Step 7 — Immutable Audit Trail**: Scroll down to the **Audit Ledger** on `/dashboard` or inspect `/api/audit` to view the tamper-proof ledger of every event.
8. **Step 8 — Instant Reset**: Click the **Reset** button next to the status badge in the header to return the demo to its unverified baseline at any time.

---

## 📄 License
MIT License • Built with ❤️ for the **Razorpay AI Buildathon 2026**.
