import { GET as catalogGet } from '../app/api/catalog/route';
import { POST as buyerPost } from '../app/api/buyer/route';
import { POST as resetPost } from '../app/api/seed/reset/route';
import { POST as verifyPost } from '../app/api/verify/route';
import { GET as readinessGet } from '../app/api/readiness/route';
import { NextRequest } from 'next/server';
import { prisma } from '../lib/prisma';

interface ProductItem {
  id: string;
  name: string;
  price: number | null;
  inventory: number | null;
  isEggless: boolean | null;
}

interface IssueItem {
  id: string;
  category: string;
}

interface CatalogMerchant {
  id: string;
  name: string;
  slug: string;
  readinessScore: number;
  products: ProductItem[];
}

interface ToolCallItem {
  toolName: string;
}

async function testPhase6() {
  console.log('=== Phase 6: Agent-Readable Catalog & AI Buyer Simulator Test ===\n');

  // 1. Reset baseline and verify Sweet Crumbs so catalog has verified items
  console.log('1. Setting up verified merchant baseline...');
  await resetPost();

  const readRes = await readinessGet(
    new NextRequest('http://localhost:3000/api/readiness?slug=sweet-crumbs', { method: 'GET' })
  );
  const readData = await readRes.json();
  const products: ProductItem[] = readData.products || [];
  const issues: IssueItem[] = readData.issues || [];

  // Verify all products
  for (const p of products) {
    await verifyPost(
      new NextRequest('http://localhost:3000/api/verify', {
        method: 'POST',
        body: JSON.stringify({
          action: 'VERIFY_PRODUCT',
          productId: p.id,
          price: p.price ?? (p.name.includes('Dark') ? 220 : 190),
          inventory: p.inventory ?? (p.name.includes('Dark') ? 15 : 20),
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }

  // Resolve conflict
  const conflict = issues.find((i) => i.category === 'CONSISTENCY');
  if (conflict) {
    await verifyPost(
      new NextRequest('http://localhost:3000/api/verify', {
        method: 'POST',
        body: JSON.stringify({
          action: 'RESOLVE_CONFLICT',
          issueId: conflict.id,
          authoritativePrice: 250,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }

  // Approve policy
  await verifyPost(
    new NextRequest('http://localhost:3000/api/verify', {
      method: 'POST',
      body: JSON.stringify({
        action: 'APPROVE_POLICY',
        merchantSlug: 'sweet-crumbs',
        type: 'REFUND',
        content: 'Perishable artisan baked goods cannot be returned once dispatched.',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
  );

  console.log('   Sweet Crumbs verified and ready for transactions.');

  // 2. Test GET /api/catalog (all verified inventory)
  console.log('\n2. Testing GET /api/catalog (all verified inventory)...');
  const catReq = new NextRequest('http://localhost:3000/api/catalog', { method: 'GET' });
  const catRes = await catalogGet(catReq);
  const catData = await catRes.json();
  const merchants: CatalogMerchant[] = catData.merchants || [];

  console.log(`   Catalog Version: ${catData.version}, GeneratedAt: ${catData.generatedAt}`);
  console.log(`   Merchants in Catalog: ${merchants.length}`);

  if (catRes.status !== 200 || merchants.length === 0) {
    throw new Error('Expected at least 1 merchant in catalog');
  }

  const merchant = merchants[0];
  console.log(`   Merchant: ${merchant.name} (Score: ${merchant.readinessScore}), Products: ${merchant.products.length}`);
  if (merchant.products.length === 0) {
    throw new Error('Expected verified products in catalog');
  }

  // 3. Test GET /api/catalog?eggless=true
  console.log('\n3. Testing GET /api/catalog?eggless=true...');
  const egglessReq = new NextRequest('http://localhost:3000/api/catalog?eggless=true', { method: 'GET' });
  const egglessRes = await catalogGet(egglessReq);
  const egglessData = await egglessRes.json();
  const egglessMerchants: CatalogMerchant[] = egglessData.merchants || [];

  const egglessProducts = egglessMerchants.flatMap((m) => m.products);
  console.log(`   Eggless Products Found: ${egglessProducts.length}`);
  if (!egglessProducts.every((p) => p.isEggless === true)) {
    throw new Error('Expected all filtered products to be eggless');
  }

  // 4. Test GET /api/catalog?maxPrice=230
  console.log('\n4. Testing GET /api/catalog?maxPrice=230...');
  const priceReq = new NextRequest('http://localhost:3000/api/catalog?maxPrice=230', { method: 'GET' });
  const priceRes = await catalogGet(priceReq);
  const priceData = await priceRes.json();
  const priceMerchants: CatalogMerchant[] = priceData.merchants || [];

  const budgetProducts = priceMerchants.flatMap((m) => m.products);
  console.log(`   Budget Products (<= ₹230): ${budgetProducts.length}`);
  if (!budgetProducts.every((p) => p.price !== null && p.price <= 230)) {
    throw new Error('Expected all filtered products to be <= 230');
  }

  // 5. Test AI Buyer Prompt 1: "I want eggless cookies under ₹300"
  console.log('\n5. Testing AI Buyer: "I want eggless cookies under ₹300"...');
  const buyerReq1 = new NextRequest('http://localhost:3000/api/buyer', {
    method: 'POST',
    body: JSON.stringify({ query: 'I want eggless cookies under ₹300' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const buyerRes1 = await buyerPost(buyerReq1);
  const buyerData1 = await buyerRes1.json();
  const toolCalls1: ToolCallItem[] = buyerData1.toolCalls || [];

  console.log(`   Buyer Status: ${buyerData1.status}`);
  console.log(`   Tool Calls (${toolCalls1.length}): ${toolCalls1.map((tc) => tc.toolName).join(' -> ')}`);
  console.log(`   Proposal ID: ${buyerData1.proposal?.id}`);
  console.log(`   Selected Product: ${buyerData1.proposal?.product?.name}`);
  console.log(`   Calculated Total: ₹${buyerData1.proposal?.calculatedTotal}`);

  if (buyerData1.status !== 'PROPOSAL_GENERATED' || !buyerData1.proposal) {
    throw new Error('Expected PROPOSAL_GENERATED for prompt 1');
  }
  if (buyerData1.proposal.offeredPrice > 300) {
    throw new Error('Expected offered price <= 300');
  }
  if (buyerData1.proposal.product?.isEggless !== true) {
    throw new Error('Expected eggless product');
  }

  // 6. Test AI Buyer Prompt 2: "Buy 2 boxes of Signature Choco Chip Cookies"
  console.log('\n6. Testing AI Buyer: "Buy 2 boxes of Signature Choco Chip Cookies"...');
  const buyerReq2 = new NextRequest('http://localhost:3000/api/buyer', {
    method: 'POST',
    body: JSON.stringify({ query: 'Buy 2 boxes of Signature Choco Chip Cookies' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const buyerRes2 = await buyerPost(buyerReq2);
  const buyerData2 = await buyerRes2.json();

  console.log(`   Buyer Status: ${buyerData2.status}`);
  console.log(`   Requested Qty: ${buyerData2.proposal?.requestedQuantity}, Total: ₹${buyerData2.proposal?.calculatedTotal}`);

  if (buyerData2.proposal?.requestedQuantity !== 2) {
    throw new Error('Expected requested quantity = 2');
  }
  if (buyerData2.proposal?.calculatedTotal !== 500) {
    throw new Error('Expected calculated total = 500');
  }

  // 7. Test AI Buyer Prompt 3: "Order 20 boxes of Signature Choco Chip Cookies" (Overstock test)
  console.log('\n7. Testing AI Buyer: "Order 20 boxes of Signature Choco Chip Cookies" (Stock limit test)...');
  const buyerReq3 = new NextRequest('http://localhost:3000/api/buyer', {
    method: 'POST',
    body: JSON.stringify({ query: 'Order 20 boxes of Signature Choco Chip Cookies' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const buyerRes3 = await buyerPost(buyerReq3);
  const buyerData3 = await buyerRes3.json();

  console.log(`   Buyer Status: ${buyerData3.status}`);
  console.log(`   Inventory Exceeded Flag: ${buyerData3.proposalData?.inventoryExceeded}`);
  console.log(`   Requested Qty: ${buyerData3.proposal?.requestedQuantity}, Total: ₹${buyerData3.proposal?.calculatedTotal}`);

  if (buyerData3.proposal?.requestedQuantity !== 20) {
    throw new Error('Expected requested quantity = 20');
  }
  if (buyerData3.proposalData?.inventoryExceeded !== true) {
    throw new Error('Expected inventoryExceeded = true');
  }

  // 8. Verify AuditLog entry TRANSACTION_PROPOSAL_CREATED
  const proposalLogs = await prisma.auditLog.findMany({
    where: { eventType: 'TRANSACTION_PROPOSAL_CREATED' },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  console.log(`\n8. Audit Trail: Found ${proposalLogs.length} TRANSACTION_PROPOSAL_CREATED audit logs.`);
  if (proposalLogs.length === 0) {
    throw new Error('Expected TRANSACTION_PROPOSAL_CREATED audit logs');
  }

  console.log('\n ALL PHASE 6 AGENT CATALOG & AI BUYER SIMULATOR TESTS PASSED!');
}

testPhase6()
  .catch((e) => {
    console.error('Phase 6 Test Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
