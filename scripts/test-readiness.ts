import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';
import { extractMerchantData } from '../lib/ai/extractor';
import { evaluateMerchantReadiness } from '../lib/engine/evaluator';

async function runReadinessTest() {
  console.log('=== Testing Phase 4: Deterministic Readiness Engine ===\n');

  const merchantSlug = 'sweet-crumbs';

  // 1. Ensure merchant exists
  let merchant = await prisma.merchant.findUnique({
    where: { slug: merchantSlug },
    include: {
      products: true,
      policies: true,
      issues: true,
    },
  });

  if (!merchant) {
    console.log('Merchant not found, seeding Sweet Crumbs demo merchant...');
    merchant = await prisma.merchant.create({
      data: {
        name: 'Sweet Crumbs',
        slug: merchantSlug,
        location: 'Chandannagar & Chuchura',
        contactPhone: '+91 8697774043',
        readinessScore: 0,
        transactionStatus: 'NOT_READY',
      },
      include: {
        products: true,
        policies: true,
        issues: true,
      },
    });
  }

  // 2. Ensure data has been ingested (if products are empty, run ingestion)
  if (merchant.products.length === 0) {
    console.log('No products found for merchant. Running ingestion pipeline...');
    const chat = fs.readFileSync(
      path.resolve(__dirname, '../seed/sweet_crumbs_chat.txt'),
      'utf8'
    );
    const csv = fs.readFileSync(
      path.resolve(__dirname, '../seed/legacy_menu.csv'),
      'utf8'
    );

    const extraction = await extractMerchantData(chat, csv);

    // Insert products
    await Promise.all(
      extraction.products.map((p) =>
        prisma.product.create({
          data: {
            merchantId: merchant!.id,
            name: p.name,
            description: p.description,
            price: p.price,
            currency: p.currency,
            inventory: p.inventory,
            isEggless: p.isEggless,
            sourceEvidence: p.sourceEvidence,
            status: 'DRAFT',
            priceVerified: false,
            inventoryVerified: false,
          },
        })
      )
    );

    // Insert policies
    await Promise.all(
      extraction.policies.map((pol) =>
        prisma.policy.create({
          data: {
            merchantId: merchant!.id,
            type: pol.type,
            content: pol.content,
            sourceEvidence: pol.sourceEvidence,
            isVerified: false,
          },
        })
      )
    );

    // Insert issues
    for (const flag of extraction.consistencyFlags) {
      await prisma.readinessIssue.create({
        data: {
          merchantId: merchant!.id,
          severity: 'CRITICAL',
          category: 'CONSISTENCY',
          title: 'Price Conflict Detected',
          description: `${flag.field}: ${flag.explanation}`,
          remediationSuggestion: 'Verify pricing with merchant.',
          resolved: false,
        },
      });
    }

    for (const p of extraction.products) {
      if (p.price === null) {
        await prisma.readinessIssue.create({
          data: {
            merchantId: merchant!.id,
            severity: 'CRITICAL',
            category: 'PRICE',
            title: 'Missing Verified Price',
            description: `Product "${p.name}" has unverified price.`,
            resolved: false,
          },
        });
      }
      if (p.inventory === null) {
        await prisma.readinessIssue.create({
          data: {
            merchantId: merchant!.id,
            severity: 'HIGH',
            category: 'INVENTORY',
            title: 'Unverified Inventory',
            description: `Product "${p.name}" has unverified inventory.`,
            resolved: false,
          },
        });
      }
    }

    console.log('Ingestion completed for test run.');
  }

  // 3. Execute evaluateMerchantReadiness
  console.log(`Running evaluateMerchantReadiness for "${merchantSlug}"...`);
  const evaluation = await evaluateMerchantReadiness(merchant.id);

  // 4. Print results
  console.log('\n----------------------------------------');
  console.log('EVALUATION RESULTS:');
  console.log('----------------------------------------');
  console.log(`Merchant:           ${evaluation.merchantName} (${evaluation.merchantSlug})`);
  console.log(`Total Score:        ${evaluation.readinessScore} / 100`);
  console.log(`Transaction Status: ${evaluation.transactionStatus}`);
  console.log('\n--- Category Breakdown ---');
  for (const [category, val] of Object.entries(evaluation.scoreBreakdown)) {
    console.log(`  ${category.padEnd(22)}: ${val} / 20 pts`);
  }

  console.log('\n--- Invariant Checklist ---');
  console.log(`  Invariants Passed: ${evaluation.invariants.passed ? 'YES' : 'NO'}`);
  if (evaluation.invariants.failures.length > 0) {
    console.log('  Failures Detected:');
    evaluation.invariants.failures.forEach((f, idx) => {
      console.log(`    ${idx + 1}. ${f}`);
    });
  }

  // 5. Verification Assertions
  console.log('\n--- Running Assertions ---');

  // Invariants should not pass because newly ingested items are unverified with critical issues
  if (evaluation.invariants.passed !== false) {
    throw new Error('Assertion Failed: Invariants should fail for newly ingested unverified merchant.');
  }
  console.log(' Verified: Invariant gate correctly rejected unverified merchant.');

  if (evaluation.transactionStatus !== 'NOT_READY') {
    throw new Error(`Assertion Failed: Expected status NOT_READY, got ${evaluation.transactionStatus}`);
  }
  console.log(' Verified: Transaction status is correctly evaluated as NOT_READY.');

  // Verify database record was updated
  const updatedMerchant = await prisma.merchant.findUnique({
    where: { id: merchant.id },
  });
  if (!updatedMerchant) {
    throw new Error('Assertion Failed: Merchant record not found.');
  }
  if (updatedMerchant.transactionStatus !== 'NOT_READY') {
    throw new Error(`Assertion Failed: DB transactionStatus not updated. Found ${updatedMerchant.transactionStatus}`);
  }
  if (updatedMerchant.readinessScore !== evaluation.readinessScore) {
    throw new Error(`Assertion Failed: DB readinessScore mismatch. DB: ${updatedMerchant.readinessScore}, Evaluation: ${evaluation.readinessScore}`);
  }
  console.log(' Verified: Merchant record in SQLite database updated with score and status.');

  // Verify AuditLog entry was recorded
  const auditLog = await prisma.auditLog.findFirst({
    where: {
      merchantId: merchant.id,
      eventType: 'READINESS_EVALUATED',
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!auditLog) {
    throw new Error('Assertion Failed: READINESS_EVALUATED audit log entry not found.');
  }
  console.log(' Verified: READINESS_EVALUATED audit log created successfully.');

  console.log('\n ALL READINESS ENGINE ASSERTIONS PASSED SUCCESSFULLY!');
}

runReadinessTest()
  .catch((err) => {
    console.error('\n Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
