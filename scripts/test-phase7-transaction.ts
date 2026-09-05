import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '../lib/prisma';
import { POST as resetPost } from '../app/api/seed/reset/route';
import { POST as verifyPost } from '../app/api/verify/route';
import { POST as ingestPost } from '../app/api/ingest/route';
import { POST as checkoutPost } from '../app/api/transaction/checkout/route';
import { POST as verifyPaymentPost } from '../app/api/transaction/verify/route';
import { validateAndReserveProposal } from '../lib/engine/transactionGate';

async function testPhase7() {
  console.log('=== Phase 7: Deterministic Transaction Gate & Razorpay Settlement Test ===\n');

  // 1. Reset and establish baseline
  console.log('1. Setting up verified merchant baseline...');
  await resetPost();

  // Ingest catalog
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

  // Ingest refund policy
  const policyReq = new NextRequest('http://localhost:3000/api/ingest', {
    method: 'POST',
    body: JSON.stringify({
      merchantSlug: 'sweet-crumbs',
      sourceType: 'POLICY',
      payload: 'Perishable artisan baked goods cannot be returned once dispatched. Photo evidence within 2 hours of delivery qualifies for instant refund.',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  await ingestPost(policyReq);

  // Quick verify products
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

  // Resolve issues and verify policy
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

  const polReq = new NextRequest('http://localhost:3000/api/verify', {
    method: 'POST',
    body: JSON.stringify({
      action: 'APPROVE_POLICY',
      merchantSlug: 'sweet-crumbs',
      type: 'REFUND',
      content: 'Perishable goods policy verified.',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  await verifyPost(polReq);

  const merchant = await prisma.merchant.findUnique({
    where: { slug: 'sweet-crumbs' },
    include: { products: true },
  });
  if (!merchant || merchant.transactionStatus === 'NOT_READY') {
    throw new Error(`Merchant baseline failed. Status: ${merchant?.transactionStatus}`);
  }
  console.log(`   Merchant ready: ${merchant.name} (Status: ${merchant.transactionStatus}, Score: ${merchant.readinessScore})`);

  const testProduct = merchant.products.find((p) => p.name === 'Signature Choco Chip Cookies') || merchant.products[0];

  // 2. Test Invariant Check 1: Block when Merchant is NOT_READY
  console.log('\n2. Testing Invariant Check 1: Merchant status NOT_READY blocks transaction...');
  await prisma.merchant.update({
    where: { id: merchant.id },
    data: { transactionStatus: 'NOT_READY' },
  });

  const propBlocked1 = await prisma.transactionProposal.create({
    data: {
      merchantId: merchant.id,
      productId: testProduct.id,
      requestedQuantity: 2,
      offeredPrice: testProduct.price!,
      calculatedTotal: 2 * testProduct.price!,
      status: 'PROPOSED',
    },
  });

  const gateRes1 = await validateAndReserveProposal(propBlocked1.id);
  if (gateRes1.allowed) {
    throw new Error('Expected gate to block NOT_READY merchant');
  }
  console.log(`   Gate Allowed: ${gateRes1.allowed}`);
  console.log(`   Block Reason: ${gateRes1.reason}`);
  if (!gateRes1.reason.includes('NOT_READY')) {
    throw new Error('Expected gate to block NOT_READY merchant');
  }

  const updatedProp1 = await prisma.transactionProposal.findUnique({ where: { id: propBlocked1.id } });
  if (updatedProp1?.status !== 'BLOCKED') {
    throw new Error(`Expected proposal status BLOCKED, got ${updatedProp1?.status}`);
  }

  // Restore merchant status
  await prisma.merchant.update({
    where: { id: merchant.id },
    data: { transactionStatus: 'READY' },
  });

  // 3. Test Invariant Check 2: Block when Product is not VERIFIED or price unverified
  console.log('\n3. Testing Invariant Check 2: Unverified product status blocks transaction...');
  const unverifiedProduct = await prisma.product.create({
    data: {
      merchantId: merchant.id,
      name: 'Unverified Seasonal Cake',
      price: 400,
      priceVerified: false,
      inventory: 5,
      inventoryVerified: false,
      status: 'DRAFT',
    },
  });

  const propBlocked2 = await prisma.transactionProposal.create({
    data: {
      merchantId: merchant.id,
      productId: unverifiedProduct.id,
      requestedQuantity: 1,
      offeredPrice: 400,
      calculatedTotal: 400,
      status: 'PROPOSED',
    },
  });

  const gateRes2 = await validateAndReserveProposal(propBlocked2.id);
  if (gateRes2.allowed) {
    throw new Error('Expected gate to block unverified product');
  }
  console.log(`   Gate Allowed: ${gateRes2.allowed}`);
  console.log(`   Block Reason: ${gateRes2.reason}`);

  // 4. Test Invariant Check 3: Price Mismatch Check
  console.log('\n4. Testing Invariant Check 3: Offered price mismatch blocks transaction...');
  const propBlocked3 = await prisma.transactionProposal.create({
    data: {
      merchantId: merchant.id,
      productId: testProduct.id,
      requestedQuantity: 2,
      offeredPrice: 150, // Catalog price is 250
      calculatedTotal: 300,
      status: 'PROPOSED',
    },
  });

  const gateRes3 = await validateAndReserveProposal(propBlocked3.id);
  if (gateRes3.allowed) {
    throw new Error('Expected gate to block price mismatch');
  }
  console.log(`   Gate Allowed: ${gateRes3.allowed}`);
  console.log(`   Block Reason: ${gateRes3.reason}`);
  if (!gateRes3.reason.includes('Price mismatch')) {
    throw new Error('Expected gate to block price mismatch');
  }

  // 5. Test Invariant Check 4: Calculated Total Mismatch
  console.log('\n5. Testing Invariant Check 4: Tampered calculated total blocks transaction...');
  const propBlocked4 = await prisma.transactionProposal.create({
    data: {
      merchantId: merchant.id,
      productId: testProduct.id,
      requestedQuantity: 2,
      offeredPrice: testProduct.price!,
      calculatedTotal: 100, // Should be 500
      status: 'PROPOSED',
    },
  });

  const gateRes4 = await validateAndReserveProposal(propBlocked4.id);
  if (gateRes4.allowed) {
    throw new Error('Expected gate to block total mismatch');
  }
  console.log(`   Gate Allowed: ${gateRes4.allowed}`);
  console.log(`   Block Reason: ${gateRes4.reason}`);
  if (!gateRes4.reason.includes('Total calculation mismatch')) {
    throw new Error('Expected gate to block total mismatch');
  }

  // 6. Test Invariant Check 5: Insufficient Inventory Check
  console.log('\n6. Testing Invariant Check 5: Insufficient inventory blocks transaction...');
  const propBlocked5 = await prisma.transactionProposal.create({
    data: {
      merchantId: merchant.id,
      productId: testProduct.id,
      requestedQuantity: 100, // Stock is 15
      offeredPrice: testProduct.price!,
      calculatedTotal: 100 * testProduct.price!,
      status: 'PROPOSED',
    },
  });

  const gateRes5 = await validateAndReserveProposal(propBlocked5.id);
  if (gateRes5.allowed) {
    throw new Error('Expected gate to block insufficient inventory');
  }
  console.log(`   Gate Allowed: ${gateRes5.allowed}`);
  console.log(`   Block Reason: ${gateRes5.reason}`);
  if (
    !gateRes5.reason.toUpperCase().includes('INSUFFICIENT_INVENTORY') &&
    !gateRes5.reason.includes('Insufficient inventory')
  ) {
    throw new Error('Expected gate to block insufficient inventory');
  }

  // 7. Test Invariants Pass -> Proposal Reserved for 10 minutes
  console.log('\n7. Testing All Invariants Pass: Proposal reserved for 10 minutes...');
  const validProposal = await prisma.transactionProposal.create({
    data: {
      merchantId: merchant.id,
      productId: testProduct.id,
      requestedQuantity: 2,
      offeredPrice: testProduct.price!,
      calculatedTotal: 2 * testProduct.price!,
      status: 'PROPOSED',
    },
  });

  const gateResSuccess = await validateAndReserveProposal(validProposal.id);
  if (!gateResSuccess.allowed) {
    throw new Error(`Expected gate to allow valid proposal, but blocked: ${gateResSuccess.reason}`);
  }

  console.log(`   Gate Allowed: ${gateResSuccess.allowed}`);
  console.log(`   Proposal Status: ${gateResSuccess.proposal.status}`);
  console.log(`   Expires At: ${gateResSuccess.proposal.expiresAt?.toISOString()}`);
  if (gateResSuccess.proposal.status !== 'RESERVED') {
    throw new Error(`Expected proposal status RESERVED, got ${gateResSuccess.proposal.status}`);
  }

  // 8. Test Checkout API (POST /api/transaction/checkout)
  console.log('\n8. Testing Checkout Order Creation API (POST /api/transaction/checkout)...');
  const checkoutReq = new NextRequest('http://localhost:3000/api/transaction/checkout', {
    method: 'POST',
    body: JSON.stringify({ proposalId: validProposal.id }),
    headers: { 'Content-Type': 'application/json' },
  });

  const checkoutRes = await checkoutPost(checkoutReq);
  const checkoutData = await checkoutRes.json();

  console.log(`   Checkout Order ID: ${checkoutData.orderId}`);
  console.log(`   Amount in Paise: ${checkoutData.amount} (₹${checkoutData.amount / 100})`);
  console.log(`   Currency: ${checkoutData.currency}`);

  if (checkoutRes.status !== 200 || !checkoutData.orderId) {
    throw new Error(`Expected 200 OK from checkout, got ${checkoutRes.status}`);
  }
  if (checkoutData.amount !== 50000) {
    throw new Error(`Expected amount 50000 paise (₹500), got ${checkoutData.amount}`);
  }

  const orderRecord = await prisma.order.findUnique({
    where: { razorpayOrderId: checkoutData.orderId },
  });
  if (!orderRecord || orderRecord.status !== 'CREATED') {
    throw new Error(`Expected Order record created with status CREATED`);
  }

  // 9. Test Cryptographic Payment Verification API (POST /api/transaction/verify)
  console.log('\n9. Testing Cryptographic Verification API (POST /api/transaction/verify)...');

  // 9a. Test Invalid Signature (Tampered)
  console.log('   9a. Testing Signature Mismatch (Tampered Signature)...');
  const invalidVerifyReq = new NextRequest('http://localhost:3000/api/transaction/verify', {
    method: 'POST',
    body: JSON.stringify({
      proposalId: validProposal.id,
      razorpay_order_id: checkoutData.orderId,
      razorpay_payment_id: 'pay_test_tampered_123',
      razorpay_signature: 'invalid_tampered_signature_hex_000',
    }),
    headers: { 'Content-Type': 'application/json' },
  });

  const invalidVerifyRes = await verifyPaymentPost(invalidVerifyReq);
  const invalidVerifyData = await invalidVerifyRes.json();
  console.log(`   Response Status: ${invalidVerifyRes.status}`);
  console.log(`   Error: ${invalidVerifyData.error}`);

  if (invalidVerifyRes.status !== 400 || !invalidVerifyData.error.includes('Invalid payment signature')) {
    throw new Error('Expected 400 Invalid payment signature for tampered signature');
  }

  const failedOrder = await prisma.order.findUnique({ where: { razorpayOrderId: checkoutData.orderId } });
  if (failedOrder?.status !== 'FAILED') {
    throw new Error(`Expected order status FAILED, got ${failedOrder?.status}`);
  }

  // 9b. Test Valid Signature (HMAC SHA-256) with fresh proposal
  console.log('\n   9b. Testing Genuine HMAC SHA-256 Signature Verification & Inventory Deduction...');
  const initialInventory = (await prisma.product.findUnique({ where: { id: testProduct.id } }))?.inventory ?? 0;
  console.log(`   Initial verified inventory for "${testProduct.name}": ${initialInventory} units`);

  const purchaseProposal = await prisma.transactionProposal.create({
    data: {
      merchantId: merchant.id,
      productId: testProduct.id,
      requestedQuantity: 3,
      offeredPrice: testProduct.price!,
      calculatedTotal: 3 * testProduct.price!,
      status: 'PROPOSED',
    },
  });

  // Call checkout to create order
  const checkoutReq2 = new NextRequest('http://localhost:3000/api/transaction/checkout', {
    method: 'POST',
    body: JSON.stringify({ proposalId: purchaseProposal.id }),
    headers: { 'Content-Type': 'application/json' },
  });
  const checkoutRes2 = await checkoutPost(checkoutReq2);
  const checkoutData2 = await checkoutRes2.json();

  // Compute authentic HMAC SHA-256 signature
  const testPaymentId = `pay_real_test_${Date.now()}`;
  const secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_placeholder_secret';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${checkoutData2.orderId}|${testPaymentId}`);
  const validSignature = hmac.digest('hex');

  // Verify payment
  const validVerifyReq = new NextRequest('http://localhost:3000/api/transaction/verify', {
    method: 'POST',
    body: JSON.stringify({
      proposalId: purchaseProposal.id,
      razorpay_order_id: checkoutData2.orderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: validSignature,
    }),
    headers: { 'Content-Type': 'application/json' },
  });

  const validVerifyRes = await verifyPaymentPost(validVerifyReq);
  const validVerifyData = await validVerifyRes.json();

  console.log(`   Verification Status: ${validVerifyRes.status}`);
  console.log(`   Success: ${validVerifyData.success}`);
  console.log(`   Payment ID: ${validVerifyData.paymentId}`);
  console.log(`   Remaining Inventory: ${validVerifyData.remainingInventory} units`);

  if (validVerifyRes.status !== 200 || !validVerifyData.success) {
    throw new Error(`Expected payment verification success, got: ${JSON.stringify(validVerifyData)}`);
  }

  // Check inventory deduction
  const expectedInventory = initialInventory - 3;
  if (validVerifyData.remainingInventory !== expectedInventory) {
    throw new Error(`Expected remaining inventory ${expectedInventory}, got ${validVerifyData.remainingInventory}`);
  }

  // Verify DB state
  const completedOrder = await prisma.order.findUnique({ where: { razorpayOrderId: checkoutData2.orderId } });
  if (completedOrder?.status !== 'PAID') {
    throw new Error(`Expected order status PAID, got ${completedOrder?.status}`);
  }

  const completedProposal = await prisma.transactionProposal.findUnique({ where: { id: purchaseProposal.id } });
  if (completedProposal?.status !== 'COMPLETED') {
    throw new Error(`Expected proposal status COMPLETED, got ${completedProposal?.status}`);
  }

  // 10. Verify Audit Trail for Phase 7
  const blockedLogs = await prisma.auditLog.findMany({ where: { eventType: 'TRANSACTION_BLOCKED' } });
  const reservedLogs = await prisma.auditLog.findMany({ where: { eventType: 'TRANSACTION_RESERVED' } });
  const orderLogs = await prisma.auditLog.findMany({ where: { eventType: 'RAZORPAY_ORDER_CREATED' } });
  const mismatchLogs = await prisma.auditLog.findMany({ where: { eventType: 'PAYMENT_SIGNATURE_MISMATCH' } });
  const verifiedLogs = await prisma.auditLog.findMany({ where: { eventType: 'PAYMENT_VERIFIED' } });
  const deductedLogs = await prisma.auditLog.findMany({ where: { eventType: 'INVENTORY_DEDUCTED' } });

  console.log('\n10. Audit Trail Verification:');
  console.log(`   - TRANSACTION_BLOCKED logs: ${blockedLogs.length}`);
  console.log(`   - TRANSACTION_RESERVED logs: ${reservedLogs.length}`);
  console.log(`   - RAZORPAY_ORDER_CREATED logs: ${orderLogs.length}`);
  console.log(`   - PAYMENT_SIGNATURE_MISMATCH logs: ${mismatchLogs.length}`);
  console.log(`   - PAYMENT_VERIFIED logs: ${verifiedLogs.length}`);
  console.log(`   - INVENTORY_DEDUCTED logs: ${deductedLogs.length}`);

  if (
    blockedLogs.length === 0 ||
    reservedLogs.length === 0 ||
    orderLogs.length === 0 ||
    mismatchLogs.length === 0 ||
    verifiedLogs.length === 0 ||
    deductedLogs.length === 0
  ) {
    throw new Error('Audit trail is missing required Phase 7 events.');
  }

  console.log('\n🎉 ALL PHASE 7 TRANSACTION GATE & RAZORPAY SETTLEMENT TESTS PASSED!\n');
}

testPhase7()
  .catch((err) => {
    console.error('Phase 7 Test Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
