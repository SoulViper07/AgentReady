import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { evaluateMerchantReadiness } from '../../../../lib/engine/evaluator';

export async function POST() {
  try {
    const merchantSlug = 'sweet-crumbs';

    // 1. Clear existing demo records
    await prisma.order.deleteMany();
    await prisma.transactionProposal.deleteMany();
    await prisma.readinessIssue.deleteMany();
    await prisma.policy.deleteMany();
    await prisma.product.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.merchant.deleteMany();

    // 2. Insert fresh demo merchant
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
              action: 'MERCHANT_ONBOARDED',
              merchant: 'Sweet Crumbs',
              location: 'Chandannagar & Chuchura',
              contact: '+91 8697774043',
            }),
          },
        },
      },
    });

    // 3. Guaranteed Seed Baseline for Products:
    // 1. Signature Choco Chip Cookies: price: 250, priceVerified: false, inventory: 10, inventoryVerified: false, isEggless: true, status: "DRAFT"
    // 2. Double Dark Sea Salt Cookies: price: null, priceVerified: false, inventory: null, inventoryVerified: false, isEggless: true, status: "DRAFT"
    // 3. Oats & Cranberry Breakfast Cookies: price: null, priceVerified: false, inventory: null, inventoryVerified: false, isEggless: false, status: "DRAFT"
    const savedProducts = await Promise.all([
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

    // 4. Default unverified policy
    const savedPolicies = await Promise.all([
      prisma.policy.create({
        data: {
          merchantId: merchant.id,
          type: 'REFUND',
          content: null,
          sourceEvidence: 'Merchant chat: No explicit refund or cancellation terms found in catalog data.',
          isVerified: false,
        },
      }),
    ]);

    // 5. Insert default issues:
    // 1. Price Conflict Detected on Signature Choco Chip Cookies (WhatsApp ₹250 vs CSV ₹200)
    // 2. Missing Verified Price on Double Dark Sea Salt Cookies
    // 3. Unverified Inventory on Double Dark Sea Salt Cookies
    // 4. Missing Delivery/Refund Policy
    const createdIssues = await Promise.all([
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

    // 6. Log Ingestion Audit
    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        eventType: 'DATA_INGESTION_COMPLETED',
        details: JSON.stringify({
          action: 'DATA_INGESTION_COMPLETED',
          merchantSlug,
          productsCount: savedProducts.length,
          policiesCount: savedPolicies.length,
          issuesCount: createdIssues.length,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    // 7. Re-run evaluateMerchantReadiness so merchant starts at ~36/100 (NOT_READY)
    const evaluation = await evaluateMerchantReadiness(merchant.id);

    return NextResponse.json({
      success: true,
      message: 'Demo state reset successfully to unverified initial state.',
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
      issuesCount: createdIssues.length,
    });
  } catch (error: unknown) {
    console.error('Demo reset error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal error during demo reset';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
