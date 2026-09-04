import { POST as resetPost } from '../app/api/seed/reset/route';
import { POST as verifyPost } from '../app/api/verify/route';
import { GET as readinessGet } from '../app/api/readiness/route';
import { NextRequest } from 'next/server';
import { prisma } from '../lib/prisma';

interface TestIssue {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  resolved: boolean;
  advice?: {
    explanation: string;
    suggestedAction: string;
  };
}

interface TestProduct {
  id: string;
  name: string;
  price: number | null;
  inventory: number | null;
}

interface TestPolicy {
  id: string;
  type: string;
  content: string | null;
  isVerified: boolean;
}

async function testPhase5() {
  console.log('=== Phase 5: Verification & Remediation End-to-End Test ===\n');

  // 1. Reset Demo Baseline
  console.log('1. Calling POST /api/seed/reset to establish baseline...');
  const resetRes = await resetPost();
  const resetJson = await resetRes.json();
  console.log(`   Reset Status: ${resetRes.status}, Message: "${resetJson.message}"`);
  console.log(`   Baseline Score: ${resetJson.evaluation.readinessScore}, Status: ${resetJson.evaluation.transactionStatus}`);

  if (resetRes.status !== 200 || resetJson.evaluation.transactionStatus !== 'NOT_READY') {
    throw new Error('Baseline reset did not produce NOT_READY status');
  }

  // 2. Fetch Readiness & Remediation Advice
  console.log('\n2. Fetching Readiness & Advice via GET /api/readiness?slug=sweet-crumbs...');
  const getReq = new NextRequest('http://localhost:3000/api/readiness?slug=sweet-crumbs', { method: 'GET' });
  const getRes = await readinessGet(getReq);
  const getData = await getRes.json();
  const issues: TestIssue[] = getData.issues || [];
  const products: TestProduct[] = getData.products || [];
  const policies: TestPolicy[] = getData.policies || [];

  console.log(`   Found ${issues.length} total issues (${getData.unresolvedCriticalIssuesCount} critical).`);

  const conflictIssue = issues.find(
    (i) => i.category === 'CONSISTENCY' && !i.resolved
  );
  if (!conflictIssue) {
    throw new Error('Expected unresolved consistency conflict issue');
  }
  console.log(`   Sample Advice Generated: "${conflictIssue.advice?.explanation}"`);

  // 3. Resolve Price Conflict (authoritative: 250)
  console.log('\n3. Resolving Price Conflict (Selecting ₹250 as truth)...');
  const conflictProduct = products.find((p) =>
    conflictIssue.description.includes(p.name)
  );

  const resolveConflictReq = new NextRequest('http://localhost:3000/api/verify', {
    method: 'POST',
    body: JSON.stringify({
      action: 'RESOLVE_CONFLICT',
      issueId: conflictIssue.id,
      productId: conflictProduct?.id,
      authoritativePrice: 250,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  const conflictRes = await verifyPost(resolveConflictReq);
  const conflictJson = await conflictRes.json();
  console.log(`   Conflict Resolved. New Score: ${conflictJson.readinessScore}, Status: ${conflictJson.transactionStatus}`);

  // 4. Verify Double Dark Sea Salt Cookies (Price: 220, Inventory: 15)
  console.log('\n4. Verifying "Double Dark Sea Salt Cookies" (Price: 220, Inventory: 15)...');
  const doubleDark = products.find((p) => p.name.includes('Double Dark'));
  if (!doubleDark) throw new Error('Double Dark product not found');

  const verifyDarkReq = new NextRequest('http://localhost:3000/api/verify', {
    method: 'POST',
    body: JSON.stringify({
      action: 'VERIFY_PRODUCT',
      productId: doubleDark.id,
      price: 220,
      inventory: 15,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  const darkRes = await verifyPost(verifyDarkReq);
  const darkJson = await darkRes.json();
  console.log(`   Product Verified. New Score: ${darkJson.readinessScore}, Status: ${darkJson.transactionStatus}`);

  // 5. Verify Oats & Cranberry Breakfast Cookies (Price: 190, Inventory: 20)
  console.log('\n5. Verifying "Oats & Cranberry Breakfast Cookies" (Price: 190, Inventory: 20)...');
  const oats = products.find((p) => p.name.includes('Oats'));
  if (!oats) throw new Error('Oats product not found');

  const verifyOatsReq = new NextRequest('http://localhost:3000/api/verify', {
    method: 'POST',
    body: JSON.stringify({
      action: 'VERIFY_PRODUCT',
      productId: oats.id,
      price: 190,
      inventory: 20,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  const oatsRes = await verifyPost(verifyOatsReq);
  const oatsJson = await oatsRes.json();
  console.log(`   Product Verified. New Score: ${oatsJson.readinessScore}, Status: ${oatsJson.transactionStatus}`);

  // 6. Verify Signature Choco Chip Cookies inventory
  console.log('\n6. Verifying "Signature Choco Chip Cookies" (Inventory verified)...');
  const choco = products.find((p) => p.name.includes('Signature Choco Chip'));
  if (!choco) throw new Error('Choco chip product not found');

  const verifyChocoReq = new NextRequest('http://localhost:3000/api/verify', {
    method: 'POST',
    body: JSON.stringify({
      action: 'VERIFY_PRODUCT',
      productId: choco.id,
      price: 250,
      inventory: 10,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  const chocoRes = await verifyPost(verifyChocoReq);
  const chocoJson = await chocoRes.json();
  console.log(`   Choco Chip Verified. New Score: ${chocoJson.readinessScore}, Status: ${chocoJson.transactionStatus}`);

  // 7. Approve Refund Policy
  console.log('\n7. Approving Perishable Goods Refund Policy...');
  const refundPolicy = policies.find((p) => p.type === 'REFUND');
  const approvePolicyReq = new NextRequest('http://localhost:3000/api/verify', {
    method: 'POST',
    body: JSON.stringify({
      action: 'APPROVE_POLICY',
      policyId: refundPolicy?.id,
      merchantId: getData.merchant.id,
      type: 'REFUND',
      content: 'Fresh perishable baked items cannot be returned once dispatched. Replacements provided for transit damage reported within 2 hours.',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  const policyRes = await verifyPost(approvePolicyReq);
  const policyJson = await policyRes.json();
  console.log(`   Policy Approved! Final Score: ${policyJson.readinessScore}, Transaction Status: ${policyJson.transactionStatus}`);
  console.log(`   Invariants Passed: ${policyJson.invariants.passed}`);
  console.log('   Score Breakdown:', policyJson.scoreBreakdown);

  // 8. Assertions
  if (!policyJson.invariants.passed) {
    throw new Error(`Expected all invariants to pass! Failures: ${policyJson.invariants.failures.join(', ')}`);
  }
  if (policyJson.readinessScore < 80) {
    throw new Error(`Expected readiness score >= 80, got ${policyJson.readinessScore}`);
  }
  if (policyJson.transactionStatus !== 'READY') {
    throw new Error(`Expected transactionStatus to transition to READY, got ${policyJson.transactionStatus}`);
  }

  // 9. Verify AuditLog entries
  const logs = await prisma.auditLog.findMany({
    where: { merchantId: getData.merchant.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log(`\n9. Audit Trail Verified: Recorded ${logs.length} audit logs. Latest events:`);
  logs.slice(0, 5).forEach((l) => console.log(`   - [${l.eventType}]`));

  console.log('\n ALL PHASE 5 HUMAN-IN-THE-LOOP VERIFICATION TESTS PASSED!');
}

testPhase5()
  .catch((e) => {
    console.error('Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
