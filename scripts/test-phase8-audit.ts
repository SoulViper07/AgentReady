import { NextRequest } from 'next/server';
import { prisma } from '../lib/prisma';
import { POST as resetPost } from '../app/api/seed/reset/route';
import { POST as verifyPost } from '../app/api/verify/route';
import { POST as ingestPost } from '../app/api/ingest/route';
import { POST as buyerPost } from '../app/api/buyer/route';
import { POST as checkoutPost } from '../app/api/transaction/checkout/route';
import { GET as auditGet } from '../app/api/audit/route';
import { validateAndReserveProposal } from '../lib/engine/transactionGate';

async function testPhase8() {
  console.log('=== Phase 8: Graceful Failure Handling & Immutable Audit Feed Test ===\n');

  // 1. Reset baseline
  console.log('1. Resetting demo baseline...');
  await resetPost();

  // Ingest catalog
  console.log('2. Ingesting catalog & policies...');
  const catalogReq = new NextRequest('http://localhost:3000/api/ingest', {
    method: 'POST',
    body: JSON.stringify({
      merchantSlug: 'sweet-crumbs',
      sourceType: 'CSV',
      payload: `Item,Description,Rate,Stock,Dietary
Signature Choco Chip Cookies,Loaded with Belgian chocolate chips,250,15,Eggless
Double Dark Sea Salt Cookies,Rich dark chocolate with Maldon sea salt,220,10,Regular
Oats & Cranberry Breakfast Cookies,Rolled oats and dried cranberries,180,20,Regular`,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  await ingestPost(catalogReq);

  const policyReq = new NextRequest('http://localhost:3000/api/ingest', {
    method: 'POST',
    body: JSON.stringify({
      merchantSlug: 'sweet-crumbs',
      sourceType: 'POLICY',
      payload:
        'Perishable artisan baked goods cannot be returned once dispatched. Photo evidence within 2 hours of delivery qualifies for instant refund.',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  await ingestPost(policyReq);

  // Quick verify products so merchant reaches READY state
  console.log('3. Verifying products and approving refund policy...');
  const products = await prisma.product.findMany({
    where: { merchant: { slug: 'sweet-crumbs' } },
  });

  for (const p of products) {
    const vReq = new NextRequest('http://localhost:3000/api/verify', {
      method: 'POST',
      body: JSON.stringify({
        action: 'VERIFY_PRODUCT',
        productId: p.id,
        price: p.price ?? 250,
        inventory: p.inventory ?? 15,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await verifyPost(vReq);
  }

  // Resolve issues
  const issues = await prisma.readinessIssue.findMany({
    where: { merchant: { slug: 'sweet-crumbs' }, resolved: false },
  });
  for (const issue of issues) {
    const cReq = new NextRequest('http://localhost:3000/api/verify', {
      method: 'POST',
      body: JSON.stringify({
        action: 'RESOLVE_CONFLICT',
        issueId: issue.id,
        authoritativePrice: 250,
        merchantSlug: 'sweet-crumbs',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await verifyPost(cReq);
  }

  // Approve policy
  const polReq = new NextRequest('http://localhost:3000/api/verify', {
    method: 'POST',
    body: JSON.stringify({
      action: 'APPROVE_POLICY',
      merchantSlug: 'sweet-crumbs',
      type: 'REFUND',
      content:
        'Perishable artisan baked goods cannot be returned once dispatched. Photo evidence within 2 hours of delivery qualifies for instant refund.',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  await verifyPost(polReq);

  const merchant = await prisma.merchant.findUnique({
    where: { slug: 'sweet-crumbs' },
    include: { products: true },
  });
  if (!merchant || merchant.transactionStatus === 'NOT_READY') {
    throw new Error(
      `Merchant baseline failed. Status: ${merchant?.transactionStatus}`
    );
  }
  console.log(
    `   Merchant ready: ${merchant.name} (Status: ${merchant.transactionStatus}, Score: ${merchant.readinessScore}/100)`
  );

  const chocoChipProduct = merchant.products.find((p) =>
    p.name.includes('Signature Choco Chip')
  );
  if (!chocoChipProduct) {
    throw new Error('Signature Choco Chip Cookies not found in catalog');
  }
  console.log(
    `   Target product: ${chocoChipProduct.name} | Verified stock: ${chocoChipProduct.inventory}`
  );

  // 4. Test Quick Prompt #3: "Order 20 boxes of Signature Choco Chip Cookies" via AI Buyer
  console.log(
    '\n4. Running AI Buyer for Quick Prompt #3: "Order 20 boxes of Signature Choco Chip Cookies"...'
  );
  const buyerReq = new NextRequest('http://localhost:3000/api/buyer', {
    method: 'POST',
    body: JSON.stringify({
      query: 'Order 20 boxes of Signature Choco Chip Cookies',
      merchantSlug: 'sweet-crumbs',
    }),
    headers: { 'Content-Type': 'application/json' },
  });

  const buyerRes = await buyerPost(buyerReq);
  const buyerData = await buyerRes.json();

  if (!buyerRes.ok || !buyerData.proposal) {
    throw new Error(
      `AI Buyer failed to formulate proposal: ${JSON.stringify(buyerData)}`
    );
  }

  const generatedProposal = buyerData.proposal;
  console.log(`   Buyer generated proposal ID: ${generatedProposal.id}`);
  console.log(`   Requested Quantity: ${generatedProposal.requestedQuantity}`);
  console.log(`   Offered Price: ₹${generatedProposal.offeredPrice}`);
  console.log(`   Calculated Total: ₹${generatedProposal.calculatedTotal}`);
  console.log(`   Status: ${generatedProposal.status}`);

  if (generatedProposal.requestedQuantity !== 20) {
    throw new Error(
      `Expected requestedQuantity to be 20, got ${generatedProposal.requestedQuantity}`
    );
  }

  // 5. Test Transaction Gate Direct Evaluation on overstock proposal
  console.log(
    '\n5. Testing validateAndReserveProposal() directly for Invariant 5 (Inventory)...'
  );
  const directGateRes = await validateAndReserveProposal(generatedProposal.id);

  if (directGateRes.allowed) {
    throw new Error(
      'Deterministic Gate must block transaction when requestedQuantity > inventory!'
    );
  }

  console.log(`   Gate Allowed: ${directGateRes.allowed}`);
  console.log(`   Gate Reason: ${directGateRes.reason}`);
  console.log(`   Violated Invariant: ${directGateRes.violatedInvariant}`);
  console.log(`   Requested: ${directGateRes.requestedQuantity}`);
  console.log(`   Available Inventory: ${directGateRes.availableInventory}`);
  console.log(`   AuditLog ID: ${directGateRes.auditLogId}`);

  if (directGateRes.violatedInvariant !== 'INSUFFICIENT_INVENTORY') {
    throw new Error(
      `Expected violatedInvariant 'INSUFFICIENT_INVENTORY', got '${directGateRes.violatedInvariant}'`
    );
  }

  if (
    !directGateRes.reason.includes('INSUFFICIENT_INVENTORY') ||
    !directGateRes.reason.includes('Requested 20 units')
  ) {
    throw new Error(
      `Reason must follow format: "INSUFFICIENT_INVENTORY: Requested 20 units, but only X verified units remain in stock." Got: "${directGateRes.reason}"`
    );
  }

  // Verify proposal DB status is BLOCKED
  const dbProposalAfterGate = await prisma.transactionProposal.findUnique({
    where: { id: generatedProposal.id },
  });
  if (dbProposalAfterGate?.status !== 'BLOCKED') {
    throw new Error(
      `Expected proposal status in DB to be BLOCKED, got ${dbProposalAfterGate?.status}`
    );
  }
  console.log(`   ✓ DB proposal status is verified BLOCKED.`);

  // 6. Test POST /api/transaction/checkout returns 400 and structured error payload
  console.log(
    '\n6. Testing POST /api/transaction/checkout route behavior on overstock proposal...'
  );

  // Create another proposal for 20 units to test through the HTTP route handler
  const prop2 = await prisma.transactionProposal.create({
    data: {
      merchantId: merchant.id,
      productId: chocoChipProduct.id,
      requestedQuantity: 20,
      offeredPrice: chocoChipProduct.price!,
      calculatedTotal: 20 * chocoChipProduct.price!,
      status: 'PROPOSED',
    },
  });

  const checkoutReq = new NextRequest(
    'http://localhost:3000/api/transaction/checkout',
    {
      method: 'POST',
      body: JSON.stringify({ proposalId: prop2.id }),
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const checkoutRes = await checkoutPost(checkoutReq);
  const checkoutData = await checkoutRes.json();

  console.log(`   HTTP Status: ${checkoutRes.status}`);
  console.log(`   Error Code: ${checkoutData.error}`);
  console.log(`   Reason: ${checkoutData.reason}`);
  console.log(`   Violated Invariant: ${checkoutData.violatedInvariant}`);
  console.log(`   AuditLog ID: ${checkoutData.auditLogId}`);

  if (checkoutRes.status !== 400) {
    throw new Error(`Expected HTTP 400, got ${checkoutRes.status}`);
  }
  if (checkoutData.error !== 'TRANSACTION_BLOCKED') {
    throw new Error(`Expected error TRANSACTION_BLOCKED, got ${checkoutData.error}`);
  }
  if (checkoutData.violatedInvariant !== 'INSUFFICIENT_INVENTORY') {
    throw new Error(
      `Expected violatedInvariant INSUFFICIENT_INVENTORY, got ${checkoutData.violatedInvariant}`
    );
  }
  if (!checkoutData.auditLogId) {
    throw new Error('Expected auditLogId to be returned in checkout failure response');
  }

  // 7. Verify AuditLog entry in DB
  console.log('\n7. Verifying TRANSACTION_BLOCKED entry in AuditLog table...');
  const blockedAudit = await prisma.auditLog.findUnique({
    where: { id: checkoutData.auditLogId },
  });

  if (!blockedAudit) {
    throw new Error(`AuditLog entry ${checkoutData.auditLogId} not found in DB`);
  }
  if (blockedAudit.eventType !== 'TRANSACTION_BLOCKED') {
    throw new Error(
      `Expected eventType 'TRANSACTION_BLOCKED', got '${blockedAudit.eventType}'`
    );
  }
  console.log(`   ✓ AuditLog record verified:`);
  console.log(`     - ID: ${blockedAudit.id}`);
  console.log(`     - Event Type: ${blockedAudit.eventType}`);
  console.log(`     - Details: ${blockedAudit.details}`);
  console.log(`     - Created At: ${blockedAudit.createdAt.toISOString()}`);

  // 8. Test GET /api/audit endpoint
  console.log('\n8. Testing GET /api/audit route...');
  const auditReqAll = new NextRequest(
    'http://localhost:3000/api/audit?merchantSlug=sweet-crumbs&limit=50'
  );
  const auditResAll = await auditGet(auditReqAll);
  const auditDataAll = await auditResAll.json();

  if (auditResAll.status !== 200) {
    throw new Error(`Expected HTTP 200 from /api/audit, got ${auditResAll.status}`);
  }
  console.log(`   Retrieved ${auditDataAll.totalCount} audit logs for sweet-crumbs.`);

  const blockedLogs = auditDataAll.logs.filter(
    (l: { eventType: string }) => l.eventType === 'TRANSACTION_BLOCKED'
  );
  if (blockedLogs.length < 2) {
    throw new Error(
      `Expected at least 2 TRANSACTION_BLOCKED logs, found ${blockedLogs.length}`
    );
  }
  console.log(`   ✓ Found ${blockedLogs.length} TRANSACTION_BLOCKED logs in ledger.`);

  // Test eventType filter
  const auditReqFiltered = new NextRequest(
    'http://localhost:3000/api/audit?merchantSlug=sweet-crumbs&eventType=TRANSACTION_BLOCKED'
  );
  const auditResFiltered = await auditGet(auditReqFiltered);
  const auditDataFiltered = await auditResFiltered.json();

  if (
    !auditDataFiltered.logs.every(
      (l: { eventType: string }) => l.eventType === 'TRANSACTION_BLOCKED'
    )
  ) {
    throw new Error('Audit endpoint eventType filter did not filter correctly');
  }
  console.log(
    `   ✓ Filter by eventType=TRANSACTION_BLOCKED returned ${auditDataFiltered.logs.length} matching events.`
  );

  console.log('\n======================================================');
  console.log('✅ ALL PHASE 8 AUDIT FEED & GATE FAILURE TESTS PASSED!');
  console.log('======================================================\n');
}

testPhase8()
  .catch((err) => {
    console.error('❌ Phase 8 Test Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
