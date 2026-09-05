# AgentReady

> **Turn messy merchant data into verified, agent-readable commerce.**

AgentReady provides the trust and settlement layer that converts informal, unstructured merchant data—spreadsheets, physical menus, chat broadcasts, and social posts—into verified, machine-readable catalogs that autonomous AI buyer agents can safely discover and transact against.

**Razorpay Buildathon 2026**  
**Track 01 — AI Growth & Agentic Commerce**

---

## The Problem in One Example

Small merchants frequently operate through informal, fragmented channels: WhatsApp messages, physical menu cards, Instagram captions, and outdated spreadsheets. Humans navigate ambiguity intuitively. Autonomous AI agents cannot guess without creating severe financial risk.

### Before AgentReady

```text
Instagram Post:
"Signature Choco Chip Cookies – ₹250/box (only a few boxes left!)"

Old Spreadsheet:
"Signature Choco Chip Cookies – ₹200, Stock: 15"

Packaging Card:
"Return policy: Perishable goods, no returns."

Merchant Website / Google Profile:
No cancellation or refund policy listed.
```

An AI buyer asks:
> *"Find me eggless cookies under ₹250."*

Can the agent safely transact?
- **Price**: Which price is authoritative—₹200 or ₹250?
- **Inventory**: How many units genuinely exist right now?
- **Policy**: What happens if the batch arrives damaged?
- **Financial Risk**: If an LLM guesses the lower price, the merchant loses money. If it guesses stock, the order oversells.

**Answer:** No. An autonomous agent cannot safely execute this purchase.

### After AgentReady

```text
Product:      Signature Choco Chip Cookies
Price:        ₹250 (Verified by merchant)
Inventory:    10 boxes (Verified & atomically tracked)
Dietary:      Eggless (Confirmed)
Policy:       Perishable goods: damaged-on-arrival replacement only (Verified)
Readiness:    READY (Deterministic Invariant Gate: PASSED)
```

Now the autonomous purchase succeeds safely:

```text
AI Buyer Agent
      ↓  Natural language search
Search Verified Catalog
      ↓  Structured proposal
Validate Invariants at Financial Gate
      ↓  Lock stock (10-minute hold)
Razorpay Test Checkout
      ↓  HMAC SHA-256 signature verification
Settlement & Inventory Decrement
```

---

## What AgentReady Does

AgentReady transforms unstructured merchant operations into safe agentic commerce through a 5-stage pipeline:

```text
Discover  ──►  Assess  ──►  Remediate  ──►  Verify  ──►  Transact
```

1. **Discover**: Ingests raw merchant information from multimodal inputs (menu card photos, WhatsApp messages, CSV sheets).
2. **Assess**: Evaluates catalog completeness, pricing consistency, inventory confidence, and policy clarity.
3. **Remediate**: Flags pricing conflicts, missing inventory, and unstated policies for merchant resolution.
4. **Verify**: The merchant confirms ground truth via a Human-in-the-Loop (HITL) console, promoting drafts to verified status.
5. **Transact**: Exposes machine-readable endpoints (`/api/catalog`) where autonomous agents submit bounded purchase proposals evaluated by a deterministic transaction gate before routing to Razorpay payment rails.

---

## Why This Matters for Agentic Commerce

AI buyer agents are evolving from conversational recommendation tools into autonomous purchasing interfaces. However, agentic commerce cannot scale on unstructured, probabilistic data alone.

If an AI agent interacts directly with ambiguous merchant feeds:
- Models hallucinate missing attributes, creating false expectations.
- Stale or missing inventory leads to overselling, failed fulfillments, and chargeback disputes.
- Giving probabilistic models direct financial authority over prices or fund capture violates fundamental fintech controls.

AgentReady establishes the verified infrastructure layer between informal commerce and autonomous buyers:

```text
Messy Merchant Data (WhatsApp, Menus, CSVs)
                   ↓
              AgentReady
                   ↓
      Verified Machine-Readable Catalog
                   ↓
             AI Buyer Agent
                   ↓
      Deterministic Transaction Gate
                   ↓
            Razorpay Rails
```

---

## Core Innovation: Financial Authority Boundary

The fundamental architectural principle of AgentReady is the **strict separation of intelligence from financial authority**:

```text
┌─────────────────────────────────────────────────────────┐
│ AI LAYER                                                │
│ Understand & Extract                                    │
│ - Multimodal OCR from physical menus & images           │
│ - Natural language parsing from chats & posts           │
│ - Semantic intent matching for buyer queries            │
│ ❌ Zero authority over prices, inventory, or payments   │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ HUMAN AUTHORITY                                         │
│ Verify Ground Truth                                     │
│ - Resolves conflicting source data (WhatsApp vs. CSV)   │
│ - Confirms stock counts & unit prices                   │
│ - Approves drafted cancellation/perishability policies  │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ DETERMINISTIC SYSTEM                                    │
│ Authorize Transactions                                  │
│ - Pure TypeScript invariant enforcement                 │
│ - Server-side price & total calculation in paise        │
│ - 10-minute atomic inventory reservation                │
│ - Zero LLM code in the authorization path               │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ RAZORPAY PAYMENT RAILS                                  │
│ Process Settlement                                      │
│ - Orders API with server-computed amounts               │
│ - Cryptographic HMAC SHA-256 signature verification     │
│ - Post-verification inventory decrement                 │
└─────────────────────────────────────────────────────────┘
```

> **AI has intelligence, but not financial authority.**  
> The LLM suggests and translates; deterministic software and human verification govern every rupee and stock unit.

---

## Architecture

```text
                      MERCHANT INPUTS
   [ Physical Menus / Photos ]  [ WhatsApp / Text ]  [ Spreadsheets / CSV ]
                              │
                              ▼
                 MULTIMODAL INGESTION STUDIO
             (Base64 Vision OCR / Text Parsing)
                              │
                              ▼
                     AI PROVIDER CASCADE
         ┌────────────────────┴────────────────────┐
         │ Vision: Gemini Primary → Groq Fallback  │
         │ Text:   Groq Primary   → Gemini Fallback│
         └────────────────────┬────────────────────┘
                              │
                              ▼
            STRUCTURED DRAFT WITH SOURCE EVIDENCE
         (Strict Zod Schemas • Null for missing data)
                              │
                              ▼
               HUMAN-IN-THE-LOOP REMEDIATION
         (Merchant resolves conflicts & confirms data)
                              │
                              ▼
                      VERIFIED CATALOG
                   (SQLite via Prisma ORM)
                              │
                              ▼
                    READINESS ENGINE
         ┌────────────────────┴────────────────────┐
         │ Quality Index (0–100 completeness score)│
         │ Invariant Gate (Hard pass/fail checks)  │
         └────────────────────┬────────────────────┘
                              │
                              ▼
          AGENT COMMERCE RAILS (GET /api/catalog)
                              │
                              ▼
                    AUTONOMOUS BUYER AGENT
                  (POST /api/buyer Simulator)
            Tool execution: search_catalog, propose_order
                              │
                              ▼
                STRUCTURED ORDER PROPOSAL
                              │
                              ▼
             DETERMINISTIC TRANSACTION GATE
               (validateAndReserveProposal)
   ┌─────────────────────────────────────────────────────┐
   │ Check 1: Merchant status !== NOT_READY              │
   │ Check 2: Product status === VERIFIED & priceVerified│
   │ Check 3: Offered price === Catalog verified price   │
   │ Check 4: Calculated total === Qty × Unit price      │
   │ Check 5: Stock invariant: Inventory >= Requested Qty│
   └──────────┬───────────────────────────────┬──────────┘
       [FAIL] │                               │ [PASS]
              ▼                               ▼
      TRANSACTION_BLOCKED             INVENTORY RESERVATION
     (Append-only audit log)         (10-minute hold duration)
                                              │
                                              ▼
                                     RAZORPAY TEST ORDER
                                  (POST /api/transaction/checkout)
                                  Server-computed amount in paise
                                              │
                                              ▼
                                    STANDARD CHECKOUT MODAL
                                              │
                                              ▼
                                     PAYMENT VERIFICATION
                                  (POST /api/transaction/verify)
                                  HMAC SHA-256 Signature Check
                                              │
                                              ▼
                                     INVENTORY DECREMENT
                                  & AUDIT TRAIL SETTLEMENT
```

---

## Key Systems

| System | What It Does | Safety & Reliability Mechanism |
|:---|:---|:---|
| **Multimodal Ingestion** | Extracts products, prices, stock, and policies from photos, chats, and CSVs. | Strict nullable primitives. Missing attributes default to `null`. Requires quoted source evidence; zero attribute fabrication. |
| **Dual-Provider Cascade** | Routes vision and text extraction across Gemini and Groq model families. | Smart routing (Gemini for OCR, Groq for high-throughput text) with automatic failover on 429 rate limits, network errors, and timeouts. Defensive JSON schema normalization. |
| **Readiness Engine** | Computes 0–100 Quality Index and runs binary invariant validation. | Decouples data quality scoring from transaction gating. Even a high score cannot bypass invariant requirements. |
| **HITL Remediation** | Merchant interface to resolve pricing discrepancies and verify draft catalogs. | Human confirmation establishes authoritative ground truth before products can be purchased. |
| **Buyer Agent** | Evaluates natural language queries via bounded tool execution (`search_catalog`, `propose_order`). | Operates only on verified catalog data; dynamic semantic intent matching against active database records without hardcoded item fallbacks. |
| **Financial Gate** | Evaluates proposals against 5 non-negotiable commerce invariants. | 100% deterministic TypeScript logic. Rejects unverified stores, mismatched prices, corrupted arithmetic, and overselling. |
| **Inventory Reservation** | Atomically locks requested stock units for 10 minutes upon gate clearance. | Mitigates overselling and stale inventory risk during checkout completion. |
| **Razorpay Integration** | Creates test orders and verifies payment authenticity. | All amounts calculated server-side in paise. Cryptographic HMAC SHA-256 signature verification required before permanent inventory decrement. |
| **Audit Trail** | Append-only chronological event ledger recorded in SQLite. | Logs all proposal creations, gate passes/blocks, order generations, signature validations, and inventory updates. |

---

## Two-Tier Readiness Model

AgentReady separates commerce evaluation into two distinct concepts:

```text
QUALITY INDEX (0–100)
0 ──────────────────────────────────────────────────────── 100
Heuristic measure of catalog completeness & data health:
• Product Data Completeness   (20 pts)
• Price Reliability           (20 pts)
• Inventory Confidence        (20 pts)
• Policy Readiness            (20 pts)
• Data Consistency            (20 pts)
```

versus

```text
INVARIANT GATE (Hard Deterministic Gate)
┌────────────────────────────────────────────────────────┐
│ Invariant 1: Merchant has verified priced product?  ✓  │
│ Invariant 2: Merchant has verified inventory?       ✓  │
│ Invariant 3: Merchant has active verified policy?   ✓  │
│ Invariant 4: Zero unresolved CRITICAL issues?       ✓  │
│                                                        │
│ Outcome: READY (Transactions Allowed)                 │
└────────────────────────────────────────────────────────┘
```

> **Score measures quality. The gate authorizes money.**  
> A merchant with an 85/100 readiness score will still be blocked from transactions if an unresolved critical pricing conflict remains open.

---

## AI Safety & Financial Controls

### What the AI Can and Cannot Do

| The AI CAN | The AI CANNOT |
|:---|:---|
| Extract raw product lines from physical menus & images | Invent missing prices or fabricate unlisted inventory |
| Parse conversational customer intent in natural language | Approve purchase proposals or authorize transactions |
| Execute bounded discovery tools (`search_catalog`) | Override verified catalog prices with user-requested prices |
| Construct structured order proposals (`propose_order`) | Calculate authoritative final payment amounts |
| Suggest draft cancellation and return policies | Move funds, capture payments, or alter stock balances directly |

---

## Razorpay Payment & Settlement Flow

```text
1. Autonomous Buyer Formulation
   AI Buyer outputs a structured proposal: { productId, requestedQuantity, offeredPrice, calculatedTotal }

2. Server-Side Invariant Gate Evaluation (POST /api/transaction/checkout)
   Server executes validateAndReserveProposal():
   ✓ Merchant transaction status !== "NOT_READY"
   ✓ Product status === "VERIFIED" and priceVerified === true
   ✓ Offered unit price matches verified database price
   ✓ Total calculation matches requestedQuantity × verifiedPrice exactly
   ✓ Verified in-stock inventory >= requestedQuantity

3. Atomic Inventory Reservation
   Proposal transitions to "RESERVED" with a 10-minute expiry timestamp.
   Audit event logged: TRANSACTION_RESERVED.

4. Razorpay Test Order Creation
   Server computes amount in paise: Math.round(proposal.calculatedTotal * 100).
   Razorpay order created via razorpay.orders.create({ amount, currency: "INR", receipt: proposal.id }).
   Order record persisted with status "CREATED".

5. Client-Side Checkout Execution
   Standard Razorpay Checkout modal loads test payment instruments (Cards, UPI, Netbanking).

6. Server-Side Cryptographic Verification (POST /api/transaction/verify)
   Server constructs expected signature:
   crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
         .update(`${razorpay_order_id}|${razorpay_payment_id}`)
         .digest('hex');

7. Verified Inventory Decrement & Final Settlement
   If signature matches:
   - Order status updated to "PAID"
   - Proposal status updated to "COMPLETED"
   - Product inventory atomically decremented by requestedQuantity
   - Audit events logged: PAYMENT_VERIFIED and INVENTORY_DEDUCTED
   If signature fails:
   - Order marked "FAILED"
   - Inventory reservation released
   - Audit event logged: PAYMENT_SIGNATURE_MISMATCH
```

---

## Graceful Failure Handling: Overstock Gate Block

A fundamental evaluation criterion in autonomous commerce is demonstrating explainable, bounded, and gated financial controls during failure.

### Failure Demonstration Scenario

```text
Catalog Baseline:
Product: "Signature Choco Chip Cookies"
Verified In-Stock: 10 units

Autonomous Buyer Request:
"Order 20 boxes of Signature Choco Chip Cookies"
```

### System Behavior

```text
1. AI Buyer matches product and formulates proposal:
   Requested Quantity: 20
   Offered Price: ₹250
   Calculated Total: ₹5000
   Inventory Exceeded Flag: true

2. User / Agent submits to Financial Gate (POST /api/transaction/checkout):
   Deterministic engine evaluates Invariant Check 5:
   Available Inventory (10) < Requested Quantity (20)

3. Gate Halts Execution:
   HTTP Response: 400 Bad Request
   {
     "error": "TRANSACTION_BLOCKED",
     "violatedInvariant": "INSUFFICIENT_INVENTORY",
     "reason": "INSUFFICIENT_INVENTORY: Requested 20 units, but only 10 verified units remain in stock.",
     "requestedQuantity": 20,
     "availableInventory": 10,
     "auditLogId": "cmtom90d5001frm8ko5k682dy"
   }

4. Audit Trail & State Safety:
   - Proposal marked BLOCKED in database.
   - Zero inventory held; zero Razorpay orders created.
   - TRANSACTION_BLOCKED event recorded in append-only SQLite audit log.
   - UI presents a clear, explainable gate block notification with invariant details.
```

---

## Demo Scenarios

### Scenario 1 — Multimodal Ingestion
- Upload a photo of a physical menu or paste unstructured WhatsApp text.
- Vision/LLM cascade extracts products, prices, and dietary flags with quoted evidence.
- Missing attributes default strictly to `null`, creating a structured draft catalog.

### Scenario 2 — Gate Block on Unverified Merchant
- Demo merchant *"Sweet Crumbs"* begins in unverified baseline (`readinessScore: 30–36`, `transactionStatus: NOT_READY`).
- Navigating to `/agent-demo` displays an active readiness warning banner.
- The public catalog endpoint (`/api/catalog`) refuses to return unverified merchants to autonomous buyers.

### Scenario 3 — Human Remediation & Score Progression
- In `/dashboard`, inspect detected issues: a price conflict (WhatsApp ₹250 vs. CSV ₹200), unverified inventory, and missing policies.
- Merchant clicks **"Resolve Conflict"** to confirm ₹250 ground truth, sets verified stock, and approves an AI-drafted perishable refund policy.
- The readiness engine updates in real time: score advances past **90/100** and status flips to **`READY`**.

### Scenario 4 — Autonomous Purchasing & Razorpay Checkout
- In `/agent-demo`, submit a natural query: *"Order 2 boxes of Signature Choco Chip Cookies"*.
- The buyer agent executes tool calls (`search_catalog`, `propose_order`) and constructs a valid proposal for ₹500.
- Clicking **"Proceed to Transaction Gate"** passes all invariants, reserves inventory for 10 minutes, triggers the Razorpay modal, completes HMAC signature verification, decrements inventory to 8 units, and logs the settlement.

### Scenario 5 — Bounded Failure Handling
- Submit an overstock query: *"Order 20 boxes of Signature Choco Chip Cookies"*.
- The Transaction Gate halts checkout immediately with `INSUFFICIENT_INVENTORY`, preventing payment initiation and logging the blocked attempt.

---

## Technology Stack

| Layer | Technologies | Role in Project |
|:---|:---|:---|
| **Frontend** | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS | Grounded commerce dashboard, ingestion studio, interactive buyer console, and collapsible telemetry drawer. |
| **Backend** | Next.js Route Handlers (Node.js runtime), TypeScript | Deterministic invariant engines, scoring algorithms, transaction gates, and API endpoints. |
| **Database** | SQLite, Prisma ORM | Relational catalog storage, proposal tracking, orders, and append-only audit trail. |
| **AI Providers** | `@google/genai` (Gemini 3.6 Flash / 3.1 Flash-Lite), `groq-sdk` (Llama 3.3 70B, Llama 3.2 Vision) | Dual-provider extraction cascade with smart vision/text routing and defensive schema normalization. |
| **Payments** | Razorpay Node SDK (`razorpay`), Node.js `crypto` | Test-mode order creation, checkout modal integration, and HMAC SHA-256 signature verification. |

---

## API Reference

All 9 API endpoints are fully implemented and verified against the repository:

### 1. `GET /api/catalog`
Exposes verified products from `READY` merchants for autonomous agent discovery.
- **Query Params**: `merchantSlug` (optional), `eggless` (`true`/`false`), `maxPrice` (number), `search` (string)
- **Response**: `{ success: true, count: 1, products: [...] }` (omits unverified items and `NOT_READY` merchants)

### 2. `POST /api/ingest`
Ingests unstructured text, CSV snippets, or menu card photos.
- **Request**: `{ merchantSlug: "sweet-crumbs", rawText?: string, imageBase64?: string, preview?: boolean }`
- **Response**: `{ success: true, preview: false, productsCount: 3, issuesCreated: 2 }`

### 3. `GET /api/readiness` & `POST /api/readiness`
Evaluates catalog data health and checks the 4 hard transaction invariants.
- **Request (GET)**: `/api/readiness?slug=sweet-crumbs`
- **Response**: `{ readinessScore: 92, transactionStatus: "READY", invariants: { passed: true, failures: [] }, scoreBreakdown: {...} }`

### 4. `POST /api/verify`
Executes merchant Human-in-the-Loop remediation actions.
- **Request**: `{ action: "VERIFY_PRODUCT" | "RESOLVE_CONFLICT" | "APPROVE_POLICY", merchantSlug: "sweet-crumbs", ... }`
- **Response**: `{ success: true, message: "...", readinessScore: 92, transactionStatus: "READY" }`

### 5. `POST /api/buyer`
Simulates autonomous buyer agent query execution using bounded tool calling.
- **Request**: `{ query: "Order 2 boxes of Signature Choco Chip Cookies", merchantSlug: "sweet-crumbs" }`
- **Response**: `{ status: "PROPOSAL_GENERATED", proposalData: {...}, toolCalls: [...], explanation: "..." }`

### 6. `POST /api/transaction/checkout`
Evaluates proposal against the deterministic transaction gate and creates a Razorpay order.
- **Request**: `{ proposalId: "cmto..." }`
- **Response**: `{ orderId: "order_...", amount: 50000, currency: "INR", keyId: "rzp_test_..." }`  
  *(Returns HTTP 400 with `TRANSACTION_BLOCKED` and invariant failure details if checks fail)*

### 7. `POST /api/transaction/verify`
Validates cryptographic Razorpay payment signature and decrements verified stock.
- **Request**: `{ proposalId: "cmto...", razorpay_order_id: "order_...", razorpay_payment_id: "pay_...", razorpay_signature: "..." }`
- **Response**: `{ success: true, remainingInventory: 8, orderId: "...", paymentId: "..." }`

### 8. `GET /api/audit`
Retrieves the chronological append-only audit trail.
- **Query Params**: `merchantSlug` (default: `sweet-crumbs`), `limit` (default: `100`), `eventType` (optional)
- **Response**: `{ success: true, total: 16, logs: [{ id, eventType, details, createdAt }, ...] }`

### 9. `POST /api/seed/reset`
Resets the demo merchant *"Sweet Crumbs"* to its unverified baseline state.
- **Response**: `{ success: true, message: "Demo reset to unverified baseline", baseline: { score: 30, status: "NOT_READY" } }`

---

## Local Setup Guide

### Prerequisites
- Node.js 18.x or 20.x
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

# Razorpay Test Mode Credentials
RAZORPAY_KEY_ID="rzp_test_YourKeyIdHere"
RAZORPAY_KEY_SECRET="YourSecretKeyHere"

# AI Provider Credentials (Dual-provider cascade)
GEMINI_API_KEY="YourGeminiApiKeyHere"
GROQ_API_KEY="YourGroqApiKeyHere"
```
*(Note: If AI keys or Razorpay keys are not provided, the application includes graceful simulation fallbacks so all UI flows, tool calls, invariant gates, and test suites can still be explored).*

### 3. Initialize Database
```bash
# Push Prisma schema to local SQLite database
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Merchant Remediation Dashboard**: `http://localhost:3000/dashboard`
- **Multimodal Ingestion Studio**: `http://localhost:3000/ingest`
- **Autonomous Buyer Simulator**: `http://localhost:3000/agent-demo`
- **Public Catalog Discovery API**: `http://localhost:3000/api/catalog?merchantSlug=sweet-crumbs`
- **Append-Only Audit Ledger API**: `http://localhost:3000/api/audit?merchantSlug=sweet-crumbs`

---

## Test Suites

Run the end-to-end verification suites verifying all subsystems:

```bash
# Verify Dynamic Buyer Intent & Invariant Enforcement
npm run test:buyer-dynamic

# Verify Invariant Gate & Razorpay HMAC Signature Verification
npm run test:phase7

# Verify Graceful Failure Handling & Append-Only Audit Feed
npm run test:phase8

# Full TypeScript Compilation Check
npx tsc --noEmit

# Production Build Verification
npm run build
```

---

## Project Structure

```text
agentready/
├── app/
│   ├── agent-demo/page.tsx          # Autonomous buyer simulator & checkout interface
│   ├── dashboard/page.tsx           # Merchant readiness console & HITL remediation
│   ├── ingest/page.tsx              # Multimodal Ingestion Studio (Vision OCR & text)
│   ├── layout.tsx                   # Root layout with fonts & metadata
│   ├── globals.css                  # Tailwind styles & warm luxury theme variables
│   ├── page.tsx                     # Root redirect to /dashboard
│   └── api/                         # 9 Next.js API route handlers
│       ├── audit/route.ts           # Append-only audit feed endpoint
│       ├── buyer/route.ts           # Autonomous buyer execution endpoint
│       ├── catalog/route.ts         # Agent-readable catalog discovery
│       ├── ingest/route.ts          # Multimodal ingestion endpoint
│       ├── readiness/route.ts       # Readiness scoring & invariant checks
│       ├── seed/reset/route.ts      # Reset demo to baseline state
│       ├── transaction/
│       │   ├── checkout/route.ts    # Financial gate & Razorpay order creation
│       │   └── verify/route.ts      # HMAC SHA-256 validation & inventory decrement
│       └── verify/route.ts          # HITL remediation actions endpoint
├── components/
│   ├── AuditFeed.tsx                # Chronological audit ledger timeline component
│   ├── AuthorityTag.tsx             # Visual badges (FINTECH_GATE, AI_INFERRED, etc.)
│   ├── IngestProgressBar.tsx        # Multi-stage animated ingestion progress rail
│   ├── IssueCard.tsx                # Conflict resolution & remediation cards
│   ├── Navbar.tsx                   # Top navigation with view modes & instant reset
│   ├── PipelineRail.tsx             # 5-stage readiness visualizer
│   └── ui/
│       ├── Spotlight.tsx            # Ambient radial glow surface
│       └── TiltCard.tsx             # Grounded luxury surface container
├── lib/
│   ├── prisma.ts                    # Prisma ORM singleton client
│   ├── razorpay.ts                  # Razorpay SDK singleton client
│   ├── ai/
│   │   ├── buyer.ts                 # Buyer tool-calling loop & dynamic intent matcher
│   │   ├── cascade.ts               # Gemini ↔ Groq dual-provider cascade
│   │   ├── extractor.ts             # Multimodal schema extraction & normalizer
│   │   ├── remediator.ts            # Deterministic advice & policy generation
│   │   └── schemas.ts               # Strict Zod schemas with nullable primitives
│   └── engine/
│       ├── evaluator.ts             # Orchestrates scoring and invariant verification
│       ├── invariants.ts            # 4 hard merchant transaction invariants
│       ├── scoring.ts               # 5-category Quality Index (0–100)
│       └── transactionGate.ts       # Deterministic proposal validation & reservation
├── prisma/
│   └── schema.prisma                # SQLite schema (Merchant, Product, Order, etc.)
└── scripts/                         # Verification & end-to-end test suites
    ├── test-buyer-dynamic.ts        # Buyer matching & invariant tests
    ├── test-phase7-transaction.ts   # Gate checks & cryptographic HMAC tests
    └── test-phase8-audit.ts         # Graceful failure & audit ledger tests
```

---

## UI / UX Design System

AgentReady is designed as an executive commerce platform adhering to the **Stripe Horizon / Apple Pay / Linear warm aesthetic**:
- **Warm Grounded Surfaces**: Deep espresso/charcoal background (`#0E0F12`), grounded card surfaces (`#181A20`), and subtle warm borders (`border-white/[0.08]`).
- **Zero Floating 3D Tilt**: Rock-solid cards with no dynamic mouse tilt calculations or sensor listeners.
- **Authoritative Status Indicators**: Botanical emerald (`READY`, `FINTECH_GATE`), warm champagne/amber (`AI_INFERRED`, `DETERMINISTIC`), and muted terracotta (`TRANSACTION_BLOCKED`).
- **Telemetry Separation**: Technical agent execution traces and tool call arguments (`search_catalog`, `propose_order`) are collapsed by default in Consumer/Merchant View (`⚡ Tool Calls Executed • View Runtime Trace ▾`) and auto-expand in Inspector Mode for judges.
- **Ergonomic Payment Experience**: Itemized checkout receipt with paise precision, delivery guarantee badge, minimum 48px high CTA button, and micro-confetti burst upon successful cryptographic verification.

---

## Technical Highlights

- **Multimodal Merchant Ingestion**: Vision OCR and text parsing with source quotation preservation and strict `null` defaults.
- **Dual-Provider Resilience**: Smart routing across Gemini (multimodal OCR) and Groq (high-throughput text) with defensive schema normalization.
- **Dynamic Semantic Matching**: AI buyer maps natural language intent (e.g. *"any eggless dessert under ₹300"*) directly to active verified database rows.
- **Human-in-the-Loop Verification**: Resolves real-world data discrepancies (e.g. WhatsApp vs. CSV pricing) before publishing.
- **Two-Tier Safety Architecture**: Decouples 0–100 data completeness scoring from non-negotiable invariant validation.
- **Zero-LLM Transaction Gate**: Hardcoded server-side checks verify merchant status, product verification, price agreement, total math, and stock availability.
- **10-Minute Atomic Inventory Reservation**: Prevents overselling during active checkout sessions.
- **Server-Side Paise Precision**: Razorpay order amounts computed strictly on server to prevent client manipulation.
- **Cryptographic Payment Integrity**: Validates Razorpay HMAC SHA-256 signatures before decrementing inventory.
- **Append-Only Audit Trail**: Every gate check, block, reservation, and settlement is permanently recorded in SQLite.
- **Explainable Failure Handling**: Unambiguous structured payloads and UI cards when transactions violate invariants.

---

## What Makes AgentReady Different

Most agentic commerce projects ask:
> *"How can an AI agent search the web and buy things?"*

AgentReady asks the foundational fintech question first:
> **"Can this merchant's data be safely trusted by an autonomous buyer with money?"**

AgentReady focuses on the missing infrastructure layer:
```text
Merchant Ground Truth
         +
Verified Machine-Readable Data
         +
Bounded Agent Tool Execution
         +
Deterministic Financial Controls
         +
Razorpay Payment Rails
```

Without this layer, autonomous commerce remains an unreliable demo vulnerable to hallucinations, out-of-stock orders, and financial disputes. With AgentReady, any merchant can become safely transacted by the next generation of AI agents.

---

## Razorpay Buildathon 2026 Alignment

**Track 01: AI Growth & Agentic Commerce**

AgentReady addresses the core challenge of Track 01:
- **Merchants Discoverable to AI**: Converts informal Indian retail data into structured, agent-readable catalogs (`/api/catalog`).
- **Agentic Commerce Rails**: Enables autonomous buyers to formulate structured orders through bounded tool execution.
- **Fintech Safety & Bounded Action**: Enforces a strict Financial Authority Boundary where zero probabilistic AI code holds money authority.
- **Razorpay Integration**: Seamlessly bridges autonomous proposals into standard Razorpay order creation and HMAC SHA-256 verified settlement.
- **Explainable & Gated Money Actions**: Every financial action is gated by deterministic invariants, explainable during failure, and recorded in an append-only audit trail.

---

## License
MIT License • Built with craftsmanship for the **Razorpay Buildathon 2026**.
