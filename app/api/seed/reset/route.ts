import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../../../../lib/prisma';
import { extractMerchantData } from '../../../../lib/ai/extractor';
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

    // 3. Ingest raw seed files
    const chatPath = path.resolve(process.cwd(), 'seed/sweet_crumbs_chat.txt');
    const csvPath = path.resolve(process.cwd(), 'seed/legacy_menu.csv');

    const rawText = fs.readFileSync(chatPath, 'utf8');
    const csvText = fs.readFileSync(csvPath, 'utf8');

    const extraction = await extractMerchantData(rawText, csvText);

    // Save extracted products
    const savedProducts = await Promise.all(
      extraction.products.map((p) =>
        prisma.product.create({
          data: {
            merchantId: merchant.id,
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

    // Save extracted policies
    const savedPolicies = await Promise.all(
      extraction.policies.map((pol) =>
        prisma.policy.create({
          data: {
            merchantId: merchant.id,
            type: pol.type,
            content: pol.content,
            sourceEvidence: pol.sourceEvidence,
            isVerified: false,
          },
        })
      )
    );

    // Build readiness issues
    const issuesData: Array<{
      merchantId: string;
      severity: string;
      category: string;
      title: string;
      description: string;
      remediationSuggestion?: string;
      resolved: boolean;
    }> = [];

    for (const flag of extraction.consistencyFlags) {
      issuesData.push({
        merchantId: merchant.id,
        severity: 'CRITICAL',
        category: 'CONSISTENCY',
        title: 'Price Conflict Detected',
        description: `${flag.field}: ${flag.explanation} (Detected values: ${flag.detectedValues.join(', ')})`,
        remediationSuggestion:
          'Verify active pricing with merchant to resolve discrepancy between sources.',
        resolved: false,
      });
    }

    for (const p of extraction.products) {
      if (p.price === null) {
        issuesData.push({
          merchantId: merchant.id,
          severity: 'CRITICAL',
          category: 'PRICE',
          title: 'Missing Verified Price',
          description: `Product "${p.name}" is missing an explicitly stated price in active catalog.`,
          remediationSuggestion: 'Request verified pricing confirmation from merchant.',
          resolved: false,
        });
      }

      if (p.inventory === null) {
        issuesData.push({
          merchantId: merchant.id,
          severity: 'HIGH',
          category: 'INVENTORY',
          title: 'Unverified Inventory',
          description: `Product "${p.name}" has unverified inventory count.`,
          remediationSuggestion:
            'Confirm stock availability or enable real-time inventory tracking.',
          resolved: false,
        });
      }
    }

    const createdIssues = await Promise.all(
      issuesData.map((data) => prisma.readinessIssue.create({ data }))
    );

    // Log Ingestion Audit
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

    // 4. Run evaluateMerchantReadiness
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
