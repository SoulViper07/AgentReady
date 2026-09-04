import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { extractMerchantData } from '../../../lib/ai/extractor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantSlug, rawText, csvText } = body;

    if (!merchantSlug || typeof merchantSlug !== 'string') {
      return NextResponse.json(
        { error: 'merchantSlug is required and must be a string' },
        { status: 400 }
      );
    }

    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json(
        { error: 'rawText is required and must be a string' },
        { status: 400 }
      );
    }

    // 1. Retrieve the Merchant by slug
    const merchant = await prisma.merchant.findUnique({
      where: { slug: merchantSlug },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: `Merchant with slug "${merchantSlug}" not found` },
        { status: 404 }
      );
    }

    // 2. Invoke extractMerchantData
    const extraction = await extractMerchantData(rawText, csvText);

    // 3. Save extracted products into the Product table (status: "DRAFT")
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

    // 4. Save extracted policies into the Policy table
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

    // 5-7. Build readiness issues
    const issuesData: Array<{
      merchantId: string;
      severity: string;
      category: string;
      title: string;
      description: string;
      remediationSuggestion?: string;
      resolved: boolean;
    }> = [];

    // 5. If consistencyFlags exist, create ReadinessIssue entries
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

    // 6. If any product has price === null, create a ReadinessIssue
    // 7. If any product has inventory === null, create a ReadinessIssue
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

    // 8. Create an AuditLog entry: MERCHANT_DATA_INGESTED or DATA_INGESTION_COMPLETED
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

    // 9. Return HTTP 200 with saved products, policies, and created issues
    return NextResponse.json({
      success: true,
      products: savedProducts,
      policies: savedPolicies,
      issues: createdIssues,
    });
  } catch (error: unknown) {
    console.error('Ingestion route error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Internal server error during data ingestion';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
