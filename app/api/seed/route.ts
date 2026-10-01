import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { evaluateMerchantReadiness } from '../../../lib/engine/evaluator';

export async function POST() {
  try {
    const merchantSlug = 'sweet-crumbs';

    // 1. Wipe existing data (respecting foreign key constraints: child records before parents)
    await prisma.order.deleteMany({});
    await prisma.transactionProposal.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.readinessIssue.deleteMany({});
    await prisma.policy.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.merchant.deleteMany({});

    // 2. Create sample merchant: Sweet Crumbs
    const merchant = await prisma.merchant.create({
      data: {
        name: 'Sweet Crumbs',
        slug: merchantSlug,
        location: 'Chandannagar',
        contactPhone: '+91 8697774043',
        readinessScore: 0,
        transactionStatus: 'NOT_READY',
        auditLogs: {
          create: {
            eventType: 'MERCHANT_ONBOARDED',
            details: JSON.stringify({
              action: 'SANDBOX_INITIALIZED',
              merchant: 'Sweet Crumbs',
              location: 'Chandannagar',
              contact: '+91 8697774043',
              timestamp: new Date().toISOString(),
            }),
          },
        },
      },
    });

    // 3. Insert products: Dark Desire, Hazel Choco Bomb, Velvet Snow, Yin & Yum, Oreo Overload, Monster Chaos, and Velvet Truffle Mix
    const productsToSeed = [
      {
        name: 'Dark Desire',
        description: 'Decadent dark chocolate molten cookie with 70% single-origin core. Available as single or 6/8 cookie gift boxes.',
        price: 260,
        currency: 'INR',
        inventory: 25,
        isEggless: true,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹260 | Stock: 25 | Eggless verified',
      },
      {
        name: 'Hazel Choco Bomb',
        description: 'Nutella-stuffed golden toasted cocoa dough with crushed hazelnuts. Packaged in custom 6-box bakery sleeves.',
        price: 290,
        currency: 'INR',
        inventory: 25,
        isEggless: true,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹290 | Stock: 25 | Eggless verified',
      },
      {
        name: 'Velvet Snow',
        description: 'White chocolate cream cheese cookie dusted with Madagascar vanilla snow. Premium 6 or 8 cookie box.',
        price: 240,
        currency: 'INR',
        inventory: 25,
        isEggless: true,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹240 | Stock: 25 | Eggless verified',
      },
      {
        name: 'Yin & Yum',
        description: 'Balanced dark chocolate & Madagascar vanilla marbled shortbread. Available in 6-piece bakery boxes.',
        price: 250,
        currency: 'INR',
        inventory: 25,
        isEggless: true,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹250 | Stock: 25 | Eggless verified',
      },
      {
        name: 'Oreo Overload',
        description: 'Double chocolate dough packed with crushed Oreo crumble & cream. Available in 6 and 8 box bundles.',
        price: 270,
        currency: 'INR',
        inventory: 25,
        isEggless: true,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹270 | Stock: 25 | Eggless verified',
      },
      {
        name: 'Monster Chaos',
        description: 'Vibrant blue vanilla butter dough with Belgian chips & pretzel brittle. 6 or 8 cookie party pack.',
        price: 280,
        currency: 'INR',
        inventory: 25,
        isEggless: false,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹280 | Stock: 25 | Contains egg',
      },
      {
        name: 'Velvet Truffle Mix',
        description: 'Luxury 8-cookie sampler box: 2 Dark Desire, 2 Hazel Choco Bomb, 2 Velvet Snow, and 2 Yin & Yum.',
        price: 580,
        currency: 'INR',
        inventory: 25,
        isEggless: true,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹580 | Stock: 25 | Eggless verified',
      },
    ];

    const savedProducts = await Promise.all(
      productsToSeed.map((p) =>
        prisma.product.create({
          data: {
            merchantId: merchant.id,
            ...p,
          },
        })
      )
    );

    // 4. Insert verified refund & delivery policies to pass Invariant Gate and achieve 100/100 readiness
    const savedPolicies = await Promise.all([
      prisma.policy.create({
        data: {
          merchantId: merchant.id,
          type: 'REFUND',
          content: 'Perishable baked goods can be refunded or replaced within 24 hours of delivery if damaged in transit.',
          isVerified: true,
          sourceEvidence: 'Verified merchant refund terms agreed on WhatsApp and store policy document.',
        },
      }),
      prisma.policy.create({
        data: {
          merchantId: merchant.id,
          type: 'DELIVERY',
          content: 'Standard temperature-controlled delivery across Chandannagar, Chuchura, and Kolkata metro within 45-60 minutes.',
          isVerified: true,
          sourceEvidence: 'Merchant logistics partner SLA verified and active.',
        },
      }),
    ]);

    // 5. Log audit trail
    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        eventType: 'SANDBOX_SEEDED',
        details: JSON.stringify({
          action: 'SANDBOX_SEEDED',
          merchantSlug,
          productsCount: savedProducts.length,
          policiesCount: savedPolicies.length,
          verified: true,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    // 6. Evaluate and lock 100/100 READY state in database
    const evaluation = await evaluateMerchantReadiness(merchant.id);

    return NextResponse.json({
      success: true,
      message: 'Sandbox environment seeded successfully with Sweet Crumbs catalog.',
      merchant: {
        id: merchant.id,
        name: merchant.name,
        slug: merchant.slug,
        location: merchant.location,
        contactPhone: merchant.contactPhone,
      },
      evaluation,
      productsCount: savedProducts.length,
      policiesCount: savedPolicies.length,
    });
  } catch (error: unknown) {
    console.error('Sandbox seed error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal error during sandbox seed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
