import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { evaluateMerchantReadiness } from '../../../lib/engine/evaluator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantSlug } = body;

    if (!merchantSlug || typeof merchantSlug !== 'string') {
      return NextResponse.json(
        { error: 'merchantSlug is required and must be a string' },
        { status: 400 }
      );
    }

    const merchant = await prisma.merchant.findUnique({
      where: { slug: merchantSlug },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: `Merchant with slug "${merchantSlug}" not found` },
        { status: 404 }
      );
    }

    const evaluation = await evaluateMerchantReadiness(merchant.id);

    return NextResponse.json({
      success: true,
      merchantSlug: evaluation.merchantSlug,
      merchantName: evaluation.merchantName,
      readinessScore: evaluation.readinessScore,
      transactionStatus: evaluation.transactionStatus,
      invariants: evaluation.invariants,
      scoreBreakdown: evaluation.scoreBreakdown,
      evaluatedAt: evaluation.evaluatedAt,
    });
  } catch (error: unknown) {
    console.error('Readiness evaluation POST error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Internal server error during readiness evaluation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { error: 'slug query parameter is required' },
        { status: 400 }
      );
    }

    const merchant = await prisma.merchant.findUnique({
      where: { slug },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            priceVerified: true,
            inventory: true,
            inventoryVerified: true,
            status: true,
          },
        },
        policies: {
          select: {
            id: true,
            type: true,
            content: true,
            isVerified: true,
          },
        },
        issues: {
          select: {
            id: true,
            severity: true,
            category: true,
            title: true,
            description: true,
            resolved: true,
          },
        },
      },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: `Merchant with slug "${slug}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      merchantSlug: merchant.slug,
      merchantName: merchant.name,
      readinessScore: merchant.readinessScore,
      transactionStatus: merchant.transactionStatus,
      productsCount: merchant.products.length,
      policiesCount: merchant.policies.length,
      issuesCount: merchant.issues.length,
      unresolvedCriticalIssuesCount: merchant.issues.filter(
        (i) => i.severity === 'CRITICAL' && !i.resolved
      ).length,
      updatedAt: merchant.updatedAt,
    });
  } catch (error: unknown) {
    console.error('Readiness evaluation GET error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Internal server error retrieving readiness status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
