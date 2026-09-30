import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { evaluateMerchantReadiness } from '../../../lib/engine/evaluator';

export async function POST() {
  try {
    const merchantSlug = 'sweet-crumbs';

    // 1. Clear existing records to ensure fresh sandbox state
    await prisma.order.deleteMany();
    await prisma.transactionProposal.deleteMany();
    await prisma.readinessIssue.deleteMany();
    await prisma.policy.deleteMany();
    await prisma.product.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.merchant.deleteMany();

    // 2. Create sample merchant: Sweet Crumbs
    const merchant = await prisma.merchant.create({
      data: {
        name: 'Sweet Crumbs',
        slug: merchantSlug,
        location: 'Chandannagar & Chuchura',
        contactPhone: '+91 8697774043',
        readinessScore: 0,
        transactionStatus: 'NOT_READY',
        auditLogs: {
          create: {
            eventType: 'MERCHANT_ONBOARDED',
            details: JSON.stringify({
              action: 'SANDBOX_INITIALIZED',
              merchant: 'Sweet Crumbs',
              location: 'Chandannagar & Chuchura',
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
        description: 'Decadent dark chocolate molten cookie with 70% single-origin cocoa core.',
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
        description: 'Rich roasted hazelnut paste encased in golden toasted cocoa dough.',
        price: 290,
        currency: 'INR',
        inventory: 20,
        isEggless: true,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹290 | Stock: 20 | Eggless verified',
      },
      {
        name: 'Velvet Snow',
        description: 'White chocolate cream cheese cookie dusted with Madagascar vanilla snow.',
        price: 240,
        currency: 'INR',
        inventory: 15,
        isEggless: true,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹240 | Stock: 15 | Eggless verified',
      },
      {
        name: 'Yin & Yum',
        description: 'Balanced half dark cocoa and half sweet vanilla marbled shortbread cookie.',
        price: 250,
        currency: 'INR',
        inventory: 30,
        isEggless: true,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹250 | Stock: 30 | Eggless verified',
      },
      {
        name: 'Oreo Overload',
        description: 'Crushed Oreo crumble and vanilla bean cream stuffed inside double chocolate dough.',
        price: 270,
        currency: 'INR',
        inventory: 18,
        isEggless: true,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹270 | Stock: 18 | Eggless verified',
      },
      {
        name: 'Monster Chaos',
        description: 'Vibrant blue butter dough packed with mini chocolate chips and pretzel brittle.',
        price: 280,
        currency: 'INR',
        inventory: 22,
        isEggless: false,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹280 | Stock: 22 | Contains egg',
      },
      {
        name: 'Velvet Truffle Mix',
        description: 'Assorted gourmet box with 2 Dark Desire, 2 Hazel Choco, and 2 Velvet Snow truffles.',
        price: 550,
        currency: 'INR',
        inventory: 12,
        isEggless: true,
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
        sourceEvidence: 'Official Bakery Spec Sheet: ₹550 | Stock: 12 | Eggless verified',
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
