import { runAIBuyer } from '../lib/ai/buyer';
import { prisma } from '../lib/prisma';
import { POST as resetPost } from '../app/api/seed/reset/route';
import { POST as verifyPost } from '../app/api/verify/route';
import { NextRequest } from 'next/server';

async function main() {
  console.log('=== Testing AI Buyer Dynamic Matching & Invariant Enforcement ===\n');

  // 1. Reset to fresh baseline (Sweet Crumbs unverified)
  console.log('1. Setting up unverified merchant baseline...');
  await resetPost();

  // Test 1: Unverified item attempt
  console.log('\n2. Testing unverified item request: "Order 1x Signature Choco Chip Cookies"...');
  const resUnverified = await runAIBuyer('Order 1x Signature Choco Chip Cookies', {
    merchantSlug: 'sweet-crumbs',
    allowDraftForDemo: true,
  });
  console.log(`   Status: ${resUnverified.status}`);
  console.log(`   Explanation: ${resUnverified.explanation}`);
  if (resUnverified.status !== 'NO_MATCH_FOUND' || !resUnverified.explanation.includes('unverified')) {
    throw new Error('Expected Invariant 1 block on unverified item');
  }

  // 2. Verify Signature Choco Chip Cookies and set merchant to ready
  console.log('\n3. Verifying Signature Choco Chip Cookies in catalog...');
  const chocoProduct = await prisma.product.findFirst({
    where: { name: { contains: 'Signature Choco Chip' } },
  });
  if (!chocoProduct) throw new Error('Product not found');

  await verifyPost(
    new NextRequest('http://localhost:3000/api/verify', {
      method: 'POST',
      body: JSON.stringify({
        action: 'VERIFY_PRODUCT',
        productId: chocoProduct.id,
        price: 250,
        inventory: 10,
        merchantSlug: 'sweet-crumbs',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
  );

  await prisma.merchant.update({
    where: { slug: 'sweet-crumbs' },
    data: { transactionStatus: 'READY', readinessScore: 100 },
  });

  // Test 3: Unknown / Unmatched item: "i need monster cookies"
  console.log('\n4. Testing arbitrary unmatched item: "i need monster cookies"...');
  const resMonster = await runAIBuyer('i need monster cookies', {
    merchantSlug: 'sweet-crumbs',
  });
  console.log(`   Status: ${resMonster.status}`);
  console.log(`   Has proposal: ${!!resMonster.proposalData}`);
  console.log(`   Explanation: ${resMonster.explanation}`);
  if (resMonster.status !== 'NO_MATCH_FOUND' || resMonster.proposalData) {
    throw new Error('Expected NO_MATCH_FOUND without proposal for monster cookies');
  }
  if (!resMonster.explanation.includes('monster cookies')) {
    throw new Error('Expected explanation to specifically cite monster cookies');
  }

  // Test 4: Verified item: "Order 1x Signature Choco Chip Cookies"
  console.log('\n5. Testing verified item: "Order 1x Signature Choco Chip Cookies"...');
  const resValid = await runAIBuyer('Order 1x Signature Choco Chip Cookies', {
    merchantSlug: 'sweet-crumbs',
  });
  console.log(`   Status: ${resValid.status}`);
  console.log(`   Product: ${resValid.proposalData?.productName}`);
  console.log(`   Qty: ${resValid.proposalData?.requestedQuantity}`);
  console.log(`   Total: ₹${resValid.proposalData?.calculatedTotal}`);
  if (resValid.status !== 'PROPOSAL_GENERATED' || !resValid.proposalData) {
    throw new Error('Expected PROPOSAL_GENERATED for verified Signature Choco Chip Cookies');
  }
  if (resValid.proposalData.calculatedTotal !== 250) {
    throw new Error('Expected total ₹250');
  }

  // Test 5: Overstock test: "Order 20 boxes of Signature Choco Chip Cookies"
  console.log('\n6. Testing overstock prompt: "Order 20 boxes of Signature Choco Chip Cookies"...');
  const resOverstock = await runAIBuyer('Order 20 boxes of Signature Choco Chip Cookies', {
    merchantSlug: 'sweet-crumbs',
  });
  console.log(`   Status: ${resOverstock.status}`);
  console.log(`   Qty: ${resOverstock.proposalData?.requestedQuantity}`);
  console.log(`   Inventory Exceeded: ${resOverstock.proposalData?.inventoryExceeded}`);
  console.log(`   Total: ₹${resOverstock.proposalData?.calculatedTotal}`);
  if (resOverstock.proposalData?.requestedQuantity !== 20) {
    throw new Error('Expected requested quantity = 20');
  }
  if (resOverstock.proposalData?.inventoryExceeded !== true) {
    throw new Error('Expected inventoryExceeded = true');
  }

  // Test 6: Unverified item when other items are verified: "2 boxes of Double Dark Sea Salt Cookies"
  console.log('\n7. Testing unverified sibling product: "2 boxes of Double Dark Sea Salt Cookies"...');
  const resDoubleDark = await runAIBuyer('2 boxes of Double Dark Sea Salt Cookies', {
    merchantSlug: 'sweet-crumbs',
  });
  console.log(`   Status: ${resDoubleDark.status}`);
  console.log(`   Explanation: ${resDoubleDark.explanation}`);
  if (resDoubleDark.status !== 'NO_MATCH_FOUND' || resDoubleDark.proposalData) {
    throw new Error('Expected NO_MATCH_FOUND for unverified Double Dark');
  }

  console.log('\n🎉 ALL AI BUYER DYNAMIC MATCHING & INVARIANT TESTS PASSED SUCCESSFULLY!');
}

main()
  .catch((e) => {
    console.error('Test Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
