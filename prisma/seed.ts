import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting database...');
  await prisma.order.deleteMany();
  await prisma.transactionProposal.deleteMany();
  await prisma.readinessIssue.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.product.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.merchant.deleteMany();

  console.log('Inserting demo merchant...');
  const merchant = await prisma.merchant.create({
    data: {
      name: 'Sweet Crumbs',
      slug: 'sweet-crumbs',
      location: 'Chandannagar & Chuchura',
      contactPhone: '+91 8697774043',
      readinessScore: 0,
      transactionStatus: 'NOT_READY',
      auditLogs: {
        create: {
          eventType: 'MERCHANT_ONBOARDED',
          details: JSON.stringify({
            action: 'MERCHANT_ONBOARDED',
            merchant: 'Sweet Crumbs',
            location: 'Chandannagar & Chuchura',
            contact: '+91 8697774043',
          }),
        },
      },
    },
    include: {
      auditLogs: true,
    },
  });

  console.log(`Seeded merchant: ${merchant.name} (ID: ${merchant.id})`);

  console.log('Inserting guaranteed baseline products...');
  await Promise.all([
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Signature Choco Chip Cookies',
        description: 'Artisan hand-crafted cookies with rich Belgian chocolate chips.',
        price: 250,
        currency: 'INR',
        inventory: 10,
        isEggless: true,
        status: 'DRAFT',
        priceVerified: false,
        inventoryVerified: false,
        sourceEvidence: 'WhatsApp: ₹250/box (10 boxes left) | CSV: 200,15,Eggless',
      },
    }),
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Double Dark Sea Salt Cookies',
        description: 'Dark cocoa artisan biscuits topped with Maldon sea salt crystals.',
        price: null,
        currency: 'INR',
        inventory: null,
        isEggless: true,
        status: 'DRAFT',
        priceVerified: false,
        inventoryVerified: false,
        sourceEvidence: 'WhatsApp: Fresh batch ready, DM to order | CSV: Double Dark Sea Salt Cookies,Artisan recipe,220,Eggless',
      },
    }),
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Oats & Cranberry Breakfast Cookies',
        description: 'Rolled oats with sun-dried cranberries and organic honey.',
        price: null,
        currency: 'INR',
        inventory: null,
        isEggless: false,
        status: 'DRAFT',
        priceVerified: false,
        inventoryVerified: false,
        sourceEvidence: 'Menu OCR: Price on request / seasonal availability',
      },
    }),
  ]);

  console.log('Inserting unverified refund policy...');
  await prisma.policy.create({
    data: {
      merchantId: merchant.id,
      type: 'REFUND',
      content: null,
      sourceEvidence: 'Merchant chat: No explicit refund or cancellation terms found in catalog data.',
      isVerified: false,
    },
  });

  console.log('Inserting default readiness issues...');
  await Promise.all([
    prisma.readinessIssue.create({
      data: {
        merchantId: merchant.id,
        severity: 'CRITICAL',
        category: 'CONSISTENCY',
        title: 'Price Conflict Detected',
        description: 'Price conflict on "Signature Choco Chip Cookies": WhatsApp says ₹250/box while legacy CSV catalog says ₹200.',
        remediationSuggestion: 'Verify active pricing with merchant to resolve discrepancy between sources.',
        resolved: false,
      },
    }),
    prisma.readinessIssue.create({
      data: {
        merchantId: merchant.id,
        severity: 'CRITICAL',
        category: 'PRICE',
        title: 'Missing Verified Price',
        description: 'Product "Double Dark Sea Salt Cookies" is missing an explicitly stated price in active catalog.',
        remediationSuggestion: 'Request verified pricing confirmation from merchant.',
        resolved: false,
      },
    }),
    prisma.readinessIssue.create({
      data: {
        merchantId: merchant.id,
        severity: 'HIGH',
        category: 'INVENTORY',
        title: 'Confirm Stock: Double Dark Sea Salt Cookies',
        description: 'Specify how many boxes are ready to bake or pack so AI buyers do not oversell.',
        remediationSuggestion: 'Confirm stock availability or enable real-time inventory tracking.',
        resolved: false,
      },
    }),
    prisma.readinessIssue.create({
      data: {
        merchantId: merchant.id,
        severity: 'HIGH',
        category: 'POLICY',
        title: 'Missing Delivery/Refund Policy',
        description: 'Merchant has no verified refund or perishable cancellation policy.',
        remediationSuggestion: 'Adopt standardized perishable goods refund terms.',
        resolved: false,
      },
    }),
  ]);

  // Evaluate initial readiness
  const { evaluateMerchantReadiness } = await import('../lib/engine/evaluator');
  const evaluation = await evaluateMerchantReadiness(merchant.id);
  console.log(`Initial readiness score: ${evaluation.readinessScore}/100 (${evaluation.transactionStatus})`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
